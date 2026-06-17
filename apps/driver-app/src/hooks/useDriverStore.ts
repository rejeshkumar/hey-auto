import { create } from 'zustand';
import { storage } from '../utils/storage';
import { driverApi, DriverProfile, EarningsSummary } from '../services/driver';
import { socketService } from '../services/socket';
import { stopBackgroundLocation } from '../services/backgroundLocation';

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
  riderName?: string;
  riderPhone?: string;
  riderRating?: number;
  pickupAddress: string;
  dropoffAddress: string;
  pickupLat: number;
  pickupLng: number;
  dropoffLat?: number;
  dropoffLng?: number;
  estimatedFare: number;
  estimatedDistanceKm?: number;
  distance?: number;
  estimatedDurationMin?: number;
  expiresAt?: number;
  rideType?: 'PASSENGER' | 'PARCEL';
  parcelDescription?: string;
  recipientName?: string;
  queuePosition?: number;
  standName?: string;
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
    stopBackgroundLocation().catch(() => {}); // stop OS-level background task too
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
      const profile = data.data;
      set({ profile });
      // Sync online state from server — source of truth
      if (profile?.isOnline && get().phase === 'offline') {
        set({ isOnline: true, phase: 'online_idle' });
      } else if (!profile?.isOnline) {
        set({ isOnline: false, phase: 'offline' });
      }
    } catch {}

    // Restore active ride if app was killed mid-trip
    if (get().currentRideId) return; // already have a ride in memory
    try {
      const { data } = await driverApi.getActiveRide();
      const ride = data.data;
      if (!ride) return;
      // OTP_VERIFIED means OTP passed but startRide wasn't called — finish it now
      if (ride.status === 'OTP_VERIFIED') {
        try { await driverApi.startRide(ride.id); } catch {}
      }
      const phaseMap: Record<string, DriverPhase> = {
        DRIVER_ASSIGNED: 'heading_to_pickup',
        DRIVER_ARRIVED:  'arrived_at_pickup',
        OTP_VERIFIED:    'on_trip',
        IN_PROGRESS:     'on_trip',
      };
      const restoredPhase = phaseMap[ride.status];
      if (!restoredPhase) return;
      set({
        currentRideId: ride.id,
        phase: restoredPhase,
        incomingRequest: {
          rideId: ride.id,
          riderName: ride.rider?.fullName ?? 'Rider',
          riderPhone: ride.rider?.phone,
          pickupAddress: ride.pickupAddress,
          dropoffAddress: ride.dropoffAddress,
          pickupLat: ride.pickupLat,
          pickupLng: ride.pickupLng,
          dropoffLat: ride.dropoffLat,
          dropoffLng: ride.dropoffLng,
          estimatedFare: ride.estimatedFare ?? 0,
          estimatedDistanceKm: ride.estimatedDistanceKm,
        },
        rideOtp: ride.rideOtp ?? null,
      });
    } catch {}
  },

  loadEarnings: async () => {
    try {
      const { data } = await driverApi.getEarnings();
      set({ earnings: data.data });
    } catch {}
  },
}));
