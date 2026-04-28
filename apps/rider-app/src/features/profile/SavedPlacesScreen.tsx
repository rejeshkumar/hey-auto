import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  FlatList, ActivityIndicator, TextInput, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { ScreenWrapper, Button } from '../../components';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { riderApi, SavedPlace } from '../../services/rider';

const PLACE_ICONS: Record<string, string> = {
  home: 'home',
  work: 'briefcase',
  default: 'map-marker',
};

export function SavedPlacesScreen({ navigation }: any) {
  const { t } = useTranslation();
  const [places, setPlaces] = useState<SavedPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [label, setLabel] = useState('');
  const [address, setAddress] = useState('');
  const [modalError, setModalError] = useState('');

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

  const handleAdd = async () => {
    setModalError('');
    if (!label.trim()) { setModalError('Enter a label (e.g. Home, Work)'); return; }
    if (!address.trim()) { setModalError('Enter an address'); return; }
    setSaving(true);
    try {
      // Use a default location for now — in production this would use the maps picker
      await riderApi.addSavedPlace({ label: label.trim(), address: address.trim(), lat: 12.0368, lng: 75.3614 });
      setShowModal(false);
      setLabel(''); setAddress('');
      load();
    } catch (err: any) {
      setModalError(err?.response?.data?.error?.message || 'Failed to save place');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (place: SavedPlace) => {
    Alert.alert('Remove Place', `Remove "${place.label}" from saved places?`, [
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

  const iconFor = (label: string) => PLACE_ICONS[label.toLowerCase()] || PLACE_ICONS.default;

  return (
    <ScreenWrapper>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('profile.savedPlaces')}</Text>
        <TouchableOpacity onPress={() => setShowModal(true)} style={styles.addBtn}>
          <Icon name="plus" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xxxl }} />
      ) : (
        <FlatList
          data={places}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Icon name="map-marker-off" size={56} color={colors.border} />
              <Text style={styles.emptyTitle}>No saved places yet</Text>
              <Text style={styles.emptySub}>Save your home, work, or favourite spots for faster booking</Text>
              <Button title="+ Add Place" onPress={() => setShowModal(true)} style={styles.emptyBtn} />
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.placeCard}>
              <View style={[styles.placeIcon, item.label.toLowerCase() === 'home' ? styles.homeIcon : item.label.toLowerCase() === 'work' ? styles.workIcon : styles.defaultIcon]}>
                <Icon name={iconFor(item.label)} size={22} color={colors.white} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.placeLabel}>{item.label}</Text>
                <Text style={styles.placeAddress} numberOfLines={1}>{item.address}</Text>
              </View>
              <TouchableOpacity onPress={() => handleDelete(item)} style={styles.deleteBtn}>
                <Icon name="trash-can-outline" size={20} color={colors.textLight} />
              </TouchableOpacity>
            </View>
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}

      {/* Add Place Modal */}
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Saved Place</Text>
              <TouchableOpacity onPress={() => { setShowModal(false); setLabel(''); setAddress(''); setModalError(''); }}>
                <Icon name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.fieldLabel}>Label</Text>
              <View style={styles.labelRow}>
                {['Home', 'Work', 'Other'].map(opt => (
                  <TouchableOpacity key={opt} style={[styles.labelChip, label === opt && styles.labelChipActive]} onPress={() => setLabel(opt)}>
                    <Text style={[styles.labelChipText, label === opt && styles.labelChipTextActive]}>{opt}</Text>
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
                style={[styles.textInput, { height: 72 }]}
                value={address}
                onChangeText={setAddress}
                placeholder="Enter full address"
                placeholderTextColor={colors.textLight}
                multiline
              />

              {!!modalError && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{modalError}</Text>
                </View>
              )}
            </View>

            <View style={styles.modalFooter}>
              <Button title={saving ? 'Saving…' : 'Save Place'} onPress={handleAdd} disabled={saving} />
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
  addBtn: { width: 40, height: 40, borderRadius: borderRadius.full, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.h4, color: colors.text },
  list: { padding: spacing.base, flexGrow: 1 },
  placeCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.base, backgroundColor: colors.card, borderRadius: borderRadius.xl, padding: spacing.base, elevation: 1, shadowColor: colors.black, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3 },
  placeIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  homeIcon: { backgroundColor: colors.primary },
  workIcon: { backgroundColor: colors.info },
  defaultIcon: { backgroundColor: colors.warning },
  placeLabel: { ...typography.smallBold, color: colors.text },
  placeAddress: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  deleteBtn: { padding: spacing.sm },
  separator: { height: spacing.sm },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: spacing.xxxl, paddingHorizontal: spacing.xl },
  emptyTitle: { ...typography.h4, color: colors.text, marginTop: spacing.base, textAlign: 'center' },
  emptySub: { ...typography.small, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm },
  emptyBtn: { marginTop: spacing.xl, paddingHorizontal: spacing.xl },
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
  errorBox: { backgroundColor: colors.errorLight, borderRadius: borderRadius.md, padding: spacing.sm, marginTop: spacing.sm },
  errorText: { ...typography.small, color: colors.error },
});
