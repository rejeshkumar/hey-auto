import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { Button, ScreenWrapper } from '../../components';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { useRideStore } from '../../hooks/useRideStore';
import { rideApi } from '../../services/ride';

const DRIVER_CHIPS = [
  { key: 'polite',    label: 'Polite driver' },
  { key: 'expert',   label: 'Expert driving' },
  { key: 'ontime',   label: 'On time' },
  { key: 'nav',      label: 'Skilled navigator' },
  { key: 'safe',     label: 'Safe ride' },
];
const OTHER_CHIPS = [
  { key: 'vehicle',  label: 'Clean vehicle' },
  { key: 'fare',     label: 'Right fare' },
];

export function RideCompleteScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { currentRide, completedRideData, driverInfo, fareEstimate, resetRide } = useRideStore();
  const [rating, setRating] = useState(5);
  const [selectedChips, setSelectedChips] = useState<string[]>([]);
  const [tipAmount, setTipAmount] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const fare = completedRideData?.totalAmount || currentRide?.totalAmount || currentRide?.estimatedFare || 0;
  const distance = completedRideData?.actualDistanceKm || currentRide?.estimatedDistanceKm || 0;
  const duration = completedRideData?.actualDurationMin || currentRide?.estimatedDurationMin || 0;
  const nightSurcharge = completedRideData?.nightSurcharge ?? currentRide?.nightSurcharge ?? fareEstimate?.nightSurcharge ?? 0;
  const breakdownBaseFare = fareEstimate?.baseFare ?? (fare - nightSurcharge - tipAmount);
  const breakdownDistanceFare = fareEstimate?.distanceFare;
  const breakdownTimeFare = fareEstimate?.timeFare;

  const toggleChip = (key: string) => {
    setSelectedChips(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const handleSubmit = async () => {
    if (!currentRide) return;
    setSubmitting(true);
    const reviewParts = selectedChips.map(k =>
      [...DRIVER_CHIPS, ...OTHER_CHIPS].find(c => c.key === k)?.label ?? k
    );
    const review = reviewParts.join(', ') || undefined;
    try {
      await rideApi.rateRide(currentRide.id, rating, review, tipAmount || undefined);
    } catch {}
    finally {
      resetRide();
      navigation.replace('MainTabs');
    }
  };

  const tipOptions = [0, 10, 20, 50];

  return (
    <ScreenWrapper>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Driver section — prominent, like Namma Yatri */}
        {driverInfo && (
          <View style={styles.driverSection}>
            <View style={styles.avatarWrap}>
              <Text style={{ fontSize: 40 }}>👤</Text>
            </View>
            <Text style={styles.driverName}>{driverInfo.driverName}</Text>
            <Text style={styles.driverType}>AUTO RICKSHAW</Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity key={star} onPress={() => setRating(star)} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
                  <Icon
                    name={star <= rating ? 'star' : 'star-outline'}
                    size={44}
                    color={star <= rating ? colors.rating : colors.border}
                  />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Fare card */}
        <View style={styles.fareCard}>
          <View style={styles.fareHeader}>
            <View>
              <Text style={styles.fareAmount}>₹{Math.round(fare + tipAmount)}</Text>
              <Text style={styles.paidLabel}>{completedRideData?.paymentMethod || 'CASH'}</Text>
            </View>
            <View style={styles.fareStats}>
              <View style={styles.statItem}>
                <Icon name="map-marker-distance" size={14} color={colors.textSecondary} />
                <Text style={styles.statText}>{distance.toFixed(1)} km</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Icon name="clock-outline" size={14} color={colors.textSecondary} />
                <Text style={styles.statText}>{duration} min</Text>
              </View>
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
          {breakdownTimeFare != null && breakdownTimeFare > 0 && (
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

        {/* Feedback chips */}
        <View style={styles.chipsSection}>
          <Text style={styles.chipsGroupLabel}>Driver feedback</Text>
          <View style={styles.chipsRow}>
            {DRIVER_CHIPS.map(chip => (
              <TouchableOpacity
                key={chip.key}
                style={[styles.chip, selectedChips.includes(chip.key) && styles.chipActive]}
                onPress={() => toggleChip(chip.key)}
                activeOpacity={0.75}
              >
                <Text style={[styles.chipText, selectedChips.includes(chip.key) && styles.chipTextActive]}>
                  {chip.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.chipsGroupLabel, { marginTop: spacing.base }]}>Other</Text>
          <View style={styles.chipsRow}>
            {OTHER_CHIPS.map(chip => (
              <TouchableOpacity
                key={chip.key}
                style={[styles.chip, selectedChips.includes(chip.key) && styles.chipActive]}
                onPress={() => toggleChip(chip.key)}
                activeOpacity={0.75}
              >
                <Text style={[styles.chipText, selectedChips.includes(chip.key) && styles.chipTextActive]}>
                  {chip.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Tip section */}
        <View style={styles.tipSection}>
          <Text style={styles.tipLabel}>Thank your driver</Text>
          <View style={styles.tipOptions}>
            {tipOptions.map((tip) => (
              <TouchableOpacity
                key={tip}
                style={[styles.tipBtn, tipAmount === tip && styles.tipBtnActive]}
                onPress={() => setTipAmount(tip)}
              >
                <Text style={[styles.tipBtnText, tipAmount === tip && styles.tipBtnTextActive]}>
                  {tip === 0 ? 'Skip' : `₹${tip}`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={submitting} activeOpacity={0.85}>
          <Text style={styles.submitText}>{submitting ? 'Submitting…' : 'Submit Feedback'}</Text>
        </TouchableOpacity>

        <Text style={styles.thankYou}>Thanks for riding with Aye Auto 🛺</Text>
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xl },

  // Driver section
  driverSection: { alignItems: 'center', paddingVertical: spacing.lg },
  avatarWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  driverName: { fontSize: 18, fontWeight: '800', color: colors.text, letterSpacing: 0.3 },
  driverType: { fontSize: 11, fontWeight: '600', color: colors.textSecondary, marginTop: 2, letterSpacing: 0.5 },
  starsRow: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.md },

  // Fare card
  fareCard: {
    backgroundColor: colors.surface, borderRadius: borderRadius.xl,
    padding: spacing.lg, marginBottom: spacing.lg,
    borderWidth: 1, borderColor: colors.border,
  },
  fareHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: spacing.sm },
  fareAmount: { fontSize: 40, fontWeight: '800', color: colors.primary },
  paidLabel: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  fareStats: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingTop: spacing.sm },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { ...typography.small, color: colors.textSecondary },
  statDivider: { width: 1, height: 12, backgroundColor: colors.border },
  breakdownDivider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.sm },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  breakdownLabel: { ...typography.small, color: colors.textSecondary },
  breakdownValue: { ...typography.small, color: colors.text },
  breakdownTotal: { marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  breakdownTotalLabel: { ...typography.bodyBold, color: colors.text },
  breakdownTotalValue: { ...typography.bodyBold, color: colors.primary },

  // Chips
  chipsSection: { marginBottom: spacing.lg },
  chipsGroupLabel: { ...typography.caption, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: spacing.sm, fontWeight: '600' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingVertical: 8, paddingHorizontal: spacing.base,
    borderRadius: borderRadius.full, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.white,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.smallBold, color: colors.text },
  chipTextActive: { color: colors.ink },

  // Tip
  tipSection: { marginBottom: spacing.xl },
  tipLabel: { ...typography.label, color: colors.textSecondary, marginBottom: spacing.sm },
  tipOptions: { flexDirection: 'row', gap: spacing.sm },
  tipBtn: {
    flex: 1, paddingVertical: spacing.md, borderRadius: borderRadius.lg,
    borderWidth: 1.5, borderColor: colors.border, alignItems: 'center',
  },
  tipBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tipBtnText: { ...typography.smallBold, color: colors.text },
  tipBtnTextActive: { color: colors.ink },

  submitBtn: {
    backgroundColor: colors.ink, borderRadius: borderRadius.xl,
    paddingVertical: spacing.lg, alignItems: 'center',
    borderTopWidth: 2, borderTopColor: colors.primary,
    overflow: 'hidden',
  },
  submitText: { fontSize: 16, fontWeight: '800', color: colors.primary },

  thankYou: { ...typography.small, color: colors.textLight, textAlign: 'center', marginTop: spacing.lg },
});
