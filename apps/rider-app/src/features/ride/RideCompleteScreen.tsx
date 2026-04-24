import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { Button, ScreenWrapper } from '../../components';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { useRideStore } from '../../hooks/useRideStore';
import { rideApi } from '../../services/ride';

export function RideCompleteScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { currentRide, completedRideData, driverInfo, resetRide } = useRideStore();
  const [rating, setRating] = useState(5);
  const [tipAmount, setTipAmount] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const fare = completedRideData?.totalAmount || currentRide?.totalAmount || currentRide?.estimatedFare || 0;
  const distance = completedRideData?.actualDistanceKm || currentRide?.estimatedDistanceKm || 0;
  const duration = completedRideData?.actualDurationMin || currentRide?.estimatedDurationMin || 0;

  const handleSubmit = async () => {
    if (!currentRide) return;
    setSubmitting(true);
    try {
      await rideApi.rateRide(currentRide.id, rating, undefined, tipAmount || undefined);
    } catch (err) {
      console.error('Rate error:', err);
    } finally {
      resetRide();
      navigation.replace('MainTabs');
    }
  };

  const tipOptions = [0, 10, 20, 50];

  return (
    <ScreenWrapper>
      <View style={styles.content}>
        <View style={styles.successIcon}>
          <Icon name="check-circle" size={64} color={colors.success} />
        </View>
        <Text style={styles.title}>{t('rideComplete.title')}</Text>

        <View style={styles.fareCard}>
          <View style={styles.fareMain}>
            <Text style={styles.fareAmount}>₹{Math.round(fare)}</Text>
            <Text style={styles.paidLabel}>{t('rideComplete.paid')} • {completedRideData?.paymentMethod || 'CASH'}</Text>
          </View>
          <View style={styles.fareDetails}>
            <View style={styles.fareDetail}>
              <Icon name="map-marker-distance" size={16} color={colors.textSecondary} />
              <Text style={styles.fareDetailText}>{distance.toFixed(1)} km</Text>
            </View>
            <View style={styles.fareDetail}>
              <Icon name="clock-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.fareDetailText}>{duration} min</Text>
            </View>
          </View>
        </View>

        {driverInfo && (
          <View style={styles.rateSection}>
            <Text style={styles.rateLabel}>{t('rideComplete.rateDriver')}</Text>
            <Text style={styles.driverName}>{driverInfo.driverName}</Text>
            <View style={styles.stars}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity key={star} onPress={() => setRating(star)}>
                  <Icon
                    name={star <= rating ? 'star' : 'star-outline'}
                    size={40}
                    color={star <= rating ? colors.rating : colors.border}
                  />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <View style={styles.tipSection}>
          <Text style={styles.tipLabel}>{t('rideComplete.addTip')}</Text>
          <View style={styles.tipOptions}>
            {tipOptions.map((tip) => (
              <TouchableOpacity
                key={tip}
                style={[styles.tipBtn, tipAmount === tip && styles.tipBtnActive]}
                onPress={() => setTipAmount(tip)}
              >
                <Text style={[styles.tipBtnText, tipAmount === tip && styles.tipBtnTextActive]}>
                  {tip === 0 ? 'No tip' : `₹${tip}`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <Button title={t('rideComplete.submit')} onPress={handleSubmit} loading={submitting} />
        <Text style={styles.thankYou}>{t('rideComplete.thankYou')}</Text>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.xl },
  successIcon: { alignItems: 'center', marginBottom: spacing.base },
  title: { ...typography.h2, color: colors.text, textAlign: 'center', marginBottom: spacing.lg },
  fareCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  fareMain: { alignItems: 'center', marginBottom: spacing.md },
  fareAmount: { fontSize: 44, fontWeight: '800', color: colors.primary },
  paidLabel: { ...typography.small, color: colors.textSecondary, marginTop: spacing.xs },
  fareDetails: { flexDirection: 'row', gap: spacing.xl },
  fareDetail: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  fareDetailText: { ...typography.small, color: colors.textSecondary },
  rateSection: { alignItems: 'center', marginBottom: spacing.lg },
  rateLabel: { ...typography.label, color: colors.textSecondary },
  driverName: { ...typography.bodyBold, color: colors.text, marginTop: spacing.xs },
  stars: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  tipSection: { marginBottom: spacing.xl },
  tipLabel: { ...typography.label, color: colors.textSecondary, marginBottom: spacing.sm },
  tipOptions: { flexDirection: 'row', gap: spacing.sm },
  tipBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
  },
  tipBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tipBtnText: { ...typography.smallBold, color: colors.text },
  tipBtnTextActive: { color: colors.white },
  thankYou: { ...typography.small, color: colors.textLight, textAlign: 'center', marginTop: spacing.lg },
});
