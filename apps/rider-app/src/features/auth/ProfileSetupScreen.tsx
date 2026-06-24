import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Input, ScreenWrapper } from '../../components';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { useAuthStore } from '../../hooks/useAuthStore';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';

const PRIVACY_URL = 'https://hey-auto-server-production.up.railway.app/legal/privacy';

export function ProfileSetupScreen() {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const completeProfile = useAuthStore((s) => s.completeProfile);

  const handleSubmit = async () => {
    if (name.trim().length < 2 || !consentGiven || !ageConfirmed) return;
    setLoading(true);
    try {
      await completeProfile({ fullName: name.trim(), email: email.trim() || undefined, language: 'ml' });
    } catch (err) {
      console.error('Profile setup error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenWrapper>
      <View style={styles.content}>
        <Text style={styles.title}>{t('auth.profileSetup')}</Text>

        <View style={styles.form}>
          <Input
            label={t('auth.fullName')}
            placeholder="Enter your name"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
          <Input
            label={t('auth.email')}
            placeholder="email@example.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        {/* DPDP Consent Notice */}
        <View style={styles.consentBox}>
          <Text style={styles.consentHeading}>Data Collection Notice</Text>
          <Text style={styles.consentText}>
            Aye Auto collects your <Text style={styles.bold}>name, phone number, and GPS location</Text> to provide ride booking services. Your data is stored securely and used only for bookings, safety, and improving the service. You can delete your account anytime from Profile settings.
          </Text>
          <TouchableOpacity onPress={() => Linking.openURL(PRIVACY_URL)}>
            <Text style={styles.privacyLink}>Read full Privacy Policy →</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.checkRow} onPress={() => setConsentGiven(v => !v)} activeOpacity={0.7}>
            <View style={[styles.checkbox, consentGiven && styles.checkboxChecked]}>
              {consentGiven && <Icon name="check" size={14} color={colors.white} />}
            </View>
            <Text style={styles.checkLabel}>I agree to the collection and use of my data as described above</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.checkRow} onPress={() => setAgeConfirmed(v => !v)} activeOpacity={0.7}>
            <View style={[styles.checkbox, ageConfirmed && styles.checkboxChecked]}>
              {ageConfirmed && <Icon name="check" size={14} color={colors.white} />}
            </View>
            <Text style={styles.checkLabel}>I confirm that I am 18 years of age or older (required under DPDP Act 2023)</Text>
          </TouchableOpacity>
        </View>

        <Button
          title={t('auth.getStarted')}
          onPress={handleSubmit}
          loading={loading}
          disabled={name.trim().length < 2 || !consentGiven || !ageConfirmed}
          style={{ marginTop: spacing.lg }}
        />
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.xl },
  title: { ...typography.h2, color: colors.text, textAlign: 'center', marginBottom: spacing.xxl },
  form: { gap: spacing.sm, marginBottom: spacing.lg },
  consentBox: {
    backgroundColor: colors.surface, borderRadius: borderRadius.xl,
    padding: spacing.base, borderWidth: 1, borderColor: colors.borderLight, gap: spacing.sm,
  },
  consentHeading: { ...typography.smallBold, color: colors.text },
  consentText: { ...typography.caption, color: colors.textSecondary, lineHeight: 18 },
  bold: { fontWeight: '700', color: colors.text },
  privacyLink: { ...typography.caption, color: colors.primary, fontWeight: '600' },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginTop: spacing.xs },
  checkbox: {
    width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: colors.primary,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1,
  },
  checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkLabel: { ...typography.caption, color: colors.text, flex: 1, lineHeight: 18 },
});
