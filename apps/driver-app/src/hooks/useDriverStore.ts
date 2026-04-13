import { create } from 'zustand';
import { storage } from '../utils/storage';
import { driverApi, DriverProfile, EarningsSummary } from '../services/driver';
import { socketService } from '../services/socket';

export type DriverPhase =
  | 'offline'
  | 'online_idle'
  | 'ride_request'
  | 'heading_to_pickup'
  | 'arrived_at_pickup'
  | 'on_trip'
  | 'trip_completed';

export interface IncomingRideRequest {
  rideId: string;
  riderName: string;
  riderRating: number;
  pickupAddress: string;
  dropoffAddress: string;
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  estimatedFare: number;
  estimatedDistanceKm: number;
  estimatedDurationMin: number;
  expiresAt: number;
}

interface DriverState {
  phase: DriverPhase;
  isOnline: boolean;
  profile: DriverProfile | null;
  earnings: EarningsSummary | null;
  incomingRequest: IncomingRideRequest | null;
  currentRideId: string | null;
  rideOtp: string | null;
  riderLocation: { lat: number; lng: number } | null;

  setPhase: (phase: DriverPhase) => void;
  goOnline: (lat: number, lng: number) => Promise<void>;
  goOffline: () => Promise<void>;
  setProfile: (profile: DriverProfile) => void;
  setEarnings: (earnings: EarningsSummary) => void;
  setIncomingRequest: (req: IncomingRideRequest | null) => void;
  setCurrentRideId: (id: string | null) => void;
  setRideOtp: (otp: string | null) => void;
  setRiderLocation: (loc: { lat: number; lng: number } | null) => void;
  acceptRide: (rideId: string) => Promise<void>;
  resetRide: () => void;
  loadProfile: () => Promise<void>;
  loadEarnings: () => Promise<void>;
}

export const useDriverStore = create<DriverState>((set, get) => ({
  phase: 'offline',
  isOnline: false,
  profile: null,
  earnings: null,
  incomingRequest: null,
  currentRideId: null,
  rideOtp: null,
  riderLocation: null,

  setPhase: (phase) => set({ phase }),
  setProfile: (profile) => set({ profile }),
  setEarnings: (earnings) => set({ earnings }),
  setIncomingRequest: (incomingRequest) => set({ incomingRequest }),
  setCurrentRideId: (currentRideId) => set({ currentRideId }),
  setRideOtp: (rideOtp) => set({ rideOtp }),
  setRiderLocation: (riderLocation) => set({ riderLocation }),

  goOnline: async (lat, lng) => {
    await driverApi.goOnline(lat, lng);
    storage.set('isOnline', 'true');
    set({ isOnline: true, phase: 'online_idle' });
  },

  goOffline: async () => {
    await driverApi.goOffline();
    socketService.stopLocationUpdates();
    storage.set('isOnline', 'false');
    set({ isOnline: false, phase: 'offline' });
  },

  acceptRide: async (rideId) => {
    await driverApi.acceptRide(rideId);
    set({ currentRideId: rideId, incomingRequest: null, phase: 'heading_to_pickup' });
  },

  resetRide: () =>
    set({
      phase: get().isOnline ? 'online_idle' : 'offline',
      incomingRequest: null,
      currentRideId: null,
      rideOtp: null,
      riderLocation: null,
    }),

  loadProfile: async () => {
    try {
      const { data } = await driverApi.getProfile();
      set({ profile: data.data });
    } catch {}
  },

  loadEarnings: async () => {
    try {
      const { data } = await driverApi.getEarnings();
      set({ earnings: data.data });
    } catch {}
  },
}));
