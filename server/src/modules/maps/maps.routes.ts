import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { mapsService } from '../../services/maps';

const router = Router();

const routeSchema = z.object({
  originLat: z.coerce.number().min(-90).max(90),
  originLng: z.coerce.number().min(-180).max(180),
  destLat: z.coerce.number().min(-90).max(90),
  destLng: z.coerce.number().min(-180).max(180),
});

const searchSchema = z.object({
  query: z.string().min(2).max(200),
  sessionToken: z.string().optional(),
});

const placeDetailSchema = z.object({
  placeId: z.string().min(1),
  sessionToken: z.string().optional(),
});

const geocodeSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

router.post('/route', authenticate, validate(routeSchema), async (req: Request, res: Response) => {
  const { originLat, originLng, destLat, destLng } = req.body;
  const route = await mapsService.getRoute(
    { lat: originLat, lng: originLng },
    { lat: destLat, lng: destLng },
  );
  res.json({ success: true, data: route });
});

router.post('/search', authenticate, validate(searchSchema), async (req: Request, res: Response) => {
  const { query, sessionToken } = req.body;
  const predictions = await mapsService.searchPlaces(query, sessionToken);
  res.json({ success: true, data: predictions });
});

router.post('/place-details', authenticate, validate(placeDetailSchema), async (req: Request, res: Response) => {
  const { placeId, sessionToken } = req.body;
  const details = await mapsService.getPlaceDetails(placeId, sessionToken);
  res.json({ success: true, data: details });
});

router.post('/reverse-geocode', authenticate, validate(geocodeSchema), async (req: Request, res: Response) => {
  const { lat, lng } = req.body;
  const address = await mapsService.reverseGeocode(lat, lng);
  res.json({ success: true, data: address });
});

router.post('/eta', authenticate, validate(routeSchema), async (req: Request, res: Response) => {
  const { originLat, originLng, destLat, destLng } = req.body;
  const eta = await mapsService.getDriverETA(
    { lat: originLat, lng: originLng },
    { lat: destLat, lng: destLng },
  );
  res.json({ success: true, data: eta });
});

export { router as mapsRoutes };
