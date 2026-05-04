import { api, ApiResponse } from './api';

export interface DriverProfile {
  id: string;
  phone: string;
  fullName: string;
  email?: string;
  language: string;
  avatarUrl?: string;
  rating: number;
  totalRides: number;
  totalEarnings: number;
  acceptanceRate: number;
  isOnline: boolean;
  licenseNumber?: string;
  licenseExpiry?: string;
  verificationStatus: string;
  vehicles?: Vehicle[];
}

export interface Vehicle {
  id: string;
  registrationNo: string;
  model?: string;
  color?: string;
  year?: number;
  permitNumber?: string;
  permitExpiry?: string;
  insuranceExpiry?: string;
  fitnessExpiry?: string;
  isActive: boolean;
}

export interface EarningsSummary {
  today: number;
  thisWeek: number;
  thisMonth: number;
  totalRidesToday: number;
  totalRidesWeek: number;
  totalRidesMonth: number;
  averagePerRide: number;
  tipsToday: number;
}

export interface RideHistoryItem {
  id: string;
  pickupAddress: string;
  dropoffAddress: string;
  totalAmount: number;
  estimatedFare: number;
  tipAmount: number;
  status: string;
  completedAt?: string;
  requestedAt: string;
  actualDistanceKm?: number;
  actualDurationMin?: number;
  rider?: { fullName: string; rating: number };
}

export const driverApi = {
  getProfile: () =>
    api.get<ApiResponse<DriverProfile>>('/driver/profile'),

  updateProfile: (data: Partial<{ fullName: string; email: string; language: string }>) =>
    api.put<ApiResponse<DriverProfile>>('/driver/profile', data),

  goOnline: (lat: number, lng: number) =>
    api.post<ApiResponse<{ isOnline: boolean }>>('/driver/go-online', { lat, lng }),

  goOffline: () =>
    api.post<ApiResponse<{ isOnline: boolean }>>('/driver/go-offline'),

  updateLocation: (lat: number, lng: number) =>
    api.post('/driver/location', { lat, lng }),

  getVehicle: () =>
    api.get<ApiResponse<Vehicle>>('/driver/vehicle'),

  registerVehicle: (data: {
    registrationNo: string;
    model?: string;
    color?: string;
    year?: number;
    permitNumber?: string;
  }) => api.post<ApiResponse<Vehicle>>('/driver/vehicle', data),

  updateVehicle: (vehicleId: string, data: {
    model?: string;
    color?: string;
    year?: number;
  }) => api.put<ApiResponse<Vehicle>>(`/driver/vehicle/${vehicleId}`, data),

  getEarnings: () =>
    api.get<ApiResponse<EarningsSummary>>('/driver/earnings'),

  getRideHistory: (page = 1) =>
    api.get(`/driver/rides/history?page=${page}&limit=20`),

  acceptRide: (rideId: string) =>
    api.post<ApiResponse<any>>(`/rides/${rideId}/accept`),

  arrivedAtPickup: (rideId: string) =>
    api.post<ApiResponse<any>>(`/rides/${rideId}/arrived`),

  startRide: (rideId: string, otp: string) =>
    api.post<ApiResponse<any>>(`/rides/${rideId}/start`, { otp }),

  completeRide: (rideId: string) =>
    api.post<ApiResponse<any>>(`/rides/${rideId}/complete`),

  rateRide: (rideId: string, rating: number) =>
    api.post<ApiResponse<any>>(`/rides/${rideId}/rate`, { rating }),

  getSubscriptionStatus: () =>
    api.get<ApiResponse<any>>('/subscription/status'),

  getSubscriptionPlans: () =>
    api.get<ApiResponse<any>>('/subscription/plans'),

  verifySubscriptionUTR: (data: { utrNumber: string; planId: string; amount: number }) =>
    api.post<ApiResponse<any>>('/subscription/verify-utr', data),

  uploadDocument: (data: { docType: string; docUrl: string; docNumber?: string }) =>
    api.post<ApiResponse<any>>('/driver/documents', data),

  uploadDocumentFile: (formData: FormData) =>
    api.post<ApiResponse<any>>('/driver/documents', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  getDocuments: () =>
    api.get<ApiResponse<any>>('/driver/documents'),
};
