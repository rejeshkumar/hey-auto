import { create } from 'zustand';
import { storage } from '../utils/storage';
import { authApi, User } from '../services/auth';
import { socketService } from '../services/socket';
import { registerPushToken } from '../services/pushNotifications';
import { setLoginGrace } from '../services/api';

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    // Consider expired if less than 60 seconds remaining
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

export const useAuthStore = create<AuthState>((set) => ({
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

    storage.set('accessToken', tokens.accessToken);
    storage.set('refreshToken', tokens.refreshToken);
    storage.set('user', JSON.stringify(user));

    setLoginGrace();
    set({ user, isAuthenticated: true, isNewUser });
    socketService.connect();
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
    storage.delete('isOnline');
    set({ user: null, isAuthenticated: false, isNewUser: false });
  },

  loadSession: async () => {
    const userStr = storage.getString('user');
    const token = storage.getString('accessToken');
    const refreshToken = storage.getString('refreshToken');

    if (!userStr) { set({ isLoading: false }); return; }

    // If no access token but we have a refresh token, silently refresh on startup
    if ((!token || isTokenExpired(token)) && refreshToken) {
      try {
        const axios = (await import('axios')).default;
        const BASE_URL = 'https://hey-auto-server-production.up.railway.app/api/v1';
        const { data } = await axios.post(`${BASE_URL}/auth/refresh-token`, { refreshToken });
        const { accessToken: newAccess, refreshToken: newRefresh } = data.data.tokens;
        storage.set('accessToken', newAccess);
        storage.set('refreshToken', newRefresh);
      } catch {
        // Refresh failed — clear everything and go to login
        storage.delete('accessToken');
        storage.delete('refreshToken');
        storage.delete('user');
        set({ isLoading: false });
        return;
      }
    }

    try {
      const user = JSON.parse(userStr) as User;
      set({ user, isAuthenticated: true, isLoading: false });
      socketService.connect();
      registerPushToken();
      // Restore online/offline state from server after session restore
      const { useDriverStore } = await import('./useDriverStore');
      useDriverStore.getState().loadProfile();
    } catch {
      set({ isLoading: false });
    }
  },
}));
