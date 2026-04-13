import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, ScreenWrapper } from '../../components';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { useAuthStore } from '../../hooks/useAuthStore';

export function OtpScreen({ route }: any) {
  const { phone } = route.params;
  const { t } = useTranslation();
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendTimer, setResendTimer] = useState(30);
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const { verifyOtp, sendOtp } = useAuthStore();

  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  const handleOtpChange = (value: string, index: number) => {
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setError('');
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
    if (newOtp.every((d) => d !== '')) handleVerify(newOtp.join(''));
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (otpStr?: string) => {
    const code = otpStr || otp.join('');
    if (code.length !== 6) return;
    setLoading(true);
    setError('');
    try {
      await verifyOtp(phone, code);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || t('auth.invalidOtp'));
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0) return;
    try { await sendOtp(phone); setResendTimer(30); } catch {}
  };

  return (
    <ScreenWrapper>
      <View style={styles.content}>
        <Text style={styles.title}>{t('auth.enterOtp')}</Text>
        <Text style={styles.subtitle}>{t('auth.otpSent', { phone: `+91 ${phone}` })}</Text>

        <View style={styles.otpContainer}>
          {otp.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => { inputRefs.current[index] = ref; }}
              style={[styles.otpInput, digit && styles.otpInputFilled, error && styles.otpInputError]}
              value={digit}
              onChangeText={(v) => handleOtpChange(v.replace(/[^0-9]/g, ''), index)}
              onKeyPress={(e) => handleKeyPress(e, index)}
              keyboardType="number-pad"
              maxLength={1}
              selectTextOnFocus
            />
          ))}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button title={t('auth.verifyOtp')} onPress={() => handleVerify()} loading={loading} disabled={otp.some((d) => !d)} style={{ marginTop: spacing.xl }} />

        <TouchableOpacity onPress={handleResend} disabled={resendTimer > 0} style={styles.resendBtn}>
          <Text style={[styles.resendText, resendTimer > 0 && styles.resendDisabled]}>
            {resendTimer > 0 ? t('auth.resendIn', { seconds: resendTimer }) : t('auth.resendOtp')}
          </Text>
        </TouchableOpacity>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.xl },
  title: { ...typography.h2, color: colors.text, textAlign: 'center' },
  subtitle: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm, marginBottom: spacing.xxl },
  otpContainer: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
  otpInput: { width: 48, height: 56, borderWidth: 1.5, borderColor: colors.border, borderRadius: borderRadius.lg, textAlign: 'center', fontSize: 22, fontWeight: '700', color: colors.text, backgroundColor: colors.surface },
  otpInputFilled: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  otpInputError: { borderColor: colors.error },
  error: { ...typography.small, color: colors.error, textAlign: 'center', marginTop: spacing.md },
  resendBtn: { alignItems: 'center', marginTop: spacing.xl },
  resendText: { ...typography.smallBold, color: colors.primary },
  resendDisabled: { color: colors.textLight },
});
