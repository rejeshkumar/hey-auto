import { api, ApiResponse } from './api';

export interface RouteStep {
  instruction: string;
  distanceKm: number;
  durationMin: number;
  startLocation: { lat: number; lng: number };
  endLocation: { lat: number; lng: number };
  polyline: string;
  maneuver?: string;
}

export interface RouteInfo {
  distanceKm: number;
  durationMin: number;
  polyline: string;
  steps: RouteStep[];
  startAddress: string;
  endAddress: string;
}

export const mapsApi = {
  getRoute: (originLat: number, originLng: number, destLat: number, destLng: number) =>
    api.post<ApiResponse<RouteInfo>>('/maps/route', { originLat, originLng, destLat, destLng }),

  reverseGeocode: (lat: number, lng: number) =>
    api.post<ApiResponse<{ address: string; lat: number; lng: number }>>('/maps/reverse-geocode', { lat, lng }),

  getETA: (originLat: number, originLng: number, destLat: number, destLng: number) =>
    api.post<ApiResponse<{ distanceKm: number; durationMin: number }>>('/maps/eta', { originLat, originLng, destLat, destLng }),
};
