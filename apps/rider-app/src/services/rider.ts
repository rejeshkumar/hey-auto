import { api, ApiResponse } from './api';

export interface RiderProfile {
  id: string;
  phone: string;
  fullName: string;
  email?: string;
  language: string;
  avatarUrl?: string;
  rating: number;
  totalRides: number;
  walletBalance: number;
  homeAddress?: string;
  workAddress?: string;
}

export interface SavedPlace {
  id: string;
  label: string;
  address: string;
  lat: number;
  lng: number;
}

export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relationship?: string;
}

export const riderApi = {
  getProfile: () =>
    api.get<ApiResponse<RiderProfile>>('/rider/profile'),

  updateProfile: (data: Partial<{ fullName: string; email: string; language: string }>) =>
    api.put<ApiResponse<RiderProfile>>('/rider/profile', data),

  getSavedPlaces: () =>
    api.get<ApiResponse<SavedPlace[]>>('/rider/saved-places'),

  addSavedPlace: (data: { label: string; address: string; lat: number; lng: number }) =>
    api.post<ApiResponse<SavedPlace>>('/rider/saved-places', data),

  deleteSavedPlace: (id: string) =>
    api.delete(`/rider/saved-places/${id}`),

  getEmergencyContacts: () =>
    api.get<ApiResponse<EmergencyContact[]>>('/rider/emergency-contacts'),

  addEmergencyContact: (data: { name: string; phone: string; relationship?: string }) =>
    api.post<ApiResponse<EmergencyContact>>('/rider/emergency-contacts', data),

  deleteEmergencyContact: (id: string) =>
    api.delete(`/rider/emergency-contacts/${id}`),

  getRideHistory: (page = 1) =>
    api.get(`/rider/rides/history?page=${page}&limit=20`),
};
