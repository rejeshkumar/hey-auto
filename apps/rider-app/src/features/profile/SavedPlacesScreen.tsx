import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  ActivityIndicator, TextInput, Modal, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { ScreenWrapper, Button } from '../../components';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { riderApi, SavedPlace } from '../../services/rider';
import { mapsApi, PlacePrediction } from '../../services/maps';

const SESSION_TOKEN = Math.random().toString(36).substring(2);

const SLOTS = [
  { key: 'Home',   icon: 'home',      color: colors.primary },
  { key: 'Work',   icon: 'briefcase', color: colors.info },
  { key: 'Other',  icon: 'star',      color: colors.warning },
] as const;

export function SavedPlacesScreen({ navigation }: any) {
  const { t } = useTranslation();
  const [places, setPlaces] = useState<SavedPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [label, setLabel] = useState('');
  const [address, setAddress] = useState('');
  const [modalError, setModalError] = useState('');
  const [searchResults, setSearchResults] = useState<PlacePrediction[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<{ lat: number; lng: number; address: string } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await riderApi.getSavedPlaces();
      setPlaces(data.data || []);
    } catch {
      setPlaces([]);
    } finally {
      setLoading(false);
    }
  };

  const openModal = (presetLabel?: string) => {
    setLabel(presetLabel || '');
    setAddress('');
    setSelectedPlace(null);
    setSearchResults([]);
    setModalError('');
    setShowModal(true);
  };

  const handleAddressChange = useCallback((text: string) => {
    setAddress(text);
    setSelectedPlace(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.length < 3) { setSearchResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const { data } = await mapsApi.searchPlaces(text, SESSION_TOKEN);
        if (data.success) setSearchResults(data.data);
      } catch {} finally {
        setSearchLoading(false);
      }
    }, 350);
  }, []);

  const handleSelectSearchResult = async (place: PlacePrediction) => {
    setSearchLoading(true);
    try {
      const { data } = await mapsApi.getPlaceDetails(place.placeId, SESSION_TOKEN);
      if (data.success && data.data) {
        setSelectedPlace({ lat: data.data.lat, lng: data.data.lng, address: data.data.name || place.mainText });
        setAddress(data.data.name || place.mainText);
        setSearchResults([]);
      }
    } catch {
      setModalError('Could not resolve location. Try another.');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSave = async () => {
    setModalError('');
    if (!label.trim()) { setModalError('Enter a label'); return; }
    if (!selectedPlace) { setModalError('Select an address from the suggestions below'); return; }
    setSaving(true);
    try {
      await riderApi.addSavedPlace({ label: label.trim(), address: selectedPlace.address, lat: selectedPlace.lat, lng: selectedPlace.lng });
      setShowModal(false);
      load();
    } catch (err: any) {
      setModalError(err?.response?.data?.error?.message || 'Failed to save place');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (place: SavedPlace) => {
    Alert.alert('Remove Place', `Remove "${place.label}" from favourites?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          try {
            await riderApi.deleteSavedPlace(place.id);
            setPlaces(prev => prev.filter(p => p.id !== place.id));
          } catch {
            Alert.alert('Error', 'Failed to remove place');
          }
        },
      },
    ]);
  };

  const savedByLabel = (key: string) =>
    places.find(p => p.label.toLowerCase() === key.toLowerCase());

  return (
    <ScreenWrapper>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Favourite Places</Text>
        <View style={{ width: 40 }} />
      </View>

      <Text style={styles.subtitle}>Save up to 3 places for quick booking</Text>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xxxl }} />
      ) : (
        <ScrollView contentContainerStyle={styles.slots}>
          {SLOTS.map((slot) => {
            const saved = savedByLabel(slot.key);
            return (
              <View key={slot.key} style={styles.slotCard}>
                <View style={[styles.slotIcon, { backgroundColor: slot.color }]}>
                  <Icon name={slot.icon} size={22} color={colors.white} />
                </View>
                <View style={styles.slotInfo}>
                  <Text style={styles.slotLabel}>{slot.key}</Text>
                  {saved ? (
                    <Text style={styles.slotAddress} numberOfLines={1}>{saved.address}</Text>
                  ) : (
                    <Text style={styles.slotEmpty}>Not set</Text>
                  )}
                </View>
                {saved ? (
                  <TouchableOpacity onPress={() => handleDelete(saved)} style={styles.actionBtn}>
                    <Icon name="trash-can-outline" size={20} color={colors.textLight} />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity onPress={() => openModal(slot.key)} style={styles.actionBtn}>
                    <Icon name="plus-circle-outline" size={22} color={colors.primary} />
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Add Place Modal */}
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add {label || 'Place'}</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Icon name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.fieldLabel}>Label</Text>
              <View style={styles.labelRow}>
                {SLOTS.map((s) => (
                  <TouchableOpacity
                    key={s.key}
                    style={[styles.labelChip, label === s.key && styles.labelChipActive]}
                    onPress={() => setLabel(s.key)}
                  >
                    <Text style={[styles.labelChipText, label === s.key && styles.labelChipTextActive]}>{s.key}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={styles.textInput}
                value={label}
                onChangeText={setLabel}
                placeholder="Or type custom label"
                placeholderTextColor={colors.textLight}
              />

              <Text style={[styles.fieldLabel, { marginTop: spacing.base }]}>Address</Text>
              <TextInput
                style={styles.textInput}
                value={address}
                onChangeText={handleAddressChange}
                placeholder="Search for address..."
                placeholderTextColor={colors.textLight}
              />
              {searchLoading && <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: spacing.sm }} />}
              {selectedPlace && (
                <View style={styles.selectedPlaceRow}>
                  <Icon name="check-circle" size={16} color={colors.secondary} />
                  <Text style={styles.selectedPlaceText} numberOfLines={1}>{selectedPlace.address}</Text>
                </View>
              )}
              {searchResults.length > 0 && !selectedPlace && (
                <View style={styles.suggestionsBox}>
                  {searchResults.slice(0, 4).map((r) => (
                    <TouchableOpacity key={r.placeId} style={styles.suggestionItem} onPress={() => handleSelectSearchResult(r)}>
                      <Icon name="map-marker-outline" size={16} color={colors.primary} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.suggestionMain}>{r.mainText}</Text>
                        <Text style={styles.suggestionSub} numberOfLines={1}>{r.secondaryText}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {!!modalError && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{modalError}</Text>
                </View>
              )}
            </View>

            <View style={styles.modalFooter}>
              <Button title={saving ? 'Saving…' : 'Save Place'} onPress={handleSave} disabled={saving} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.base, paddingHorizontal: spacing.base },
  backBtn: { width: 40, height: 40, borderRadius: borderRadius.full, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.h4, color: colors.text },
  subtitle: { ...typography.small, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.lg, paddingHorizontal: spacing.xl },

  slots: { padding: spacing.base, gap: spacing.sm },
  slotCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.base, backgroundColor: colors.card, borderRadius: borderRadius.xl, padding: spacing.base, elevation: 1, shadowColor: colors.black, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3 },
  slotIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  slotInfo: { flex: 1 },
  slotLabel: { ...typography.smallBold, color: colors.text },
  slotAddress: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  slotEmpty: { ...typography.caption, color: colors.textLight, marginTop: 2 },
  actionBtn: { padding: spacing.sm },

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  modal: { backgroundColor: colors.card, borderTopLeftRadius: borderRadius.xxl, borderTopRightRadius: borderRadius.xxl, paddingBottom: spacing.xxxl },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  modalTitle: { ...typography.h4, color: colors.text },
  modalBody: { padding: spacing.lg },
  modalFooter: { paddingHorizontal: spacing.lg },
  fieldLabel: { ...typography.smallBold, color: colors.textSecondary, marginBottom: spacing.sm },
  labelRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  labelChip: { paddingHorizontal: spacing.base, paddingVertical: spacing.sm, borderRadius: borderRadius.full, borderWidth: 1.5, borderColor: colors.border },
  labelChipActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  labelChipText: { ...typography.smallBold, color: colors.textSecondary },
  labelChipTextActive: { color: colors.primary },
  textInput: { borderWidth: 1.5, borderColor: colors.border, borderRadius: borderRadius.lg, padding: spacing.base, fontSize: 15, color: colors.text, backgroundColor: colors.surface },
  selectedPlaceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.secondaryLight, borderRadius: borderRadius.md, padding: spacing.sm, marginTop: spacing.xs },
  selectedPlaceText: { ...typography.caption, color: colors.secondary, flex: 1 },
  suggestionsBox: { backgroundColor: colors.white, borderRadius: borderRadius.lg, marginTop: spacing.xs, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  suggestionItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  suggestionMain: { ...typography.small, color: colors.text },
  suggestionSub: { ...typography.caption, color: colors.textSecondary },
  errorBox: { backgroundColor: colors.errorLight, borderRadius: borderRadius.md, padding: spacing.sm, marginTop: spacing.sm },
  errorText: { ...typography.small, color: colors.error },
});
