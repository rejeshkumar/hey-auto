import type { PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';
import { checkAndAlertDriver, broadcastClearIfEmpty, IDLE_THRESHOLD_MS } from './hotspot.service';
import { logger } from '../../utils/logger';

const CRON_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const ALERT_COOLDOWN_MS = 10 * 60 * 1000;

export function startHotspotCron(prisma: PrismaClient, redis: Redis): void {
  setInterval(async () => {
    try {
      const now = new Date();
      const idleThreshold = new Date(now.getTime() - IDLE_THRESHOLD_MS);
      const alertCooldown = new Date(now.getTime() - ALERT_COOLDOWN_MS);

      const idleDrivers = await prisma.driverProfile.findMany({
        where: {
          isOnline: true,
          isOnRide: false,
          OR: [
            { lastRideCompletedAt: { lt: idleThreshold } },
            { lastRideCompletedAt: null },
          ],
          AND: [
            {
              OR: [
                { lastHotspotAlertAt: { lt: alertCooldown } },
                { lastHotspotAlertAt: null },
              ],
            },
          ],
        },
        select: { userId: true, currentLat: true, currentLng: true },
      });

      if (idleDrivers.length === 0) {
        await broadcastClearIfEmpty(prisma, redis);
        return;
      }

      logger.info({ count: idleDrivers.length }, 'Hotspot cron: checking idle drivers');

      for (const driver of idleDrivers) {
        await checkAndAlertDriver(driver.userId, driver.currentLat, driver.currentLng, prisma, redis);
      }
    } catch (err) {
      logger.error({ err }, 'Hotspot cron failed');
    }
  }, CRON_INTERVAL_MS);

  logger.info('Hotspot cron started (5 min interval)');
}
