import { z } from 'zod';

// ── Meta Cloud API incoming message types ─────────────────────────────────────

const waTextSchema = z.object({ body: z.string() });

const waInteractiveSchema = z.object({
  type: z.enum(['button_reply', 'list_reply']),
  button_reply: z.object({ id: z.string(), title: z.string() }).optional(),
  list_reply: z.object({ id: z.string(), title: z.string() }).optional(),
});

const waLocationSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  name: z.string().optional(),
  address: z.string().optional(),
});

export const waIncomingMessageSchema = z.object({
  from: z.string(),
  id: z.string(),
  timestamp: z.string(),
  type: z.string(),
  text: waTextSchema.optional(),
  interactive: waInteractiveSchema.optional(),
  location: waLocationSchema.optional(),
});

const waContactSchema = z.object({
  profile: z.object({ name: z.string() }),
  wa_id: z.string(),
});

const waValueSchema = z.object({
  messaging_product: z.literal('whatsapp'),
  metadata: z.object({
    display_phone_number: z.string(),
    phone_number_id: z.string(),
  }),
  contacts: z.array(waContactSchema).optional(),
  messages: z.array(waIncomingMessageSchema).optional(),
  statuses: z.array(z.any()).optional(),
});

// ── Meta Cloud API webhook envelope ──────────────────────────────────────────

export const metaWebhookSchema = z.object({
  object: z.string(),
  entry: z.array(
    z.object({
      id: z.string(),
      changes: z.array(
        z.object({
          value: waValueSchema,
          field: z.string(),
        }),
      ),
    }),
  ),
});

// ── Twilio WhatsApp webhook (form-encoded body) ───────────────────────────────
// From: "whatsapp:+919876543210"

export const twilioWhatsAppSchema = z.object({
  Body: z.string().default(''),
  From: z.string(),
  To: z.string().optional(),
  ProfileName: z.string().optional(),
  Latitude: z.string().optional(),
  Longitude: z.string().optional(),
  MessageSid: z.string().optional(),
});

// ── Webhook GET verification (Meta standard) ──────────────────────────────────

export const webhookVerifyQuerySchema = z.object({
  'hub.mode': z.string(),
  'hub.verify_token': z.string(),
  'hub.challenge': z.string(),
});

export type MetaWebhookPayload = z.infer<typeof metaWebhookSchema>;
export type TwilioWhatsAppPayload = z.infer<typeof twilioWhatsAppSchema>;
export type WaIncomingMessage = z.infer<typeof waIncomingMessageSchema>;
