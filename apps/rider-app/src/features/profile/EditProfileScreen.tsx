import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { ScreenWrapper, Input, Button } from '../../components';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { useAuthStore } from '../../hooks/useAuthStore';
import { riderApi } from '../../services/rider';

export function EditProfileScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { user, setUser } = useAuthStore();

  const [fullName, setFullName] = useState(user?.fullName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const { data } = await riderApi.getProfile();
      setFullName(data.data.fullName || '');
      setEmail(data.data.email || '');
    } catch {
      // fall back to store values
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setError('');
    if (!fullName.trim() || fullName.trim().length < 2) {
      setError('Name must be at least 2 characters');
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Enter a valid email address');
      return;
    }
    setSaving(true);
    try {
      const { data } = await riderApi.updateProfile({ fullName: fullName.trim(), email: email.trim() || undefined });
      setUser({ ...user!, fullName: data.data.fullName, email: data.data.email });
      Alert.alert('', 'Profile updated successfully', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenWrapper>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Icon name="arrow-left" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.title}>{t('profile.editProfile')}</Text>
            <View style={{ width: 40 }} />
          </View>

          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xxxl }} />
          ) : (
            <View style={styles.form}>
              <View style={styles.avatarSection}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{fullName?.[0]?.toUpperCase() || '?'}</Text>
                </View>
                <Text style={styles.phoneLabel}>{user?.phone}</Text>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Full Name</Text>
                <Input
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="Your full name"
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Email (optional)</Text>
                <Input
                  value={email}
                  onChangeText={setEmail}
                  placeholder="your@email.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              {!!error && (
                <View style={styles.errorBox}>
                  <Icon name="alert-circle" size={16} color={colors.error} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <Button title={saving ? 'Saving…' : 'Save Changes'} onPress={handleSave} disabled={saving} style={styles.saveBtn} />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.base, paddingHorizontal: spacing.base },
  backBtn: { width: 40, height: 40, borderRadius: borderRadius.full, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.h4, color: colors.text },
  avatarSection: { alignItems: 'center', marginVertical: spacing.xl },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  avatarText: { ...typography.h2, color: colors.white },
  phoneLabel: { ...typography.small, color: colors.textSecondary },
  form: { paddingHorizontal: spacing.base },
  field: { marginBottom: spacing.base },
  label: { ...typography.smallBold, color: colors.textSecondary, marginBottom: spacing.sm },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.errorLight, borderRadius: borderRadius.md, padding: spacing.sm, marginBottom: spacing.base },
  errorText: { ...typography.small, color: colors.error, flex: 1 },
  saveBtn: { marginTop: spacing.base, marginBottom: spacing.xxxl },
});
