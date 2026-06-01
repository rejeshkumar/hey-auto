import { z } from 'zod';

export const sendOtpSchema = z.object({
  phone: z
    .string()
    .regex(/^[6-9]\d{9}$/, 'Invalid Indian phone number')
    .transform((v) => `+91${v}`),
  role: z.enum(['RIDER', 'DRIVER']).default('RIDER'),
});

export const verifyOtpSchema = z.object({
  phone: z
    .string()
    .regex(/^[6-9]\d{9}$/, 'Invalid Indian phone number')
    .transform((v) => `+91${v}`),
  otp: z.string().length(6, 'OTP must be 6 digits'),
  role: z.enum(['RIDER', 'DRIVER']).default('RIDER'),
  deviceId: z.string().optional(),
});

// Admin-only schemas — used only on /admin/auth/* endpoints, never public
export const adminSendOtpSchema = z.object({
  phone: z
    .string()
    .regex(/^[6-9]\d{9}$/, 'Invalid Indian phone number')
    .transform((v) => `+91${v}`),
});

export const adminVerifyOtpSchema = z.object({
  phone: z
    .string()
    .regex(/^[6-9]\d{9}$/, 'Invalid Indian phone number')
    .transform((v) => `+91${v}`),
  otp: z.string().length(6, 'OTP must be 6 digits'),
  deviceId: z.string().optional(),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token required'),
});

export const completeProfileSchema = z.object({
  fullName: z.string().min(2).max(100),
  email: z.string().email().optional(),
  language: z.enum(['ml', 'en', 'hi']).default('ml'),
});

export type SendOtpInput = z.infer<typeof sendOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type CompleteProfileInput = z.infer<typeof completeProfileSchema>;
