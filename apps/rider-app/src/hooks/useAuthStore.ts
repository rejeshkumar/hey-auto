import { create } from 'zustand';
import { storage } from '../utils/storage';
import { authApi, User } from '../services/auth';
import { socketService } from '../services/socket';
import { registerPushToken } from '../services/pushNotifications';

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
  loadSession: () => void;
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

    storage.set('accessToken', tokens.accessToken);
    storage.set('refreshToken', tokens.refreshToken);
    storage.set('user', JSON.stringify(user));

    set({ user, isAuthenticated: true, isNewUser });
    socketService.connect();
    registerPushToken();
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
  },

  loadSession: () => {
    const userStr = storage.getString('user');
    const token = storage.getString('accessToken');

    if (userStr && token) {
      try {
        const user = JSON.parse(userStr) as User;
        set({ user, isAuthenticated: true, isLoading: false });
        socketService.connect();
        registerPushToken();
      } catch {
        set({ isLoading: false });
      }
    } else {
      set({ isLoading: false });
    }
  },
}));
