import { Router } from 'express';
import { whatsappController } from './whatsapp.controller';

const router = Router();

/**
 * Webhook routes — no JWT auth (verified by hub.verify_token / Twilio signature).
 *
 * Meta:   GET  /api/v1/whatsapp/webhook  → hub.challenge verification
 *         POST /api/v1/whatsapp/webhook  → incoming messages / status updates
 *
 * Twilio: POST /api/v1/whatsapp/webhook  → incoming WhatsApp messages
 *
 * Configure in Meta Developer portal / Twilio console:
 *   Callback URL: https://your-domain.com/api/v1/whatsapp/webhook
 *   Verify Token: WHATSAPP_VERIFY_TOKEN env var
 */
router.get('/webhook', (req, res, next) => whatsappController.verify(req, res, next));
router.post('/webhook', (req, res, next) => whatsappController.incoming(req, res, next));

export { router as whatsappRoutes };
