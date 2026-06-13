import React, { useEffect, useRef, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { View, ActivityIndicator, AppState, AppStateStatus } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold, Inter_900Black } from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';

import '../i18n';
import i18n from '../i18n';
import { Navigation } from './Navigation';
import { useAuthStore } from '../hooks/useAuthStore';
import { useDriverStore } from '../hooks/useDriverStore';
import { driverApi } from '../services/driver';
import { preloadStorage } from '../utils/storage';
import { colors } from '../theme';
import { registerPushToken } from '../services/pushNotifications';
import '../services/backgroundLocation'; // register background task on app load

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 2, staleTime: 1000 * 60 * 5 } },
});

async function recoverPendingRideRequest() {
  try {
    const { data } = await driverApi.getPendingRideRequest();
    const request = data.data;
    if (!request) return;
    const store = useDriverStore.getState();
    // Only surface it if driver is not already on a ride
    if (store.phase === 'offline' || store.phase === 'online_idle') {
      store.setIncomingRequest(request);
      store.setPhase('ride_request');
    }
  } catch {}
}

export default function App() {
  const [storageReady, setStorageReady] = useState(false);
  const [fontTimeout, setFontTimeout] = useState(false);
  const loadSession = useAuthStore((s) => s.loadSession);
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();
  const appState = useRef<AppStateStatus>(AppState.currentState);
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
    // Re-register token when app returns to foreground — catches drivers who
    // enabled notifications in device Settings after initially denying
    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        registerPushToken(true); // silent — just refresh token, no prompts
      }
      appState.current = nextState;
    });

    preloadStorage().then(({ getString }) => {
      const savedLang = getString('language');
      if (savedLang && savedLang !== i18n.language) {
        i18n.changeLanguage(savedLang);
      }
      loadSession();
      setStorageReady(true);
    });

    // Foreground notification — socket already handles the in-app UI
    notificationListener.current = Notifications.addNotificationReceivedListener(() => {});

    // Driver tapped the push notification while app was backgrounded
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data as any;
      if (data?.type === 'ride:new_request') {
        // Socket may have missed the event while backgrounded — fetch from server
        recoverPendingRideRequest();
      }
    });

    // Also recover on cold start (app killed, notification tapped)
    Notifications.getLastNotificationResponseAsync().then(response => {
      if (!response) return;
      const data = response.notification.request.content.data as any;
      if (data?.type === 'ride:new_request') {
        recoverPendingRideRequest();
      }
    });

    return () => {
      appStateSub.remove();
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
