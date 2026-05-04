import { prisma } from '../../config/database';
import { redis } from '../../config/redis';
import { NotFoundError, BadRequestError } from '../../utils/errors';
import { notificationService } from '../notification/notification.service';

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

  async getDriver(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        driverProfile: {
          include: {
            vehicles: true,
            documents: { select: { id: true, docType: true, status: true, docNumber: true, expiryDate: true } },
          },
        },
      },
    });
    if (!user || !user.driverProfile) throw new NotFoundError('Driver not found');
    return {
      id: user.id,
      fullName: user.fullName,
      phone: user.phone,
      status: user.status,
      createdAt: user.createdAt,
      profile: user.driverProfile,
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
    const doc = await prisma.driverDocument.findUnique({
      where: { id: documentId },
      include: { driver: { select: { userId: true } } },
    });
    if (!doc) throw new NotFoundError('Document not found');

    if (action === 'reject' && !rejectionReason) {
      throw new BadRequestError('Rejection reason is required');
    }

    const updated = await prisma.driverDocument.update({
      where: { id: documentId },
      data: {
        status: action === 'verify' ? 'VERIFIED' : 'REJECTED',
        verifiedBy: adminId,
        verifiedAt: new Date(),
        ...(rejectionReason && { rejectionReason }),
      },
    });

    const docLabel: Record<string, string> = {
      LICENSE: 'Driving License', VEHICLE_RC: 'Vehicle RC', INSURANCE: 'Insurance',
      PERMIT: 'Permit', AADHAAR: 'Aadhaar Card', PHOTO: 'Driver Photo', VEHICLE_PHOTO: 'Vehicle Photo',
    };

    if (action === 'verify') {
      notificationService.sendPushNotification(
        doc.driver.userId,
        '✅ Document Verified',
        `Your ${docLabel[doc.docType] ?? doc.docType} has been verified.`,
        { type: 'document:verified', docType: doc.docType },
      ).catch(() => {});
    } else {
      notificationService.sendPushNotification(
        doc.driver.userId,
        '⚠️ Document Rejected',
        `${docLabel[doc.docType] ?? doc.docType}: ${rejectionReason}`,
        { type: 'document:rejected', docType: doc.docType },
      ).catch(() => {});
    }

    return updated;
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

  async getFareConfig(city: string, vehicleType: 'AUTO' | 'E_AUTO') {
    return prisma.fareConfig.findFirst({
      where: { city, vehicleType, isActive: true },
      orderBy: { effectiveFrom: 'desc' },
    });
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
    nightStart: string;
    nightEnd: string;
    onwardSurchargeEnabled: boolean;
    onwardSurchargePercent: number;
    waitingChargePerQuarterHour: number;
    waitingChargeMaxPerDay: number;
  }) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const fields = {
      baseFare: data.baseFare,
      baseDistanceKm: data.baseDistanceKm,
      perKmRate: data.perKmRate,
      perMinRate: data.perMinRate,
      minFare: data.minFare,
      nightStart: data.nightStart,
      nightEnd: data.nightEnd,
      nightMultiplier: data.nightMultiplier,
      onwardSurchargeEnabled: data.onwardSurchargeEnabled,
      onwardSurchargePercent: data.onwardSurchargePercent,
      waitingChargePerQuarterHour: data.waitingChargePerQuarterHour,
      waitingChargeMaxPerDay: data.waitingChargeMaxPerDay,
    };

    return prisma.fareConfig.upsert({
      where: {
        city_vehicleType_effectiveFrom: {
          city: data.city,
          vehicleType: data.vehicleType,
          effectiveFrom: today,
        },
      },
      update: fields,
      create: {
        city: data.city,
        vehicleType: data.vehicleType,
        effectiveFrom: today,
        ...fields,
      },
    });
  }

  async getPendingSubscriptions(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [subs, total] = await Promise.all([
      prisma.driverSubscription.findMany({
        where: { status: 'PENDING' },
        include: {
          driver: { include: { user: { select: { fullName: true, phone: true } } } },
          plan: true,
          payment: true,
        },
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
      }),
      prisma.driverSubscription.count({ where: { status: 'PENDING' } }),
    ]);
    return { data: subs, total, page, limit };
  }

  async verifySubscription(subscriptionId: string, action: 'approve' | 'reject') {
    const sub = await prisma.driverSubscription.findUnique({
      where: { id: subscriptionId },
      include: { driver: true, plan: true, payment: true },
    });
    if (!sub) throw new NotFoundError('Subscription not found');

    const driverUserId = sub.driver.userId;

    if (action === 'approve') {
      const now = new Date();
      const istMidnight = new Date();
      istMidnight.setUTCHours(18, 30, 0, 0);
      if (istMidnight < now) istMidnight.setUTCDate(istMidnight.getUTCDate() + 1);

      await prisma.driverSubscription.update({
        where: { id: subscriptionId },
        data: { status: 'ACTIVE', startsAt: now, expiresAt: istMidnight },
      });
      if (sub.payment) {
        await prisma.payment.update({ where: { id: sub.payment.id }, data: { status: 'COMPLETED' } });
      }

      notificationService.sendPushNotification(
        driverUserId,
        '✅ Subscription Activated!',
        `Your ₹${sub.payment?.amount ?? 25} payment is verified. You can now go online and accept rides.`,
        { type: 'subscription:activated' },
      ).catch(() => {});
    } else {
      await prisma.driverSubscription.update({
        where: { id: subscriptionId },
        data: { status: 'CANCELLED' },
      });
      if (sub.payment) {
        await prisma.payment.update({ where: { id: sub.payment.id }, data: { status: 'FAILED' } });
      }

      notificationService.sendPushNotification(
        driverUserId,
        '❌ Payment Not Verified',
        'Your subscription payment could not be verified. Please retry with a valid UTR.',
        { type: 'subscription:rejected' },
      ).catch(() => {});
    }
    return { subscriptionId, action };
  }

  async getAllSubscriptions(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [subs, total] = await Promise.all([
      prisma.driverSubscription.findMany({
        include: {
          driver: { include: { user: { select: { fullName: true, phone: true } } } },
          plan: true,
          payment: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.driverSubscription.count(),
    ]);
    return { data: subs, total, page, limit };
  }

  async getRiders(filters: {
    page?: number;
    limit?: number;
    search?: string;
  }) {
    const { page = 1, limit = 20, search } = filters;
    const skip = (page - 1) * limit;

    const where: any = { role: 'RIDER' as const };
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: { riderProfile: true },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      data: users.map((u) => ({
        id: u.id,
        fullName: u.fullName,
        phone: u.phone,
        status: u.status,
        createdAt: u.createdAt,
        rating: u.riderProfile?.rating ?? 5.0,
        totalRides: u.riderProfile?.totalRides ?? 0,
      })),
      total,
      page,
      limit,
      hasMore: skip + users.length < total,
    };
  }

  async createDriver(data: {
    phone: string;
    fullName: string;
    city: string;
    licenseNumber: string;
    vehicleMake: string;
    vehicleModel: string;
    vehiclePlate: string;
    vehicleType: 'AUTO' | 'E_AUTO';
    autoVerify: boolean;
  }) {
    const existing = await prisma.user.findFirst({ where: { phone: `+91${data.phone}` } });
    if (existing) throw new BadRequestError('A user with this phone number already exists', 'PHONE_EXISTS');

    const user = await prisma.user.create({
      data: {
        phone: `+91${data.phone}`,
        fullName: data.fullName,
        role: 'DRIVER',
        status: data.autoVerify ? 'ACTIVE' : 'PENDING_VERIFICATION',
      },
    });

    const profile = await prisma.driverProfile.create({
      data: {
        userId: user.id,
        licenseNumber: data.licenseNumber,
        city: data.city,
        verificationStatus: data.autoVerify ? 'VERIFIED' : 'PENDING',
        ...(data.autoVerify && { verifiedAt: new Date() }),
        isOnline: false,
        currentLat: 12.0368,
        currentLng: 75.3614,
      },
    });

    await prisma.vehicle.create({
      data: {
        driverId: profile.id,
        registrationNo: data.vehiclePlate,
        make: data.vehicleMake,
        model: data.vehicleModel,
        vehicleType: data.vehicleType,
        color: 'Yellow-Green',
        isActive: true,
      },
    });

    return { userId: user.id, phone: user.phone, fullName: user.fullName, verificationStatus: profile.verificationStatus };
  }
}

export const adminService = new AdminService();
