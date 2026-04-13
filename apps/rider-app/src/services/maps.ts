import { api, ApiResponse } from './api';

export interface PlacePrediction {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
}

export interface PlaceDetails {
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

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

export interface GeocodedAddress {
  address: string;
  lat: number;
  lng: number;
  locality?: string;
  district?: string;
}

export const mapsApi = {
  searchPlaces: (query: string, sessionToken?: string) =>
    api.post<ApiResponse<PlacePrediction[]>>('/maps/search', { query, sessionToken }),

  getPlaceDetails: (placeId: string, sessionToken?: string) =>
    api.post<ApiResponse<PlaceDetails>>('/maps/place-details', { placeId, sessionToken }),

  getRoute: (originLat: number, originLng: number, destLat: number, destLng: number) =>
    api.post<ApiResponse<RouteInfo>>('/maps/route', { originLat, originLng, destLat, destLng }),

  reverseGeocode: (lat: number, lng: number) =>
    api.post<ApiResponse<GeocodedAddress>>('/maps/reverse-geocode', { lat, lng }),

  getETA: (originLat: number, originLng: number, destLat: number, destLng: number) =>
    api.post<ApiResponse<{ distanceKm: number; durationMin: number }>>('/maps/eta', { originLat, originLng, destLat, destLng }),
};
