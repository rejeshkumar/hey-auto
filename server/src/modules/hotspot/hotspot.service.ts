import type { PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';
import { haversineDistance } from '../../utils/helpers';
import { logger } from '../../utils/logger';
import { getIo } from '../../socket/io';
import ngeohash from 'ngeohash';

export interface Hotspot {
  id: string;
  lat: number;
  lng: number;
  pendingCount: number;
  nearbyDriverCount: number;
  label: string;
  detectedAt: string;
}

// ── Thresholds ────────────────────────────────────────────────
const IDLE_THRESHOLD_MIN = 10;
const MIN_PENDING_REQUESTS = 3;
const MAX_NEARBY_DRIVERS = 1;
const CLUSTER_RADIUS_KM = 1.5;
const ALERT_RADIUS_KM = 5;
const REDIS_TTL_SEC = 300;          // 5 minutes
const ALERT_COOLDOWN_MIN = 10;      // suppress re-alert within this window

// ── Taliparamba landmarks for human-readable labels ───────────
const LANDMARKS = [
  { name: 'Taliparamba Railway Station', lat: 12.0397, lng: 75.3622 },
  { name: 'Taliparamba Bus Stand',       lat: 12.0383, lng: 75.3631 },
  { name: 'Taliparamba Town Center',     lat: 12.0370, lng: 75.3618 },
  { name: 'Govt Hospital Taliparamba',   lat: 12.0361, lng: 75.3640 },
  { name: 'KSRTC Stand Taliparamba',     lat: 12.0378, lng: 75.3648 },
];

const REDIS_HOTSPOTS_KEY = 'hotspots:computed';

function nearestLandmarkLabel(lat: number, lng: number): string {
  let best = LANDMARKS[0];
  let bestDist = haversineDistance(lat, lng, best.lat, best.lng);
  for (let i = 1; i < LANDMARKS.length; i++) {
    const d = haversineDistance(lat, lng, LANDMARKS[i].lat, LANDMARKS[i].lng);
    if (d < bestDist) { bestDist = d; best = LANDMARKS[i]; }
  }
  return `Near ${best.name}`;
}

/** Cluster an array of {lat,lng} points by CLUSTER_RADIUS_KM into centroid groups. */
function clusterPoints(points: { lat: number; lng: number; rideId: string }[]): { lat: number; lng: number; ids: string[] }[] {
  const clusters: { lat: number; lng: number; ids: string[] }[] = [];
  const used = new Set<number>();

  for (let i = 0; i < points.length; i++) {
    if (used.has(i)) continue;
    const members = [i];
    used.add(i);
    for (let j = i + 1; j < points.length; j++) {
      if (used.has(j)) continue;
      if (haversineDistance(points[i].lat, points[i].lng, points[j].lat, points[j].lng) <= CLUSTER_RADIUS_KM) {
        members.push(j);
        used.add(j);
      }
    }
    const centLat = members.reduce((s, k) => s + points[k].lat, 0) / members.length;
    const centLng = members.reduce((s, k) => s + points[k].lng, 0) / members.length;
    clusters.push({ lat: centLat, lng: centLng, ids: members.map((k) => points[k].rideId) });
  }
  return clusters;
}

export async function computeHotspots(prisma: PrismaClient, redis: Redis): Promise<Hotspot[]> {
  // Return cached result if fresh
  const cached = await redis.get(REDIS_HOTSPOTS_KEY);
  if (cached) {
    try { return JSON.parse(cached) as Hotspot[]; } catch { /* fall through */ }
  }

  // Fetch all REQUESTED rides in last 30 minutes
  const since = new Date(Date.now() - 30 * 60 * 1000);
  const requestedRides = await prisma.ride.findMany({
    where: { status: 'REQUESTED', requestedAt: { gte: since } },
    select: { id: true, pickupLat: true, pickupLng: true },
  });

  if (requestedRides.length === 0) {
    await redis.setex(REDIS_HOTSPOTS_KEY, REDIS_TTL_SEC, JSON.stringify([]));
    return [];
  }

  const points = requestedRides.map((r) => ({ lat: r.pickupLat, lng: r.pickupLng, rideId: r.id }));
  const clusters = clusterPoints(points);

  // Fetch all online+idle drivers
  const onlineDrivers = await prisma.driverProfile.findMany({
    where: { isOnline: true, isOnRide: false },
    select: { id: true, currentLat: true, currentLng: true },
  });

  const hotspots: Hotspot[] = [];
  const now = new Date().toISOString();

  for (const cluster of clusters) {
    if (cluster.ids.length < MIN_PENDING_REQUESTS) continue;

    const nearbyDrivers = onlineDrivers.filter(
      (d) => d.currentLat && d.currentLng &&
        haversineDistance(cluster.lat, cluster.lng, d.currentLat!, d.currentLng!) <= ALERT_RADIUS_KM,
    );
    if (nearbyDrivers.length > MAX_NEARBY_DRIVERS) continue;

    const geohash = ngeohash.encode(cluster.lat, cluster.lng, 7);
    hotspots.push({
      id: geohash,
      lat: cluster.lat,
      lng: cluster.lng,
      pendingCount: cluster.ids.length,
      nearbyDriverCount: nearbyDrivers.length,
      label: nearestLandmarkLabel(cluster.lat, cluster.lng),
      detectedAt: now,
    });
  }

  await redis.setex(REDIS_HOTSPOTS_KEY, REDIS_TTL_SEC, JSON.stringify(hotspots));
  return hotspots;
}

export async function checkAndAlertDriver(
  driverId: string,
  driverLat: number | null | undefined,
  driverLng: number | null | undefined,
  prisma: PrismaClient,
  redis: Redis,
): Promise<void> {
  if (!driverLat || !driverLng) return;

  const profile = await prisma.driverProfile.findUnique({
    where: { userId: driverId },
    select: { isOnline: true, isOnRide: true, lastHotspotAlertAt: true },
  });
  if (!profile || !profile.isOnline || profile.isOnRide) return;

  // Suppress if alerted recently
  if (profile.lastHotspotAlertAt) {
    const minutesSince = (Date.now() - new Date(profile.lastHotspotAlertAt).getTime()) / 60000;
    if (minutesSince < ALERT_COOLDOWN_MIN) return;
  }

  const hotspots = await computeHotspots(prisma, redis);
  if (hotspots.length === 0) return;

  const nearbyHotspots = hotspots
    .map((h) => ({ ...h, distanceKm: haversineDistance(driverLat, driverLng, h.lat, h.lng) }))
    .filter((h) => h.distanceKm <= ALERT_RADIUS_KM)
    .sort((a, b) => a.distanceKm - b.distanceKm);

  if (nearbyHotspots.length === 0) return;

  getIo().to(`user:${driverId}`).emit('hotspot:alert', {
    hotspots: nearbyHotspots,
    distanceKm: nearbyHotspots[0].distanceKm,
  });

  await prisma.driverProfile.update({
    where: { userId: driverId },
    data: { lastHotspotAlertAt: new Date() },
  });

  logger.info({ driverId, hotspotCount: nearbyHotspots.length }, 'Hotspot alert sent');
}

export async function broadcastClearIfEmpty(prisma: PrismaClient, redis: Redis): Promise<void> {
  const hotspots = await computeHotspots(prisma, redis);
  if (hotspots.length === 0) {
    getIo().to('drivers').emit('hotspot:clear');
  }
}

export const IDLE_THRESHOLD_MS = IDLE_THRESHOLD_MIN * 60 * 1000;
