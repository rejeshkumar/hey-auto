import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { Button, ScreenWrapper } from '../../components';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { useRideStore } from '../../hooks/useRideStore';
import { rideApi } from '../../services/ride';

export function RideCompleteScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { currentRide, completedRideData, driverInfo, fareEstimate, resetRide } = useRideStore();
  const [rating, setRating] = useState(5);
  const [tipAmount, setTipAmount] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const fare = completedRideData?.totalAmount || currentRide?.totalAmount || currentRide?.estimatedFare || 0;
  const distance = completedRideData?.actualDistanceKm || currentRide?.estimatedDistanceKm || 0;
  const duration = completedRideData?.actualDurationMin || currentRide?.estimatedDurationMin || 0;

  const nightSurcharge = completedRideData?.nightSurcharge ?? currentRide?.nightSurcharge ?? fareEstimate?.nightSurcharge ?? 0;
  const breakdownBaseFare = fareEstimate?.baseFare ?? (fare - nightSurcharge - tipAmount);
  const breakdownDistanceFare = fareEstimate?.distanceFare;
  const breakdownTimeFare = fareEstimate?.timeFare;

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
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.successIcon}>
          <Icon name="check-circle" size={64} color={colors.success} />
        </View>
        <Text style={styles.title}>{t('rideComplete.title')}</Text>

        <View style={styles.fareCard}>
          <View style={styles.fareMain}>
            <Text style={styles.fareAmount}>₹{Math.round(fare)}</Text>
            <Text style={styles.paidLabel}>{t('rideComplete.paid')} • {completedRideData?.paymentMethod || 'CASH'}</Text>
          </View>

          <View style={styles.tripMeta}>
            <View style={styles.fareDetail}>
              <Icon name="map-marker-distance" size={15} color={colors.textSecondary} />
              <Text style={styles.fareDetailText}>{distance.toFixed(1)} km</Text>
            </View>
            <View style={styles.metaDivider} />
            <View style={styles.fareDetail}>
              <Icon name="clock-outline" size={15} color={colors.textSecondary} />
              <Text style={styles.fareDetailText}>{duration} min</Text>
            </View>
          </View>

          <View style={styles.breakdownDivider} />

          {breakdownDistanceFare != null && (
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Base fare</Text>
              <Text style={styles.breakdownValue}>₹{Math.round(breakdownBaseFare)}</Text>
            </View>
          )}
          {breakdownDistanceFare != null && (
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Distance ({distance.toFixed(1)} km)</Text>
              <Text style={styles.breakdownValue}>₹{Math.round(breakdownDistanceFare)}</Text>
            </View>
          )}
          {breakdownTimeFare != null && (
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Time ({duration} min)</Text>
              <Text style={styles.breakdownValue}>₹{Math.round(breakdownTimeFare)}</Text>
            </View>
          )}
          {nightSurcharge > 0 && (
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>🌙 Night surcharge</Text>
              <Text style={styles.breakdownValue}>₹{Math.round(nightSurcharge)}</Text>
            </View>
          )}
          {tipAmount > 0 && (
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Tip</Text>
              <Text style={styles.breakdownValue}>₹{tipAmount}</Text>
            </View>
          )}
          <View style={[styles.breakdownRow, styles.breakdownTotal]}>
            <Text style={styles.breakdownTotalLabel}>Total</Text>
            <Text style={styles.breakdownTotalValue}>₹{Math.round(fare + tipAmount)}</Text>
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
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: spacing.xl, paddingVertical: spacing.xl },
  successIcon: { alignItems: 'center', marginBottom: spacing.base },
  title: { ...typography.h2, color: colors.text, textAlign: 'center', marginBottom: spacing.lg },
  fareCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  fareMain: { alignItems: 'center', marginBottom: spacing.md },
  fareAmount: { fontSize: 44, fontWeight: '800', color: colors.primary },
  paidLabel: { ...typography.small, color: colors.textSecondary, marginTop: spacing.xs },
  tripMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  metaDivider: { width: 1, height: 14, backgroundColor: colors.border },
  fareDetails: { flexDirection: 'row', gap: spacing.xl },
  fareDetail: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  fareDetailText: { ...typography.small, color: colors.textSecondary },
  breakdownDivider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  breakdownLabel: { ...typography.small, color: colors.textSecondary },
  breakdownValue: { ...typography.small, color: colors.text },
  breakdownTotal: { marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  breakdownTotalLabel: { ...typography.bodyBold, color: colors.text },
  breakdownTotalValue: { ...typography.bodyBold, color: colors.primary },
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
