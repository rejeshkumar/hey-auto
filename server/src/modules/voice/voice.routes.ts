import { Router } from 'express';
import multer from 'multer';
import { voiceController } from './voice.controller';
import { authenticate, authorize } from '../../middleware/auth';

const router = Router();

// Audio stored in memory (max 10MB — a 60s recording is ~2MB)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.use(authenticate);

// Riders only — voice booking
router.post('/process', authorize('RIDER'), upload.single('audio'), voiceController.process);
router.post('/tts',     authorize('RIDER'), voiceController.tts);

export { router as voiceRoutes };
