import { create } from 'zustand';
import { storage } from '../utils/storage';
import { authApi, User } from '../services/auth';
import { socketService } from '../services/socket';
import { registerPushToken } from '../services/pushNotifications';
import { setLoginGrace } from '../services/api';

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 < Date.now() + 60000;
  } catch {
    return true;
  }
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isNewUser: boolean;

  setUser: (user: User) => void;
  sendOtp: (phone: string) => Promise<{ expiresIn: number; otp?: string }>;
  verifyOtp: (phone: string, otp: string) => Promise<void>;
  completeProfile: (data: { fullName: string; email?: string; language?: string }) => Promise<void>;
  logout: () => Promise<void>;
  loadSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  isNewUser: false,

  setUser: (user) => {
    set({ user, isAuthenticated: true });
    storage.set('user', JSON.stringify(user));
  },

  sendOtp: async (phone) => {
    const { data } = await authApi.sendOtp(phone);
    return data.data;
  },

  verifyOtp: async (phone, otp) => {
    const { data } = await authApi.verifyOtp(phone, otp);
    const { user, tokens, isNewUser } = data.data;

    // Write tokens to storage FIRST before any API calls that need them
    storage.set('accessToken', tokens.accessToken);
    storage.set('refreshToken', tokens.refreshToken);
    storage.set('user', JSON.stringify(user));

    // Clear stale ride state from any previous session
    const { useRideStore } = require('./useRideStore');
    useRideStore.getState().resetRide();

    // Set 10-second grace period BEFORE anything else — prevents race-condition logout
    setLoginGrace();

    set({ user, isAuthenticated: true, isNewUser });

    socketService.connect();
    // Push token registration is best-effort — never block login on it
    registerPushToken().catch(() => {});
  },

  completeProfile: async (profileData) => {
    const { data } = await authApi.completeProfile(profileData);
    const user = data.data;
    set({ user, isNewUser: false });
    storage.set('user', JSON.stringify(user));
  },

  logout: async () => {
    try {
      const refreshToken = storage.getString('refreshToken');
      await authApi.logout(refreshToken);
    } catch {}

    socketService.disconnect();
    storage.delete('accessToken');
    storage.delete('refreshToken');
    storage.delete('user');
    set({ user: null, isAuthenticated: false, isNewUser: false });
    // Clear any cached ride state so "active ride" error doesn't persist across sessions
    const { useRideStore } = require('./useRideStore');
    useRideStore.getState().resetRide();
  },

  loadSession: async () => {
    const userStr = storage.getString('user');
    const token = storage.getString('accessToken');
    const refreshToken = storage.getString('refreshToken');

    if (!userStr) { set({ isLoading: false }); return; }

    // Proactively refresh if token is missing or about to expire
    if ((!token || isTokenExpired(token)) && refreshToken) {
      try {
        const BASE_URL = 'https://hey-auto-server-production.up.railway.app/api/v1';
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(`${BASE_URL}/auth/refresh-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
          signal: controller.signal,
        });
        clearTimeout(timeout);
        const json = await res.json();
        const { accessToken: newAccess, refreshToken: newRefresh } = json.data.tokens;
        storage.set('accessToken', newAccess);
        storage.set('refreshToken', newRefresh);
      } catch {
        // Network unavailable or refresh failed — proceed with existing token (may fail later)
        // Don't clear session — user should stay logged in and retry when online
      }
    }

    try {
      const user = JSON.parse(userStr) as User;
      setLoginGrace();
      set({ user, isAuthenticated: true, isLoading: false });
      socketService.connect();
      registerPushToken().catch(() => {});
    } catch {
      set({ isLoading: false });
    }
  },
}));
