import { prisma } from '../../config/database';
import { NotFoundError } from '../../utils/errors';
import { notificationService } from '../notification/notification.service';
import type { UpdateRiderProfileInput, SavedPlaceInput, EmergencyContactInput } from './rider.schema';

export class RiderService {
  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { riderProfile: true, wallet: true },
    });
    if (!user) throw new NotFoundError('Rider not found');

    return {
      id: user.id,
      phone: user.phone,
      fullName: user.fullName,
      email: user.email,
      language: user.language,
      avatarUrl: user.avatarUrl,
      rating: user.riderProfile?.rating ?? 5.0,
      totalRides: user.riderProfile?.totalRides ?? 0,
      walletBalance: user.wallet?.balance ?? 0,
      homeAddress: user.riderProfile?.homeAddress,
      workAddress: user.riderProfile?.workAddress,
    };
  }

  async updateProfile(userId: string, input: UpdateRiderProfileInput) {
    const { fullName, email, language, ...profileData } = input;

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

    if (Object.keys(profileData).length > 0) {
      await prisma.riderProfile.update({
        where: { userId },
        data: profileData,
      });
    }

    return this.getProfile(userId);
  }

  async getSavedPlaces(userId: string) {
    return prisma.savedPlace.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addSavedPlace(userId: string, input: SavedPlaceInput) {
    return prisma.savedPlace.create({
      data: { userId, ...input },
    });
  }

  async deleteSavedPlace(userId: string, placeId: string) {
    await prisma.savedPlace.deleteMany({
      where: { id: placeId, userId },
    });
  }

  async getEmergencyContacts(userId: string) {
    return prisma.emergencyContact.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addEmergencyContact(userId: string, input: EmergencyContactInput) {
    return prisma.emergencyContact.create({
      data: { userId, ...input },
    });
  }

  async deleteEmergencyContact(userId: string, contactId: string) {
    await prisma.emergencyContact.deleteMany({
      where: { id: contactId, userId },
    });
  }

  async triggerSOS(userId: string, rideId?: string) {
    const contacts = await prisma.emergencyContact.findMany({ where: { userId } });
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { fullName: true, phone: true } });

    // Notify the rider themselves with confirmation
    notificationService.sendPushNotification(
      userId,
      '🚨 SOS Activated',
      'Emergency contacts have been alerted. Help is on the way.',
      { type: 'sos', ...(rideId && { rideId }) },
    ).catch(() => {});

    // Log SOS as a system notification for admin visibility
    if (contacts.length > 0) {
      await prisma.notification.create({
        data: {
          userId,
          title: 'SOS Alert Sent',
          body: `Rider ${user?.fullName ?? userId} triggered SOS. Emergency contacts: ${contacts.map(c => c.name).join(', ')}`,
          type: 'SAFETY',
          data: { rideId, contacts: contacts.map(c => ({ name: c.name, phone: c.phone })) },
        },
      });
    }

    return { triggered: true, contactsNotified: contacts.length };
  }

  async getRideHistory(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [rides, total] = await Promise.all([
      prisma.ride.findMany({
        where: { riderId: userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          driver: { select: { fullName: true, avatarUrl: true } },
          vehicle: { select: { registrationNo: true, color: true } },
          ratings: { where: { ratedBy: userId } },
        },
      }),
      prisma.ride.count({ where: { riderId: userId } }),
    ]);

    return {
      data: rides,
      total,
      page,
      limit,
      hasMore: skip + rides.length < total,
    };
  }
}

export const riderService = new RiderService();
