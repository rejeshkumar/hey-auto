import { create } from 'zustand';

interface LocationState {
  currentLat: number | null;
  currentLng: number | null;
  permissionGranted: boolean;
  isLocating: boolean;

  setCurrentLocation: (lat: number, lng: number) => void;
  setPermission: (granted: boolean) => void;
  setLocating: (locating: boolean) => void;
}

export const useLocationStore = create<LocationState>((set) => ({
  currentLat: null,
  currentLng: null,
  permissionGranted: false,
  isLocating: false,

  setCurrentLocation: (lat, lng) => set({ currentLat: lat, currentLng: lng }),
  setPermission: (granted) => set({ permissionGranted: granted }),
  setLocating: (isLocating) => set({ isLocating }),
}));
