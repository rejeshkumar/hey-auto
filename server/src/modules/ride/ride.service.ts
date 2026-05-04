import { RideStatus } from '@prisma/client';
import { prisma } from '../../config/database';
import { redis } from '../../config/redis';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { BadRequestError, NotFoundError } from '../../utils/errors';
import { haversineDistance, isNightTime, roundToRupee, generateRideOTP } from '../../utils/helpers';
import { driverService } from '../driver/driver.service';
import { mapsService } from '../../services/maps';
import { notificationService } from '../notification/notification.service';
import type { FareEstimateInput, RequestRideInput, CancelRideInput, RateRideInput } from './ride.schema';

const ACTIVE_RIDE_PREFIX = 'active_ride:';
const RIDE_REQUEST_PREFIX = 'ride_request:';

export class RideService {
  async getFareEstimate(input: FareEstimateInput) {
    const route = await mapsService.getRoute(
      { lat: input.pickupLat, lng: input.pickupLng },
      { lat: input.dropoffLat, lng: input.dropoffLng },
    );

    const distanceKm = route.distanceKm;
    const estimatedDurationMin = route.durationMin;

    const fareConfig = await prisma.fareConfig.findFirst({
      where: { city: input.city, isActive: true },
      orderBy: { effectiveFrom: 'desc' },
    });

    const baseFare         = fareConfig?.baseFare ?? 30;
    const baseDistanceKm   = fareConfig?.baseDistanceKm ?? 1.5;
    const perKmRate        = fareConfig?.perKmRate ?? 15;
    const perMinRate       = fareConfig?.perMinRate ?? 0;       // Kerala: 0 while moving
    const minFare          = fareConfig?.minFare ?? 30;
    const nightStart       = fareConfig?.nightStart ?? '22:00';
    const nightEnd         = fareConfig?.nightEnd ?? '05:00';
    const nightMultiplier  = fareConfig?.nightMultiplier ?? 1.5; // Kerala gazette: 50%
    const onwardEnabled    = fareConfig?.onwardSurchargeEnabled ?? true;
    const onwardPercent    = fareConfig?.onwardSurchargePercent ?? 50;

    // Step 1: base distance fare
    const distanceFare = distanceKm > baseDistanceKm
      ? (distanceKm - baseDistanceKm) * perKmRate
      : 0;

    // Step 2: time fare (0 by default per Kerala rules)
    const timeFare = estimatedDurationMin * perMinRate;

    let fare = baseFare + distanceFare + timeFare;

    // Step 3: night surcharge — 50% of total (Kerala gazette)
    let nightSurcharge = 0;
    const isNight = isNightTime(nightStart, nightEnd);
    if (isNight) {
      nightSurcharge = fare * (nightMultiplier - 1);
      fare += nightSurcharge;
    }

    // Step 4: onward-only surcharge — 50% of amount above minimum, daytime only
    // Applied when rider books a one-way trip in non-corporation towns (default: enabled)
    let onwardSurcharge = 0;
    if (!isNight && onwardEnabled && fare > minFare) {
      onwardSurcharge = (fare - minFare) * (onwardPercent / 100);
      fare += onwardSurcharge;
    }

    fare = Math.max(fare, minFare);

    return {
      baseFare: roundToRupee(baseFare),
      distanceFare: roundToRupee(distanceFare),
      timeFare: roundToRupee(timeFare),
      nightSurcharge: roundToRupee(nightSurcharge),
      onwardSurcharge: roundToRupee(onwardSurcharge),
      totalFare: roundToRupee(fare),
      distanceKm,
      durationMin: estimatedDurationMin,
      currency: 'INR',
      ratePerKm: perKmRate,
      polyline: route.polyline,
      steps: route.steps,
      startAddress: route.startAddress,
      endAddress: route.endAddress,
    };
  }

