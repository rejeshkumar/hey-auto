import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, TextInput,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { ScreenWrapper, Button } from '../../components';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { driverApi, Vehicle } from '../../services/driver';

const CURRENT_YEAR = new Date().getFullYear();

export function VehicleScreen({ navigation }: any) {
  const { t } = useTranslation();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  const [form, setForm] = useState({
    registrationNo: '',
    model: '',
    color: '',
    year: '',
  });

  useEffect(() => { loadVehicle(); }, []);

  const loadVehicle = async () => {
    setLoading(true);
    try {
      const { data } = await driverApi.getVehicle();
      const v = data.data;
      if (v) {
        setVehicle(v);
        setForm({
          registrationNo: v.registrationNo || '',
          model: v.model || '',
          color: v.color || '',
          year: v.year ? String(v.year) : '',
        });
      } else {
        setEditing(true);
      }
    } catch {
      setEditing(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!form.registrationNo.trim()) {
      Alert.alert('Required', 'Vehicle registration number is required.');
      return;
    }
    if (form.registrationNo.trim().length < 5) {
      Alert.alert('Invalid', 'Enter a valid registration number (e.g. KL13 AB 1234).');
      return;
    }
    if (form.year && (isNaN(Number(form.year)) || Number(form.year) < 2000 || Number(form.year) > CURRENT_YEAR)) {
      Alert.alert('Invalid', `Year must be between 2000 and ${CURRENT_YEAR}.`);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        registrationNo: form.registrationNo.trim().toUpperCase(),
        model: form.model.trim() || undefined,
        color: form.color.trim() || undefined,
        year: form.year ? Number(form.year) : undefined,
      };
      const { data } = await driverApi.registerVehicle(payload);
      setVehicle(data.data);
      setEditing(false);
      Alert.alert('Saved', 'Vehicle details saved successfully.');
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error?.message || 'Failed to save vehicle details.');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = () => setEditing(true);

  const handleCancel = () => {
    if (vehicle) {
      setForm({
        registrationNo: vehicle.registrationNo || '',
        model: vehicle.model || '',
        color: vehicle.color || '',
        year: vehicle.year ? String(vehicle.year) : '',
      });
      setEditing(false);
    }
  };

  const set = (field: keyof typeof form) => (val: string) =>
    setForm((prev) => ({ ...prev, [field]: val }));

  if (loading) {
    return (
      <ScreenWrapper>
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 100 }} />
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>My Vehicle</Text>
        {vehicle && !editing ? (
          <TouchableOpacity onPress={handleEdit} style={styles.editBtn}>
            <Icon name="pencil" size={20} color={colors.primary} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

        {/* Vehicle illustration card */}
        <View style={styles.illustrationCard}>
          <Icon name="rickshaw" size={56} color={colors.primary} />
          <Text style={styles.illustrationLabel}>
            {vehicle ? vehicle.registrationNo : 'Register your vehicle'}
          </Text>
          {vehicle && (
            <View style={[styles.activeBadge, { backgroundColor: vehicle.isActive ? colors.successLight : colors.warningLight }]}>
              <Text style={[styles.activeBadgeText, { color: vehicle.isActive ? colors.success : colors.warning }]}>
                {vehicle.isActive ? 'Active' : 'Inactive'}
              </Text>
            </View>
          )}
        </View>

        {editing ? (
          /* ── Edit / Register Form ── */
          <View style={styles.form}>
            <Field
              label="Registration Number *"
              placeholder="e.g. KL13 AB 1234"
              value={form.registrationNo}
              onChangeText={set('registrationNo')}
              autoCapitalize="characters"
              maxLength={15}
            />
            <Field
              label="Model"
              placeholder="e.g. Bajaj RE, TVS King"
              value={form.model}
              onChangeText={set('model')}
            />
            <Field
              label="Color"
              placeholder="e.g. Yellow"
              value={form.color}
              onChangeText={set('color')}
            />
            <Field
              label="Year"
              placeholder={`e.g. ${CURRENT_YEAR}`}
              value={form.year}
              onChangeText={set('year')}
              keyboardType="numeric"
              maxLength={4}
            />

            <View style={styles.actions}>
              <Button
                title={saving ? 'Saving…' : 'Save Vehicle'}
                onPress={handleSave}
                disabled={saving}
                style={styles.saveBtn}
              />
              {vehicle && (
                <TouchableOpacity onPress={handleCancel} style={styles.cancelBtn}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ) : (
          /* ── Display Mode ── */
          vehicle && (
            <View style={styles.detailsCard}>
              <DetailRow icon="card-text" label="Registration No" value={vehicle.registrationNo} />
              {vehicle.model && <DetailRow icon="car-info" label="Model" value={vehicle.model} />}
              {vehicle.color && <DetailRow icon="palette" label="Color" value={vehicle.color} />}
              {vehicle.year && <DetailRow icon="calendar" label="Year" value={String(vehicle.year)} />}
              {vehicle.permitExpiry && (
                <DetailRow
                  icon="file-certificate"
                  label="Permit Expiry"
                  value={new Date(vehicle.permitExpiry).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  warn={isExpiringSoon(vehicle.permitExpiry)}
                />
              )}
              {vehicle.insuranceExpiry && (
                <DetailRow
                  icon="shield-check"
                  label="Insurance Expiry"
                  value={new Date(vehicle.insuranceExpiry).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  warn={isExpiringSoon(vehicle.insuranceExpiry)}
                />
              )}
              {vehicle.fitnessExpiry && (
                <DetailRow
                  icon="clipboard-check"
                  label="Fitness Expiry"
                  value={new Date(vehicle.fitnessExpiry).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  warn={isExpiringSoon(vehicle.fitnessExpiry)}
                />
              )}
            </View>
          )
        )}

        <View style={styles.noteCard}>
          <Icon name="information" size={16} color={colors.info} />
          <Text style={styles.noteText}>
            Permit, insurance, and fitness expiry dates are updated by Aye Auto admin after document verification.
          </Text>
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function isExpiringSoon(dateStr: string): boolean {
  const diff = new Date(dateStr).getTime() - Date.now();
  return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000; // within 30 days
}

function Field({
  label, placeholder, value, onChangeText, autoCapitalize, keyboardType, maxLength,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (v: string) => void;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  keyboardType?: 'default' | 'numeric';
  maxLength?: number;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.fieldInput}
        placeholder={placeholder}
        placeholderTextColor={colors.textLight}
        value={value}
        onChangeText={onChangeText}
        autoCapitalize={autoCapitalize || 'words'}
        keyboardType={keyboardType || 'default'}
        maxLength={maxLength}
      />
    </View>
  );
}

function DetailRow({
  icon, label, value, warn,
}: {
  icon: string;
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <View style={styles.detailRow}>
      <View style={[styles.detailIcon, warn && { backgroundColor: colors.warningLight }]}>
        <Icon name={icon as any} size={18} color={warn ? colors.warning : colors.primary} />
      </View>
      <View style={styles.detailText}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={[styles.detailValue, warn && { color: colors.warning }]}>
          {value}{warn ? '  ⚠ Expiring soon' : ''}
        </Text>
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: spacing.base, paddingHorizontal: spacing.base,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: borderRadius.full,
    backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center',
  },
  title: { ...typography.h4, color: colors.text },
  editBtn: {
    width: 40, height: 40, borderRadius: borderRadius.full,
    backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  content: { padding: spacing.base, paddingBottom: spacing.xxxl },
  illustrationCard: {
    backgroundColor: colors.card, borderRadius: borderRadius.xl, padding: spacing.xl,
    alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg,
    elevation: 1, shadowColor: colors.black, shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 3,
  },
  illustrationLabel: { ...typography.h4, color: colors.text },
  activeBadge: { paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: borderRadius.full },
  activeBadgeText: { ...typography.captionBold },
  form: { gap: spacing.base },
  fieldWrap: { gap: spacing.xs },
  fieldLabel: { ...typography.smallBold, color: colors.text },
  fieldInput: {
    backgroundColor: colors.card, borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.base, paddingVertical: spacing.md,
    ...typography.body, color: colors.text,
    borderWidth: 1.5, borderColor: colors.borderLight,
  },
  actions: { gap: spacing.sm, marginTop: spacing.sm },
  saveBtn: { marginTop: 0 },
  cancelBtn: { alignItems: 'center', paddingVertical: spacing.md },
  cancelText: { ...typography.smallBold, color: colors.textSecondary },
  detailsCard: {
    backgroundColor: colors.card, borderRadius: borderRadius.xl, overflow: 'hidden',
    elevation: 1, shadowColor: colors.black, shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 3, marginBottom: spacing.base,
  },
  detailRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.base,
    paddingHorizontal: spacing.base, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  detailIcon: {
    width: 40, height: 40, borderRadius: borderRadius.md,
    backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  detailText: { flex: 1 },
  detailLabel: { ...typography.caption, color: colors.textSecondary },
  detailValue: { ...typography.smallBold, color: colors.text, marginTop: 2 },
  noteCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
    backgroundColor: colors.infoLight, borderRadius: borderRadius.lg,
    padding: spacing.base, marginTop: spacing.sm,
  },
  noteText: { ...typography.caption, color: colors.info, flex: 1, lineHeight: 18 },
});
