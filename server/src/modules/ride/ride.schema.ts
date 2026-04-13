import { z } from 'zod';

export const fareEstimateSchema = z.object({
  pickupLat: z.number().min(-90).max(90),
  pickupLng: z.number().min(-180).max(180),
  dropoffLat: z.number().min(-90).max(90),
  dropoffLng: z.number().min(-180).max(180),
  city: z.string().default('taliparamba'),
});

export const requestRideSchema = z.object({
  pickupLat: z.number().min(-90).max(90),
  pickupLng: z.number().min(-180).max(180),
  pickupAddress: z.string().min(1),
  dropoffLat: z.number().min(-90).max(90),
  dropoffLng: z.number().min(-180).max(180),
  dropoffAddress: z.string().min(1),
  paymentMethod: z.enum(['CASH', 'UPI', 'WALLET', 'CARD']).default('CASH'),
  city: z.string().default('taliparamba'),
});

export const cancelRideSchema = z.object({
  reason: z.string().max(500).optional(),
});

export const rateRideSchema = z.object({
  rating: z.number().int().min(1).max(5),
  review: z.string().max(500).optional(),
  tipAmount: z.number().min(0).max(1000).optional(),
});

export type FareEstimateInput = z.infer<typeof fareEstimateSchema>;
export type RequestRideInput = z.infer<typeof requestRideSchema>;
export type CancelRideInput = z.infer<typeof cancelRideSchema>;
export type RateRideInput = z.infer<typeof rateRideSchema>;