  async requestRide(riderId: string, input: RequestRideInput) {
    const existingRide = await prisma.ride.findFirst({
      where: {
        riderId,
        status: { in: ['REQUESTED', 'DRIVER_ASSIGNED', 'DRIVER_ARRIVED', 'OTP_VERIFIED', 'IN_PROGRESS'] },
      },
    });
    if (existingRide) {
      throw new BadRequestError('You already have an active ride');
    }

    const estimate = await this.getFareEstimate({
      pickupLat: input.pickupLat,
      pickupLng: input.pickupLng,
      dropoffLat: input.dropoffLat,
      dropoffLng: input.dropoffLng,
      city: input.city,
    });

    const rideOtp = generateRideOTP();

    const ride = await prisma.ride.create({
      data: {
        riderId,
        pickupLat: input.pickupLat,
        pickupLng: input.pickupLng,
        pickupAddress: input.pickupAddress,
        dropoffLat: input.dropoffLat,
        dropoffLng: input.dropoffLng,
        dropoffAddress: input.dropoffAddress,
        estimatedDistanceKm: estimate.distanceKm,
        estimatedDurationMin: estimate.durationMin,
        baseFare: estimate.baseFare,
        perKmRate: estimate.ratePerKm,
        perMinRate: estimate.durationMin > 0 ? estimate.timeFare / estimate.durationMin : 1.5,
        estimatedFare: estimate.totalFare,
        nightSurcharge: estimate.nightSurcharge,
        onwardSurcharge: estimate.onwardSurcharge,
        paymentMethod: input.paymentMethod,
        city: input.city,
        rideOtp,
        status: 'REQUESTED',
      },
    });

    await redis.setex(`${ACTIVE_RIDE_PREFIX}${riderId}`, 3600, ride.id);

    this.findDriver(ride.id, input.pickupLat, input.pickupLng, input.city).catch(async (err) => {
      logger.error({ err, rideId: ride.id }, 'findDriver crashed — reverting to NO_DRIVERS');
      try {
        await prisma.ride.update({ where: { id: ride.id }, data: { status: 'NO_DRIVERS' } });
        await redis.del(`${ACTIVE_RIDE_PREFIX}${riderId}`);
        await redis.publish(
          'ride_events',
          JSON.stringify({ type: 'ride:no_drivers', rideId: ride.id, riderId }),
        );
      } catch (fallbackErr) {
        logger.error({ fallbackErr, rideId: ride.id }, 'findDriver fallback also failed');
      }
    });

    logger.info({ rideId: ride.id, riderId }, 'Ride requested');

    return {
      ...ride,
      fareEstimate: estimate,
    };
  }

  private async findDriver(rideId: string, pickupLat: number, pickupLng: number, city: string) {
    const ride = await prisma.ride.findUnique({ where: { id: rideId } });
    if (!ride || ride.status !== 'REQUESTED') return;

    const nearbyDrivers = await driverService.getNearbyDrivers(
      pickupLat,
      pickupLng,
      env.DRIVER_SEARCH_RADIUS_KM,
    );

    const availableDrivers = [];
    for (const driver of nearbyDrivers) {
      const profile = await prisma.driverProfile.findUnique({
        where: { userId: driver.userId },
      });
      if (profile && !profile.isOnRide && profile.isOnline && profile.city === city) {
        availableDrivers.push({ ...driver, rating: profile.rating, acceptanceRate: profile.acceptanceRate });
      }
    }

    if (availableDrivers.length === 0) {
      await prisma.ride.update({
        where: { id: rideId },
        data: { status: 'NO_DRIVERS' },
      });
      await redis.del(`${ACTIVE_RIDE_PREFIX}${ride.riderId}`);
      await redis.publish('ride_events', JSON.stringify({ type: 'ride:no_drivers', rideId, riderId: ride.riderId }));
      notificationService.sendPushNotification(
        ride.riderId,
        '😔 No Drivers Available',
        'No drivers nearby right now. Please try again in a few minutes.',
        { type: 'ride:no_drivers', rideId },
      ).catch(() => {});
      return;
    }

    const scored = availableDrivers.map((d) => ({
      ...d,
      score:
        0.4 * (1 - d.distance / env.DRIVER_SEARCH_RADIUS_KM) +
        0.3 * (d.rating / 5) +
        0.2 * (d.acceptanceRate / 100) +
        0.1 * Math.random(),
    }));
    scored.sort((a, b) => b.score - a.score);

    const riderUser = await prisma.user.findUnique({
      where: { id: ride.riderId },
      select: { fullName: true, phone: true },
    });

    for (let round = 0; round < Math.min(scored.length, env.MAX_MATCHING_ROUNDS); round++) {
      const driver = scored[round];

      await redis.setex(
        `${RIDE_REQUEST_PREFIX}${driver.userId}`,
        env.RIDE_REQUEST_TIMEOUT_SEC,
        JSON.stringify({ rideId, round }),
      );

      await redis.publish(
        'ride_events',
        JSON.stringify({
          type: 'ride:new_request',
          driverId: driver.userId,
          rideId,
          pickupLat,
          pickupLng,
          pickupAddress: ride.pickupAddress,
          dropoffAddress: ride.dropoffAddress,
          estimatedFare: ride.estimatedFare,
          distance: driver.distance,
          riderName: riderUser?.fullName,
          riderPhone: riderUser?.phone,
        }),
      );

      // Push to driver if app is backgrounded
      notificationService.sendPushNotification(
        driver.userId,
        '🛺 New Ride Request',
        `${ride.pickupAddress} → ${ride.dropoffAddress} · ₹${ride.estimatedFare}`,
        { type: 'ride:new_request', rideId },
      ).catch(() => {});

      const accepted = await this.waitForDriverResponse(rideId, driver.userId);
      if (accepted) return;
    }

    await prisma.ride.update({
      where: { id: rideId },
      data: { status: 'NO_DRIVERS' },
    });
    await redis.del(`${ACTIVE_RIDE_PREFIX}${ride.riderId}`);
    await redis.publish('ride_events', JSON.stringify({ type: 'ride:no_drivers', rideId, riderId: ride.riderId }));
    notificationService.sendPushNotification(
      ride.riderId,
      '😔 No Drivers Available',
      'All nearby drivers are busy. Please try again shortly.',
      { type: 'ride:no_drivers', rideId },
    ).catch(() => {});
  }

