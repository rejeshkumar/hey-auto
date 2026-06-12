import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Vibration, Alert, ScrollView, AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { useAuthStore } from '../../hooks/useAuthStore';
import { useDriverStore, IncomingRideRequest } from '../../hooks/useDriverStore';
import { useLocationStore } from '../../hooks/useLocationStore';
import { socketService } from '../../services/socket';
import { storage } from '../../utils/storage';
import { RideRequestCard } from './RideRequestCard';
import { StaticMapView } from '../../components';
import { LiveMapView } from '../../components/LiveMapView';
import { driverApi } from '../../services/driver';

const TALIPARAMBA_CENTER = { latitude: 12.9716, longitude: 77.5946 };

export function HomeScreen({ navigation }: any) {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const { phase, isOnline, earnings, incomingRequest, goOnline, goOffline, setIncomingRequest, setPhase, loadEarnings } = useDriverStore();
  const { currentLat, currentLng, setCurrentLocation, setPermission } = useLocationStore();
  const [toggling, setToggling] = useState(false);
  const insets = useSafeAreaInsets();
  const [goHomeMode, setGoHomeMode] = useState(false);
  const [homeLocation, setHomeLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [goHomeToggling, setGoHomeToggling] = useState(false);
  const [queueStatus, setQueueStatus] = useState<{ standName: string; position: number } | null>(null);
  const locationSubscription = React.useRef<Location.LocationSubscription | null>(null);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    requestLocationPermission();
    loadEarnings();
    // Load driver's home location and go-home state
    driverApi.getProfile().then((res) => {
      const p = res.data.data;
      if (p?.homeLat && p?.homeLng) setHomeLocation({ lat: p.homeLat, lng: p.homeLng });
      setGoHomeMode(!!p?.isGoHomeMode);
    }).catch(() => {});
    // Poll queue status every 30s when online
    const pollQueue = () => {
      driverApi.getQueueStatus().then((res) => {
        const entries = res.data.data ?? [];
        setQueueStatus(entries.length > 0 ? { standName: entries[0].standName, position: entries[0].position } : null);
      }).catch(() => {});
    };
    pollQueue();
    const queueInterval = setInterval(pollQueue, 30000);
    // Reconnect socket when app returns to foreground (covers lock screen wake)
    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        if (!socketService.isConnected()) socketService.connect();
      }
      appState.current = nextState;
    });

    return () => { locationSubscription.current?.remove(); clearInterval(queueInterval); appStateSub.remove(); };
  }, []);

  useEffect(() => {
    socketService.on<IncomingRideRequest>('ride:new_request', (data) => {
      Vibration.vibrate([0, 500, 200, 500, 200, 500]);
      setIncomingRequest(data);
      setPhase('ride_request');
      // Fire local notification so driver sees alert on lock screen
      Notifications.scheduleNotificationAsync({
        content: {
          title: '🛺 New Ride Request!',
          body: `${data.pickupAddress} → ${data.dropoffAddress} · ₹${Math.round(data.estimatedFare)}`,
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.MAX,
          ...(Platform.OS === 'android' && { channelId: 'rides' }),
        },
        trigger: null,
      }).catch(() => {});
    });
    socketService.on('ride:request_expired', () => {
      setIncomingRequest(null);
      if (useDriverStore.getState().phase === 'ride_request') setPhase('online_idle');
    });
    return () => {
      socketService.off('ride:new_request');
      socketService.off('ride:request_expired');
    };
  }, []);

  const requestLocationPermission = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      setPermission(true);
      locationSubscription.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 10, timeInterval: 5000 },
        (pos) => setCurrentLocation(pos.coords.latitude, pos.coords.longitude),
      );
    } else {
      setCurrentLocation(TALIPARAMBA_CENTER.latitude, TALIPARAMBA_CENTER.longitude);
    }
  };

  const handleToggleOnline = async () => {
    if (isOnline) {
      Alert.alert(
        'End Shift?',
        'You will stop receiving ride requests.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'End Shift', style: 'destructive', onPress: () => performToggle() },
        ],
      );
      return;
    }
    performToggle();
  };

  const performToggle = async () => {
    setToggling(true);
    try {
      if (isOnline) {
        await goOffline();
        socketService.stopLocationUpdates();
      } else {
        const lat = currentLat || TALIPARAMBA_CENTER.latitude;
        const lng = currentLng || TALIPARAMBA_CENTER.longitude;
        await goOnline(lat, lng);
        socketService.startLocationUpdates(() => {
          const store = useLocationStore.getState();
          return store.currentLat && store.currentLng ? { lat: store.currentLat, lng: store.currentLng } : null;
        });
      }
      loadEarnings();
    } catch (err: any) {
      const errData = err?.response?.data?.error || err?.response?.data;
      let parsed = errData;
      if (typeof errData?.message === 'string') {
        try { parsed = JSON.parse(errData.message); } catch {}
      }
      const code = parsed?.code || errData?.code;
      if (code === 'SUBSCRIPTION_REQUIRED') {
        const msg = i18n.language === 'ml' ? parsed?.messageMl : parsed?.message;
        Alert.alert('Subscription Required', msg || 'Pay ₹25 to go online today', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Subscribe Now', onPress: () => navigation.navigate('Subscription') },
        ]);
      } else {
        const msg = parsed?.message || errData?.message || JSON.stringify(errData) || 'Could not go online. Check verification status and subscription.';
        Alert.alert('Cannot Go Online', msg);
      }
    } finally {
      setToggling(false);
    }
  };

  const handleGoHomeToggle = async () => {
    if (!homeLocation && !goHomeMode) {
      Alert.alert('Set Home First', 'Go to Profile → Home Location to set your home address.', [
        { text: 'OK' },
        { text: 'Go to Profile', onPress: () => navigation.navigate('ProfileTab') },
      ]);
      return;
    }
    setGoHomeToggling(true);
    try {
      const res = await driverApi.toggleGoHomeMode(!goHomeMode);
      setGoHomeMode(res.data.data?.isGoHomeMode ?? !goHomeMode);
    } catch {
      Alert.alert('Error', 'Could not toggle Go Home mode');
    } finally {
      setGoHomeToggling(false);
    }
  };

  const handleLanguageToggle = () => {
    const newLang = i18n.language === 'ml' ? 'en' : 'ml';
    i18n.changeLanguage(newLang);
    storage.set('language', newLang);
  };

  const firstName = user?.fullName?.split(' ')[0] || 'Driver';
  const mapCenter = useMemo(() => ({
    lat: currentLat || TALIPARAMBA_CENTER.latitude,
    lng: currentLng || TALIPARAMBA_CENTER.longitude,
  }), [currentLat, currentLng]);
  const mapMarkers = useMemo(() => [{
    lat: mapCenter.lat,
    lng: mapCenter.lng,
    color: '0xF5C800',
    label: 'D',
  }], [mapCenter.lat, mapCenter.lng]);

  return (
    <View style={styles.container}>
      <LiveMapView
        lat={mapCenter.lat}
        lng={mapCenter.lng}
        isOnline={isOnline}
        homeLat={homeLocation?.lat}
        homeLng={homeLocation?.lng}
        isGoHomeMode={goHomeMode}
        style={styles.map}
      />

      {/* Top bar */}
      <View style={styles.topBar}>
        <View style={[styles.statusPill, isOnline ? styles.statusPillOnline : styles.statusPillOffline]}>
          <View style={[styles.statusDot, { backgroundColor: isOnline ? colors.online : colors.offline }]} />
          <Text style={[styles.statusText, { color: isOnline ? colors.online : colors.offline }]}>
            {isOnline ? t('home.online') : t('home.offline')}
          </Text>
        </View>
        <View style={styles.topActions}>
          <TouchableOpacity style={styles.iconBtn} onPress={handleLanguageToggle}>
            <Text style={styles.langText}>{i18n.language === 'ml' ? 'EN' : 'മ'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('ProfileTab')}>
            <Icon name="account-circle-outline" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Ride request overlay */}
      {phase === 'ride_request' && incomingRequest && (
        <RideRequestCard request={incomingRequest} navigation={navigation} />
      )}

      {/* Bottom card */}
      {phase !== 'ride_request' && (
        <View style={[styles.bottomCard, { paddingBottom: Math.max(insets.bottom + 8, 16) }]}>
          {isOnline && phase === 'online_idle' ? (
            /* Online state — compact, warm */
            <>
              <View style={styles.waitingRow}>
                <View style={styles.pulseDot} />
                <Text style={styles.waitingText}>Waiting for rides...</Text>
              </View>
              {queueStatus && (
                <View style={styles.queueBanner}>
                  <Text style={styles.queueBannerText}>🚏 #{queueStatus.position} in queue at {queueStatus.standName}</Text>
                </View>
              )}
              <TouchableOpacity
                style={[styles.onlineBtn, styles.btnEndShift]}
                onPress={handleToggleOnline}
                disabled={toggling}
                activeOpacity={0.85}
              >
                <Text style={styles.btnEndShiftText}>{toggling ? '...' : 'End Shift'}</Text>
              </TouchableOpacity>
            </>
          ) : (
            /* Offline state — Jobs style: greeting + weekly card */
            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
              <Text style={styles.greetText}>Good {getTimeGreeting()}, {firstName} 👋</Text>
              <Text style={styles.greetSub}>Ready to start your shift?</Text>
              {earnings && (
                <View style={styles.weeklyCard}>
                  <Text style={styles.weeklyLabel}>This Week</Text>
                  <Text style={styles.weeklyAmount}>₹{earnings.thisWeek || 0}</Text>
                  <Text style={styles.weeklyRides}>{earnings.totalRidesWeek || 0} rides completed</Text>
                  <View style={styles.weeklyDivider} />
                  <View style={styles.weeklyStats}>
                    <View style={styles.weeklyStat}>
                      <Text style={styles.weeklyStatVal}>₹{Math.round(earnings.averagePerRide || 0)}</Text>
                      <Text style={styles.weeklyStatLabel}>Avg fare</Text>
                    </View>
                    <View style={styles.weeklyStatDivider} />
                    <View style={styles.weeklyStat}>
                      <Text style={styles.weeklyStatVal}>₹{earnings.today || 0}</Text>
                      <Text style={styles.weeklyStatLabel}>Today</Text>
                    </View>
                    <View style={styles.weeklyStatDivider} />
                    <View style={styles.weeklyStat}>
                      <Text style={styles.weeklyStatVal}>₹{earnings.tipsToday || 0}</Text>
                      <Text style={styles.weeklyStatLabel}>Tips</Text>
                    </View>
                  </View>
                </View>
              )}
              <TouchableOpacity
                style={[styles.onlineBtn, styles.btnStartEarning]}
                onPress={handleToggleOnline}
                disabled={toggling}
                activeOpacity={0.85}
              >
                <Icon name={toggling ? 'loading' : 'lightning-bolt'} size={20} color={colors.ink} />
                <Text style={styles.onlineBtnText}>{toggling ? '...' : "Let's Go Online"}</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      )}
    </View>
  );
}

function getTimeGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Morning';
  if (h < 17) return 'Afternoon';
  return 'Evening';
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  map: { flex: 1 },

  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 56 : 44,
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.sm,
  },

  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 6, paddingHorizontal: spacing.base,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
  },
  statusPillOnline: { backgroundColor: colors.secondaryLight, borderColor: colors.online },
  statusPillOffline: { backgroundColor: '#FEE2E2', borderColor: colors.error },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { ...typography.smallBold },

  topActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center',
    elevation: 3, shadowColor: colors.black, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 4,
  },
  langText: { ...typography.smallBold, color: colors.text },

  bottomCard: {
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius.xxl,
    borderTopRightRadius: borderRadius.xxl,
    paddingTop: spacing.base,
    paddingHorizontal: spacing.base,
    elevation: 12,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
  },

  // Offline — Jobs style
  greetText: { ...typography.h3, color: colors.text, marginBottom: 4 },
  greetSub: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.lg },

  weeklyCard: {
    backgroundColor: colors.surface, borderRadius: borderRadius.xl,
    padding: spacing.lg, marginBottom: spacing.lg,
    borderWidth: 1, borderColor: colors.borderLight,
  },
  weeklyLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', color: colors.textSecondary, marginBottom: 4 },
  weeklyAmount: { fontSize: 42, fontWeight: '900', color: colors.primary, letterSpacing: -1.5, lineHeight: 46 },
  weeklyRides: { ...typography.small, color: colors.textSecondary, marginTop: 2, marginBottom: spacing.base },
  weeklyDivider: { height: 1, backgroundColor: colors.borderLight, marginBottom: spacing.base },
  weeklyStats: { flexDirection: 'row', alignItems: 'center' },
  weeklyStat: { flex: 1, alignItems: 'center' },
  weeklyStatVal: { ...typography.h4, color: colors.text },
  weeklyStatLabel: { fontSize: 9, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 2 },
  weeklyStatDivider: { width: 1, height: 28, backgroundColor: colors.borderLight },

  // Online state
  waitingRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm,
  },
  pulseDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.secondary },
  waitingText: { ...typography.body, color: colors.textSecondary },

  queueBanner: {
    backgroundColor: colors.surface, borderRadius: borderRadius.lg,
    paddingVertical: spacing.xs, paddingHorizontal: spacing.base,
    marginBottom: spacing.sm, borderLeftWidth: 3, borderLeftColor: colors.primary,
  },
  queueBannerText: { ...typography.small, color: colors.text, fontWeight: '600' },

  onlineBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, paddingVertical: spacing.base + 2, borderRadius: borderRadius.xl,
    elevation: 4, shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 8,
  },
  btnStartEarning: { backgroundColor: colors.primary },
  btnEndShift: {
    backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.border, elevation: 0,
  },
  btnEndShiftText: { ...typography.h4, color: colors.textSecondary },
  onlineBtnText: { ...typography.h4, color: colors.ink },
});
