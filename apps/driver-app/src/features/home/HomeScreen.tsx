import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Vibration, Alert, ScrollView } from 'react-native';
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

const TALIPARAMBA_CENTER = { latitude: 12.0368, longitude: 75.3614 };

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
    return () => { locationSubscription.current?.remove(); clearInterval(queueInterval); };
  }, []);

  useEffect(() => {
    socketService.on<IncomingRideRequest>('ride:new_request', (data) => {
      Vibration.vibrate([0, 500, 200, 500]);
      setIncomingRequest(data);
      setPhase('ride_request');
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
        Alert.alert('Error', parsed?.message || errData?.message || 'Something went wrong');
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
            <>
              {/* Earnings row — ink card */}
              <View style={styles.earningsRow}>
                <View style={styles.earningsStat}>
                  <Text style={styles.earningsAmount}>₹{earnings?.today || 0}</Text>
                  <Text style={styles.earningsLabel}>{t('home.todayEarnings')}</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.earningsStat}>
                  <Text style={styles.statValue}>{earnings?.totalRidesToday || 0}</Text>
                  <Text style={styles.earningsLabel}>{t('home.ridesCompleted')}</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.earningsStat}>
                  <Text style={styles.statValue}>₹{earnings?.tipsToday || 0}</Text>
                  <Text style={styles.earningsLabel}>{t('earnings.tips')}</Text>
                </View>
              </View>

              {/* Queue status banner */}
              {queueStatus && (
                <View style={styles.queueBanner}>
                  <Text style={styles.queueBannerText}>
                    🚏 #{queueStatus.position} in queue at {queueStatus.standName}
                  </Text>
                </View>
              )}

              {/* Waiting row — ink card, green top border */}
              <View style={styles.waitingRow}>
                <View style={styles.pulseDot} />
                <Text style={styles.waitingText}>{t('home.waitingForRides')}</Text>
              </View>
            </>
          ) : (
            <View style={styles.greetRow}>
              <Text style={styles.greetText}>Good {getTimeGreeting()}, {firstName}</Text>
              <Text style={styles.greetSub}>Go online to start accepting rides</Text>
            </View>
          )}

          {/* Go Home toggle — only shown when online */}
          {isOnline && (
            <TouchableOpacity
              style={[styles.goHomeBtn, goHomeMode && styles.goHomeBtnActive]}
              onPress={handleGoHomeToggle}
              disabled={goHomeToggling}
              activeOpacity={0.85}
            >
              <Icon name="home-outline" size={18} color={goHomeMode ? colors.ink : colors.primary} />
              <Text style={[styles.goHomeBtnText, { color: goHomeMode ? colors.ink : colors.primary }]}>
                {goHomeMode ? 'Go Home: ON' : 'Go Home'}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.onlineBtn, isOnline ? styles.btnOffline : styles.btnOnline]}
            onPress={handleToggleOnline}
            disabled={toggling}
            activeOpacity={0.85}
          >
            <Icon name={isOnline ? 'power-off' : 'power'} size={22} color={isOnline ? colors.primary : colors.ink} />
            <Text style={[styles.onlineBtnText, { color: isOnline ? colors.primary : colors.ink }]}>
              {toggling ? '...' : isOnline ? t('home.goOffline') : t('home.goOnline')}
            </Text>
          </TouchableOpacity>
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

  greetRow: { marginBottom: spacing.base },
  greetText: { ...typography.h4, color: colors.text },
  greetSub: { ...typography.small, color: colors.textSecondary, marginTop: 2 },

  earningsRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.ink, borderRadius: borderRadius.xl,
    borderTopWidth: 2, borderTopColor: colors.primary,
    overflow: 'hidden',
    paddingVertical: spacing.sm, paddingHorizontal: spacing.base, marginBottom: spacing.sm,
  },
  earningsStat: { flex: 1, alignItems: 'center' },
  earningsAmount: { fontSize: 22, fontWeight: '900', color: colors.primary },
  earningsLabel: { ...typography.caption, color: colors.primary, fontWeight: '600', marginTop: 1 },
  statValue: { ...typography.body, fontWeight: '700', color: colors.primary },
  divider: { width: 1, height: 28, backgroundColor: 'rgba(249,176,27,0.25)' },

  queueBanner: {
    backgroundColor: 'rgba(249,176,27,0.12)', borderRadius: borderRadius.lg,
    paddingVertical: spacing.xs, paddingHorizontal: spacing.base,
    marginBottom: spacing.sm, borderLeftWidth: 3, borderLeftColor: colors.primary,
  },
  queueBannerText: { ...typography.small, color: colors.text, fontWeight: '600' },

  waitingRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm,
    backgroundColor: colors.ink, borderRadius: borderRadius.xl,
    borderTopWidth: 2, borderTopColor: colors.secondary,
    overflow: 'hidden',
    paddingVertical: spacing.sm, paddingHorizontal: spacing.base,
  },
  pulseDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.secondary },
  waitingText: { ...typography.small, color: colors.primary, fontWeight: '600' },

  goHomeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.xs, paddingVertical: spacing.xs + 2, paddingHorizontal: spacing.base,
    borderRadius: borderRadius.lg, marginBottom: spacing.sm,
    backgroundColor: colors.ink,
    borderTopWidth: 2, borderTopColor: colors.primary, overflow: 'hidden',
  },
  goHomeBtnActive: { backgroundColor: colors.primary, borderTopColor: colors.ink },
  goHomeBtnText: { ...typography.caption, fontWeight: '700' },

  onlineBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, paddingVertical: spacing.base, borderRadius: borderRadius.xl,
    elevation: 4, shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 8,
  },
  btnOnline: { backgroundColor: colors.primary },
  btnOffline: {
    backgroundColor: colors.ink,
    borderTopWidth: 2, borderTopColor: colors.primary,
    overflow: 'hidden',
  },
  onlineBtnText: { ...typography.body, fontWeight: '700' },
});
