import { MMKV } from 'react-native-mmkv';

export const storage = new MMKV({ id: 'heyauto-rider' });

export const storageKeys = {
  accessToken: 'accessToken',
  refreshToken: 'refreshToken',
  user: 'user',
  language: 'language',
  onboardingDone: 'onboardingDone',
} as const;
