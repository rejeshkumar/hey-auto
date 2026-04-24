import { api, ApiResponse } from './api';

export interface User {
  id: string;
  phone: string;
  fullName: string;
  email?: string;
  role: string;
  status: string;
  language: string;
  avatarUrl?: string;
}

interface SendOtpResponse {
  message: string;
  expiresIn: number;
  otp?: string;
}

interface VerifyOtpResponse {
  user: User;
  tokens: { accessToken: string; refreshToken: string };
  isNewUser: boolean;
}

const normalizePhone = (phone: string) =>
  phone.startsWith('+91') ? phone : `+91${phone}`;

export const authApi = {
  sendOtp: (phone: string) =>
    api.post<ApiResponse<SendOtpResponse>>('/auth/send-otp', { phone: normalizePhone(phone), role: 'RIDER' }),

  verifyOtp: (phone: string, otp: string, deviceId?: string) =>
    api.post<ApiResponse<VerifyOtpResponse>>('/auth/verify-otp', { phone: normalizePhone(phone), otp, role: 'RIDER', deviceId }),

  refreshToken: (refreshToken: string) =>
    api.post<ApiResponse<{ tokens: { accessToken: string; refreshToken: string } }>>('/auth/refresh-token', { refreshToken }),

  logout: (refreshToken?: string) =>
    api.post('/auth/logout', { refreshToken }),

  completeProfile: (data: { fullName: string; email?: string; language?: string }) =>
    api.put<ApiResponse<User>>('/auth/complete-profile', data),
};
