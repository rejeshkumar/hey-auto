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
  homeLat?: number;
  homeLng?: number;
  homeAddress?: string;
  isGoHomeMode?: boolean;
  acceptsParcels?: boolean;
  coinsBalance?: number;
}

export interface HeatmapCell {
  geohash: string;
  lat: number;
  lng: number;
  count: number;
}

export interface DailyEarning {
  date: string;
  totalEarnings: number;
  tips: number;
  rides: number;
}

export interface LeaderboardEntry {
  rank: number;
  name: string;
  rides: number;
  rating: number;
  coinsEarned: number;
  isYou: boolean;
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

  updateProfile: (data: Partial<{ fullName: string; email: string; language: string; city: string }>) =>
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

  getPendingRideRequest: () =>
    api.get<ApiResponse<any>>('/driver/ride-request'),

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

  cancelRide: (rideId: string, reason?: string) =>
    api.post<ApiResponse<any>>(`/rides/${rideId}/cancel`, { reason }),

  rateRide: (rideId: string, rating: number) =>
    api.post<ApiResponse<any>>(`/rides/${rideId}/rate`, { rating }),

  getSubscriptionStatus: () =>
    api.get<ApiResponse<any>>('/subscription/status'),

  getSubscriptionPlans: () =>
    api.get<ApiResponse<any>>('/subscription/plans'),

  createSubscriptionPayment: (planId?: string) =>
    api.post<ApiResponse<{ paymentUrl: string; linkId: string; amount: number }>>(
      '/subscription/create-payment',
      { planId },
    ),

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

  setHomeLocation: (lat: number, lng: number, address: string) =>
    api.put<ApiResponse<any>>('/driver/home-location', { lat, lng, address }),

  toggleGoHomeMode: (active: boolean) =>
    api.post<ApiResponse<{ isGoHomeMode: boolean }>>('/driver/go-home', { active }),

  getDemandHeatmap: (lat: number, lng: number, radiusKm = 5) =>
    api.get<ApiResponse<HeatmapCell[]>>(`/driver/demand-heatmap?lat=${lat}&lng=${lng}&radiusKm=${radiusKm}`),

  getQueueStatus: () =>
    api.get<ApiResponse<{ standId: string; standName: string; position: number; totalInQueue: number }[]>>('/driver/queue-status'),

  getDailyEarnings: (days = 7) =>
    api.get<ApiResponse<DailyEarning[]>>(`/driver/earnings/daily?days=${days}`),

  redeemCoins: (planId: string) =>
    api.post<ApiResponse<{ message: string; expiresAt: string }>>('/driver/coins/redeem', { planId }),

  getLeaderboard: () =>
    api.get<ApiResponse<LeaderboardEntry[]>>('/driver/leaderboard'),
};
