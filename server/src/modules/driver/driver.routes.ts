import { Router } from 'express';
import { driverController } from './driver.controller';
import { authenticate, authorize } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { upload } from '../../services/upload';
import {
  updateDriverProfileSchema,
  vehicleSchema,
  updateLocationSchema,
  documentUploadSchema,
} from './driver.schema';

const router = Router();

router.use(authenticate, authorize('DRIVER'));

router.get('/profile', driverController.getProfile);
router.put('/profile', validate(updateDriverProfileSchema), driverController.updateProfile);

router.post('/vehicle', validate(vehicleSchema), driverController.addVehicle);
router.put('/vehicle/:id', driverController.updateVehicle);

router.post('/documents', upload.single('file'), validate(documentUploadSchema), driverController.uploadDocument);
router.get('/documents', driverController.getDocuments);

router.post('/go-online', driverController.goOnline);
router.post('/go-offline', driverController.goOffline);
router.put('/location', validate(updateLocationSchema), driverController.updateLocation);

router.get('/ride-request', driverController.getPendingRideRequest);
router.get('/earnings', driverController.getEarnings);
router.get('/rides/history', driverController.getRideHistory);

router.put('/home-location', driverController.setHomeLocation);
router.post('/go-home', driverController.toggleGoHomeMode);
router.get('/demand-heatmap', driverController.getDemandHeatmap);
router.get('/earnings/daily', driverController.getDailyEarnings);
router.post('/coins/redeem', driverController.redeemCoins);
router.get('/leaderboard', driverController.getLeaderboard);
router.get('/nearby-stands', driverController.getNearbyStands);
router.get('/queue-status', driverController.getQueueStatus);

export { router as driverRoutes };
