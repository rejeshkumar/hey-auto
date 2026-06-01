import React, { useEffect, useRef, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { View, ActivityIndicator } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold, Inter_900Black } from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';

import '../i18n';
import i18n from '../i18n';
import { Navigation } from './Navigation';
import { useAuthStore } from '../hooks/useAuthStore';
import { preloadStorage } from '../utils/storage';
import { colors } from '../theme';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 2, staleTime: 1000 * 60 * 5 } },
});

export default function App() {
  const [storageReady, setStorageReady] = useState(false);
  const [fontTimeout, setFontTimeout] = useState(false);
  const loadSession = useAuthStore((s) => s.loadSession);
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();
  const [fontsLoaded] = useFonts({
    Inter: Inter_400Regular,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    Inter_900Black,
  });

  // If fonts don't load within 3 seconds, proceed anyway with system font
  useEffect(() => {
    const t = setTimeout(() => setFontTimeout(true), 3000);
    return () => clearTimeout(t);
  }, []);

  const fontsReady = fontsLoaded || fontTimeout;

  useEffect(() => {
    if (fontsReady) SplashScreen.hideAsync().catch(() => {});
  }, [fontsReady]);

  useEffect(() => {
    preloadStorage().then(({ getString }) => {
      const savedLang = getString('language');
      if (savedLang && savedLang !== i18n.language) {
        i18n.changeLanguage(savedLang);
      }
      loadSession();
      setStorageReady(true);
    });

    notificationListener.current = Notifications.addNotificationReceivedListener(() => {
      // Foreground: sound/vibration fires; socket handles in-app UI updates
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(_response => {
      // Rider tapped a notification — app opens to foreground automatically
    });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  if (!storageReady || !fontsReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <Navigation />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
