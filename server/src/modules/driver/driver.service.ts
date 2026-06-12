import { prisma } from '../../config/database';
import { redis } from '../../config/redis';
import { env } from '../../config/env';
import { NotFoundError, BadRequestError } from '../../utils/errors';
import { haversineDistance } from '../../utils/helpers';
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
        docUrl: input.docUrl!,
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

    // ── Subscription check (skip in development or for bypass list) ────
    const isDev = process.env.NODE_ENV === 'development';
    const bypassPhones = (env.BYPASS_SUBSCRIPTION_PHONES || '')
      .split(',').map((p) => p.trim()).filter(Boolean);
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { phone: true } });
    const isBypassed = user ? bypassPhones.includes(user.phone) : false;
    if (!isDev && !isBypassed && profile.subscriptions.length === 0) {
      throw new BadRequestError(
        JSON.stringify({
          code: 'SUBSCRIPTION_REQUIRED',
          message: 'Pay ₹25 to go online today',
          messageMl: 'ഇന്ന് ഓൺലൈൻ ആകാൻ ₹25 അടയ്ക്കൂ',
          requiresSubscription: true,
        })
      );
    }
    // ────────────────────────────────────────────────────────────────

    await prisma.driverProfile.update({
      where: { userId },
      data: { isOnline: true, onlineSince: new Date() },
    });

    await redis.geoadd(
      DRIVER_LOCATION_KEY,
      profile.currentLng,
      profile.currentLat,
      userId,
    );
    await redis.set(`${DRIVER_ONLINE_PREFIX}${userId}`, '1');

    // Trigger initial stand queue sync
    this.syncStandQueue(userId, profile.currentLat, profile.currentLng).catch(() => {});

    return { isOnline: true };
  }

  async goOffline(userId: string) {
    const { logger } = await import('../../utils/logger');
    logger.warn({ userId, stack: new Error().stack?.split('\n').slice(1,4).join(' | ') }, 'goOffline called');
    const profile = await prisma.driverProfile.findUnique({ where: { userId } });

    await prisma.driverProfile.update({
      where: { userId },
      data: { isOnline: false, onlineSince: null },
    });

    await redis.zrem(DRIVER_LOCATION_KEY, userId);
    await redis.del(`${DRIVER_ONLINE_PREFIX}${userId}`);

    // Remove from all stand queues
    if (profile) {
      await prisma.standQueueEntry.deleteMany({ where: { driverId: profile.id } });
    }

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
      // Auto-join/leave stand queues based on proximity
      this.syncStandQueue(userId, input.lat, input.lng).catch(() => {});
    }

    return { lat: input.lat, lng: input.lng };
  }

  private async syncStandQueue(userId: string, lat: number, lng: number) {
    const profile = await prisma.driverProfile.findUnique({ where: { userId } });
    if (!profile) return;

    let stands: any[] = [];
    try {
      stands = await prisma.$queryRaw`
        SELECT id, lat, lng, COALESCE(radius_meters, 100) as "radiusMeters"
        FROM auto_stands WHERE city = ${profile.city} AND is_active = true
      `;
    } catch { return; }

    for (const stand of stands) {
      const distM = haversineDistance(lat, lng, stand.lat, stand.lng) * 1000;
      const inZone = distM <= stand.radiusMeters;
      const farAway = distM > stand.radiusMeters * 2;

      if (inZone) {
        // Auto-join if not already in queue
        await prisma.standQueueEntry.upsert({
          where: { driverId_standId: { driverId: profile.id, standId: stand.id } },
          update: {},
          create: { driverId: profile.id, standId: stand.id },
        });
      } else if (farAway) {
        // Auto-leave if too far
        await prisma.standQueueEntry.deleteMany({
          where: { driverId: profile.id, standId: stand.id },
        });
      }
    }
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

  async getDailyEarnings(userId: string, days = 7) {
    const windowStart = new Date(Date.now() - days * 24 * 3600 * 1000);
    const rides = await prisma.ride.findMany({
      where: { driverId: userId, status: 'COMPLETED', completedAt: { gte: windowStart } },
      select: { totalAmount: true, tipAmount: true, completedAt: true },
      orderBy: { completedAt: 'desc' },
    });

    // Group by IST date string
    const map = new Map<string, { totalEarnings: number; tips: number; rides: number }>();
    for (const r of rides) {
      if (!r.completedAt) continue;
      // IST = UTC + 5:30
      const istDate = new Date(r.completedAt.getTime() + 5.5 * 3600 * 1000);
      const key = istDate.toISOString().slice(0, 10); // YYYY-MM-DD
      const existing = map.get(key) ?? { totalEarnings: 0, tips: 0, rides: 0 };
      map.set(key, {
        totalEarnings: existing.totalEarnings + (r.totalAmount ?? 0),
        tips: existing.tips + r.tipAmount,
        rides: existing.rides + 1,
      });
    }

    return Array.from(map.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, stats]) => ({ date, ...stats }));
  }

  async setHomeLocation(userId: string, input: { lat: number; lng: number; address: string }) {
    await prisma.driverProfile.update({
      where: { userId },
      data: { homeLat: input.lat, homeLng: input.lng, homeAddress: input.address },
    });
    return { homeLat: input.lat, homeLng: input.lng, homeAddress: input.address };
  }

  async toggleGoHomeMode(userId: string, active: boolean) {
    const profile = await prisma.driverProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundError('Driver profile not found');
    if (active && (!profile.homeLat || !profile.homeLng)) {
      throw new BadRequestError('Please set your home location before enabling Go Home mode');
    }
    await prisma.driverProfile.update({
      where: { userId },
      data: { isGoHomeMode: active },
    });
    return { isGoHomeMode: active };
  }

  async getDemandHeatmap(lat: number, lng: number, radiusKm = 5) {
    const { prisma: db } = await import('../../config/database');
    const ngeohashMod = await import('ngeohash');
    const ngeohash = ngeohashMod.default ?? ngeohashMod;
    const windowStart = new Date(Date.now() - 30 * 60 * 1000); // last 30 min

    // Bounding box approximation (1 deg lat ≈ 111km)
    const latDelta = radiusKm / 111;
    const lngDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));

    const rides = await db.ride.findMany({
      where: {
        status: { in: ['REQUESTED', 'NO_DRIVERS'] },
        createdAt: { gte: windowStart },
        pickupLat: { gte: lat - latDelta, lte: lat + latDelta },
        pickupLng: { gte: lng - lngDelta, lte: lng + lngDelta },
      },
      select: { pickupLat: true, pickupLng: true },
    });

    // Count per geohash cell (precision 7 ≈ 150m cells)
    const cells = new Map<string, number>();
    for (const ride of rides) {
      const hash = ngeohash.encode(ride.pickupLat, ride.pickupLng, 7);
      cells.set(hash, (cells.get(hash) ?? 0) + 1);
    }

    return Array.from(cells.entries()).map(([hash, count]) => {
      const { latitude, longitude } = ngeohash.decode(hash);
      return { geohash: hash, lat: latitude, lng: longitude, count };
    });
  }

  async redeemCoins(userId: string, planId: string) {
    const profile = await prisma.driverProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundError('Driver profile not found');

    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundError('Subscription plan not found');

    const coinsNeeded = Math.ceil(plan.price);
    if (profile.coinsBalance < coinsNeeded) {
      throw new BadRequestError(`You need ${coinsNeeded} coins to redeem this plan. You have ${profile.coinsBalance}.`);
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + plan.durationDays * 24 * 3600 * 1000);

    await prisma.$transaction([
      prisma.driverProfile.update({
        where: { userId },
        data: {
          coinsBalance: { decrement: coinsNeeded },
          coinsRedeemed: { increment: coinsNeeded },
        },
      }),
      prisma.coinTransaction.create({
        data: {
          driverId: profile.id,
          amount: coinsNeeded,
          type: 'REDEEMED',
          description: `Redeemed for ${plan.name} subscription`,
        },
      }),
      prisma.driverSubscription.create({
        data: {
          driverId: profile.id,
          planId,
          startsAt: now,
          expiresAt,
          status: 'ACTIVE',
        },
      }),
    ]);

    return { message: `${plan.name} activated via ${coinsNeeded} coins`, expiresAt };
  }

  async getLeaderboard(userId: string) {
    const profile = await prisma.driverProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundError('Driver profile not found');

    const windowStart = new Date(Date.now() - 30 * 24 * 3600 * 1000);

    // Count rides per driver in city in last 30 days
    const rideCounts = await prisma.ride.groupBy({
      by: ['driverId'],
      where: {
        status: 'COMPLETED',
        completedAt: { gte: windowStart },
        city: profile.city,
        driverId: { not: null },
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    const driverIds = rideCounts.map((r) => r.driverId!);
    const profiles = await prisma.driverProfile.findMany({
      where: { id: { in: driverIds } },
      select: { id: true, userId: true, rating: true, coinsEarned: true },
    });
    const users = await prisma.user.findMany({
      where: { id: { in: profiles.map((p) => p.userId) } },
      select: { id: true, fullName: true },
    });

    const profileMap = new Map(profiles.map((p) => [p.id, p]));
    const userMap = new Map(users.map((u) => [u.id, u]));

    const board = rideCounts.map((r, i) => {
      const p = profileMap.get(r.driverId!);
      const u = p ? userMap.get(p.userId) : null;
      return {
        rank: i + 1,
        name: u?.fullName?.split(' ')[0] ?? 'Driver',
        rides: r._count.id,
        rating: p?.rating ?? 5,
        coinsEarned: p?.coinsEarned ?? 0,
        isYou: p?.userId === userId,
      };
    });

    // If current driver not in top 10, find their rank
    const myEntry = board.find((b) => b.isYou);
    if (!myEntry) {
      const myRides = await prisma.ride.count({
        where: { driverId: userId, status: 'COMPLETED', completedAt: { gte: windowStart } },
      });
      const aboveMe = await prisma.ride.groupBy({
        by: ['driverId'],
        where: { status: 'COMPLETED', completedAt: { gte: windowStart }, city: profile.city },
        _count: { id: true },
        having: { id: { _count: { gt: myRides } } },
      });
      board.push({
        rank: aboveMe.length + 1,
        name: users.find((u) => u.id === userId)?.fullName?.split(' ')[0] ?? 'You',
        rides: myRides,
        rating: profile.rating,
        coinsEarned: profile.coinsEarned,
        isYou: true,
      });
    }

    return board;
  }

  async getNearbyStands(lat: number, lng: number, city: string) {
    let stands: any[] = [];
    try {
      stands = await prisma.$queryRaw`
        SELECT id, name, lat, lng, COALESCE(radius_meters, 100) as "radiusMeters", max_capacity as "maxCapacity"
        FROM auto_stands WHERE city = ${city} AND is_active = true
      `;
    } catch { return []; }
    return stands
      .map((s) => ({
        ...s,
        distanceM: Math.round(haversineDistance(lat, lng, s.lat, s.lng) * 1000),
      }))
      .filter((s) => s.distanceM <= 1000)
      .sort((a, b) => a.distanceM - b.distanceM);
  }

  async getQueueStatus(userId: string) {
    const profile = await prisma.driverProfile.findUnique({ where: { userId } });
    if (!profile) return [];

    const entries = await prisma.standQueueEntry.findMany({
      where: { driverId: profile.id },
      include: { stand: true },
    });

    return Promise.all(entries.map(async (entry) => {
      const totalInQueue = await prisma.standQueueEntry.count({ where: { standId: entry.standId } });
      const position = await prisma.standQueueEntry.count({
        where: { standId: entry.standId, joinedAt: { lte: entry.joinedAt } },
      });
      return {
        standId: entry.standId,
        standName: entry.stand.name,
        position,
        totalInQueue,
      };
    }));
  }

  async getNearbyDrivers(lat: number, lng: number, radiusKm = 3) {
    const { logger } = await import('../../utils/logger');
    const allOnline = await prisma.driverProfile.findMany({
      where: {
        isOnline: true,
        isOnRide: false,
        currentLat: { not: null },
        currentLng: { not: null },
      },
      select: { userId: true, currentLat: true, currentLng: true },
    });

    logger.info({ totalOnline: allOnline.length, searchLat: lat, searchLng: lng, radiusKm }, 'getNearbyDrivers: online drivers in DB');

    const drivers: Array<{ userId: string; distance: number; lat: number; lng: number }> = [];

    for (const d of allOnline) {
      const distance = haversineDistance(lat, lng, d.currentLat!, d.currentLng!);
      if (distance <= radiusKm) {
        drivers.push({ userId: d.userId, distance, lat: d.currentLat!, lng: d.currentLng! });
      }
    }

    drivers.sort((a, b) => a.distance - b.distance);
    return drivers.slice(0, 20);
  }
}

export const driverService = new DriverService();
