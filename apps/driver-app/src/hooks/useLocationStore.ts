import { create } from 'zustand';

interface LocationState {
  currentLat: number | null;
  currentLng: number | null;
  permissionGranted: boolean;
  isLocating: boolean;
  heading: number | null;

  setCurrentLocation: (lat: number, lng: number) => void;
  setPermission: (granted: boolean) => void;
  setLocating: (locating: boolean) => void;
  setHeading: (heading: number) => void;
}

export const useLocationStore = create<LocationState>((set) => ({
  currentLat: null,
  currentLng: null,
  permissionGranted: false,
  isLocating: false,
  heading: null,

  setCurrentLocation: (lat, lng) => set({ currentLat: lat, currentLng: lng }),
  setPermission: (granted) => set({ permissionGranted: granted }),
  setLocating: (isLocating) => set({ isLocating }),
  setHeading: (heading) => set({ heading }),
}));
