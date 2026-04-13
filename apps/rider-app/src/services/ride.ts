import { api, ApiResponse } from './api';

export interface FareEstimate {
  baseFare: number;
  distanceFare: number;
  timeFare: number;
  nightSurcharge: number;
  totalFare: number;
  distanceKm: number;
  durationMin: number;
  currency: string;
  ratePerKm: number;
}

export interface Ride {
  id: string;
  riderId: string;
  driverId?: string;
  pickupLat: number;
  pickupLng: number;
  pickupAddress: string;
  dropoffLat: number;
  dropoffLng: number;
  dropoffAddress: string;
  estimatedFare: number;
  actualFare?: number;
  totalAmount?: number;
  nightSurcharge: number;
  tipAmount: number;
  status: string;
  rideOtp?: string;
  paymentMethod: string;
  requestedAt: string;
  acceptedAt?: string;
  completedAt?: string;
  estimatedDistanceKm?: number;
  estimatedDurationMin?: number;
  actualDistanceKm?: number;
  actualDurationMin?: number;
}

export interface RideWithDriver extends Ride {
  rider: { fullName: string; phone: string; avatarUrl?: string };
  driver?: { fullName: string; phone: string; avatarUrl?: string };
  vehicle?: { registrationNo: string; color?: string; model?: string };
}

export const rideApi = {
  getFareEstimate: (data: {
    pickupLat: number;
    pickupLng: number;
    dropoffLat: number;
    dropoffLng: number;
    city?: string;
  }) => api.post<ApiResponse<FareEstimate>>('/rides/estimate', { city: 'taliparamba', ...data }),

  requestRide: (data: {
    pickupLat: number;
    pickupLng: number;
    pickupAddress: string;
    dropoffLat: number;
    dropoffLng: number;
    dropoffAddress: string;
    paymentMethod?: string;
  }) => api.post<ApiResponse<Ride>>('/rides/request', { city: 'taliparamba', paymentMethod: 'CASH', ...data }),

  getRideDetails: (rideId: string) =>
    api.get<ApiResponse<RideWithDriver>>(`/rides/${rideId}`),

  cancelRide: (rideId: string, reason?: string) =>
    api.post<ApiResponse<Ride>>(`/rides/${rideId}/cancel`, { reason }),

  rateRide: (rideId: string, rating: number, review?: string, tipAmount?: number) =>
    api.post(`/rides/${rideId}/rate`, { rating, review, tipAmount }),
};
