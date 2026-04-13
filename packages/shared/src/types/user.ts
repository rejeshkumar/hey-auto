import { Location, SupportedCity, SupportedLanguage } from './common';

export type UserRole = 'RIDER' | 'DRIVER' | 'ADMIN';
export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED' | 'PENDING_VERIFICATION';
export type VerificationStatus = 'PENDING' | 'IN_REVIEW' | 'VERIFIED' | 'REJECTED';
export type VehicleType = 'AUTO' | 'E_AUTO';
export type FuelType = 'PETROL' | 'DIESEL' | 'CNG' | 'ELECTRIC';
export type DocumentType =
  | 'DRIVING_LICENSE'
  | 'VEHICLE_RC'
  | 'INSURANCE'
  | 'PERMIT'
  | 'AADHAAR'
  | 'PHOTO'
  | 'VEHICLE_PHOTO';
export type DocumentStatus = 'PENDING' | 'VERIFIED' | 'REJECTED' | 'EXPIRED';

export interface User {
  id: string;
  phone: string;
  email?: string;
  fullName: string;
  avatarUrl?: string;
  language: SupportedLanguage;
  role: UserRole;
  status: UserStatus;
}

export interface RiderProfile {
  id: string;
  userId: string;
  homeLocation?: Location;
  homeAddress?: string;
  workLocation?: Location;
  workAddress?: string;
  rating: number;
  totalRides: number;
}

export interface DriverProfile {
  id: string;
  userId: string;
  licenseNumber: string;
  rating: number;
  totalRides: number;
  totalEarnings: number;
  isOnline: boolean;
  isOnRide: boolean;
  currentLocation?: Location;
  city: SupportedCity;
  verificationStatus: VerificationStatus;
  acceptanceRate: number;
}

export interface Vehicle {
  id: string;
  driverId: string;
  registrationNo: string;
  vehicleType: VehicleType;
  make?: string;
  model?: string;
  year?: number;
  fuelType?: FuelType;
  color?: string;
  seatCapacity: number;
}

export interface DriverDocument {
  id: string;
  driverId: string;
  docType: DocumentType;
  docUrl: string;
  docNumber?: string;
  expiryDate?: string;
  status: DocumentStatus;
  rejectionReason?: string;
}

export interface SavedPlace {
  id: string;
  userId: string;
  label: string;
  address: string;
  location: Location;
}

export interface EmergencyContact {
  id: string;
  userId: string;
  name: string;
  phone: string;
  relationship?: string;
}
