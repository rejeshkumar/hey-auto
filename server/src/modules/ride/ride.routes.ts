import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { rideController } from './ride.controller';
import { authenticate, authorize } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { fareEstimateSchema, requestRideSchema, cancelRideSchema, rateRideSchema } from './ride.schema';

// Prevents a single rider from flooding the matching algorithm
const rideRequestLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  keyGenerator: (req) => (req as any).user?.userId ?? req.ip,
  message: { success: false, error: { code: 'RATE_LIMIT', message: 'Too many ride requests. Please wait before trying again.' } },
});

const router = Router();

// Public track endpoint (no auth)
router.get('/track/:token', rideController.getTrackData);

router.use(authenticate);

// Rider endpoints
router.post('/estimate', authorize('RIDER'), validate(fareEstimateSchema), rideController.getFareEstimate);
router.post('/request', authorize('RIDER'), rideRequestLimiter, validate(requestRideSchema), rideController.requestRide);
router.get('/:id', rideController.getRideDetails);
router.get('/:id/cancel-preview', authorize('RIDER'), rideController.getCancelPreview);
router.post('/:id/cancel', authorize('RIDER', 'DRIVER'), validate(cancelRideSchema), rideController.cancelRide);
router.post('/:id/rate', authorize('RIDER', 'DRIVER'), validate(rateRideSchema), rideController.rateRide);
router.post('/:id/share', authorize('RIDER'), rideController.createShareToken);

// Driver endpoints
router.get('/active', authorize('DRIVER'), rideController.getActiveRide);
router.post('/:id/accept', authorize('DRIVER'), rideController.acceptRide);
router.post('/:id/decline', authorize('DRIVER'), rideController.declineRide);
router.post('/:id/arrived', authorize('DRIVER'), rideController.driverArrived);
router.post('/:id/verify-otp', authorize('DRIVER'), rideController.verifyRideOtp);
router.post('/:id/start', authorize('DRIVER'), rideController.startRide);
router.post('/:id/complete', authorize('DRIVER'), rideController.completeRide);

export { router as rideRoutes };
