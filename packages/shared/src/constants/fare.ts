import { FareConfig } from '../types/ride';

/**
 * Default fare configurations based on Kerala auto-rickshaw government rates.
 * These serve as defaults; actual rates are stored in the database and can be
 * updated per city via the admin dashboard.
 */
export const DEFAULT_FARE_CONFIGS: Record<string, FareConfig> = {
  taliparamba_auto: {
    city: 'taliparamba',
    vehicleType: 'AUTO',
    baseFare: 30,
    baseDistanceKm: 1.5,
    perKmRate: 15,
    perMinRate: 1.5,
    minFare: 30,
    nightStart: '22:00',
    nightEnd: '05:00',
    nightMultiplier: 1.25,
  },
  kannur_auto: {
    city: 'kannur',
    vehicleType: 'AUTO',
    baseFare: 30,
    baseDistanceKm: 1.5,
    perKmRate: 15,
    perMinRate: 1.5,
    minFare: 30,
    nightStart: '22:00',
    nightEnd: '05:00',
    nightMultiplier: 1.25,
  },
  kochi_auto: {
    city: 'kochi',
    vehicleType: 'AUTO',
    baseFare: 30,
    baseDistanceKm: 1.5,
    perKmRate: 15,
    perMinRate: 1.5,
    minFare: 30,
    nightStart: '22:00',
    nightEnd: '05:00',
    nightMultiplier: 1.25,
  },
  calicut_auto: {
    city: 'calicut',
    vehicleType: 'AUTO',
    baseFare: 28,
    baseDistanceKm: 1.5,
    perKmRate: 14,
    perMinRate: 1.5,
    minFare: 28,
    nightStart: '22:00',
    nightEnd: '05:00',
    nightMultiplier: 1.25,
  },
};

/**
 * Common fixed routes in Taliparamba with pre-calculated fares.
 * Displayed to riders for quick booking without entering destination.
 */
export const TALIPARAMBA_QUICK_ROUTES = [
  { from: 'Taliparamba Bus Stand', to: 'Kannapuram Railway Station', distanceKm: 10, estimatedFare: 158, durationMin: 20 },
  { from: 'Taliparamba Bus Stand', to: 'Trichambaram Temple', distanceKm: 1.5, estimatedFare: 30, durationMin: 5 },
  { from: 'Taliparamba Bus Stand', to: 'Manna Junction', distanceKm: 3, estimatedFare: 53, durationMin: 8 },
  { from: 'Taliparamba Bus Stand', to: 'Govt Hospital', distanceKm: 2, estimatedFare: 38, durationMin: 6 },
  { from: 'Kannapuram Railway Station', to: 'Taliparamba Town', distanceKm: 10, estimatedFare: 158, durationMin: 20 },
];
