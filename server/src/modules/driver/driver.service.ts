import { prisma } from '../../config/database';
import { redis } from '../../config/redis';
import { NotFoundError, BadRequestError } from '../../utils/errors';
import type {
  UpdateDriverProfileInput,
  VehicleInput,
  UpdateLocationInput,
  DocumentUploadInput,
} from './driver.schema';

const DRIVER_LOCATION_KEY = 'driver_locations';
const DRIVER_ONLINE_PREFIX = 'driver_online:';
const RIDE_REQUEST_PREFIX = 'ride_request:';

export class DriverService {
  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        driverProfile: {
          include: {
            vehicles: true,
            documents: true,
            subscriptions: {
              where: { status: 'ACTIVE' },
              include: { plan: true },
              orderBy: { expiresAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });
    if (!user || !user.driverProfile) throw new NotFoundError('Driver not found');

    const dp = user.driverProfile;
    return {
      id: user.id,
      phone: user.phone,
      fullName: user.fullName,
      email: user.email,
      language: user.language,
      avatarUrl: user.avatarUrl,
      status: user.status,
      licenseNumber: dp.licenseNumber,
      rating: dp.rating,
      totalRides: dp.totalRides,
      totalEarnings: dp.totalEarnings,
      isOnline: dp.isOnline,
      isOnRide: dp.isOnRide,
      city: dp.city,
      verificationStatus: dp.verificationStatus,
      acceptanceRate: dp.acceptanceRate,
      vehicles: dp.vehicles,
      documents: dp.documents.map((d) => ({
        id: d.id,
        docType: d.docType,
        docNumber: d.docNumber,
        status: d.status,
        rejectionReason: d.rejectionReason,
        expiryDate: d.expiryDate,
      })),
      activeSubscription: dp.subscriptions[0] ?? null,
    };
  }

  async updateProfile(userId: string, input: UpdateDriverProfileInput) {
    const { fullName, email, language, ...driverData } = input;

    if (fullName || email || language) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          ...(fullName && { fullName }),
          ...(email && { email }),
          ...(language && { language }),
        },
      });
    }

    if (Object.keys(driverData).length > 0) {
      await prisma.driverProfile.update({
        where: { userId },
        data: driverData,
      });
    }

    return this.getProfile(userId);
  }

  async addVehicle(userId: string, input: VehicleInput) {
    const profile = await prisma.driverProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundError('Driver profile not found');

    return prisma.vehicle.create({
      data: { driverId: profile.id, ...input },
    });
  }

  async updateVehicle(userId: string, vehicleId: string, input: Partial<VehicleInput>) {
    const profile = await prisma.driverProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundError('Driver profile not found');

    const vehicle = await prisma.vehicle.findFirst({
      where: { id: vehicleId, driverId: profile.id },
    });
    if (!vehicle) throw new NotFoundError('Vehicle not found');

    return prisma.vehicle.update({
      where: { id: vehicleId },
      data: input,
    });
  }

  async uploadDocument(userId: string, input: DocumentUploadInput) {
    const profile = await prisma.driverProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundError('Driver profile not found');

    const existing = await prisma.driverDocument.findFirst({
      where: { driverId: profile.id, docType: input.docType, status: { in: ['PENDING', 'VERIFIED'] } },
    });

    if (existing) {
      return prisma.driverDocument.update({
        where: { id: existing.id },
        data: {
          docUrl: input.docUrl,
          docNumber: input.docNumber,
          expiryDate: input.expiryDate ? new Date(input.expiryDate) : undefined,
          status: 'PENDING',
        },
      });
    }

    return prisma.driverDocument.create({
      data: {
        driverId: profile.id,
        docType: input.docType,
        docUrl: input.docUrl,
        docNumber: input.docNumber,
        expiryDate: input.expiryDate ? new Date(input.expiryDate) : undefined,
      },
    });
  }

  async getDocuments(userId: string) {
    const profile = await prisma.driverProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundError('Driver profile not found');

    return prisma.driverDocument.findMany({
      where: { driverId: profile.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async goOnline(userId: string) {
    const profile = await prisma.driverProfile.findUnique({
      where: { userId },
      include: {
        vehicles: { where: { isActive: true } },
        subscriptions: {
          where: {
            status: 'ACTIVE',
            expiresAt: { gt: new Date() },
          },
          take: 1,
        },
      },
    });
    if (!profile) throw new NotFoundError('Driver profile not found');

    if (profile.verificationStatus !== 'VERIFIED') {
      throw new BadRequestError('Your profile is not verified yet');
    }
    if (profile.vehicles.length === 0) {
      throw new BadRequestError('Please add a vehicle before going online');
    }
    if (!profile.currentLat || !profile.currentLng) {
      throw new BadRequestError('Location not available. Please enable GPS.');
    }

    // ── Subscription check ──────────────────────────
    if (profile.subscriptions.length === 0) {
      throw new BadRequestError(
        JSON.stringify({
          code: 'SUBSCRIPTION_REQUIRED',
          message: 'Pay ₹25 to go online today',
          messageMl: 'ഇന്ന് ഓൺലൈൻ ആകാൻ ₹25 അടയ്ക്കൂ',
          requiresSubscription: true,
        })
      );
    }
    // ───────────────────────────────────────────────

    await prisma.driverProfile.update({
      where: { userId },
      data: { isOnline: true },
    });

    await redis.geoadd(
      DRIVER_LOCATION_KEY,
      profile.currentLng,
      profile.currentLat,
      userId,
    );
    await redis.set(`${DRIVER_ONLINE_PREFIX}${userId}`, '1');

    return { isOnline: true };
  }

  async goOffline(userId: string) {
    await prisma.driverProfile.update({
      where: { userId },
      data: { isOnline: false },
    });

    await redis.zrem(DRIVER_LOCATION_KEY, userId);
    await redis.del(`${DRIVER_ONLINE_PREFIX}${userId}`);

    return { isOnline: false };
  }

  async updateLocation(userId: string, input: UpdateLocationInput) {
    await prisma.driverProfile.update({
      where: { userId },
      data: { currentLat: input.lat, currentLng: input.lng },
    });

    const isOnline = await redis.get(`${DRIVER_ONLINE_PREFIX}${userId}`);
    if (isOnline) {
      await redis.geoadd(DRIVER_LOCATION_KEY, input.lng, input.lat, userId);
    }

    return { lat: input.lat, lng: input.lng };
  }

  async getEarnings(userId: string, period: 'today' | 'week' | 'month' = 'today') {
    const profile = await prisma.driverProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundError('Driver profile not found');

    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
    }

    const rides = await prisma.ride.findMany({
      where: {
        driverId: userId,
        status: 'COMPLETED',
        completedAt: { gte: startDate },
      },
      select: {
        totalAmount: true,
        tipAmount: true,
        completedAt: true,
      },
      orderBy: { completedAt: 'desc' },
    });

    const totalEarnings = rides.reduce((sum, r) => sum + (r.totalAmount ?? 0), 0);
    const totalTips = rides.reduce((sum, r) => sum + r.tipAmount, 0);

    return {
      period,
      totalRides: rides.length,
      totalEarnings,
      totalTips,
      rides,
    };
  }

  /**
   * Returns the pending ride request for a driver (polled by the driver PWA).
   * Reads from the same Redis key that ride.service writes.
   */
  async getPendingRideRequest(userId: string) {
    const raw = await redis.get(`${RIDE_REQUEST_PREFIX}${userId}`);
    if (!raw) return null;

    let rideId: string;
    try {
      ({ rideId } = JSON.parse(raw));
    } catch {
      return null;
    }

    const ride = await prisma.ride.findUnique({
      where: { id: rideId },
      include: { rider: { select: { fullName: true, avatarUrl: true } } },
    });

    if (!ride || ride.status !== 'REQUESTED') {
      // Stale key — clean up
      await redis.del(`${RIDE_REQUEST_PREFIX}${userId}`);
      return null;
    }

    return {
      rideId:               ride.id,
      pickupAddress:        ride.pickupAddress,
      dropoffAddress:       ride.dropoffAddress,
      estimatedFare:        ride.estimatedFare,
      estimatedDistanceKm:  ride.estimatedDistanceKm,
      estimatedDurationMin: ride.estimatedDurationMin,
      riderName:            ride.rider?.fullName ?? 'Rider',
    };
  }

  async getNearbyDrivers(lat: number, lng: number, radiusKm = 3) {
    const results = await redis.georadius(
      DRIVER_LOCATION_KEY,
      lng,
      lat,
      radiusKm,
      'km',
      'WITHCOORD',
      'WITHDIST',
      'ASC',
      'COUNT',
      20,
    );

    const drivers: Array<{ userId: string; distance: number; lat: number; lng: number }> = [];

    for (let i = 0; i < results.length; i++) {
      const item = results[i] as unknown as [string, string, [string, string]];
      const userId = item[0];
      const distance = parseFloat(item[1]);
      const [driverLng, driverLat] = item[2];

      const isOnline = await redis.get(`${DRIVER_ONLINE_PREFIX}${userId}`);
      if (isOnline) {
        drivers.push({
          userId,
          distance,
          lat: parseFloat(driverLat),
          lng: parseFloat(driverLng),
        });
      }
    }

    return drivers;
  }
}

export const driverService = new DriverService();
