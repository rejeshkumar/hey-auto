import React, { useEffect, useRef, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { View, ActivityIndicator, AppState, AppStateStatus } from 'react-native';
import * as Notifications from 'expo-notifications';
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
// Register background task — must be outside component, wrapped for safety
try { require('../services/backgroundLocation'); } catch {}

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 2, staleTime: 1000 * 60 * 5 } },
});

async function recoverPendingRideRequest() {
  try {
    const { data } = await driverApi.getPendingRideRequest();
    const request = data.data;
    if (!request) return;
    const store = useDriverStore.getState();
    if (store.phase === 'offline' || store.phase === 'online_idle') {
      store.setIncomingRequest(request);
      store.setPhase('ride_request');
    }
  } catch {}
}

export default function App() {
  const [ready, setReady] = useState(false);
  const loadSession = useAuthStore((s) => s.loadSession);
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();
  const appState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    // Must be called from component lifecycle (after RN bridge connects) — not at module load time
    SplashScreen.hideAsync().catch(() => {});

    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        registerPushToken(true).catch(() => {});
      }
      appState.current = nextState;
    });

    preloadStorage().then(({ getString }) => {
      const savedLang = getString('language');
      if (savedLang && savedLang !== i18n.language) {
        i18n.changeLanguage(savedLang);
      }
      loadSession().finally(() => setReady(true));
    }).catch(() => setReady(true));

    notificationListener.current = Notifications.addNotificationReceivedListener(() => {});
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data as any;
      if (data?.type === 'ride:new_request') recoverPendingRideRequest();
    });
    Notifications.getLastNotificationResponseAsync().then(response => {
      if (!response) return;
      const data = response.notification.request.content.data as any;
      if (data?.type === 'ride:new_request') recoverPendingRideRequest();
    });

    return () => {
      appStateSub.remove();
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  if (!ready) {
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
