import { prisma } from '../../config/database';
import { logger } from '../../utils/logger';
import { env } from '../../config/env';

export class NotificationService {
  async sendPushNotification(userId: string, title: string, body: string, data?: Record<string, string>) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { fcmToken: true },
    });

    if (!user?.fcmToken) {
      logger.debug({ userId }, 'No FCM token, skipping push notification');
      return;
    }

    await this.saveNotification(userId, title, body, 'SYSTEM', data);

    if (!env.FIREBASE_PROJECT_ID) {
      logger.debug('Firebase not configured, skipping push');
      return;
    }

    try {
      // firebase-admin is an optional dependency — only loaded when configured
      const admin = await import('firebase-admin' as string);
      if (!admin.apps?.length) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: env.FIREBASE_PROJECT_ID,
            privateKey: env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            clientEmail: env.FIREBASE_CLIENT_EMAIL,
          }),
        });
      }

      await admin.messaging().send({
        token: user.fcmToken,
        notification: { title, body },
        data: data ?? {},
        android: { priority: 'high' as const },
        apns: { payload: { aps: { sound: 'default' } } },
      });

      logger.info({ userId, title }, 'Push notification sent');
    } catch (err) {
      logger.error({ err, userId }, 'Failed to send push notification');
    }
  }

  async sendRideNotification(
    userId: string,
    type: 'RIDE_UPDATE' | 'PAYMENT' | 'SAFETY',
    title: string,
    body: string,
    data?: Record<string, string>,
  ) {
    await this.saveNotification(userId, title, body, type, data);
    await this.sendPushNotification(userId, title, body, data);
  }

  async saveNotification(
    userId: string,
    title: string,
    body: string,
    type: string,
    data?: Record<string, string>,
  ) {
    await prisma.notification.create({
      data: {
        userId,
        title,
        body,
        type: type as any,
        data: data ?? undefined,
      },
    });
  }

  async getNotifications(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.notification.count({ where: { userId } }),
    ]);

    return {
      data: notifications,
      total,
      page,
      limit,
      hasMore: skip + notifications.length < total,
      unreadCount: await prisma.notification.count({ where: { userId, isRead: false } }),
    };
  }

  async markAsRead(userId: string, notificationId?: string) {
    if (notificationId) {
      await prisma.notification.updateMany({
        where: { id: notificationId, userId },
        data: { isRead: true },
      });
    } else {
      await prisma.notification.updateMany({
        where: { userId, isRead: false },
        data: { isRead: true },
      });
    }
  }

  async updateFcmToken(userId: string, fcmToken: string) {
    await prisma.user.update({
      where: { id: userId },
      data: { fcmToken },
    });
  }
}

export const notificationService = new NotificationService();
