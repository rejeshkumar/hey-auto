import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button, Input, ScreenWrapper } from '../../components';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { useAuthStore } from '../../hooks/useAuthStore';

export function PhoneScreen({ navigation }: any) {
  const { t } = useTranslation();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const sendOtp = useAuthStore((s) => s.sendOtp);

  const handleSendOtp = async () => {
    if (phone.length !== 10) {
      setError('Please enter a valid 10-digit number');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await sendOtp(phone);
      navigation.navigate('OTP', { phone });
    } catch (err: any) {
      setError(err.response?.data?.error?.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenWrapper>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <View style={styles.logoLines}>
                <View style={[styles.logoLine, styles.logoLineShort]} />
                <View style={[styles.logoLine, styles.logoLineMid]} />
                <View style={[styles.logoLine, styles.logoLineLong]} />
              </View>
              <View style={styles.logoTextRow}>
                <Text style={styles.logoHey}>Hey</Text>
                <Text style={styles.logoAuto}>Auto</Text>
              </View>
            </View>
            <Text style={styles.title}>{t('auth.welcome')}</Text>
            <Text style={styles.subtitle}>{t('auth.welcomeSub')}</Text>
          </View>

          <View style={styles.form}>
            <Input
              label={t('auth.phoneLabel')}
              placeholder={t('auth.phonePlaceholder')}
              value={phone}
              onChangeText={(text) => {
                setPhone(text.replace(/[^0-9]/g, '').slice(0, 10));
                setError('');
              }}
              keyboardType="phone-pad"
              maxLength={10}
              error={error}
              leftIcon={<Text style={styles.prefix}>+91</Text>}
            />

            <Button
              title={t('auth.sendOtp')}
              onPress={handleSendOtp}
              loading={loading}
              disabled={phone.length !== 10}
            />
          </View>

          <Text style={styles.terms}>
            By continuing, you agree to our Terms of Service and Privacy Policy
          </Text>
        </View>
      </KeyboardAvoidingView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.xl },
  header: { alignItems: 'center', marginBottom: spacing.xxxl },
  logoContainer: {
    backgroundColor: colors.ink,
    borderRadius: borderRadius.xxl,
    borderTopWidth: 3,
    borderTopColor: colors.primary,
    overflow: 'hidden',
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 14,
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },
  logoLines: { gap: 7, marginBottom: 10 },
  logoLine: { height: 5, borderRadius: 3, backgroundColor: colors.primary },
  logoLineShort: { width: 44 },
  logoLineMid:   { width: 60 },
  logoLineLong:  { width: 76 },
  logoTextRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  logoHey:  { fontSize: 22, fontWeight: '900', color: colors.white },
  logoAuto: { fontSize: 22, fontWeight: '900', color: colors.primary, fontStyle: 'italic' },
  title: { ...typography.h1, color: colors.text, textAlign: 'center' },
  subtitle: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm },
  form: { gap: spacing.lg },
  prefix: { fontSize: 15, fontWeight: '400', color: colors.text, lineHeight: 22 },
  terms: { ...typography.caption, color: colors.textLight, textAlign: 'center', marginTop: spacing.xxl },
});
