import { Router } from 'express';
import { authController } from './auth.controller';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  sendOtpSchema,
  verifyOtpSchema,
  refreshTokenSchema,
  completeProfileSchema,
} from './auth.schema';

const router = Router();

router.post('/send-otp', validate(sendOtpSchema), authController.sendOtp);
router.post('/verify-otp', validate(verifyOtpSchema), authController.verifyOtp);
router.post('/refresh-token', validate(refreshTokenSchema), authController.refreshToken);
router.post('/logout', authenticate, authController.logout);
router.put('/complete-profile', authenticate, validate(completeProfileSchema), authController.completeProfile);

export { router as authRoutes };
