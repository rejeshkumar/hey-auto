import { redis } from '../../config/redis';

// Existing keys — unchanged (mobile apps depend on these)
export const ACTIVE_RIDE_PREFIX   = 'active_ride:';
export const RIDE_REQUEST_PREFIX  = 'ride_request:';
export const DRIVER_LOCATION_KEY  = 'driver_locations';
export const DRIVER_ONLINE_PREFIX = 'driver_online:';

// Pool-state keys per rideId (TTL: POOL_STATE_TTL_SEC)
export const POOL_RADIUS_STEP_PREFIX = 'pool_radius_step:';
export const POOL_BATCH_NUM_PREFIX   = 'pool_batch_num:';

// Blocklist keys
export const BLOCKLIST_SEARCH_PREFIX = 'blocklist_search:'; // per rideId,  TTL 3600s
export const BLOCKLIST_RIDER_PREFIX  = 'blocklist_rider:';  // per riderId, TTL 1800s (only set on charged cancel)
export const PREV_ATTEMPTED_PREFIX   = 'prev_attempted:';   // per rideId,  TTL 3600s

export async function addToBlocklist(key: string, driverId: string, ttl: number): Promise<void> {
  await redis.sadd(key, driverId);
  await redis.expire(key, ttl);
}

export async function getBlocklistMembers(key: string): Promise<string[]> {
  return redis.smembers(key);
}
