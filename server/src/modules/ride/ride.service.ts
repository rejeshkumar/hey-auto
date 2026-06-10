import { RideStatus } from '@prisma/client';
import { prisma } from '../../config/database';
import { redis } from '../../config/redis';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { BadRequestError, NotFoundError, ForbiddenError } from '../../utils/errors';
import { haversineDistance, isNightTime, roundToRupee, generateRideOTP } from '../../utils/helpers';
import { driverService } from '../driver/driver.service';
import { mapsService } from '../../services/maps';
import { notificationService } from '../notification/notification.service';
import type { FareEstimateInput, RequestRideInput, CancelRideInput, RateRideInput } from './ride.schema';
import {
  ACTIVE_RIDE_PREFIX,
  RIDE_REQUEST_PREFIX,
  POOL_RADIUS_STEP_PREFIX,
  POOL_BATCH_NUM_PREFIX,
  BLOCKLIST_SEARCH_PREFIX,
  BLOCKLIST_RIDER_PREFIX,
  PREV_ATTEMPTED_PREFIX,
  addToBlocklist,
  getBlocklistMembers,
} from './ride.redis-keys';

interface ScoredDriver {
  userId: string;
  distance: number;
  score: number;
}

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

    // Parcel surcharge
    let parcelSurcharge = 0;
    if (input.rideType === 'PARCEL') {
      parcelSurcharge = fareConfig?.parcelSurcharge ?? 20;
      fare += parcelSurcharge;
    }

    return {
      baseFare: roundToRupee(baseFare),
      distanceFare: roundToRupee(distanceFare),
      timeFare: roundToRupee(timeFare),
      nightSurcharge: roundToRupee(nightSurcharge),
      onwardSurcharge: roundToRupee(onwardSurcharge),
      parcelSurcharge: roundToRupee(parcelSurcharge),
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
      rideType: input.rideType ?? 'PASSENGER',
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
        rideType: (input.rideType ?? 'PASSENGER') as any,
        parcelDescription: input.parcelDescription,
        recipientName: input.recipientName,
        recipientPhone: input.recipientPhone,
      },
    });

    await redis.setex(`${ACTIVE_RIDE_PREFIX}${riderId}`, 3600, ride.id);

    this.findDriver(ride.id, input.pickupLat, input.pickupLng, input.dropoffLat, input.dropoffLng, input.city, input.rideType ?? 'PASSENGER').catch(async (err) => {
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

  private scoreDriver(driver: {
    distance: number;
    rating: number;
    acceptanceRate: number;
    cancellationRate: number;
    onlineSince: Date | null;
    ridesLast24h: number;
    radiusKm: number;
    isGoHomeMode: boolean;
    homeLat: number | null;
    homeLng: number | null;
    dropoffLat: number;
    dropoffLng: number;
  }): number {
    const onlineMinutes = driver.onlineSince
      ? (Date.now() - driver.onlineSince.getTime()) / 60000
      : 0;

    const proximityScore      = Math.max(0, Math.min(1, 1 - driver.distance / driver.radiusKm));
    const ratingScore         = (driver.rating - 1) / 4;
    const acceptanceScore     = driver.acceptanceRate / 100;
    const cancellationScore   = 1 - (driver.cancellationRate / 100);
    const availableTimeScore  = Math.min(onlineMinutes / 60, 1);
    const rideFrequencyScore  = Math.max(0, 1 - (driver.ridesLast24h / 20));

    // Go-home bonus: driver in go-home mode and dropoff is near their home
    const goHomeScore = (driver.isGoHomeMode && driver.homeLat && driver.homeLng)
      ? Math.max(0, 1 - haversineDistance(driver.dropoffLat, driver.dropoffLng, driver.homeLat, driver.homeLng) / 1.0)
      : 0;

    const wP = env.SCORE_W_PROXIMITY;
    const wR = env.SCORE_W_RATING;
    const wA = env.SCORE_W_ACCEPTANCE;
    const wC = env.SCORE_W_CANCELLATION;
    const wT = env.SCORE_W_AVAILABLE_TIME;
    const wF = env.SCORE_W_RIDE_FREQUENCY;
    const wG = env.SCORE_W_GO_HOME;
    const totalW = wP + wR + wA + wC + wT + wF + wG;

    return (
      wP * proximityScore +
      wR * ratingScore +
      wA * acceptanceScore +
      wC * cancellationScore +
      wT * availableTimeScore +
      wF * rideFrequencyScore +
      wG * goHomeScore
    ) / totalW;
  }

  private async computeRidesLast24h(driverId: string): Promise<number> {
    const windowStart = new Date(Date.now() - 24 * 3600 * 1000);
    return prisma.ride.count({
      where: { driverId, status: 'COMPLETED', completedAt: { gte: windowStart } },
    });
  }

  private async prepareDriverBatch(
    rideId: string,
    riderId: string,
    pickupLat: number,
    pickupLng: number,
    dropoffLat: number,
    dropoffLng: number,
    city: string,
    radiusKm: number,
    rideType: string = 'PASSENGER',
  ): Promise<ScoredDriver[]> {
    let nearbyDrivers = await driverService.getNearbyDrivers(pickupLat, pickupLng, radiusKm);

    // Rebuild Redis geo index from DB if empty (redeploy recovery)
    if (nearbyDrivers.length === 0) {
      const allWithLocation = await prisma.driverProfile.findMany({
        where: { currentLat: { not: null }, currentLng: { not: null } },
        select: { userId: true, currentLat: true, currentLng: true, isOnline: true },
      });
      logger.info({ total: allWithLocation.length, online: allWithLocation.filter(d => d.isOnline).length }, 'prepareDriverBatch: Redis geo empty, rebuilding from DB');
      for (const d of allWithLocation) {
        await redis.geoadd('driver_locations', d.currentLng!, d.currentLat!, d.userId);
        // Set online key for ALL drivers with location — let DB filter handle online state
        await redis.set(`driver_online:${d.userId}`, '1');
      }
      nearbyDrivers = await driverService.getNearbyDrivers(pickupLat, pickupLng, radiusKm);
      logger.info({ nearbyCount: nearbyDrivers.length, radiusKm }, 'prepareDriverBatch: after rebuild');
    }

    // Load all 3 blocklists and build excluded set
    const [searchBlock, riderBlock, prevAttempted] = await Promise.all([
      getBlocklistMembers(`${BLOCKLIST_SEARCH_PREFIX}${rideId}`),
      getBlocklistMembers(`${BLOCKLIST_RIDER_PREFIX}${riderId}`),
      getBlocklistMembers(`${PREV_ATTEMPTED_PREFIX}${rideId}`),
    ]);
    const excluded = new Set([...searchBlock, ...riderBlock, ...prevAttempted]);

    const candidateIds = nearbyDrivers
      .filter((d) => !excluded.has(d.userId))
      .map((d) => d.userId);

    if (candidateIds.length === 0) return [];

    // Single batch DB query for all candidate profiles
    const profiles = await prisma.driverProfile.findMany({
      where: { userId: { in: candidateIds } },
    });
    const profileMap = new Map(profiles.map((p) => [p.userId, p]));

    const validCandidates = nearbyDrivers.filter((d) => {
      if (excluded.has(d.userId)) return false;
      const p = profileMap.get(d.userId);
      if (!p) { logger.info({ userId: d.userId }, 'prepareDriverBatch: no profile found'); return false; }
      if (!p.isOnline) { logger.info({ userId: d.userId, isOnline: p.isOnline }, 'prepareDriverBatch: driver not online'); return false; }
      if (p.isOnRide) { logger.info({ userId: d.userId }, 'prepareDriverBatch: driver on ride'); return false; }
      if (p.city.toLowerCase() !== city.toLowerCase()) { logger.info({ driverCity: p.city, searchCity: city }, 'prepareDriverBatch: city mismatch'); return false; }
      if (rideType === 'PARCEL' && !p.acceptsParcels) return false;
      return true;
    });

    logger.info({ nearbyCount: nearbyDrivers.length, candidateCount: candidateIds.length, validCount: validCandidates.length, city, radiusKm }, 'prepareDriverBatch: filter results');

    if (validCandidates.length === 0) return [];

    // Compute ridesLast24h in parallel for all valid candidates
    const ridesLast24hList = await Promise.all(
      validCandidates.map((d) => this.computeRidesLast24h(d.userId)),
    );

    const scored = validCandidates.map((d, i) => {
      const p = profileMap.get(d.userId)!;
      return {
        userId: d.userId,
        distance: d.distance,
        score: this.scoreDriver({
          distance: d.distance,
          rating: p.rating,
          acceptanceRate: p.acceptanceRate,
          cancellationRate: p.cancellationRate,
          onlineSince: p.onlineSince,
          ridesLast24h: ridesLast24hList[i],
          radiusKm,
          isGoHomeMode: p.isGoHomeMode,
          homeLat: p.homeLat,
          homeLng: p.homeLng,
          dropoffLat,
          dropoffLng,
        }),
      };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, env.BATCH_SIZE);
  }

  private async waitForBatchResponse(rideId: string, driverIds: string[]): Promise<boolean> {
    const driverSet = new Set(driverIds);
    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(false), env.RIDE_REQUEST_TIMEOUT_SEC * 1000);

      const checkInterval = setInterval(async () => {
        const ride = await prisma.ride.findUnique({ where: { id: rideId } });
        if (ride?.status === 'DRIVER_ASSIGNED' && ride.driverId && driverSet.has(ride.driverId)) {
          clearTimeout(timeout);
          clearInterval(checkInterval);
          // 500ms settling delay — lets the accept transaction fully commit
          await new Promise<void>((r) => setTimeout(r, 500));
          resolve(true);
        } else if (ride?.status !== 'REQUESTED') {
          clearTimeout(timeout);
          clearInterval(checkInterval);
          resolve(false);
        }
      }, 2000);
    });
  }

  private async findDriver(rideId: string, pickupLat: number, pickupLng: number, dropoffLat: number, dropoffLng: number, city: string, rideType: string = 'PASSENGER') {
    const ride = await prisma.ride.findUnique({ where: { id: rideId } });
    if (!ride || ride.status !== 'REQUESTED') return;

    const riderId = ride.riderId;

    // Restore pool state from Redis (survives process restarts within TTL)
    const [stepRaw, batchRaw] = await Promise.all([
      redis.get(`${POOL_RADIUS_STEP_PREFIX}${rideId}`),
      redis.get(`${POOL_BATCH_NUM_PREFIX}${rideId}`),
    ]);
    let stepCount = stepRaw ? parseInt(stepRaw, 10) : 0;
    let batchNum  = batchRaw ? parseInt(batchRaw, 10) : 0;

    let radiusKm = Math.min(
      env.MIN_SEARCH_RADIUS_KM + stepCount * env.RADIUS_STEP_KM,
      env.MAX_SEARCH_RADIUS_KM,
    );

    const riderUser = await prisma.user.findUnique({
      where: { id: riderId },
      select: { fullName: true, phone: true },
    });

    // Always rebuild Redis geo from DB on each findDriver call to handle server restarts
    const onlineDrivers = await prisma.driverProfile.findMany({
      where: { isOnline: true, currentLat: { not: null }, currentLng: { not: null } },
      select: { userId: true, currentLat: true, currentLng: true },
    });
    logger.info({ count: onlineDrivers.length, city }, 'findDriver: syncing Redis geo from DB');
    for (const d of onlineDrivers) {
      await redis.geoadd('driver_locations', d.currentLng!, d.currentLat!, d.userId);
      await redis.set(`driver_online:${d.userId}`, '1');
    }

    // Queue-first: if pickup is near a stand, offer queue members sequentially (#1 → #2 → #3 → city batch)
    let nearbyStands: any[] = [];
    try {
      nearbyStands = await prisma.$queryRaw`
        SELECT id, name, city, lat, lng,
               COALESCE(radius_meters, 100) as "radiusMeters",
               is_active as "isActive"
        FROM auto_stands
        WHERE city = ${city} AND is_active = true
      `;
    } catch {
      // auto_stands table may not exist yet — skip queue logic
    }
    for (const stand of nearbyStands) {
      const distM = haversineDistance(pickupLat, pickupLng, stand.lat, stand.lng) * 1000;
      if (distM <= stand.radiusMeters * 2) {
        // Load the full queue ordered by join time
        const queueEntries = await prisma.standQueueEntry.findMany({
          where: { standId: stand.id },
          orderBy: { joinedAt: 'asc' },
        });

        for (let qi = 0; qi < queueEntries.length; qi++) {
          const entry = queueEntries[qi];
          const profile = await prisma.driverProfile.findUnique({ where: { id: entry.driverId } });
          if (!profile || !profile.isOnline || profile.isOnRide) continue; // skip unavailable drivers

          const queuePosition = qi + 1;
          logger.info({ rideId, standName: stand.name, driverId: profile.userId, queuePosition }, 'findDriver: queue offer');

          await redis.setex(
            `${RIDE_REQUEST_PREFIX}${profile.userId}`,
            env.RIDE_REQUEST_TIMEOUT_SEC,
            JSON.stringify({ rideId, batchNum: -1, queueFirst: true }),
          );
          await redis.publish('ride_events', JSON.stringify({
            type: 'ride:new_request',
            driverId: profile.userId,
            rideId,
            pickupLat, pickupLng,
            pickupAddress: ride.pickupAddress,
            dropoffAddress: ride.dropoffAddress,
            estimatedFare: ride.estimatedFare,
            distance: distM / 1000,
            riderName: riderUser?.fullName,
            riderPhone: riderUser?.phone,
            timeoutSec: env.RIDE_REQUEST_TIMEOUT_SEC,
            rideType: ride.rideType,
            queuePosition,
            standName: stand.name,
          }));
          notificationService.sendPushNotification(
            profile.userId,
            `🚏 Queue Ride — #${queuePosition} in line`,
            `${ride.pickupAddress} → ${ride.dropoffAddress} · ₹${ride.estimatedFare}`,
            { type: 'ride:new_request', rideId },
          ).catch((err: unknown) => logger.warn({ err }, 'Push notification failed'));

          const accepted = await this.waitForBatchResponse(rideId, [profile.userId]);
          await redis.del(`${RIDE_REQUEST_PREFIX}${profile.userId}`);

          if (accepted) {
            await redis.del(`${POOL_RADIUS_STEP_PREFIX}${rideId}`, `${POOL_BATCH_NUM_PREFIX}${rideId}`);
            return;
          }
          // Driver declined/timed out — penalise and move to next in queue
          await addToBlocklist(`${PREV_ATTEMPTED_PREFIX}${rideId}`, profile.userId, 3600);
        }

        break; // Only process the closest matching stand
      }
    }

    while (batchNum < env.MAX_BATCH_ROUNDS) {
      const batch = await this.prepareDriverBatch(rideId, riderId, pickupLat, pickupLng, dropoffLat, dropoffLng, city, radiusKm, rideType);

      if (batch.length === 0) {
        if (radiusKm < env.MAX_SEARCH_RADIUS_KM) {
          // Expand radius and retry without consuming a batch round
          stepCount++;
          radiusKm = Math.min(env.MIN_SEARCH_RADIUS_KM + stepCount * env.RADIUS_STEP_KM, env.MAX_SEARCH_RADIUS_KM);
          await redis.setex(`${POOL_RADIUS_STEP_PREFIX}${rideId}`, env.POOL_STATE_TTL_SEC, String(stepCount));
          logger.info({ rideId, stepCount, radiusKm }, 'findDriver: no candidates, expanding radius');
          continue;
        }
        // At max radius with no drivers — give up
        break;
      }

      logger.info({ rideId, batchNum, radiusKm, batchSize: batch.length }, 'findDriver: dispatching batch');

      // Dispatch all drivers in batch simultaneously
      await Promise.all(batch.map(async (driver) => {
        await redis.setex(
          `${RIDE_REQUEST_PREFIX}${driver.userId}`,
          env.RIDE_REQUEST_TIMEOUT_SEC,
          JSON.stringify({ rideId, batchNum }),
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
            timeoutSec: env.RIDE_REQUEST_TIMEOUT_SEC,
            rideType: ride.rideType,
            parcelDescription: ride.parcelDescription,
            recipientName: ride.recipientName,
          }),
        );
        notificationService.sendPushNotification(
          driver.userId,
          '🛺 New Ride Request',
          `${ride.pickupAddress} → ${ride.dropoffAddress} · ₹${ride.estimatedFare}`,
          { type: 'ride:new_request', rideId },
        ).catch((err: unknown) => logger.warn({ err }, 'Push notification failed'));
      }));

      const accepted = await this.waitForBatchResponse(rideId, batch.map((d) => d.userId));

      if (accepted) {
        // Clean up ride_request keys for drivers that didn't accept in this batch
        await Promise.all(
          batch.map((d) => redis.del(`${RIDE_REQUEST_PREFIX}${d.userId}`)),
        );
        await redis.del(`${POOL_RADIUS_STEP_PREFIX}${rideId}`, `${POOL_BATCH_NUM_PREFIX}${rideId}`);
        return;
      }

      // Timeout — drivers that still have a ride_request key didn't respond (timeout = cancel)
      await Promise.all(batch.map(async (driver) => {
        const stillPending = await redis.get(`${RIDE_REQUEST_PREFIX}${driver.userId}`);
        if (stillPending) {
          await addToBlocklist(`${PREV_ATTEMPTED_PREFIX}${rideId}`, driver.userId, 3600);
          // Treat timeout same as cancel — increment cancellationRate
          const profile = await prisma.driverProfile.findUnique({ where: { userId: driver.userId } });
          if (profile) {
            await prisma.driverProfile.update({
              where: { userId: driver.userId },
              data: { cancellationRate: Math.min(100, profile.cancellationRate + 2) },
            });
          }
          await redis.del(`${RIDE_REQUEST_PREFIX}${driver.userId}`);
        }
      }));

      batchNum++;
      stepCount++;
      radiusKm = Math.min(env.MIN_SEARCH_RADIUS_KM + stepCount * env.RADIUS_STEP_KM, env.MAX_SEARCH_RADIUS_KM);
      await redis.setex(`${POOL_BATCH_NUM_PREFIX}${rideId}`, env.POOL_STATE_TTL_SEC, String(batchNum));
      await redis.setex(`${POOL_RADIUS_STEP_PREFIX}${rideId}`, env.POOL_STATE_TTL_SEC, String(stepCount));

      logger.info({ rideId, batchNum, radiusKm }, 'findDriver: batch timed out, next round');
    }

    // NO_DRIVERS — all rounds exhausted
    await prisma.ride.update({ where: { id: rideId }, data: { status: 'NO_DRIVERS' } });
    await redis.del(`${ACTIVE_RIDE_PREFIX}${riderId}`);
    await redis.del(`${POOL_RADIUS_STEP_PREFIX}${rideId}`, `${POOL_BATCH_NUM_PREFIX}${rideId}`);
    await redis.publish('ride_events', JSON.stringify({ type: 'ride:no_drivers', rideId, riderId }));
    notificationService.sendPushNotification(
      riderId,
      '😔 No Drivers Available',
      'No drivers available nearby. Please try again in a few minutes.',
      { type: 'ride:no_drivers', rideId },
    ).catch((err: unknown) => logger.warn({ err }, 'Push notification failed'));
  }

  async acceptRide(driverId: string, rideId: string) {
    const ride = await prisma.ride.findUnique({ where: { id: rideId } });
    if (!ride) throw new NotFoundError('Ride not found');
    if (ride.status !== 'REQUESTED') {
      throw new BadRequestError('This ride is no longer available');
    }

    // Verify this ride was actually offered to this driver
    const pending = await redis.get(`${RIDE_REQUEST_PREFIX}${driverId}`);
    const pendingData = pending ? JSON.parse(pending) : null;
    if (!pendingData || pendingData.rideId !== rideId) {
      throw new ForbiddenError('This ride was not offered to you');
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
    await redis.del(`${POOL_RADIUS_STEP_PREFIX}${rideId}`, `${POOL_BATCH_NUM_PREFIX}${rideId}`);

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
    ).catch((err: unknown) => logger.warn({ err }, 'Push notification failed'));

    logger.info({ rideId, driverId }, 'Ride accepted by driver');
    return updatedRide;
  }

  async declineRide(driverId: string, rideId: string) {
    await redis.del(`${RIDE_REQUEST_PREFIX}${driverId}`);

    // Add to search blocklist and prev-attempted so this driver is excluded from future rounds
    await Promise.all([
      addToBlocklist(`${BLOCKLIST_SEARCH_PREFIX}${rideId}`, driverId, 3600),
      addToBlocklist(`${PREV_ATTEMPTED_PREFIX}${rideId}`, driverId, 3600),
    ]);

    const profile = await prisma.driverProfile.findUnique({ where: { userId: driverId } });
    if (profile) {
      await prisma.driverProfile.update({
        where: { userId: driverId },
        data: {
          acceptanceRate: Math.max(0, profile.acceptanceRate - 2),
          cancellationRate: Math.min(100, profile.cancellationRate + 2),
        },
      });
    }

    logger.info({ rideId, driverId }, 'Ride declined by driver');
    return { message: 'Ride declined' };
  }

  async driverArrived(driverId: string, rideId: string) {
    const ride = await prisma.ride.findUnique({ where: { id: rideId } });
    if (!ride || ride.driverId !== driverId) throw new NotFoundError('Ride not found');
    if (ride.status !== 'DRIVER_ASSIGNED') throw new BadRequestError('Invalid ride state');

    const driverProfile = await prisma.driverProfile.findUnique({ where: { userId: driverId } });
    if (driverProfile?.currentLat && driverProfile?.currentLng) {
      const distanceKm = haversineDistance(
        driverProfile.currentLat, driverProfile.currentLng,
        ride.pickupLat, ride.pickupLng,
      );
      if (distanceKm > env.ARRIVAL_PROXIMITY_THRESHOLD_KM) {
        throw new BadRequestError(
          `You are ${Math.round(distanceKm * 1000)}m away from the pickup. Move closer before marking arrived.`,
        );
      }
    }

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
    ).catch((err: unknown) => logger.warn({ err }, 'Push notification failed'));

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
        isGoHomeMode: false,
        totalRides: { increment: 1 },
        totalEarnings: { increment: totalAmount },
      },
    });

    // Award coins: 1 coin per ₹10 earned
    const coinsToAward = Math.floor(totalAmount / 10);
    if (coinsToAward > 0) {
      await prisma.driverProfile.update({
        where: { userId: driverId },
        data: { coinsBalance: { increment: coinsToAward }, coinsEarned: { increment: coinsToAward } },
      });
      await prisma.coinTransaction.create({
        data: {
          driverId: driverProfile.id,
          amount: coinsToAward,
          type: 'EARNED',
          rideId,
          description: `Ride completed — ₹${totalAmount}`,
        },
      });
    }

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
    ).catch((err: unknown) => logger.warn({ err }, 'Push notification failed'));

    logger.info({ rideId, driverId, totalAmount }, 'Ride completed');
    return updated;
  }

  async cancelRide(userId: string, rideId: string, input: CancelRideInput, role: 'RIDER' | 'DRIVER') {
    const ride = await prisma.ride.findUnique({ where: { id: rideId } });
    if (!ride) throw new NotFoundError('Ride not found');

    // Ownership check — a rider can only cancel their own ride, driver only rides assigned to them
    if (role === 'RIDER' && ride.riderId !== userId) {
      throw new ForbiddenError('You cannot cancel this ride');
    }
    if (role === 'DRIVER' && ride.driverId !== userId) {
      throw new ForbiddenError('You cannot cancel this ride');
    }

    const cancelableStatuses: RideStatus[] = ['REQUESTED', 'DRIVER_ASSIGNED', 'DRIVER_ARRIVED'];
    if (!cancelableStatuses.includes(ride.status)) {
      throw new BadRequestError('Cannot cancel ride in current state');
    }

    const status: RideStatus = role === 'RIDER' ? 'CANCELLED_RIDER' : 'CANCELLED_DRIVER';

    // Compute cancellation charge for rider cancellation after grace period
    let cancellationCharge = 0;
    if (role === 'RIDER' && ride.status === 'DRIVER_ASSIGNED' && ride.acceptedAt) {
      const fareConfig = await prisma.fareConfig.findFirst({
        where: { city: ride.city, isActive: true },
        orderBy: { effectiveFrom: 'desc' },
      });
      const chargeEnabled = fareConfig?.cancellationChargeEnabled ?? true;
      const chargeAmount = fareConfig?.cancellationChargeAmount ?? 20;
      const gracePeriodMin = fareConfig?.cancellationGracePeriodMin ?? 3;
      const waitedMin = (Date.now() - ride.acceptedAt.getTime()) / 60000;
      if (chargeEnabled && waitedMin >= gracePeriodMin) {
        cancellationCharge = chargeAmount;
      }
    }

    const updated = await prisma.ride.update({
      where: { id: rideId },
      data: {
        status,
        cancelledAt: new Date(),
        cancellationReason: input.reason,
        cancellationCharge,
      },
    });

    if (ride.driverId) {
      await prisma.driverProfile.update({
        where: { userId: ride.driverId },
        data: { isOnRide: false, isGoHomeMode: false },
      });
      // If rider cancelled after driver was assigned, block that driver for this rider for 24h
      if (role === 'RIDER' && ride.status === 'DRIVER_ASSIGNED') {
        await addToBlocklist(`${BLOCKLIST_RIDER_PREFIX}${ride.riderId}`, ride.driverId, 86400);
      }
    }

    await redis.del(`${ACTIVE_RIDE_PREFIX}${ride.riderId}`);

    await redis.publish('ride_events', JSON.stringify({
      type: 'ride:cancelled',
      rideId,
      riderId: ride.riderId,
      driverId: ride.driverId,
      cancelledBy: role,
      reason: input.reason,
      cancellationCharge,
    }));

    // Notify the other party
    if (role === 'RIDER' && ride.driverId) {
      notificationService.sendPushNotification(
        ride.driverId,
        '❌ Ride Cancelled',
        `Rider cancelled the ride`,
        { type: 'ride:cancelled', rideId },
      ).catch((err: unknown) => logger.warn({ err }, 'Push notification failed'));
    } else if (role === 'DRIVER') {
      notificationService.sendPushNotification(
        ride.riderId,
        '❌ Ride Cancelled',
        `Driver cancelled. We'll find you another driver.`,
        { type: 'ride:cancelled', rideId },
      ).catch((err: unknown) => logger.warn({ err }, 'Push notification failed'));
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
