import AsyncStorage from '@react-native-async-storage/async-storage';

export const storageKeys = {
  accessToken: 'accessToken',
  refreshToken: 'refreshToken',
  user: 'user',
  language: 'language',
  onboardingDone: 'onboardingDone',
  isOnline: 'isOnline',
} as const;

let memCache: Record<string, string> = {};

export async function preloadStorage() {
  const keys = Object.values(storageKeys) as string[];
  const pairs = await AsyncStorage.multiGet(keys);
  pairs.forEach(([k, v]) => { if (v !== null) memCache[k] = v; });
  return storage;
}

export const storage = {
  getString: (key: string): string | undefined => memCache[key],
  set: (key: string, value: string) => {
    memCache[key] = value;
    AsyncStorage.setItem(key, value);
  },
  delete: (key: string) => {
    delete memCache[key];
    AsyncStorage.removeItem(key);
  },
};
