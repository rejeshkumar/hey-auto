import { z } from 'zod';

export const updateRiderProfileSchema = z.object({
  fullName: z.string().min(2).max(100).optional(),
  email: z.string().email().optional(),
  language: z.enum(['ml', 'en', 'hi']).optional(),
  homeLat: z.number().optional(),
  homeLng: z.number().optional(),
  homeAddress: z.string().optional(),
  workLat: z.number().optional(),
  workLng: z.number().optional(),
  workAddress: z.string().optional(),
});

export const savedPlaceSchema = z.object({
  label: z.string().min(1).max(50),
  address: z.string().min(1),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const emergencyContactSchema = z.object({
  name: z.string().min(1).max(100),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Invalid Indian phone number'),
  relationship: z.string().max(50).optional(),
});

export type UpdateRiderProfileInput = z.infer<typeof updateRiderProfileSchema>;
export type SavedPlaceInput = z.infer<typeof savedPlaceSchema>;
export type EmergencyContactInput = z.infer<typeof emergencyContactSchema>;
