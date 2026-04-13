import React, { useEffect, useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, PermissionsAndroid, Vibration } from 'react-native';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import Geolocation from 'react-native-geolocation-service';
import { useTranslation } from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { useAuthStore } from '../../hooks/useAuthStore';
import { useDriverStore, IncomingRideRequest } from '../../hooks/useDriverStore';
import { useLocationStore } from '../../hooks/useLocationStore';
import { socketService } from '../../services/socket';
import { RideRequestCard } from './RideRequestCard';

const TALIPARAMBA_CENTER = { latitude: 12.0368, longitude: 75.3614 };

export function HomeScreen({ navigation }: any) {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const { phase, isOnline, earnings, incomingRequest, goOnline, goOffline, setIncomingRequest, setPhase, loadEarnings } = useDriverStore();
  const { currentLat, currentLng, setCurrentLocation, setPermission } = useLocationStore();
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    requestLocationPermission();
    loadEarnings();
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
    if (Platform.OS === 'android') {
      const fine = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
      const bg = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION);
      if (fine === PermissionsAndroid.RESULTS.GRANTED) {
        setPermission(true);
        startWatchingLocation();
      }
    } else {
      setPermission(true);
      startWatchingLocation();
    }
  };

  const startWatchingLocation = () => {
    Geolocation.watchPosition(
      (pos) => setCurrentLocation(pos.coords.latitude, pos.coords.longitude),
      () => setCurrentLocation(TALIPARAMBA_CENTER.latitude, TALIPARAMBA_CENTER.longitude),
      { enableHighAccuracy: true, distanceFilter: 10, interval: 5000, fastestInterval: 3000 },
    );
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
    } catch (err) {
      console.error('Toggle online error:', err);
    } finally {
      setToggling(false);
    }
  };

  const mapRegion = {
    latitude: currentLat || TALIPARAMBA_CENTER.latitude,
    longitude: currentLng || TALIPARAMBA_CENTER.longitude,
    latitudeDelta: 0.015,
    longitudeDelta: 0.015,
  };

  return (
    <View style={styles.container}>
      <MapView style={styles.map} provider={PROVIDER_GOOGLE} region={mapRegion} showsUserLocation showsMyLocationButton={false} />

      {/* Top bar */}
      <View style={styles.topBar}>
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, { backgroundColor: isOnline ? colors.online : colors.offline }]} />
          <Text style={styles.statusText}>{isOnline ? t('home.online') : t('home.offline')}</Text>
        </View>
        <TouchableOpacity style={styles.profileBtn} onPress={() => navigation.navigate('ProfileTab')}>
          <Icon name="account-circle" size={36} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Earnings card (when online idle) */}
      {isOnline && phase === 'online_idle' && (
        <View style={styles.earningsCard}>
          <Text style={styles.earningsLabel}>{t('home.todayEarnings')}</Text>
          <Text style={styles.earningsAmount}>₹{earnings?.today || 0}</Text>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{earnings?.totalRidesToday || 0}</Text>
              <Text style={styles.statLabel}>{t('home.ridesCompleted')}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>{earnings?.tipsToday || 0}₹</Text>
              <Text style={styles.statLabel}>{t('earnings.tips')}</Text>
            </View>
          </View>
          <Text style={styles.waitingText}>{t('home.waitingForRides')}</Text>
        </View>
      )}

      {/* Incoming ride request overlay */}
      {phase === 'ride_request' && incomingRequest && (
        <RideRequestCard request={incomingRequest} navigation={navigation} />
      )}

      {/* Go Online/Offline button */}
      <View style={styles.bottomArea}>
        <TouchableOpacity
          style={[styles.onlineBtn, isOnline ? styles.onlineBtnActive : styles.onlineBtnInactive]}
          onPress={handleToggleOnline}
          disabled={toggling}
          activeOpacity={0.8}
        >
          <Icon name={isOnline ? 'power' : 'power'} size={28} color={colors.white} />
          <Text style={styles.onlineBtnText}>{isOnline ? t('home.goOffline') : t('home.goOnline')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingHorizontal: spacing.base,
  },
  statusRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.white, paddingVertical: spacing.sm, paddingHorizontal: spacing.base,
    borderRadius: borderRadius.full, elevation: 3,
    shadowColor: colors.black, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4,
  },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { ...typography.smallBold, color: colors.text },
  profileBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.white,
    alignItems: 'center', justifyContent: 'center', elevation: 3,
    shadowColor: colors.black, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4,
  },
  earningsCard: {
    position: 'absolute', top: Platform.OS === 'ios' ? 115 : 95,
    left: spacing.base, right: spacing.base,
    backgroundColor: colors.white, borderRadius: borderRadius.xl, padding: spacing.lg,
    alignItems: 'center', elevation: 4,
    shadowColor: colors.black, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 8,
  },
  earningsLabel: { ...typography.small, color: colors.textSecondary },
  earningsAmount: { ...typography.bigNumber, color: colors.earnings, marginTop: spacing.xs },
  statsRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.base, gap: spacing.xl },
  stat: { alignItems: 'center' },
  statValue: { ...typography.h4, color: colors.text },
  statLabel: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  statDivider: { width: 1, height: 30, backgroundColor: colors.border },
  waitingText: { ...typography.small, color: colors.textLight, marginTop: spacing.base },
  bottomArea: { position: 'absolute', bottom: 40, left: spacing.base, right: spacing.base },
  onlineBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md,
    paddingVertical: spacing.lg, borderRadius: borderRadius.xl, elevation: 6,
    shadowColor: colors.black, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 10,
  },
  onlineBtnActive: { backgroundColor: colors.error },
  onlineBtnInactive: { backgroundColor: colors.primary },
  onlineBtnText: { ...typography.h4, color: colors.white },
});
