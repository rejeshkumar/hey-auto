import Redis from 'ioredis';
import { env } from './env';
import { logger } from '../utils/logger';

const redisOptions = {
  maxRetriesPerRequest: 3,
  retryStrategy(times: number) {
    const delay = Math.min(times * 200, 2000);
    return delay;
  },
  // Warn at startup if Redis has no password — production should always use auth
  lazyConnect: false,
};

export const redis = new Redis(env.REDIS_URL, redisOptions);

redis.on('connect', async () => {
  logger.info('Redis connected');
  // Warn if running without authentication (REDIS_URL has no password component)
  try {
    const url = new URL(env.REDIS_URL);
    if (!url.password && env.NODE_ENV === 'production') {
      logger.warn('SECURITY: Redis has no password set — set a password in REDIS_URL for production (redis://:password@host:port)');
    }
  } catch {}
});

redis.on('error', (err) => {
  logger.error({ err }, 'Redis connection error');
});

export const redisPub = new Redis(env.REDIS_URL, redisOptions);
export const redisSub = new Redis(env.REDIS_URL, redisOptions);
