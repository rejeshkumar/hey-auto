import { create } from 'zustand';
import { Ride, FareEstimate } from '../services/ride';

export interface DriverInfo {
  driverId: string;
  driverName: string;
  driverPhone: string;
  driverRating: number;
  driverAvatar?: string;
  vehicleRegistrationNo: string;
  vehicleColor?: string;
  vehicleModel?: string;
  driverLat: number;
  driverLng: number;
}

export type RidePhase =
  | 'idle'
  | 'selecting_destination'
  | 'reviewing_estimate'
  | 'searching_driver'
  | 'driver_assigned'
  | 'driver_arriving'
  | 'driver_arrived'
  | 'on_ride'
  | 'ride_completed'
  | 'no_drivers';

interface Location {
  lat: number;
  lng: number;
  address: string;
}

interface RideState {
  phase: RidePhase;
  pickup: Location | null;
  dropoff: Location | null;
  fareEstimate: FareEstimate | null;
  currentRide: Ride | null;
  driverInfo: DriverInfo | null;
  driverLocation: { lat: number; lng: number } | null;
  rideOtp: string | null;
  paymentMethod: 'CASH' | 'UPI' | 'WALLET';
  completedRideData: any | null;

  setPhase: (phase: RidePhase) => void;
  setPickup: (location: Location) => void;
  setDropoff: (location: Location) => void;
  setFareEstimate: (estimate: FareEstimate) => void;
  setCurrentRide: (ride: Ride) => void;
  setDriverInfo: (info: DriverInfo) => void;
  setDriverLocation: (loc: { lat: number; lng: number }) => void;
  setRideOtp: (otp: string) => void;
  setPaymentMethod: (method: 'CASH' | 'UPI' | 'WALLET') => void;
  setCompletedRideData: (data: any) => void;
  resetRide: () => void;
}

export const useRideStore = create<RideState>((set) => ({
  phase: 'idle',
  pickup: null,
  dropoff: null,
  fareEstimate: null,
  currentRide: null,
  driverInfo: null,
  driverLocation: null,
  rideOtp: null,
  paymentMethod: 'CASH',
  completedRideData: null,

  setPhase: (phase) => set({ phase }),
  setPickup: (pickup) => set({ pickup }),
  setDropoff: (dropoff) => set({ dropoff }),
  setFareEstimate: (fareEstimate) => set({ fareEstimate }),
  setCurrentRide: (currentRide) => set({ currentRide }),
  setDriverInfo: (driverInfo) => set({ driverInfo }),
  setDriverLocation: (driverLocation) => set({ driverLocation }),
  setRideOtp: (rideOtp) => set({ rideOtp }),
  setPaymentMethod: (paymentMethod) => set({ paymentMethod }),
  setCompletedRideData: (completedRideData) => set({ completedRideData }),

  resetRide: () =>
    set({
      phase: 'idle',
      pickup: null,
      dropoff: null,
      fareEstimate: null,
      currentRide: null,
      driverInfo: null,
      driverLocation: null,
      rideOtp: null,
      completedRideData: null,
    }),
}));
