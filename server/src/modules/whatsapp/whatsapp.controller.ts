import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { whatsappService, devInboxPop } from './whatsapp.service';
import { metaWebhookSchema, twilioWhatsAppSchema, webhookVerifyQuerySchema } from './whatsapp.schema';
import { BadRequestError } from '../../utils/errors';
import { logger } from '../../utils/logger';
import { env } from '../../config/env';

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
        // Verify Twilio request signature when auth token is configured
        if (env.TWILIO_AUTH_TOKEN) {
          const twilioSig = req.headers['x-twilio-signature'] as string | undefined;
          if (!twilioSig) {
            throw new BadRequestError('Missing Twilio signature');
          }
          const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
          const params = req.body as Record<string, string>;
          const sortedKeys = Object.keys(params).sort();
          const valueString = sortedKeys.reduce((acc, k) => acc + k + params[k], url);
          const expected = crypto
            .createHmac('sha1', env.TWILIO_AUTH_TOKEN)
            .update(valueString)
            .digest('base64');
          const expectedBuf = Buffer.from(expected);
          const sigBuf = Buffer.from(twilioSig);
          const valid =
            expectedBuf.length === sigBuf.length &&
            crypto.timingSafeEqual(expectedBuf, sigBuf);
          if (!valid) {
            logger.warn('Twilio webhook signature mismatch');
            throw new BadRequestError('Invalid Twilio signature');
          }
        }

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

  /** GET /dev-inbox/:phone — returns the last bot reply (dev mode only, no Twilio/Meta configured) */
  async devInbox(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const phone = req.params.phone as string;
      const msg = await devInboxPop(phone);
      res.json({ success: true, data: { message: msg ?? null } });
    } catch (err) {
      next(err);
    }
  }
}

export const whatsappController = new WhatsAppController();
