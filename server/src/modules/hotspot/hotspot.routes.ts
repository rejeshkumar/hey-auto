import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth';
import { prisma } from '../../config/database';
import { redis } from '../../config/redis';
import { computeHotspots } from './hotspot.service';
import { haversineDistance } from '../../utils/helpers';

const router = Router();

router.use(authenticate, authorize('DRIVER'));

// REST poll for backgrounded app — returns hotspots within 5 km of driver's current location
router.get('/', async (req, res) => {
  const lat = parseFloat(req.query.lat as string);
  const lng = parseFloat(req.query.lng as string);

  if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return res.status(400).json({ success: false, error: { message: 'Valid lat (-90 to 90) and lng (-180 to 180) required' } });
  }

  const hotspots = await computeHotspots(prisma, redis);
  const nearby = hotspots
    .map((h) => ({ ...h, distanceKm: haversineDistance(lat, lng, h.lat, h.lng) }))
    .filter((h) => h.distanceKm <= 5)
    .sort((a, b) => a.distanceKm - b.distanceKm);

  return res.json({ success: true, data: nearby });
});

export { router as hotspotRoutes };
