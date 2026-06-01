import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  API_VERSION: z.string().default('v1'),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('30d'),

  FAST2SMS_API_KEY: z.string().optional(),

  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),

  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),

  GOOGLE_MAPS_API_KEY: z.string().optional(),

  // Cloudflare R2 (preferred — zero egress cost)
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().optional(),
  R2_PUBLIC_URL: z.string().optional(), // e.g. https://files.heyauto.in (custom domain on R2)

  // AWS S3 (legacy fallback — kept for backward compatibility)
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().default('ap-south-1'),
  AWS_S3_BUCKET: z.string().default('heyauto-uploads'),

  // Firebase — FCM Server Key only needed for Expo dashboard registration (not used at runtime)
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FCM_SERVER_KEY: z.string().optional(),

  SENTRY_DSN: z.string().optional(),

  WHATSAPP_VERIFY_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_API_VERSION: z.string().default('v19.0'),

  DRIVER_SEARCH_RADIUS_KM: z.coerce.number().default(3),
  RIDE_REQUEST_TIMEOUT_SEC: z.coerce.number().default(15),
  MAX_MATCHING_ROUNDS: z.coerce.number().default(3),
  OTP_EXPIRY_SEC: z.coerce.number().default(300),

  // Comma-separated phone numbers exempt from subscription check (testing only)
  BYPASS_SUBSCRIPTION_PHONES: z.string().optional(),
  // Comma-separated phone numbers that always get OTP 123456 (testing, even when WhatsApp is live)
  DEMO_OTP_PHONES: z.string().optional(),

  // Sarvam AI — Malayalam STT + TTS
  SARVAM_API_KEY: z.string().optional(),

  // Anthropic — Claude for voice NLU
  ANTHROPIC_API_KEY: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
