import React, { useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Platform, PermissionsAndroid } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import Geolocation from 'react-native-geolocation-service';
import { useTranslation } from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { useAuthStore } from '../../hooks/useAuthStore';
import { useRideStore } from '../../hooks/useRideStore';
import { useLocationStore } from '../../hooks/useLocationStore';
import { socketService } from '../../services/socket';

const TALIPARAMBA_CENTER = { latitude: 12.0368, longitude: 75.3614 };

const QUICK_ROUTES = [
  { id: '1', icon: 'bus', label: 'busStand', nameMl: 'ബസ് സ്റ്റാൻഡ്', lat: 12.0368, lng: 75.3614 },
  { id: '2', icon: 'train', label: 'railwayStation', nameMl: 'കണ്ണപുരം', lat: 12.0016, lng: 75.3295 },
  { id: '3', icon: 'hospital-building', label: 'Hospital', nameMl: 'ആശുപത്രി', lat: 12.0380, lng: 75.3620 },
  { id: '4', icon: 'temple-hindu', label: 'Temple', nameMl: 'തൃച്ചംബരം', lat: 12.0350, lng: 75.3580 },
];

export function HomeScreen({ navigation }: any) {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const { setPickup, setPhase } = useRideStore();
  const { currentLat, currentLng, setCurrentLocation, setPermission } = useLocationStore();

  useEffect(() => {
    requestLocationPermission();
  }, []);

  const requestLocationPermission = async () => {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
      if (granted === PermissionsAndroid.RESULTS.GRANTED) {
        setPermission(true);
        getCurrentLocation();
      }
    } else {
      setPermission(true);
      getCurrentLocation();
    }
  };

  const getCurrentLocation = () => {
    Geolocation.getCurrentPosition(
      (position) => {
        setCurrentLocation(position.coords.latitude, position.coords.longitude);
      },
      () => {
        setCurrentLocation(TALIPARAMBA_CENTER.latitude, TALIPARAMBA_CENTER.longitude);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 },
    );
  };

  const handleSearchPress = () => {
    if (currentLat && currentLng) {
      setPickup({ lat: currentLat, lng: currentLng, address: t('booking.currentLocation') });
    }
    setPhase('selecting_destination');
    navigation.navigate('Search');
  };

  const handleQuickRoute = (route: typeof QUICK_ROUTES[0]) => {
    if (currentLat && currentLng) {
      setPickup({ lat: currentLat, lng: currentLng, address: t('booking.currentLocation') });
      useRideStore.getState().setDropoff({ lat: route.lat, lng: route.lng, address: route.nameMl });
      setPhase('reviewing_estimate');
      navigation.navigate('BookingConfirm');
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
      <MapView
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        region={mapRegion}
        showsUserLocation
        showsMyLocationButton={false}
      />

      <View style={styles.overlay}>
        {/* Greeting */}
        <View style={styles.greetingRow}>
          <View>
            <Text style={styles.greeting}>
              {t('home.greeting', { name: user?.fullName?.split(' ')[0] || '' })}
            </Text>
          </View>
          <TouchableOpacity style={styles.profileBtn} onPress={() => navigation.navigate('ProfileTab')}>
            <Icon name="account-circle" size={36} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Search bar */}
        <TouchableOpacity style={styles.searchBar} onPress={handleSearchPress} activeOpacity={0.9}>
          <Icon name="magnify" size={22} color={colors.textSecondary} />
          <Text style={styles.searchText}>{t('home.whereTo')}</Text>
          <View style={styles.searchDot} />
        </TouchableOpacity>

        {/* Quick routes */}
        <View style={styles.quickRoutes}>
          {QUICK_ROUTES.map((route) => (
            <TouchableOpacity key={route.id} style={styles.quickItem} onPress={() => handleQuickRoute(route)}>
              <View style={styles.quickIcon}>
                <Icon name={route.icon} size={20} color={colors.primary} />
              </View>
              <Text style={styles.quickLabel} numberOfLines={1}>{route.nameMl}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: spacing.base,
  },
  greetingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  greeting: { ...typography.h3, color: colors.text },
  profileBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.base,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    elevation: 4,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  searchText: { ...typography.body, color: colors.textSecondary, flex: 1 },
  searchDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  quickRoutes: {
    flexDirection: 'row',
    marginTop: spacing.base,
    gap: spacing.sm,
  },
  quickItem: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
    elevation: 2,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  quickIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: { ...typography.caption, color: colors.text, textAlign: 'center' },
});
