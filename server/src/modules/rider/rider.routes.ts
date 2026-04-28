import { Router } from 'express';
import { riderController } from './rider.controller';
import { authenticate, authorize } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { updateRiderProfileSchema, savedPlaceSchema, emergencyContactSchema } from './rider.schema';

const router = Router();

router.use(authenticate, authorize('RIDER'));

router.get('/profile', riderController.getProfile);
router.put('/profile', validate(updateRiderProfileSchema), riderController.updateProfile);

router.get('/saved-places', riderController.getSavedPlaces);
router.post('/saved-places', validate(savedPlaceSchema), riderController.addSavedPlace);
router.delete('/saved-places/:id', riderController.deleteSavedPlace);

router.get('/emergency-contacts', riderController.getEmergencyContacts);
router.post('/emergency-contacts', validate(emergencyContactSchema), riderController.addEmergencyContact);
router.delete('/emergency-contacts/:id', riderController.deleteEmergencyContact);

router.post('/sos', riderController.triggerSOS);
router.get('/rides/history', riderController.getRideHistory);

export { router as riderRoutes };
