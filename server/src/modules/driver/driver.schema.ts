import { z } from 'zod';

export const updateDriverProfileSchema = z.object({
  fullName: z.string().min(2).max(100).optional(),
  email: z.string().email().optional(),
  language: z.enum(['ml', 'en', 'hi']).optional(),
  licenseNumber: z.string().min(5).max(20).optional(),
  aadhaarNumber: z.string().length(12).optional(),
  city: z.string().min(1).optional(),
});

export const vehicleSchema = z.object({
  registrationNo: z.string().min(5).max(20),
  vehicleType: z.enum(['AUTO', 'E_AUTO']).default('AUTO'),
  make: z.string().optional(),
  model: z.string().optional(),
  year: z.number().min(2000).max(2030).optional(),
  fuelType: z.enum(['PETROL', 'DIESEL', 'CNG', 'ELECTRIC']).optional(),
  color: z.string().optional(),
  seatCapacity: z.number().min(1).max(6).default(3),
});

export const updateLocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const documentUploadSchema = z.object({
  docType: z.enum([
    'DRIVING_LICENSE',
    'VEHICLE_RC',
    'INSURANCE',
    'PERMIT',
    'AADHAAR',
    'PHOTO',
    'VEHICLE_PHOTO',
  ]),
  docUrl: z.string().url().optional(),
  docNumber: z.string().optional(),
  expiryDate: z.string().datetime().optional(),
});

export type UpdateDriverProfileInput = z.infer<typeof updateDriverProfileSchema>;
export type VehicleInput = z.infer<typeof vehicleSchema>;
export type UpdateLocationInput = z.infer<typeof updateLocationSchema>;
export type DocumentUploadInput = z.infer<typeof documentUploadSchema>;
