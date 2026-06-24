import { Router } from 'express';
import multer from 'multer';
import { voiceController } from './voice.controller';
import { authenticate, authorize } from '../../middleware/auth';

const router = Router();

const ALLOWED_AUDIO_MAGIC: Array<{ bytes: number[]; mask?: number[] }> = [
  { bytes: [0x52, 0x49, 0x46, 0x46] },          // WAV  — RIFF
  { bytes: [0x49, 0x44, 0x33] },                  // MP3  — ID3
  { bytes: [0xFF, 0xFB] },                         // MP3  — frame sync
  { bytes: [0x00, 0x00, 0x00], mask: undefined },  // M4A/AAC — checked by mimetype below
  { bytes: [0x1A, 0x45, 0xDF, 0xA3] },            // WebM/Opus
];

// Audio stored in memory (max 10MB — a 60s recording is ~2MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /audio\/(wav|wave|mpeg|mp4|m4a|aac|webm|ogg)|video\/webm/;
    if (!allowed.test(file.mimetype)) {
      return cb(new Error('Only audio files are accepted'));
    }
    cb(null, true);
  },
});

router.use(authenticate);

// Riders only — voice booking
router.post('/process', authorize('RIDER'), upload.single('audio'), voiceController.process);
router.post('/tts',     authorize('RIDER'), voiceController.tts);

export { router as voiceRoutes };
