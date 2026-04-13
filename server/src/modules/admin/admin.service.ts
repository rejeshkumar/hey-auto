import { prisma } from '../../config/database';
import { redis } from '../../config/redis';
import { NotFoundError, BadRequestError } from '../../utils/errors';

export class AdminService {
  async getDashboardStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalRiders,
      totalDrivers,
      verifiedDrivers,
      pendingVerifications,
      todayRides,
      activeRides,
      completedToday,
      todayRevenue,
    ] = await Promise.all([
      prisma.user.count({ where: { role: 'RIDER' } }),
      prisma.user.count({ where: { role: 'DRIVER' } }),
      prisma.driverProfile.count({ where: { verificationStatus: 'VERIFIED' } }),
      prisma.driverDocument.count({ where: { status: 'PENDING' } }),
      prisma.ride.count({ where: { createdAt: { gte: today } } }),
      prisma.ride.count({
        where: { status: { in: ['REQUESTED', 'DRIVER_ASSIGNED', 'DRIVER_ARRIVED', 'OTP_VERIFIED', 'IN_PROGRESS'] } },
      }),
      prisma.ride.count({ where: { status: 'COMPLETED', completedAt: { gte: today } } }),
      prisma.ride.aggregate({
        where: { status: 'COMPLETED', completedAt: { gte: today } },
        _sum: { totalAmount: true },
      }),
    ]);

    const onlineDrivers = await redis.keys('driver_online:*');

    return {
      riders: { total: totalRiders },
      drivers: {
        total: totalDrivers,
        verified: verifiedDrivers,
        online: onlineDrivers.length,
        pendingVerifications,
      },
      rides: {
        today: todayRides,
        active: activeRides,
        completedToday,
      },
      revenue: {
        today: todayRevenue._sum.totalAmount ?? 0,
      },
    };
  }

  async getDrivers(filters: {
    status?: string;
    city?: string;
    page?: number;
    limit?: number;
    search?: string;
  }) {
    const { status, city, page = 1, limit = 20, search } = filters;
    const skip = (page - 1) * limit;

    const where: any = { role: 'DRIVER' as const };
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: {
          driverProfile: {
            where: {
              ...(status && { verificationStatus: status as any }),
              ...(city && { city }),
            },
            include: {
              vehicles: true,
              documents: { select: { id: true, docType: true, status: true } },
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    const drivers = users.filter((u) => u.driverProfile);

    return {
      data: drivers.map((u) => ({
        id: u.id,
        fullName: u.fullName,
        phone: u.phone,
        status: u.status,
        createdAt: u.createdAt,
        profile: u.driverProfile,
      })),
      total,
      page,
      limit,
      hasMore: skip + drivers.length < total,
    };
  }

  async verifyDriver(driverId: string, action: 'verify' | 'reject', adminId: string) {
    const profile = await prisma.driverProfile.findUnique({
      where: { userId: driverId },
    });
    if (!profile) throw new NotFoundError('Driver not found');

    if (action === 'verify') {
      await prisma.driverProfile.update({
        where: { userId: driverId },
        data: { verificationStatus: 'VERIFIED', verifiedAt: new Date() },
      });
      await prisma.user.update({
        where: { id: driverId },
        data: { status: 'ACTIVE' },
      });
    } else {
      await prisma.driverProfile.update({
        where: { userId: driverId },
        data: { verificationStatus: 'REJECTED' },
      });
    }

    return { driverId, action, verificationStatus: action === 'verify' ? 'VERIFIED' : 'REJECTED' };
  }

  async verifyDocument(documentId: string, action: 'verify' | 'reject', adminId: string, rejectionReason?: string) {
    const doc = await prisma.driverDocument.findUnique({ where: { id: documentId } });
    if (!doc) throw new NotFoundError('Document not found');

    if (action === 'reject' && !rejectionReason) {
      throw new BadRequestError('Rejection reason is required');
    }

    return prisma.driverDocument.update({
      where: { id: documentId },
      data: {
        status: action === 'verify' ? 'VERIFIED' : 'REJECTED',
        verifiedBy: adminId,
        verifiedAt: new Date(),
        ...(rejectionReason && { rejectionReason }),
      },
    });
  }

  async getPendingDocuments(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [docs, total] = await Promise.all([
      prisma.driverDocument.findMany({
        where: { status: 'PENDING' },
        include: {
          driver: {
            include: { user: { select: { fullName: true, phone: true } } },
          },
        },
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
      }),
      prisma.driverDocument.count({ where: { status: 'PENDING' } }),
    ]);

    return { data: docs, total, page, limit, hasMore: skip + docs.length < total };
  }

  async getRides(filters: {
    status?: string;
    city?: string;
    page?: number;
    limit?: number;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const { status, city, page = 1, limit = 20, dateFrom, dateTo } = filters;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;
    if (city) where.city = city;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const [rides, total] = await Promise.all([
      prisma.ride.findMany({
        where,
        include: {
          rider: { select: { fullName: true, phone: true } },
          driver: { select: { fullName: true, phone: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.ride.count({ where }),
    ]);

    return { data: rides, total, page, limit, hasMore: skip + rides.length < total };
  }

  async updateFareConfig(data: {
    city: string;
    vehicleType: 'AUTO' | 'E_AUTO';
    baseFare: number;
    baseDistanceKm: number;
    perKmRate: number;
    perMinRate: number;
    minFare: number;
    nightMultiplier: number;
  }) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return prisma.fareConfig.upsert({
      where: {
        city_vehicleType_effectiveFrom: {
          city: data.city,
          vehicleType: data.vehicleType,
          effectiveFrom: today,
        },
      },
      update: {
        baseFare: data.baseFare,
        baseDistanceKm: data.baseDistanceKm,
        perKmRate: data.perKmRate,
        perMinRate: data.perMinRate,
        minFare: data.minFare,
        nightMultiplier: data.nightMultiplier,
      },
      create: {
        city: data.city,
        vehicleType: data.vehicleType,
        baseFare: data.baseFare,
        baseDistanceKm: data.baseDistanceKm,
        perKmRate: data.perKmRate,
        perMinRate: data.perMinRate,
        minFare: data.minFare,
        nightMultiplier: data.nightMultiplier,
        effectiveFrom: today,
      },
    });
  }
}

export const adminService = new AdminService();
