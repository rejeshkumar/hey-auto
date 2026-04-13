import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Input, ScreenWrapper } from '../../components';
import { colors, typography, spacing } from '../../theme';
import { useAuthStore } from '../../hooks/useAuthStore';
import { driverApi } from '../../services/driver';

export function RegistrationScreen() {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [loading, setLoading] = useState(false);
  const completeProfile = useAuthStore((s) => s.completeProfile);

  const handleSubmit = async () => {
    if (name.trim().length < 2 || vehicleNo.trim().length < 4) return;
    setLoading(true);
    try {
      await completeProfile({ fullName: name.trim(), email: email.trim() || undefined, language: 'ml' });

      await driverApi.registerVehicle({
        registrationNo: vehicleNo.trim().toUpperCase(),
        model: vehicleModel.trim() || undefined,
        color: vehicleColor.trim() || undefined,
      });
    } catch (err) {
      console.error('Registration error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenWrapper>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{t('auth.profileSetup')}</Text>
        <Text style={styles.subtitle}>Taliparamba, Kannur District</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Details</Text>
          <Input label={t('auth.fullName')} placeholder="Enter your name" value={name} onChangeText={setName} autoCapitalize="words" />
          <Input label={t('auth.email')} placeholder="email@example.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vehicle Details</Text>
          <Input label={t('auth.vehicleNo')} placeholder={t('auth.vehicleNoPlaceholder')} value={vehicleNo} onChangeText={setVehicleNo} autoCapitalize="characters" />
          <Input label={t('auth.vehicleModel')} placeholder="Bajaj RE, TVS King, etc." value={vehicleModel} onChangeText={setVehicleModel} />
          <Input label={t('auth.vehicleColor')} placeholder="Yellow, Green, etc." value={vehicleColor} onChangeText={setVehicleColor} />
        </View>

        <Button
          title={t('auth.register')}
          onPress={handleSubmit}
          loading={loading}
          disabled={name.trim().length < 2 || vehicleNo.trim().length < 4}
          style={{ marginTop: spacing.lg }}
        />
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingVertical: spacing.xxl, paddingHorizontal: spacing.xl },
  title: { ...typography.h2, color: colors.text, textAlign: 'center' },
  subtitle: { ...typography.small, color: colors.primary, textAlign: 'center', marginTop: spacing.xs, marginBottom: spacing.xxl },
  section: { marginBottom: spacing.lg },
  sectionTitle: { ...typography.h4, color: colors.text, marginBottom: spacing.md },
});
