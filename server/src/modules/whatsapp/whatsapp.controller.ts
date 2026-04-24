import { Request, Response, NextFunction } from 'express';
import { whatsappService } from './whatsapp.service';
import { metaWebhookSchema, twilioWhatsAppSchema, webhookVerifyQuerySchema } from './whatsapp.schema';
import { BadRequestError } from '../../utils/errors';
import { logger } from '../../utils/logger';

export class WhatsAppController {
  /**
   * GET /webhook
   * Meta hub.challenge verification handshake.
   */
  verify(req: Request, res: Response, next: NextFunction): void {
    try {
      const result = webhookVerifyQuerySchema.safeParse(req.query);
      if (!result.success) {
        throw new BadRequestError('Missing webhook verification parameters');
      }

      const challenge = whatsappService.verifyWebhook(req.query as Record<string, string>);
      if (challenge === null) {
        res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Verification failed' } });
        return;
      }

      // Meta expects a plain text response with the challenge string
      res.status(200).send(challenge);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /webhook
   * Accepts both Meta Cloud API JSON and Twilio form-encoded payloads.
   * Meta sends `application/json`; Twilio sends `application/x-www-form-urlencoded`.
   */
  async incoming(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const contentType = req.headers['content-type'] ?? '';

      if (contentType.includes('application/json')) {
        // ── Meta Cloud API ──────────────────────────────────────────────────
        const parsed = metaWebhookSchema.safeParse(req.body);
        if (!parsed.success) {
          // Meta may send status updates (delivery receipts) we don't handle — ack silently
          logger.debug({ body: req.body }, 'WhatsApp: unrecognised Meta payload, acking');
          res.sendStatus(200);
          return;
        }

        // Respond 200 immediately — Meta requires a fast ack
        res.sendStatus(200);

        // Process asynchronously so we don't hold the connection
        whatsappService.handleMetaWebhook(parsed.data).catch((err) =>
          logger.error({ err }, 'WhatsApp: meta webhook processing error'),
        );
      } else {
        // ── Twilio WhatsApp ─────────────────────────────────────────────────
        const parsed = twilioWhatsAppSchema.safeParse(req.body);
        if (!parsed.success) {
          throw new BadRequestError('Invalid Twilio webhook payload');
        }

        // Twilio expects an empty TwiML response or plain 200
        res.set('Content-Type', 'text/xml').status(200).send('<Response></Response>');

        whatsappService.handleTwilioWebhook(parsed.data).catch((err) =>
          logger.error({ err }, 'WhatsApp: twilio webhook processing error'),
        );
      }
    } catch (err) {
      next(err);
    }
  }
}

export const whatsappController = new WhatsAppController();
