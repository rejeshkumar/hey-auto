import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import * as Location from 'expo-location';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { storage } from '../../utils/storage';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { useAuthStore } from '../../hooks/useAuthStore';
import { useRideStore } from '../../hooks/useRideStore';
import { useLocationStore } from '../../hooks/useLocationStore';
import { riderApi, SavedPlace } from '../../services/rider';

const TALIPARAMBA_CENTER = { latitude: 12.9716, longitude: 77.5946 };

const FAVE_SLOTS = [
  { key: 'Home',  icon: 'home'      as const },
  { key: 'Work',  icon: 'briefcase' as const },
  { key: 'Other', icon: 'star'      as const },
];

export function HomeScreen({ navigation }: any) {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const { setPickup, setPhase, rideType, setRideType } = useRideStore();
  const { currentLat, currentLng, setCurrentLocation, setPermission } = useLocationStore();
  const [favourites, setFavourites] = useState<SavedPlace[]>([]);

  useEffect(() => { requestLocation(); loadFavourites(); }, []);

  const loadFavourites = () => {
    riderApi.getSavedPlaces()
      .then(({ data }) => setFavourites(data.data || []))
      .catch(() => {});
  };

  const requestLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      setPermission(true);
      try {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        setCurrentLocation(loc.coords.latitude, loc.coords.longitude);
      } catch {
        // GPS timeout — try last known position
        const last = await Location.getLastKnownPositionAsync();
        if (last) {
          setCurrentLocation(last.coords.latitude, last.coords.longitude);
        }
      }
    }
    // Do NOT fall back to hardcoded coords — null means "unknown, ask GPS again at booking time"
  };

  const handleLanguageToggle = () => {
    const newLang = i18n.language === 'ml' ? 'en' : 'ml';
    i18n.changeLanguage(newLang);
    storage.set('language', newLang);
  };

  const handleSearchPress = async () => {
    let lat = currentLat;
    let lng = currentLng;
    // If GPS not yet resolved, try one more time before proceeding
    if (!lat || !lng) {
      try {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        lat = loc.coords.latitude;
        lng = loc.coords.longitude;
        setCurrentLocation(lat, lng);
      } catch {
        const last = await Location.getLastKnownPositionAsync();
        if (last) { lat = last.coords.latitude; lng = last.coords.longitude; }
      }
    }
    if (lat && lng) {
      setPickup({ lat, lng, address: t('booking.currentLocation') });
    }
    setPhase('selecting_destination');
    navigation.navigate('Search');
  };

  const handleFavourite = async (place: SavedPlace) => {
    let lat = currentLat;
    let lng = currentLng;
    if (!lat || !lng) {
      try {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        lat = loc.coords.latitude; lng = loc.coords.longitude;
        setCurrentLocation(lat, lng);
      } catch {
        const last = await Location.getLastKnownPositionAsync();
        if (last) { lat = last.coords.latitude; lng = last.coords.longitude; }
      }
    }
    setPickup({ lat: lat!, lng: lng!, address: t('booking.currentLocation') });
    useRideStore.getState().setDropoff({ lat: place.lat, lng: place.lng, address: place.address });
    setPhase('reviewing_estimate');
    navigation.navigate('BookingConfirm');
  };

  const firstName = user?.fullName?.split(' ')[0] || '';
  const greeting = getTimeGreeting();

  return (
    <View style={styles.container}>
      <View style={styles.map} />

      {/* Top header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{greeting}{firstName ? `, ${firstName}` : ''} 👋</Text>
          <Text style={styles.subGreeting}>{t('home.whereTo')}</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.iconBtn} onPress={handleLanguageToggle}>
            <Text style={styles.langText}>{i18n.language === 'ml' ? 'EN' : 'മ'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('ProfileTab')}>
            <MaterialCommunityIcons name="account-circle-outline" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Bottom sheet */}
      <View style={styles.bottomSheet}>
        {/* Booking type selector */}
        <View style={styles.typeSelector}>
          <TouchableOpacity
            style={[styles.typeTab, rideType === 'PASSENGER' && styles.typeTabActive]}
            onPress={() => setRideType('PASSENGER')}
          >
            <MaterialCommunityIcons name="car" size={16} color={rideType === 'PASSENGER' ? colors.ink : colors.textSecondary} />
            <Text style={[styles.typeTabText, rideType === 'PASSENGER' && styles.typeTabTextActive]}>Book Ride</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.typeTab, rideType === 'PARCEL' && styles.typeTabActive]}
            onPress={() => setRideType('PARCEL')}
          >
            <MaterialCommunityIcons name="package-variant" size={16} color={rideType === 'PARCEL' ? colors.ink : colors.textSecondary} />
            <Text style={[styles.typeTabText, rideType === 'PARCEL' && styles.typeTabTextActive]}>Send Parcel</Text>
          </TouchableOpacity>
        </View>

        {/* Search bar */}
        <TouchableOpacity style={styles.searchBar} onPress={handleSearchPress} activeOpacity={0.85}>
          <View style={styles.searchIconWrap}>
            <MaterialCommunityIcons name="magnify" size={20} color={colors.primary} />
          </View>
          <Text style={styles.searchText}>{t('home.whereTo')}</Text>
          <View style={styles.searchArrow}>
            <MaterialCommunityIcons name="arrow-right" size={18} color={colors.ink} />
          </View>
        </TouchableOpacity>

        {/* Voice booking — for Sr. citizens */}
        <TouchableOpacity style={styles.voiceBtn} onPress={() => navigation.navigate('VoiceBooking')} activeOpacity={0.85}>
          <View style={styles.voiceMicWrap}>
            <MaterialCommunityIcons name="microphone" size={22} color={colors.ink} />
          </View>
          <View style={styles.voiceTextWrap}>
            <Text style={styles.voiceBtnTitle}>സംസാരിക്കൂ</Text>
            <Text style={styles.voiceBtnSub}>Speak to book · Malayalam</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color={colors.primary} />
        </TouchableOpacity>

        {/* Favourites */}
        <View style={styles.favHeader}>
          <Text style={styles.sectionLabel}>Favourites</Text>
          {favourites.length > 0 && (
            <TouchableOpacity onPress={() => navigation.navigate('SavedPlaces')}>
              <Text style={styles.favEditLink}>Edit</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.favRow}>
          {FAVE_SLOTS.map((slot) => {
            const saved = favourites.find(p => p.label.toLowerCase() === slot.key.toLowerCase());
            if (saved) {
              return (
                <TouchableOpacity key={slot.key} style={styles.favItem} onPress={() => handleFavourite(saved)}>
                  <View style={styles.favIcon}>
                    <MaterialCommunityIcons name={slot.icon} size={20} color={colors.primary} />
                  </View>
                  <Text style={styles.favLabel} numberOfLines={1}>{saved.label}</Text>
                  <Text style={styles.favAddr} numberOfLines={1}>{saved.address}</Text>
                </TouchableOpacity>
              );
            }
            return (
              <TouchableOpacity key={slot.key} style={styles.favItemEmpty} onPress={() => navigation.navigate('SavedPlaces')}>
                <View style={[styles.favIcon, styles.favIconEmpty]}>
                  <MaterialCommunityIcons name={slot.icon} size={18} color={colors.textLight} />
                </View>
                <Text style={styles.favLabelEmpty}>{slot.key}</Text>
                <View style={styles.favAddBadge}>
                  <MaterialCommunityIcons name="plus" size={12} color={colors.primary} />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* USP strip */}
        <View style={styles.uspStrip}>
          <MaterialCommunityIcons name="shield-check" size={16} color={colors.primary} />
          <Text style={styles.uspText}>Fair rates · No surge · No hidden fees</Text>
        </View>
      </View>
    </View>
  );
}

function getTimeGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  map: { flex: 1, backgroundColor: '#EAF3EA' },

  header: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingTop: Platform.OS === 'ios' ? 60 : 44,
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.sm,
  },
  greeting: { ...typography.h3, color: colors.text },
  subGreeting: { ...typography.small, color: colors.textSecondary, marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center',
    elevation: 3, shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4,
  },
  langText: { ...typography.smallBold, color: colors.text },

  bottomSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius.xxl,
    borderTopRightRadius: borderRadius.xxl,
    padding: spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? 36 : spacing.xl,
    elevation: 12,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
  },

  typeSelector: {
    flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.base,
  },
  typeTab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.xs, paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  typeTabActive: {
    backgroundColor: colors.primary, borderColor: colors.primary,
  },
  typeTabText: { ...typography.smallBold, color: colors.textSecondary },
  typeTabTextActive: { color: colors.ink },

  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.ink,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    paddingVertical: spacing.base,
    paddingHorizontal: spacing.base,
    gap: spacing.sm,
    marginBottom: spacing.lg,
    borderTopWidth: 2,
    borderTopColor: colors.primary,
  },
  searchIconWrap: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  searchText: { ...typography.body, color: colors.primary, flex: 1, fontWeight: '600' },
  searchArrow: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },

  voiceBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.ink,
    borderRadius: borderRadius.xl, overflow: 'hidden',
    borderTopWidth: 2, borderTopColor: colors.primary,
    padding: spacing.base,
    marginBottom: spacing.lg,
  },
  voiceMicWrap: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  voiceTextWrap: { flex: 1 },
  voiceBtnTitle: { fontSize: 16, fontWeight: '800', color: colors.primary },
  voiceBtnSub:   { fontSize: 11, fontWeight: '500', color: colors.primary, opacity: 0.6, marginTop: 2 },

  sectionLabel: { ...typography.captionBold, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: spacing.sm },

  favHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  favEditLink: { ...typography.caption, color: colors.primary, fontWeight: '600' },
  favRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  favItem: { flex: 1, backgroundColor: colors.ink, borderRadius: borderRadius.xl, padding: spacing.sm, borderTopWidth: 2, borderTopColor: colors.primary, overflow: 'hidden', gap: 3 },
  favItemEmpty: { flex: 1, backgroundColor: colors.surface, borderRadius: borderRadius.xl, padding: spacing.sm, borderWidth: 1.5, borderColor: colors.border, borderStyle: 'dashed', gap: 3, alignItems: 'flex-start' },
  favIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 2, backgroundColor: 'rgba(249,176,27,0.15)' },
  favIconEmpty: { backgroundColor: colors.borderLight },
  favLabel: { fontSize: 13, fontWeight: '700', color: colors.primary },
  favLabelEmpty: { fontSize: 13, fontWeight: '600', color: colors.textLight },
  favAddr: { fontSize: 11, fontWeight: '500', color: colors.primary, opacity: 0.6 },
  favAddBadge: { marginTop: 2, width: 18, height: 18, borderRadius: 9, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },

  uspStrip: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    justifyContent: 'center',
    backgroundColor: colors.ink,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.base,
    borderTopWidth: 2,
    borderTopColor: colors.primary,
  },
  uspText: { ...typography.caption, color: colors.primary, fontWeight: '600' },
});
