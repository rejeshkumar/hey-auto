import { prisma } from '../../config/database';
import { logger } from '../../utils/logger';
import { env } from '../../config/env';

// Both apps call getExpoPushTokenAsync() which produces ExponentPushToken[xxx] tokens.
// These must be sent through Expo's push gateway, which internally uses FCM/APNs.
// The FCM Server Key is registered in the Expo dashboard — the server never calls FCM directly.
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  sound?: 'default';
  priority?: 'high' | 'normal' | 'default';
  channelId?: string;
}

export class NotificationService {
  async sendPushNotification(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { fcmToken: true },
    });

    if (!user?.fcmToken) {
      logger.debug({ userId }, 'No FCM token, skipping push notification');
      return;
    }

    await this.saveNotification(userId, title, body, 'SYSTEM', data);

    const isExpoToken = user.fcmToken.startsWith('ExponentPushToken[');
    if (!isExpoToken) {
      logger.warn({ userId }, 'Unrecognised push token format — skipping push');
      return;
    }

    const message: ExpoMessage = {
      to: user.fcmToken,
      title,
      body,
      data: data ?? {},
      sound: 'default',
      priority: 'high',
      channelId: 'rides',
    };

    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      const result = await res.json() as { data: { status: string; message?: string } };

      if (result.data?.status === 'error') {
        logger.error({ userId, title, error: result.data.message }, 'Expo push delivery error');
      } else {
        logger.info({ userId, title }, 'Push notification sent via Expo');
      }
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
