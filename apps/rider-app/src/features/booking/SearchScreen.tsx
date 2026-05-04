import React, { useState, useCallback, useRef } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { useRideStore } from '../../hooks/useRideStore';
import { mapsApi, PlacePrediction } from '../../services/maps';

const SESSION_TOKEN = Math.random().toString(36).substring(2);

export function SearchScreen({ navigation }: any) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlacePrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingPickup, setEditingPickup] = useState(false);
  const [pickupQuery, setPickupQuery] = useState('');
  const { setDropoff, setPickup, setPhase } = useRideStore();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pickupDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = useCallback((text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.length < 2) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const { data } = await mapsApi.searchPlaces(text, SESSION_TOKEN);
        if (data.success) {
          setResults(data.data);
        } else {
          setError(data.error?.message || 'Search failed');
        }
      } catch (err: any) {
        const msg = err?.response?.data?.error?.message || err?.message || 'Network error';
        setError(msg);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, []);

  const handlePickupSearch = useCallback((text: string) => {
    setPickupQuery(text);
    if (pickupDebounceRef.current) clearTimeout(pickupDebounceRef.current);
    if (text.length < 2) { setResults([]); return; }
    pickupDebounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await mapsApi.searchPlaces(text, SESSION_TOKEN);
        if (data.success) setResults(data.data);
      } catch {} finally {
        setLoading(false);
      }
    }, 300);
  }, []);

  const handleSelectPlace = async (place: PlacePrediction, isPickup = false) => {
    try {
      const { data } = await mapsApi.getPlaceDetails(place.placeId, SESSION_TOKEN);
      if (data.success && data.data && data.data.lat !== 0 && data.data.lng !== 0) {
        if (isPickup) {
          setPickup({ lat: data.data.lat, lng: data.data.lng, address: data.data.name || place.mainText });
          setEditingPickup(false);
          setPickupQuery('');
          setResults([]);
        } else {
          setDropoff({ lat: data.data.lat, lng: data.data.lng, address: data.data.name || place.mainText });
          setPhase('reviewing_estimate');
          navigation.navigate('BookingConfirm');
        }
      } else {
        setError('Could not get location details. Please try another place.');
      }
    } catch {
      setError('Could not get location details. Please try another place.');
    }
  };

  const handleSwap = () => {
    const store = useRideStore.getState();
    const currentPickup = store.pickup;
    const currentDropoff = store.dropoff;
    if (currentPickup && currentDropoff) {
      setPickup(currentDropoff);
      setDropoff(currentPickup);
    }
  };

  const pickupAddress = useRideStore.getState().pickup?.address || t('booking.currentLocation');
  const dropoffAddress = useRideStore.getState().dropoff?.address || '';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.inputContainer}>
          <View style={styles.dots}>
            <View style={[styles.dot, { backgroundColor: colors.secondary }]} />
            <View style={styles.line} />
            <View style={[styles.dot, { backgroundColor: colors.error }]} />
          </View>
          <View style={styles.inputs}>
            <View style={styles.inputRow}>
              {editingPickup ? (
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search pickup location"
                  placeholderTextColor={colors.textLight}
                  value={pickupQuery}
                  onChangeText={handlePickupSearch}
                  autoFocus
                />
              ) : (
                <TouchableOpacity onPress={() => { setEditingPickup(true); setResults([]); setQuery(''); }}>
                  <Text style={styles.inputLabel} numberOfLines={1}>{pickupAddress}</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.inputDivider} />
            {!editingPickup && (
              <TextInput
                style={styles.searchInput}
                placeholder={t('home.searchPlaceholder')}
                placeholderTextColor={colors.textLight}
                value={query}
                onChangeText={handleSearch}
                autoFocus
              />
            )}
          </View>

          <TouchableOpacity style={styles.swapBtn} onPress={handleSwap}>
            <Icon name="swap-vertical" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {loading && <ActivityIndicator size="small" color={colors.primary} style={styles.loader} />}

      {error && <Text style={styles.errorText}>{error}</Text>}

      <FlatList
        data={results}
        keyExtractor={(item) => item.placeId}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.placeItem} onPress={() => handleSelectPlace(item, editingPickup)}>
            <View style={styles.placeIcon}>
              <Icon name="map-marker" size={20} color={colors.primary} />
            </View>
            <View style={styles.placeInfo}>
              <Text style={styles.placeName}>{item.mainText}</Text>
              <Text style={styles.placeNameEn} numberOfLines={1}>{item.secondaryText}</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          query.length >= 2 && !loading && !error ? (
            <Text style={styles.empty}>No places found</Text>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingTop: 50,
    paddingHorizontal: spacing.base, paddingBottom: spacing.base,
    backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  backBtn: { marginRight: spacing.md },
  inputContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dots: { alignItems: 'center', paddingTop: spacing.sm, gap: 2 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  line: { width: 2, height: 24, backgroundColor: colors.border },
  inputs: { flex: 1 },
  inputRow: { paddingVertical: spacing.sm },
  inputLabel: { ...typography.small, color: colors.textSecondary },
  inputDivider: { height: 1, backgroundColor: colors.borderLight },
  searchInput: { ...typography.body, color: colors.text, paddingVertical: spacing.sm },
  swapBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: colors.primary,
  },
  loader: { marginTop: spacing.md },
  list: { padding: spacing.base },
  placeItem: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md,
    gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  placeIcon: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  placeInfo: { flex: 1 },
  placeName: { ...typography.bodyBold, color: colors.text },
  placeNameEn: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  empty: { ...typography.body, color: colors.textLight, textAlign: 'center', marginTop: spacing.xxl },
  errorText: { ...typography.small, color: colors.error, textAlign: 'center', margin: spacing.md },
});
