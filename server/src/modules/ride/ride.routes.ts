import { Router } from 'express';
import { rideController } from './ride.controller';
import { authenticate, authorize } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { fareEstimateSchema, requestRideSchema, cancelRideSchema, rateRideSchema } from './ride.schema';

const router = Router();

router.use(authenticate);

// Rider endpoints
router.post('/estimate', authorize('RIDER'), validate(fareEstimateSchema), rideController.getFareEstimate);
router.post('/request', authorize('RIDER'), validate(requestRideSchema), rideController.requestRide);
router.get('/:id', rideController.getRideDetails);
router.post('/:id/cancel', validate(cancelRideSchema), rideController.cancelRide);
router.post('/:id/rate', validate(rateRideSchema), rideController.rateRide);

// Driver endpoints
router.post('/:id/accept', authorize('DRIVER'), rideController.acceptRide);
router.post('/:id/decline', authorize('DRIVER'), rideController.declineRide);
router.post('/:id/arrived', authorize('DRIVER'), rideController.driverArrived);
router.post('/:id/verify-otp', authorize('DRIVER'), rideController.verifyRideOtp);
router.post('/:id/start', authorize('DRIVER'), rideController.startRide);
router.post('/:id/complete', authorize('DRIVER'), rideController.completeRide);

export { router as rideRoutes };
