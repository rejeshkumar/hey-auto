import { create } from 'zustand';

export interface Hotspot {
  id: string;
  lat: number;
  lng: number;
  pendingCount: number;
  nearbyDriverCount: number;
  label: string;
  detectedAt: string;
  distanceKm: number;
}

interface HotspotState {
  hotspots: Hotspot[];
  visible: boolean;
  setHotspots: (hotspots: Hotspot[]) => void;
  dismiss: () => void;
}

export const useHotspotStore = create<HotspotState>((set) => ({
  hotspots: [],
  visible: false,
  setHotspots: (hotspots) => set({ hotspots, visible: hotspots.length > 0 }),
  dismiss: () => set({ visible: false }),
}));
