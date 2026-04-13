import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Input, ScreenWrapper } from '../../components';
import { colors, typography, spacing } from '../../theme';
import { useAuthStore } from '../../hooks/useAuthStore';

export function ProfileSetupScreen() {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const completeProfile = useAuthStore((s) => s.completeProfile);

  const handleSubmit = async () => {
    if (name.trim().length < 2) return;
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

        <Button
          title={t('auth.getStarted')}
          onPress={handleSubmit}
          loading={loading}
          disabled={name.trim().length < 2}
          style={{ marginTop: spacing.xxl }}
        />
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.xl },
  title: { ...typography.h2, color: colors.text, textAlign: 'center', marginBottom: spacing.xxl },
  form: { gap: spacing.sm },
});
