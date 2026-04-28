import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  FlatList, ActivityIndicator, TextInput, Modal, KeyboardAvoidingView, Platform, Linking,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { ScreenWrapper, Button } from '../../components';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { riderApi, EmergencyContact } from '../../services/rider';

export function EmergencyContactsScreen({ navigation }: any) {
  const { t } = useTranslation();
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relationship, setRelationship] = useState('');
  const [modalError, setModalError] = useState('');

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await riderApi.getEmergencyContacts();
      setContacts(data.data || []);
    } catch {
      setContacts([]);
    } finally {
      setLoading(false);
    }
  };

  const resetModal = () => { setName(''); setPhone(''); setRelationship(''); setModalError(''); };

  const handleAdd = async () => {
    setModalError('');
    if (!name.trim()) { setModalError('Enter contact name'); return; }
    if (!phone.trim() || phone.trim().length !== 10 || !/^\d+$/.test(phone.trim())) {
      setModalError('Enter a valid 10-digit phone number'); return;
    }
    setSaving(true);
    try {
      await riderApi.addEmergencyContact({ name: name.trim(), phone: phone.trim(), relationship: relationship.trim() || undefined });
      setShowModal(false);
      resetModal();
      load();
    } catch (err: any) {
      setModalError(err?.response?.data?.error?.message || 'Failed to add contact');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (contact: EmergencyContact) => {
    Alert.alert('Remove Contact', `Remove ${contact.name} from emergency contacts?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          try {
            await riderApi.deleteEmergencyContact(contact.id);
            setContacts(prev => prev.filter(c => c.id !== contact.id));
          } catch {
            Alert.alert('Error', 'Failed to remove contact');
          }
        },
      },
    ]);
  };

  const handleCall = (contact: EmergencyContact) => {
    Linking.openURL(`tel:${contact.phone}`);
  };

  return (
    <ScreenWrapper>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('profile.emergencyContacts')}</Text>
        <TouchableOpacity onPress={() => setShowModal(true)} style={styles.addBtn}>
          <Icon name="plus" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.safetyNote}>
        <Icon name="shield-check" size={18} color={colors.primary} />
        <Text style={styles.safetyText}>These contacts will be notified if you trigger an SOS during a ride</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xxxl }} />
      ) : (
        <FlatList
          data={contacts}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Icon name="account-alert" size={56} color={colors.border} />
              <Text style={styles.emptyTitle}>No emergency contacts</Text>
              <Text style={styles.emptySub}>Add trusted contacts who will be alerted in an emergency</Text>
              <Button title="+ Add Contact" onPress={() => setShowModal(true)} style={styles.emptyBtn} />
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.contactCard}>
              <View style={styles.contactAvatar}>
                <Text style={styles.contactAvatarText}>{item.name[0]?.toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.contactName}>{item.name}</Text>
                <Text style={styles.contactMeta}>
                  {item.phone}{item.relationship ? ` · ${item.relationship}` : ''}
                </Text>
              </View>
              <TouchableOpacity onPress={() => handleCall(item)} style={styles.callBtn}>
                <Icon name="phone" size={18} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(item)} style={styles.deleteBtn}>
                <Icon name="trash-can-outline" size={18} color={colors.textLight} />
              </TouchableOpacity>
            </View>
          )}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        />
      )}

      {/* Add Contact Modal */}
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => { setShowModal(false); resetModal(); }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Emergency Contact</Text>
              <TouchableOpacity onPress={() => { setShowModal(false); resetModal(); }}>
                <Icon name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.fieldLabel}>Name *</Text>
              <TextInput style={styles.textInput} value={name} onChangeText={setName} placeholder="e.g. Amma, Rajan" placeholderTextColor={colors.textLight} autoCapitalize="words" />

              <Text style={[styles.fieldLabel, { marginTop: spacing.base }]}>Phone Number *</Text>
              <View style={styles.phoneRow}>
                <View style={styles.prefix}><Text style={styles.prefixText}>+91</Text></View>
                <TextInput style={[styles.textInput, { flex: 1 }]} value={phone} onChangeText={setPhone} placeholder="9876543210" placeholderTextColor={colors.textLight} keyboardType="phone-pad" maxLength={10} />
              </View>

              <Text style={[styles.fieldLabel, { marginTop: spacing.base }]}>Relationship (optional)</Text>
              <View style={styles.relRow}>
                {['Family', 'Friend', 'Colleague'].map(r => (
                  <TouchableOpacity key={r} style={[styles.relChip, relationship === r && styles.relChipActive]} onPress={() => setRelationship(r)}>
                    <Text style={[styles.relChipText, relationship === r && styles.relChipTextActive]}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput style={[styles.textInput, { marginTop: spacing.sm }]} value={relationship} onChangeText={setRelationship} placeholder="Or type relationship" placeholderTextColor={colors.textLight} autoCapitalize="words" />

              {!!modalError && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{modalError}</Text>
                </View>
              )}
            </View>

            <View style={styles.modalFooter}>
              <Button title={saving ? 'Saving…' : 'Add Contact'} onPress={handleAdd} disabled={saving} />
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
  safetyNote: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.primaryLight, marginHorizontal: spacing.base, borderRadius: borderRadius.lg, padding: spacing.base, marginBottom: spacing.base },
  safetyText: { ...typography.small, color: colors.primary, flex: 1 },
  list: { padding: spacing.base, flexGrow: 1 },
  contactCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.base, backgroundColor: colors.card, borderRadius: borderRadius.xl, padding: spacing.base, elevation: 1, shadowColor: colors.black, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3 },
  contactAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.error, alignItems: 'center', justifyContent: 'center' },
  contactAvatarText: { ...typography.h4, color: colors.white },
  contactName: { ...typography.smallBold, color: colors.text },
  contactMeta: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  callBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  deleteBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: spacing.xxxl, paddingHorizontal: spacing.xl },
  emptyTitle: { ...typography.h4, color: colors.text, marginTop: spacing.base, textAlign: 'center' },
  emptySub: { ...typography.small, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm },
  emptyBtn: { marginTop: spacing.xl },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  modal: { backgroundColor: colors.card, borderTopLeftRadius: borderRadius.xxl, borderTopRightRadius: borderRadius.xxl, paddingBottom: spacing.xxxl },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  modalTitle: { ...typography.h4, color: colors.text },
  modalBody: { padding: spacing.lg },
  modalFooter: { paddingHorizontal: spacing.lg },
  fieldLabel: { ...typography.smallBold, color: colors.textSecondary, marginBottom: spacing.sm },
  phoneRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  prefix: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border, borderRadius: borderRadius.lg, padding: spacing.base, justifyContent: 'center' },
  prefixText: { ...typography.smallBold, color: colors.textSecondary },
  relRow: { flexDirection: 'row', gap: spacing.sm },
  relChip: { paddingHorizontal: spacing.base, paddingVertical: spacing.sm, borderRadius: borderRadius.full, borderWidth: 1.5, borderColor: colors.border },
  relChipActive: { borderColor: colors.error, backgroundColor: colors.errorLight },
  relChipText: { ...typography.smallBold, color: colors.textSecondary },
  relChipTextActive: { color: colors.error },
  textInput: { borderWidth: 1.5, borderColor: colors.border, borderRadius: borderRadius.lg, padding: spacing.base, fontSize: 15, color: colors.text, backgroundColor: colors.surface },
  errorBox: { backgroundColor: colors.errorLight, borderRadius: borderRadius.md, padding: spacing.sm, marginTop: spacing.sm },
  errorText: { ...typography.small, color: colors.error },
});
