import React, { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { View, ActivityIndicator } from 'react-native';

import '../i18n';
import i18n from '../i18n';
import { Navigation } from './Navigation';
import { useAuthStore } from '../hooks/useAuthStore';
import { preloadStorage } from '../utils/storage';
import { colors } from '../theme';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 2, staleTime: 1000 * 60 * 5 } },
});

export default function App() {
  const [storageReady, setStorageReady] = useState(false);
  const loadSession = useAuthStore((s) => s.loadSession);

  useEffect(() => {
    preloadStorage().then(({ getString }) => {
      const savedLang = getString('language');
      if (savedLang && savedLang !== i18n.language) {
        i18n.changeLanguage(savedLang);
      }
      loadSession();
      setStorageReady(true);
    });
  }, []);

  if (!storageReady) {
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
