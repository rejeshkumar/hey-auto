import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Platform } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { storage } from '../../utils/storage';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { useAuthStore } from '../../hooks/useAuthStore';
import { useRideStore } from '../../hooks/useRideStore';
import { useLocationStore } from '../../hooks/useLocationStore';

const TALIPARAMBA_CENTER = { latitude: 11.9462, longitude: 75.4928 };

const QUICK_ROUTES = [
  { id: '1', icon: 'bus' as const, labelKey: 'home.busStand', lat: 11.9462, lng: 75.4928 },
  { id: '2', icon: 'train' as const, labelKey: 'home.railwayStation', lat: 11.9812, lng: 75.3644 },
  { id: '3', icon: 'hospital-building' as const, labelKey: 'home.hospital', lat: 11.9480, lng: 75.4940 },
  { id: '4', icon: 'temple-hindu' as const, labelKey: 'home.temple', lat: 11.9550, lng: 75.4850 },
];

export function HomeScreen({ navigation }: any) {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);

  const handleLanguageToggle = () => {
    const newLang = i18n.language === 'ml' ? 'en' : 'ml';
    i18n.changeLanguage(newLang);
    storage.set('language', newLang);
  };
  const { setPickup, setPhase } = useRideStore();
  const { currentLat, currentLng, setCurrentLocation, setPermission } = useLocationStore();

  useEffect(() => {
    requestLocation();
  }, []);

  const requestLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      setPermission(true);
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCurrentLocation(loc.coords.latitude, loc.coords.longitude);
    } else {
      setCurrentLocation(TALIPARAMBA_CENTER.latitude, TALIPARAMBA_CENTER.longitude);
    }
  };

  const handleSearchPress = () => {
    if (currentLat && currentLng) {
      setPickup({ lat: currentLat, lng: currentLng, address: t('booking.currentLocation') });
    }
    setPhase('selecting_destination');
    navigation.navigate('Search');
  };

  const handleQuickRoute = (route: typeof QUICK_ROUTES[0]) => {
    const lat = currentLat || TALIPARAMBA_CENTER.latitude;
    const lng = currentLng || TALIPARAMBA_CENTER.longitude;
    setPickup({ lat, lng, address: t('booking.currentLocation') });
    useRideStore.getState().setDropoff({ lat: route.lat, lng: route.lng, address: t(route.labelKey) });
    setPhase('reviewing_estimate');
    navigation.navigate('BookingConfirm');
  };

  const mapRegion = {
    latitude: currentLat || TALIPARAMBA_CENTER.latitude,
    longitude: currentLng || TALIPARAMBA_CENTER.longitude,
    latitudeDelta: 0.015,
    longitudeDelta: 0.015,
  };

  return (
    <View style={styles.container}>
      <MapView style={styles.map} region={mapRegion} showsUserLocation showsMyLocationButton={false} />

      <View style={styles.overlay}>
        <View style={styles.greetingRow}>
          <Text style={styles.greeting}>
            {t('home.greeting', { name: user?.fullName?.split(' ')[0] || '' })}
          </Text>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.langToggle} onPress={handleLanguageToggle}>
              <Text style={styles.langToggleText}>{i18n.language === 'ml' ? 'EN' : 'മ'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.profileBtn} onPress={() => navigation.navigate('ProfileTab')}>
              <MaterialCommunityIcons name="account-circle" size={36} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={styles.searchBar} onPress={handleSearchPress} activeOpacity={0.9}>
          <MaterialCommunityIcons name="magnify" size={22} color={colors.textSecondary} />
          <Text style={styles.searchText}>{t('home.whereTo')}</Text>
          <View style={styles.searchDot} />
        </TouchableOpacity>

        <View style={styles.quickRoutes}>
          {QUICK_ROUTES.map((route) => (
            <TouchableOpacity key={route.id} style={styles.quickItem} onPress={() => handleQuickRoute(route)}>
              <View style={styles.quickIcon}>
                <MaterialCommunityIcons name={route.icon} size={20} color={colors.primary} />
              </View>
              <Text style={styles.quickLabel} numberOfLines={1}>{t(route.labelKey)}</Text>
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
    position: 'absolute', top: 0, left: 0, right: 0,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: spacing.base,
  },
  greetingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  greeting: { ...typography.h3, color: colors.text, flex: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  langToggle: {
    backgroundColor: colors.white,
    borderRadius: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderWidth: 1.5,
    borderColor: colors.primary,
    elevation: 2,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  langToggleText: { ...typography.smallBold, color: colors.primary },
  profileBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.white,
    alignItems: 'center', justifyContent: 'center',
    elevation: 3, shadowColor: colors.black, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4,
  },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white,
    borderRadius: borderRadius.xl, paddingVertical: spacing.base, paddingHorizontal: spacing.lg, gap: spacing.md,
    elevation: 4, shadowColor: colors.black, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 8,
  },
  searchText: { ...typography.body, color: colors.textSecondary, flex: 1 },
  searchDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  quickRoutes: { flexDirection: 'row', marginTop: spacing.base, gap: spacing.sm },
  quickItem: {
    flex: 1, backgroundColor: colors.white, borderRadius: borderRadius.lg,
    padding: spacing.md, alignItems: 'center', gap: spacing.xs,
    elevation: 2, shadowColor: colors.black, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3,
  },
  quickIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { ...typography.caption, color: colors.text, textAlign: 'center' },
});
