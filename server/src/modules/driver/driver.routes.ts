import { Router } from 'express';
import { driverController } from './driver.controller';
import { authenticate, authorize } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
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

router.post('/documents', validate(documentUploadSchema), driverController.uploadDocument);
router.get('/documents', driverController.getDocuments);

router.post('/go-online', driverController.goOnline);
router.post('/go-offline', driverController.goOffline);
router.put('/location', validate(updateLocationSchema), driverController.updateLocation);

router.get('/ride-request', driverController.getPendingRideRequest);
router.get('/earnings', driverController.getEarnings);

export { router as driverRoutes };
