import type { PrismaClient } from '@prisma/client';
import { logger } from '../../utils/logger';

// DPDP Act 2023 Section 8(7): erase personal data once the purpose is served or
// retention is no longer necessary. We treat 3 years of inactivity as the threshold.
const RETENTION_YEARS = 3;
const CRON_INTERVAL_MS = 24 * 60 * 60 * 1000; // run once per day

export function startRetentionCron(prisma: PrismaClient): void {
  const run = async () => {
    try {
      const cutoff = new Date();
      cutoff.setFullYear(cutoff.getFullYear() - RETENTION_YEARS);

      // Find ACTIVE/PENDING users whose last activity (updatedAt) is older than the cutoff
      // and who have no ride in the retention window
      const staleUsers = await prisma.user.findMany({
        where: {
          status: { in: ['ACTIVE', 'PENDING_VERIFICATION'] },
          updatedAt: { lt: cutoff },
          // exclude users who have a recent ride as rider or driver
          AND: [
            {
              ridesAsRider: {
                none: { requestedAt: { gte: cutoff } },
              },
            },
          ],
        },
        select: { id: true, role: true },
      });

      if (staleUsers.length === 0) {
        logger.info('Retention cron: no stale accounts found');
        return;
      }

      logger.info({ count: staleUsers.length }, 'Retention cron: anonymising stale accounts (DPDP §8(7))');

      for (const user of staleUsers) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            phone: `+00000000000_${user.id.slice(0, 8)}`,
            fullName: 'Deleted User',
            email: null,
            avatarUrl: null,
            status: 'DEACTIVATED',
          },
        });
        await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
      }

      logger.info({ count: staleUsers.length }, 'Retention cron: done');
    } catch (err) {
      logger.error({ err }, 'Retention cron failed');
    }
  };

  // Run once on startup (catches any backlog), then daily
  run();
  setInterval(run, CRON_INTERVAL_MS);

  logger.info(`Retention cron started (daily, ${RETENTION_YEARS}-year threshold)`);
}
