import { create } from 'zustand';
import { Ride, FareEstimate, rideApi, RideWithDriver } from '../services/ride';

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
  rideType: 'PASSENGER' | 'PARCEL';
  parcelDescription?: string;
  recipientName?: string;
  recipientPhone?: string;

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
  setRideType: (type: 'PASSENGER' | 'PARCEL') => void;
  setParcelDetails: (details: { parcelDescription?: string; recipientName?: string; recipientPhone?: string }) => void;
  resetRide: () => void;
  restoreActiveRide: () => Promise<RideWithDriver | null>;
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
  rideType: 'PASSENGER',

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
  setRideType: (rideType) => set({ rideType }),
  setParcelDetails: (details) => set(details),

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

  restoreActiveRide: async () => {
    try {
      const { data } = await rideApi.getActiveRide();
      const ride = data.data;
      if (!ride) return null;

      // Restore pickup/dropoff
      set({
        currentRide: ride as unknown as Ride,
        pickup: { lat: ride.pickupLat, lng: ride.pickupLng, address: ride.pickupAddress },
        dropoff: { lat: ride.dropoffLat, lng: ride.dropoffLng, address: ride.dropoffAddress },
      });

      // Restore phase from DB status
      if (ride.status === 'REQUESTED') {
        set({ phase: 'searching_driver' });
      } else if (ride.status === 'DRIVER_ASSIGNED' && ride.driver) {
        set({
          phase: 'driver_assigned',
          driverInfo: {
            driverId: ride.driverId ?? '',
            driverName: ride.driver.fullName,
            driverPhone: ride.driver.phone,
            driverRating: 5,
            vehicleRegistrationNo: ride.vehicle?.registrationNo ?? '',
            vehicleColor: ride.vehicle?.color ?? undefined,
            vehicleModel: ride.vehicle?.model ?? undefined,
            driverLat: 0,
            driverLng: 0,
          },
        });
      } else if (ride.status === 'DRIVER_ARRIVED') {
        set({
          phase: 'driver_arrived',
          rideOtp: ride.rideOtp ?? null,
          driverInfo: ride.driver ? {
            driverId: ride.driverId ?? '',
            driverName: ride.driver.fullName,
            driverPhone: ride.driver.phone,
            driverRating: 5,
            vehicleRegistrationNo: ride.vehicle?.registrationNo ?? '',
            vehicleColor: ride.vehicle?.color ?? undefined,
            vehicleModel: ride.vehicle?.model ?? undefined,
            driverLat: 0,
            driverLng: 0,
          } : null,
        });
      } else if (ride.status === 'IN_PROGRESS' || ride.status === 'OTP_VERIFIED') {
        set({
          phase: 'on_ride',
          driverInfo: ride.driver ? {
            driverId: ride.driverId ?? '',
            driverName: ride.driver.fullName,
            driverPhone: ride.driver.phone,
            driverRating: 5,
            vehicleRegistrationNo: ride.vehicle?.registrationNo ?? '',
            vehicleColor: ride.vehicle?.color ?? undefined,
            vehicleModel: ride.vehicle?.model ?? undefined,
            driverLat: 0,
            driverLng: 0,
          } : null,
        });
      }

      return ride;
    } catch {
      return null;
    }
  },
}));
