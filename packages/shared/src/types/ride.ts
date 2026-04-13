import { Location, SupportedCity } from './common';
import { PaymentMethod, PaymentStatus } from './payment';

export type RideStatus =
  | 'REQUESTED'
  | 'DRIVER_ASSIGNED'
  | 'DRIVER_ARRIVED'
  | 'OTP_VERIFIED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED_RIDER'
  | 'CANCELLED_DRIVER'
  | 'NO_DRIVERS';

export interface FareEstimate {
  baseFare: number;
  distanceFare: number;
  timeFare: number;
  nightSurcharge: number;
  totalFare: number;
  distanceKm: number;
  durationMin: number;
  currency: string;
}

export interface RideRequest {
  pickupLocation: Location;
  pickupAddress: string;
  dropoffLocation: Location;
  dropoffAddress: string;
  paymentMethod: PaymentMethod;
  city: SupportedCity;
}

export interface Ride {
  id: string;
  riderId: string;
  driverId?: string;
  vehicleId?: string;

  pickupLocation: Location;
  pickupAddress: string;
  dropoffLocation: Location;
  dropoffAddress: string;

  estimatedDistanceKm?: number;
  actualDistanceKm?: number;
  estimatedDurationMin?: number;
  actualDurationMin?: number;

  estimatedFare: number;
  actualFare?: number;
  nightSurcharge: number;
  tipAmount: number;
  totalAmount?: number;

  status: RideStatus;
  rideOtp?: string;

  requestedAt: string;
  acceptedAt?: string;
  arrivedAt?: string;
  startedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  cancellationReason?: string;

  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  city: SupportedCity;
}

export interface RideDriverInfo {
  driverId: string;
  driverName: string;
  driverPhone: string;
  driverAvatar?: string;
  driverRating: number;
  vehicleRegistrationNo: string;
  vehicleColor?: string;
  vehicleModel?: string;
  currentLocation: Location;
}

export interface FareConfig {
  city: SupportedCity;
  vehicleType: string;
  baseFare: number;
  baseDistanceKm: number;
  perKmRate: number;
  perMinRate: number;
  minFare: number;
  nightStart: string;
  nightEnd: string;
  nightMultiplier: number;
}
