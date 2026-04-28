import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, TextInput, Linking,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { ScreenWrapper, Button } from '../../components';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { driverApi } from '../../services/driver';

interface SubscriptionStatus {
  isActive: boolean;
  pendingApproval?: boolean;
  message?: string;
  plan?: {
    name: string;
    pricePerDay: number;
    durationDays: number;
  };
  expiresAt?: string;
  daysRemaining?: number;
}

interface SubscriptionPlan {
  id: string;
  name: string;
  pricePerDay: number;
  durationDays: number;
  totalAmount: number;
  description?: string;
}

const UPI_ID = 'heyauto@upi';
const UPI_NAME = 'Hey Auto';

export function SubscriptionScreen({ navigation }: any) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [step, setStep] = useState<'plans' | 'pay' | 'utr'>('plans');
  const [utr, setUtr] = useState('');
  const [utrError, setUtrError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [statusRes, plansRes] = await Promise.all([
        driverApi.getSubscriptionStatus(),
        driverApi.getSubscriptionPlans(),
      ]);
      setStatus(statusRes.data.data);
      const planList = plansRes.data.data || [];
      setPlans(planList);
      if (planList.length > 0 && !selectedPlan) {
        // default to the middle/recommended plan
        const recommended = planList.find((p: SubscriptionPlan) => p.durationDays === 30) || planList[0];
        setSelectedPlan(recommended);
      }
    } catch {
      setStatus({ isActive: false });
    } finally {
      setLoading(false);
    }
  };

  const handlePayUPI = () => {
    if (!selectedPlan) return;
    const amount = selectedPlan.totalAmount;
    const note = `HeyAuto subscription ${selectedPlan.durationDays}d`;
    const upiUrl = `upi://pay?pa=${UPI_ID}&pn=${encodeURIComponent(UPI_NAME)}&am=${amount}&cu=INR&tn=${encodeURIComponent(note)}`;
    Linking.openURL(upiUrl).catch(() => {
      Alert.alert('UPI App Not Found', 'Please pay manually to UPI ID: ' + UPI_ID + ' and enter the UTR below.');
    });
    setStep('utr');
  };

  const handleSubmitUTR = async () => {
    setUtrError('');
    const trimmed = utr.trim();
    if (!trimmed || trimmed.length < 12 || !/^[A-Za-z0-9]+$/.test(trimmed)) {
      setUtrError('Enter a valid UTR number (12+ alphanumeric characters)');
      return;
    }
    if (!selectedPlan) return;
    setSubmitting(true);
    try {
      await driverApi.verifySubscriptionUTR({
        utrNumber: trimmed,
        planId: selectedPlan.id,
        amount: selectedPlan.totalAmount,
      });
      setStep('plans');
      setUtr('');
      await load();
      Alert.alert(
        'Payment Submitted',
        'Your payment is under review. Subscription will be activated within 2–4 hours after admin verification.',
      );
    } catch (err: any) {
      setUtrError(err?.response?.data?.error?.message || 'Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const daysRemainingColor = (days?: number) => {
    if (!days) return colors.textSecondary;
    if (days <= 3) return colors.error;
    if (days <= 7) return colors.warning;
    return colors.success;
  };

  const formatDate = (iso?: string) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <ScreenWrapper>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => {
          if (step === 'utr') { setStep('pay'); return; }
          if (step === 'pay') { setStep('plans'); return; }
          navigation.goBack();
        }} style={styles.backBtn}>
          <Icon name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Subscription</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xxxl }} />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

          {/* Active subscription status card */}
          {status?.pendingApproval ? (
            <View style={styles.pendingCard}>
              <Icon name="clock-outline" size={32} color={colors.warning} />
              <View style={{ flex: 1 }}>
                <Text style={styles.pendingTitle}>Payment Under Review</Text>
                <Text style={styles.pendingSub}>Admin will verify your UTR and activate subscription within 2–4 hours</Text>
              </View>
            </View>
          ) : status?.isActive ? (
            <View style={styles.activeCard}>
              <View style={styles.activeTop}>
                <View style={styles.activeBadge}>
                  <Icon name="check-circle" size={16} color={colors.success} />
                  <Text style={styles.activeBadgeText}>Active</Text>
                </View>
                <Text style={styles.activePlanName}>{status.plan?.name || 'Subscription'}</Text>
              </View>
              <View style={styles.activeMeta}>
                <View style={styles.activeMetaItem}>
                  <Text style={styles.activeMetaLabel}>Expires</Text>
                  <Text style={styles.activeMetaValue}>{formatDate(status.expiresAt)}</Text>
                </View>
                <View style={styles.activeMetaDivider} />
                <View style={styles.activeMetaItem}>
                  <Text style={styles.activeMetaLabel}>Days Left</Text>
                  <Text style={[styles.activeMetaValue, { color: daysRemainingColor(status.daysRemaining) }]}>
                    {status.daysRemaining ?? '—'}
                  </Text>
                </View>
                <View style={styles.activeMetaDivider} />
                <View style={styles.activeMetaItem}>
                  <Text style={styles.activeMetaLabel}>Rate</Text>
                  <Text style={styles.activeMetaValue}>₹{status.plan?.pricePerDay}/day</Text>
                </View>
              </View>
              {(status.daysRemaining ?? 99) <= 7 && (
                <View style={styles.renewNotice}>
                  <Icon name="clock-alert" size={14} color={colors.warning} />
                  <Text style={styles.renewNoticeText}>
                    {(status.daysRemaining ?? 0) <= 3
                      ? 'Subscription expiring very soon — renew now to stay online'
                      : 'Subscription expiring in 7 days — consider renewing'}
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.inactiveCard}>
              <Icon name="alert-circle" size={32} color={colors.warning} />
              <View style={{ flex: 1 }}>
                <Text style={styles.inactiveTitle}>No Active Subscription</Text>
                <Text style={styles.inactiveSub}>Subscribe to go online and accept rides</Text>
              </View>
            </View>
          )}

          {/* Step: Plan selection */}
          {step === 'plans' && !status?.pendingApproval && (
            <>
              <Text style={styles.sectionLabel}>
                {status?.isActive ? 'RENEW / UPGRADE' : 'CHOOSE A PLAN'}
              </Text>

              {plans.length === 0 ? (
                <View style={styles.fallbackPlans}>
                  {[
                    { id: 'daily', name: '1-Day Pass', pricePerDay: 25, durationDays: 1, totalAmount: 25 },
                    { id: 'weekly', name: '7-Day Pack', pricePerDay: 20, durationDays: 7, totalAmount: 140 },
                    { id: 'monthly', name: '30-Day Pack', pricePerDay: 17, durationDays: 30, totalAmount: 500, description: 'Best Value' },
                  ].map(plan => renderPlanCard(plan, selectedPlan, setSelectedPlan))}
                </View>
              ) : (
                <View style={styles.fallbackPlans}>
                  {plans.map(plan => renderPlanCard(plan, selectedPlan, setSelectedPlan))}
                </View>
              )}

              <Button
                title={`Subscribe — ₹${selectedPlan?.totalAmount ?? '—'}`}
                onPress={() => setStep('pay')}
                disabled={!selectedPlan}
                style={styles.subscribeBtn}
              />

              <View style={styles.howCard}>
                <Text style={styles.howTitle}>How It Works</Text>
                {[
                  { icon: 'numeric-1-circle', text: 'Choose a plan and tap Subscribe' },
                  { icon: 'numeric-2-circle', text: 'Pay via GPay / PhonePe / any UPI app' },
                  { icon: 'numeric-3-circle', text: 'Enter the 12-digit UTR from your payment' },
                  { icon: 'numeric-4-circle', text: 'Admin verifies and activates within 2–4 hours' },
                ].map(item => (
                  <View key={item.icon} style={styles.howRow}>
                    <Icon name={item.icon as any} size={20} color={colors.primary} />
                    <Text style={styles.howText}>{item.text}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* Step: Payment instructions */}
          {step === 'pay' && selectedPlan && (
            <>
              <Text style={styles.sectionLabel}>PAYMENT</Text>
              <View style={styles.payCard}>
                <View style={styles.payRow}>
                  <Text style={styles.payLabel}>Plan</Text>
                  <Text style={styles.payValue}>{selectedPlan.name}</Text>
                </View>
                <View style={styles.payRow}>
                  <Text style={styles.payLabel}>Duration</Text>
                  <Text style={styles.payValue}>{selectedPlan.durationDays} days</Text>
                </View>
                <View style={[styles.payRow, styles.payRowTotal]}>
                  <Text style={styles.payTotalLabel}>Amount to Pay</Text>
                  <Text style={styles.payTotalValue}>₹{selectedPlan.totalAmount}</Text>
                </View>
              </View>

              <View style={styles.upiCard}>
                <Icon name="qrcode" size={40} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.upiLabel}>Pay to UPI ID</Text>
                  <Text style={styles.upiId}>{UPI_ID}</Text>
                  <Text style={styles.upiName}>{UPI_NAME}</Text>
                </View>
              </View>

              <Button
                title="Open UPI App to Pay"
                onPress={handlePayUPI}
                style={styles.upiBtn}
              />

              <TouchableOpacity onPress={() => setStep('utr')} style={styles.manualLink}>
                <Text style={styles.manualLinkText}>Already paid? Enter UTR manually →</Text>
              </TouchableOpacity>

              <View style={styles.upiAppsRow}>
                {['GPay', 'PhonePe', 'Paytm', 'BHIM'].map(app => (
                  <View key={app} style={styles.upiAppChip}>
                    <Text style={styles.upiAppText}>{app}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* Step: UTR entry */}
          {step === 'utr' && (
            <>
              <Text style={styles.sectionLabel}>ENTER PAYMENT REFERENCE</Text>
              <View style={styles.utrCard}>
                <Icon name="bank-check" size={32} color={colors.primary} />
                <Text style={styles.utrTitle}>Enter UTR Number</Text>
                <Text style={styles.utrSub}>
                  Find the 12-digit UTR in your UPI app under transaction details
                </Text>
                <TextInput
                  style={[styles.utrInput, !!utrError && styles.utrInputError]}
                  value={utr}
                  onChangeText={text => { setUtr(text.toUpperCase()); setUtrError(''); }}
                  placeholder="e.g. 407812345678"
                  placeholderTextColor={colors.textLight}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={22}
                  keyboardType="default"
                />
                {!!utrError && (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{utrError}</Text>
                  </View>
                )}
              </View>

              <View style={styles.utrSummary}>
                <Text style={styles.utrSummaryLabel}>Plan: {selectedPlan?.name}</Text>
                <Text style={styles.utrSummaryLabel}>Amount: ₹{selectedPlan?.totalAmount}</Text>
              </View>

              <Button
                title={submitting ? 'Submitting…' : 'Submit for Verification'}
                onPress={handleSubmitUTR}
                disabled={submitting}
                style={styles.subscribeBtn}
              />

              <View style={styles.noteCard}>
                <Icon name="information" size={16} color={colors.info} />
                <Text style={styles.noteText}>
                  Subscription activates within 2–4 hours after admin verifies your payment. You'll receive a notification.
                </Text>
              </View>
            </>
          )}

        </ScrollView>
      )}
    </ScreenWrapper>
  );
}

function renderPlanCard(
  plan: SubscriptionPlan & { description?: string },
  selected: SubscriptionPlan | null,
  onSelect: (p: SubscriptionPlan) => void,
) {
  const isSelected = selected?.id === plan.id;
  const isPopular = plan.durationDays === 30;
  return (
    <TouchableOpacity
      key={plan.id}
      style={[styles.planCard, isSelected && styles.planCardSelected]}
      onPress={() => onSelect(plan)}
    >
      {isPopular && (
        <View style={styles.popularBadge}>
          <Text style={styles.popularBadgeText}>BEST VALUE</Text>
        </View>
      )}
      <View style={styles.planTop}>
        <View style={styles.planRadio}>
          {isSelected && <View style={styles.planRadioDot} />}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.planName}>{plan.name}</Text>
          <Text style={styles.planDuration}>{plan.durationDays} days access</Text>
        </View>
        <View style={styles.planPriceBox}>
          <Text style={styles.planTotal}>₹{plan.totalAmount}</Text>
          <Text style={styles.planPerDay}>₹{plan.pricePerDay}/day</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.base, paddingHorizontal: spacing.base },
  backBtn: { width: 40, height: 40, borderRadius: borderRadius.full, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.h4, color: colors.text },
  content: { padding: spacing.base, paddingBottom: spacing.xxxl },

  activeCard: { backgroundColor: colors.successLight, borderRadius: borderRadius.xl, padding: spacing.lg, marginBottom: spacing.base, borderWidth: 1.5, borderColor: colors.success + '40' },
  activeTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.base },
  activeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.white, borderRadius: borderRadius.full, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  activeBadgeText: { ...typography.captionBold, color: colors.success },
  activePlanName: { ...typography.h4, color: colors.text },
  activeMeta: { flexDirection: 'row', alignItems: 'center' },
  activeMetaItem: { flex: 1, alignItems: 'center' },
  activeMetaLabel: { ...typography.caption, color: colors.textSecondary },
  activeMetaValue: { ...typography.smallBold, color: colors.text, marginTop: 2 },
  activeMetaDivider: { width: 1, height: 32, backgroundColor: colors.success + '30' },
  renewNotice: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.warningLight, borderRadius: borderRadius.md, padding: spacing.sm, marginTop: spacing.base },
  renewNoticeText: { ...typography.caption, color: colors.warning, flex: 1 },

  inactiveCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.base, backgroundColor: colors.warningLight, borderRadius: borderRadius.xl, padding: spacing.base, marginBottom: spacing.base, borderWidth: 1, borderColor: colors.warning + '40' },
  inactiveTitle: { ...typography.smallBold, color: colors.text },
  inactiveSub: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  pendingCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.base, backgroundColor: colors.warningLight, borderRadius: borderRadius.xl, padding: spacing.lg, marginBottom: spacing.base, borderWidth: 1.5, borderColor: colors.warning + '40' },
  pendingTitle: { ...typography.smallBold, color: colors.text },
  pendingSub: { ...typography.caption, color: colors.textSecondary, marginTop: 4, lineHeight: 18 },

  sectionLabel: { ...typography.captionBold, color: colors.textSecondary, letterSpacing: 0.8, marginBottom: spacing.sm, marginTop: spacing.sm },

  fallbackPlans: { gap: spacing.sm, marginBottom: spacing.base },
  planCard: { backgroundColor: colors.card, borderRadius: borderRadius.xl, padding: spacing.base, borderWidth: 2, borderColor: colors.borderLight, elevation: 1, shadowColor: colors.black, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
  planCardSelected: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  popularBadge: { alignSelf: 'flex-end', backgroundColor: colors.primary, borderRadius: borderRadius.sm, paddingHorizontal: spacing.sm, paddingVertical: 2, marginBottom: spacing.xs },
  popularBadgeText: { fontSize: 9, fontWeight: '800', color: colors.white, letterSpacing: 1 },
  planTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.base },
  planRadio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  planRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  planName: { ...typography.smallBold, color: colors.text },
  planDuration: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  planPriceBox: { alignItems: 'flex-end' },
  planTotal: { ...typography.h4, color: colors.text },
  planPerDay: { ...typography.caption, color: colors.textSecondary },

  subscribeBtn: { marginBottom: spacing.base },

  howCard: { backgroundColor: colors.card, borderRadius: borderRadius.xl, padding: spacing.lg, elevation: 1, shadowColor: colors.black, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
  howTitle: { ...typography.smallBold, color: colors.text, marginBottom: spacing.base },
  howRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.sm },
  howText: { ...typography.small, color: colors.textSecondary, flex: 1, lineHeight: 20 },

  payCard: { backgroundColor: colors.card, borderRadius: borderRadius.xl, padding: spacing.lg, marginBottom: spacing.base, elevation: 1, shadowColor: colors.black, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3 },
  payRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  payRowTotal: { borderBottomWidth: 0, marginTop: spacing.sm },
  payLabel: { ...typography.small, color: colors.textSecondary },
  payValue: { ...typography.smallBold, color: colors.text },
  payTotalLabel: { ...typography.body, color: colors.text, fontWeight: '700' },
  payTotalValue: { ...typography.h3, color: colors.primary },

  upiCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.base, backgroundColor: colors.primaryLight, borderRadius: borderRadius.xl, padding: spacing.lg, marginBottom: spacing.base, borderWidth: 1.5, borderColor: colors.primary + '40' },
  upiLabel: { ...typography.caption, color: colors.textSecondary },
  upiId: { ...typography.h4, color: colors.primary },
  upiName: { ...typography.caption, color: colors.textSecondary },

  upiBtn: { marginBottom: spacing.sm },
  manualLink: { alignItems: 'center', marginBottom: spacing.base },
  manualLinkText: { ...typography.small, color: colors.primary },
  upiAppsRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', justifyContent: 'center', marginBottom: spacing.base },
  upiAppChip: { backgroundColor: colors.surface, borderRadius: borderRadius.full, paddingHorizontal: spacing.base, paddingVertical: spacing.xs, borderWidth: 1, borderColor: colors.border },
  upiAppText: { ...typography.caption, color: colors.textSecondary, fontWeight: '600' },

  utrCard: { backgroundColor: colors.card, borderRadius: borderRadius.xl, padding: spacing.xl, alignItems: 'center', marginBottom: spacing.base, elevation: 1, shadowColor: colors.black, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3 },
  utrTitle: { ...typography.h4, color: colors.text, marginTop: spacing.base },
  utrSub: { ...typography.small, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm, marginBottom: spacing.lg, lineHeight: 20 },
  utrInput: { width: '100%', borderWidth: 2, borderColor: colors.primary, borderRadius: borderRadius.lg, padding: spacing.base, fontSize: 18, fontWeight: '700', color: colors.text, textAlign: 'center', letterSpacing: 2, backgroundColor: colors.surface },
  utrInputError: { borderColor: colors.error },
  errorBox: { backgroundColor: colors.errorLight, borderRadius: borderRadius.md, padding: spacing.sm, marginTop: spacing.sm, width: '100%' },
  errorText: { ...typography.small, color: colors.error, textAlign: 'center' },

  utrSummary: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.base, marginBottom: spacing.base },
  utrSummaryLabel: { ...typography.smallBold, color: colors.textSecondary },

  noteCard: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: colors.infoLight, borderRadius: borderRadius.lg, padding: spacing.base, marginTop: spacing.sm },
  noteText: { ...typography.caption, color: colors.info, flex: 1, lineHeight: 18 },
});