  private async waitForDriverResponse(rideId: string, driverId: string): Promise<boolean> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve(false);
      }, env.RIDE_REQUEST_TIMEOUT_SEC * 1000);

      const checkInterval = setInterval(async () => {
        const ride = await prisma.ride.findUnique({ where: { id: rideId } });
        if (ride?.status === 'DRIVER_ASSIGNED' && ride?.driverId === driverId) {
          clearTimeout(timeout);
          clearInterval(checkInterval);
          // 500ms settling delay — lets the accept transaction fully commit before
          // the next matching round inspects the ride row (prevents false re-dispatch)
          await new Promise<void>((r) => setTimeout(r, 500));
          resolve(true);
        }
        if (ride?.status !== 'REQUESTED') {
          clearTimeout(timeout);
          clearInterval(checkInterval);
          resolve(false);
        }
      }, 2000);
    });
  }

  async acceptRide(driverId: string, rideId: string) {
    const ride = await prisma.ride.findUnique({ where: { id: rideId } });
    if (!ride) throw new NotFoundError('Ride not found');
    if (ride.status !== 'REQUESTED') {
      throw new BadRequestError('This ride is no longer available');
    }

    const profile = await prisma.driverProfile.findUnique({
      where: { userId: driverId },
      include: { vehicles: { where: { isActive: true }, take: 1 } },
    });
    if (!profile) throw new NotFoundError('Driver profile not found');

    const vehicle = profile.vehicles[0];
    if (!vehicle) throw new BadRequestError('No active vehicle found');

    const updatedRide = await prisma.ride.update({
      where: { id: rideId },
      data: {
        driverId,
        vehicleId: vehicle.id,
        status: 'DRIVER_ASSIGNED',
        acceptedAt: new Date(),
      },
    });

    await prisma.driverProfile.update({
      where: { userId: driverId },
      data: { isOnRide: true },
    });

    await redis.del(`${RIDE_REQUEST_PREFIX}${driverId}`);

    const driverUser = await prisma.user.findUnique({ where: { id: driverId } });

    await redis.publish(
      'ride_events',
      JSON.stringify({
        type: 'ride:driver_assigned',
        rideId,
        riderId: ride.riderId,
        driverId,
        driverName: driverUser?.fullName,
        driverPhone: driverUser?.phone,
        driverRating: profile.rating,
        vehicleRegistrationNo: vehicle.registrationNo,
        vehicleColor: vehicle.color,
        vehicleModel: vehicle.model,
        driverLat: profile.currentLat,
        driverLng: profile.currentLng,
      }),
    );

    notificationService.sendPushNotification(
      ride.riderId,
      '✅ Driver Found!',
      `${driverUser?.fullName || 'Your driver'} is on the way · ${vehicle.registrationNo}`,
      { type: 'ride:driver_assigned', rideId },
    ).catch(() => {});

    logger.info({ rideId, driverId }, 'Ride accepted by driver');
    return updatedRide;
  }

  async declineRide(driverId: string, rideId: string) {
    await redis.del(`${RIDE_REQUEST_PREFIX}${driverId}`);

    const profile = await prisma.driverProfile.findUnique({ where: { userId: driverId } });
    if (profile) {
      const newRate = Math.max(0, profile.acceptanceRate - 2);
      await prisma.driverProfile.update({
        where: { userId: driverId },
        data: { acceptanceRate: newRate },
      });
    }

    logger.info({ rideId, driverId }, 'Ride declined by driver');
    return { message: 'Ride declined' };
  }

  async driverArrived(driverId: string, rideId: string) {
    const ride = await prisma.ride.findUnique({ where: { id: rideId } });
    if (!ride || ride.driverId !== driverId) throw new NotFoundError('Ride not found');
    if (ride.status !== 'DRIVER_ASSIGNED') throw new BadRequestError('Invalid ride state');

    const updated = await prisma.ride.update({
      where: { id: rideId },
      data: { status: 'DRIVER_ARRIVED', arrivedAt: new Date() },
    });

    await redis.publish('ride_events', JSON.stringify({
      type: 'ride:driver_arrived',
      rideId,
      riderId: ride.riderId,
      rideOtp: ride.rideOtp,
    }));

    notificationService.sendPushNotification(
      ride.riderId,
      '📍 Driver Arrived',
      `Your driver is waiting. Show OTP: ${ride.rideOtp}`,
      { type: 'ride:driver_arrived', rideId },
    ).catch(() => {});

    return updated;
  }

  async verifyRideOtp(driverId: string, rideId: string, otp: string) {
    const ride = await prisma.ride.findUnique({ where: { id: rideId } });
    if (!ride || ride.driverId !== driverId) throw new NotFoundError('Ride not found');
    if (ride.status !== 'DRIVER_ARRIVED') throw new BadRequestError('Driver has not arrived yet');
    if (ride.rideOtp !== otp) throw new BadRequestError('Invalid OTP');

    const updated = await prisma.ride.update({
      where: { id: rideId },
      data: { status: 'OTP_VERIFIED' },
    });

    return updated;
  }

  async startRide(driverId: string, rideId: string) {
    const ride = await prisma.ride.findUnique({ where: { id: rideId } });
    if (!ride || ride.driverId !== driverId) throw new NotFoundError('Ride not found');
    if (ride.status !== 'OTP_VERIFIED') throw new BadRequestError('OTP not verified yet');

    const updated = await prisma.ride.update({
      where: { id: rideId },
      data: { status: 'IN_PROGRESS', startedAt: new Date() },
    });

    await redis.publish('ride_events', JSON.stringify({
      type: 'ride:started',
      rideId,
      riderId: ride.riderId,
      driverId,
    }));

    logger.info({ rideId, driverId }, 'Ride started');
    return updated;
  }

  async completeRide(driverId: string, rideId: string) {
    const ride = await prisma.ride.findUnique({ where: { id: rideId } });
    if (!ride || ride.driverId !== driverId) throw new NotFoundError('Ride not found');
    if (ride.status !== 'IN_PROGRESS') throw new BadRequestError('Ride is not in progress');

    const driverProfile = await prisma.driverProfile.findUnique({ where: { userId: driverId } });
    if (!driverProfile) throw new NotFoundError('Driver not found');

    const actualDistanceKm = haversineDistance(
      ride.pickupLat,
      ride.pickupLng,
      ride.dropoffLat,
      ride.dropoffLng,
    );
    const startedAt = ride.startedAt ?? new Date();
    const actualDurationMin = Math.ceil((Date.now() - startedAt.getTime()) / 60000);

    let actualFare = ride.baseFare ?? 30;
    const baseDistanceKm = 1.5;
    if (actualDistanceKm > baseDistanceKm) {
      actualFare += (actualDistanceKm - baseDistanceKm) * (ride.perKmRate ?? 15);
    }
    actualFare += actualDurationMin * (ride.perMinRate ?? 1.5);
    actualFare += ride.nightSurcharge;
    actualFare = Math.max(actualFare, 30);
    actualFare = roundToRupee(actualFare);

    const totalAmount = actualFare + ride.tipAmount;

    const updated = await prisma.ride.update({
      where: { id: rideId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        actualDistanceKm,
        actualDurationMin,
        actualFare,
        totalAmount,
        paymentStatus: ride.paymentMethod === 'CASH' ? 'COMPLETED' : 'PENDING',
      },
    });

    await prisma.driverProfile.update({
      where: { userId: driverId },
      data: {
        isOnRide: false,
        totalRides: { increment: 1 },
        totalEarnings: { increment: totalAmount },
      },
    });

    await prisma.riderProfile.update({
      where: { userId: ride.riderId },
      data: { totalRides: { increment: 1 } },
    });

    await redis.del(`${ACTIVE_RIDE_PREFIX}${ride.riderId}`);

    await redis.publish('ride_events', JSON.stringify({
      type: 'ride:completed',
      rideId,
      riderId: ride.riderId,
      driverId,
      actualFare,
      totalAmount,
      actualDistanceKm,
      actualDurationMin,
      paymentMethod: ride.paymentMethod,
    }));

    notificationService.sendPushNotification(
      ride.riderId,
      '🏁 Ride Completed',
      `Total fare: ₹${totalAmount} · ${actualDistanceKm.toFixed(1)} km · ${actualDurationMin} min`,
      { type: 'ride:completed', rideId },
    ).catch(() => {});

    logger.info({ rideId, driverId, totalAmount }, 'Ride completed');
    return updated;
  }

  async cancelRide(userId: string, rideId: string, input: CancelRideInput, role: 'RIDER' | 'DRIVER') {
    const ride = await prisma.ride.findUnique({ where: { id: rideId } });
    if (!ride) throw new NotFoundError('Ride not found');

    const cancelableStatuses: RideStatus[] = ['REQUESTED', 'DRIVER_ASSIGNED', 'DRIVER_ARRIVED'];
    if (!cancelableStatuses.includes(ride.status)) {
      throw new BadRequestError('Cannot cancel ride in current state');
    }

    const status: RideStatus = role === 'RIDER' ? 'CANCELLED_RIDER' : 'CANCELLED_DRIVER';

    const updated = await prisma.ride.update({
      where: { id: rideId },
      data: {
        status,
        cancelledAt: new Date(),
        cancellationReason: input.reason,
      },
    });

    if (ride.driverId) {
      await prisma.driverProfile.update({
        where: { userId: ride.driverId },
        data: { isOnRide: false },
      });
    }

    await redis.del(`${ACTIVE_RIDE_PREFIX}${ride.riderId}`);

    await redis.publish('ride_events', JSON.stringify({
      type: 'ride:cancelled',
      rideId,
      riderId: ride.riderId,
      driverId: ride.driverId,
      cancelledBy: role,
      reason: input.reason,
    }));

    // Notify the other party
    if (role === 'RIDER' && ride.driverId) {
      notificationService.sendPushNotification(
        ride.driverId,
        '❌ Ride Cancelled',
        `Rider cancelled the ride`,
        { type: 'ride:cancelled', rideId },
      ).catch(() => {});
    } else if (role === 'DRIVER') {
      notificationService.sendPushNotification(
        ride.riderId,
        '❌ Ride Cancelled',
        `Driver cancelled. We'll find you another driver.`,
        { type: 'ride:cancelled', rideId },
      ).catch(() => {});
    }

    logger.info({ rideId, cancelledBy: role }, 'Ride cancelled');
    return updated;
  }

  async rateRide(userId: string, rideId: string, input: RateRideInput) {
    const ride = await prisma.ride.findUnique({ where: { id: rideId } });
    if (!ride) throw new NotFoundError('Ride not found');
    if (ride.status !== 'COMPLETED') throw new BadRequestError('Can only rate completed rides');

    const isRider = ride.riderId === userId;
    const ratedUser = isRider ? ride.driverId! : ride.riderId;

    const rating = await prisma.rating.create({
      data: {
        rideId,
        ratedBy: userId,
        ratedUser,
        rating: input.rating,
        review: input.review,
      },
    });

    const allRatings = await prisma.rating.findMany({
      where: { ratedUser },
      select: { rating: true },
    });
    const avgRating = allRatings.reduce((sum, r) => sum + r.rating, 0) / allRatings.length;

    if (isRider && ride.driverId) {
      await prisma.driverProfile.update({
        where: { userId: ride.driverId },
        data: { rating: Math.round(avgRating * 100) / 100 },
      });
    } else {
      await prisma.riderProfile.update({
        where: { userId: ride.riderId },
        data: { rating: Math.round(avgRating * 100) / 100 },
      });
    }

    if (input.tipAmount && input.tipAmount > 0 && isRider) {
      await prisma.ride.update({
        where: { id: rideId },
        data: {
          tipAmount: input.tipAmount,
          totalAmount: (ride.totalAmount ?? ride.actualFare ?? 0) + input.tipAmount,
        },
      });
    }

    return rating;
  }

  async getRideDetails(userId: string, rideId: string) {
    const ride = await prisma.ride.findUnique({
      where: { id: rideId },
      include: {
        rider: { select: { id: true, fullName: true, phone: true, avatarUrl: true } },
        driver: { select: { id: true, fullName: true, phone: true, avatarUrl: true } },
        vehicle: true,
        ratings: true,
        payments: true,
      },
    });

    if (!ride) throw new NotFoundError('Ride not found');
    if (ride.riderId !== userId && ride.driverId !== userId) {
      throw new NotFoundError('Ride not found');
    }

    return ride;
  }
}

export const rideService = new RideService();
