import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, TextInput, Linking, AppState, AppStateStatus,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { ScreenWrapper, Button } from '../../components';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { driverApi } from '../../services/driver';

interface SubscriptionStatus {
  hasActiveSubscription: boolean;
  cashfreeEnabled?: boolean;
  pendingApproval?: boolean;
  message?: string;
  plan?: string;
  expiresAt?: string;
  hoursLeft?: number;
  amount?: number;
  upiId?: string;
  upiName?: string;
  upiLink?: string;
}

interface SubscriptionPlan {
  id: string;
  name: string;
  nameMl?: string;
  price: number;
  durationDays: number;
  description?: string;
}

export function SubscriptionScreen({ navigation }: any) {
  const { t, i18n } = useTranslation();
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [step, setStep] = useState<'plans' | 'pay' | 'utr'>('plans');
  const [utr, setUtr] = useState('');
  const [utrError, setUtrError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Track when user returns from browser after Cashfree payment
  const [awaitingReturn, setAwaitingReturn] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [statusRes, plansRes] = await Promise.all([
        driverApi.getSubscriptionStatus(),
        driverApi.getSubscriptionPlans(),
      ]);
      const s: SubscriptionStatus = statusRes.data.data;
      setStatus(s);
      const planList: SubscriptionPlan[] = plansRes.data.data || [];
      setPlans(planList);
      if (planList.length > 0 && !selectedPlan) {
        const recommended = planList.find(p => p.durationDays === 1) ?? planList[0];
        setSelectedPlan(recommended);
      }
    } catch {
      setStatus({ hasActiveSubscription: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // When user returns from browser (after Cashfree payment), reload status
  useEffect(() => {
    if (!awaitingReturn) return;
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        setAwaitingReturn(false);
        setStep('plans');
        load();
      }
    });
    return () => sub.remove();
  }, [awaitingReturn, load]);

  // ── Cashfree payment ──────────────────────────
  const handleCashfreePayment = async () => {
    if (!selectedPlan) return;
    setSubmitting(true);
    try {
      const res = await driverApi.createSubscriptionPayment(selectedPlan.id);
      const { paymentUrl } = res.data.data;
      await Linking.openURL(paymentUrl);
      // App goes to background while user pays in browser
      setAwaitingReturn(true);
      Alert.alert(
        'Complete Payment',
        'Complete your payment in the browser. Your subscription will activate automatically once payment is confirmed.',
        [{ text: 'OK' }],
      );
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error?.message ?? 'Could not create payment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Manual UPI payment (fallback) ─────────────
  const handleManualUPI = () => {
    if (!selectedPlan) return;
    const amount = selectedPlan.price;
    const note = `HeyAuto subscription ${selectedPlan.durationDays}d`;
    const upiUrl = `upi://pay?pa=${status?.upiId ?? 'heyauto@ybl'}&pn=${encodeURIComponent(status?.upiName ?? 'Hey Auto')}&am=${amount}&cu=INR&tn=${encodeURIComponent(note)}`;
    Linking.openURL(upiUrl).catch(() => {
      Alert.alert('UPI App Not Found', `Pay manually to UPI ID: ${status?.upiId ?? 'heyauto@ybl'} and enter the UTR below.`);
    });
    setStep('utr');
  };

  // ── UTR submission ────────────────────────────
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
        amount: selectedPlan.price,
      });
      setStep('plans');
      setUtr('');
      await load();
      Alert.alert(
        'Payment Submitted',
        'Your payment is under review. Subscription will activate within 2–4 hours after admin verification.',
      );
    } catch (err: any) {
      setUtrError(err?.response?.data?.error?.message ?? 'Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (iso?: string) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const cashfreeEnabled = status?.cashfreeEnabled ?? false;

  return (
    <ScreenWrapper>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (step === 'utr') { setStep('pay'); return; }
            if (step === 'pay') { setStep('plans'); return; }
            navigation.goBack();
          }}
          style={styles.backBtn}
        >
          <Icon name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Subscription</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xxxl }} />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

          {/* Status card */}
          {status?.pendingApproval ? (
            <View style={styles.pendingCard}>
              <Icon name="clock-outline" size={32} color={colors.warning} />
              <View style={{ flex: 1 }}>
                <Text style={styles.pendingTitle}>
                  {cashfreeEnabled ? 'Payment Pending' : 'Payment Under Review'}
                </Text>
                <Text style={styles.pendingSub}>
                  {cashfreeEnabled
                    ? 'Complete payment in the browser. Subscription activates instantly after payment.'
                    : 'Admin will verify your UTR and activate subscription within 2–4 hours.'}
                </Text>
                {cashfreeEnabled && (
                  <TouchableOpacity onPress={load} style={styles.refreshBtn}>
                    <Icon name="refresh" size={14} color={colors.primary} />
                    <Text style={styles.refreshText}>Check status</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ) : status?.hasActiveSubscription ? (
            /* Active subscription — ink card */
            <View style={styles.activeCard}>
              <View style={styles.activeTop}>
                <View style={styles.activeBadge}>
                  <Icon name="check-circle" size={16} color={colors.primary} />
                  <Text style={styles.activeBadgeText}>Active</Text>
                </View>
                <Text style={styles.activePlanName}>{status.plan ?? 'Subscription'}</Text>
              </View>
              <Text style={styles.activePlanTagline}>You're all set — go online and earn!</Text>
              <View style={styles.activeMeta}>
                <View style={styles.activeMetaItem}>
                  <Text style={styles.activeMetaLabel}>Expires</Text>
                  <Text style={styles.activeMetaValue}>{formatDate(status.expiresAt)}</Text>
                </View>
                <View style={styles.activeMetaDivider} />
                <View style={styles.activeMetaItem}>
                  <Text style={styles.activeMetaLabel}>Hours Left</Text>
                  <Text style={styles.activeMetaValue}>{status.hoursLeft ?? '—'}</Text>
                </View>
              </View>
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

          {/* Plan selection */}
          {step === 'plans' && !status?.pendingApproval && (
            <>
              <Text style={styles.sectionLabel}>
                {status?.hasActiveSubscription ? 'RENEW / UPGRADE' : 'CHOOSE A PLAN'}
              </Text>

              <View style={styles.planList}>
                {(plans.length > 0 ? plans : FALLBACK_PLANS).map(plan => {
                  const isSelected = selectedPlan?.id === plan.id;
                  return (
                    <TouchableOpacity
                      key={plan.id}
                      style={[styles.planCard, isSelected && styles.planCardSelected]}
                      onPress={() => setSelectedPlan(plan)}
                    >
                      {plan.durationDays === 30 && (
                        <View style={styles.popularBadge}>
                          <Text style={styles.popularBadgeText}>BEST VALUE</Text>
                        </View>
                      )}
                      <View style={styles.planRow}>
                        <View style={[styles.planRadio, isSelected && styles.planRadioSelected]}>
                          {isSelected && <View style={styles.planRadioDot} />}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.planName, isSelected && styles.planNameSelected]}>
                            {i18n.language === 'ml' && plan.nameMl ? plan.nameMl : plan.name}
                          </Text>
                          <Text style={[styles.planDuration, isSelected && styles.planDurationSelected]}>
                            {plan.durationDays} day{plan.durationDays > 1 ? 's' : ''} access
                          </Text>
                        </View>
                        <View style={styles.planPriceBox}>
                          <Text style={[styles.planTotal, isSelected && styles.planTotalSelected]}>₹{plan.price}</Text>
                          <Text style={[styles.planPerDay, isSelected && styles.planPerDaySelected]}>
                            ₹{Math.ceil(plan.price / plan.durationDays)}/day
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Button
                title={`Pay ₹${selectedPlan?.price ?? '—'}`}
                onPress={() => setStep('pay')}
                disabled={!selectedPlan}
                style={styles.mainBtn}
              />

              <View style={styles.howCard}>
                <Text style={styles.howTitle}>How It Works</Text>
                {(cashfreeEnabled ? CF_HOW_IT_WORKS : MANUAL_HOW_IT_WORKS).map(item => (
                  <View key={item.icon} style={styles.howRow}>
                    <Icon name={item.icon as any} size={20} color={colors.primary} />
                    <Text style={styles.howText}>{item.text}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* Payment step */}
          {step === 'pay' && selectedPlan && (
            <>
              <Text style={styles.sectionLabel}>PAYMENT</Text>
              <View style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Plan</Text>
                  <Text style={styles.summaryValue}>{selectedPlan.name}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Duration</Text>
                  <Text style={styles.summaryValue}>{selectedPlan.durationDays} day{selectedPlan.durationDays > 1 ? 's' : ''}</Text>
                </View>
                <View style={[styles.summaryRow, { borderBottomWidth: 0 }]}>
                  <Text style={[styles.summaryLabel, { fontWeight: '700', color: colors.text }]}>Amount</Text>
                  <Text style={styles.amountValue}>₹{selectedPlan.price}</Text>
                </View>
              </View>

              {cashfreeEnabled ? (
                <>
                  <View style={styles.cfInfoCard}>
                    <Icon name="shield-check" size={28} color={colors.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cfTitle}>Secure UPI Payment</Text>
                      <Text style={styles.cfSub}>Pay via GPay, PhonePe, Paytm, or any UPI app. Subscription activates instantly.</Text>
                    </View>
                  </View>
                  <Button
                    title={submitting ? 'Opening Payment…' : 'Pay Now via UPI'}
                    onPress={handleCashfreePayment}
                    disabled={submitting}
                    style={styles.mainBtn}
                  />
                  <View style={styles.upiAppsRow}>
                    {['GPay', 'PhonePe', 'Paytm', 'BHIM'].map(app => (
                      <View key={app} style={styles.upiAppChip}>
                        <Text style={styles.upiAppText}>{app}</Text>
                      </View>
                    ))}
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.upiCard}>
                    <Icon name="qrcode" size={40} color={colors.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.upiLabel}>Pay to UPI ID</Text>
                      <Text style={styles.upiId}>{status?.upiId ?? 'heyauto@ybl'}</Text>
                      <Text style={styles.upiName}>{status?.upiName ?? 'Hey Auto'}</Text>
                    </View>
                  </View>
                  <Button
                    title="Open UPI App to Pay"
                    onPress={handleManualUPI}
                    style={styles.mainBtn}
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
            </>
          )}

          {/* UTR entry (manual fallback only) */}
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
                <Text style={styles.utrSummaryLabel}>Amount: ₹{selectedPlan?.price}</Text>
              </View>

              <Button
                title={submitting ? 'Submitting…' : 'Submit for Verification'}
                onPress={handleSubmitUTR}
                disabled={submitting}
                style={styles.mainBtn}
              />

              <View style={styles.noteCard}>
                <Icon name="information" size={16} color={colors.info} />
                <Text style={styles.noteText}>
                  Subscription activates within 2–4 hours after admin verifies your payment.
                </Text>
              </View>
            </>
          )}

        </ScrollView>
      )}
    </ScreenWrapper>
  );
}

const FALLBACK_PLANS: SubscriptionPlan[] = [
  { id: 'daily', name: 'Daily Plan', price: 25, durationDays: 1 },
  { id: 'weekly', name: 'Weekly Plan', price: 150, durationDays: 7 },
  { id: 'monthly', name: 'Monthly Plan', price: 500, durationDays: 30 },
];

const CF_HOW_IT_WORKS = [
  { icon: 'numeric-1-circle', text: 'Choose a plan and tap Pay' },
  { icon: 'numeric-2-circle', text: 'Complete payment in your browser via any UPI app' },
  { icon: 'numeric-3-circle', text: 'Subscription activates instantly after payment' },
];

const MANUAL_HOW_IT_WORKS = [
  { icon: 'numeric-1-circle', text: 'Choose a plan and tap Pay' },
  { icon: 'numeric-2-circle', text: 'Pay via GPay / PhonePe / any UPI app' },
  { icon: 'numeric-3-circle', text: 'Enter the 12-digit UTR from your payment' },
  { icon: 'numeric-4-circle', text: 'Admin verifies and activates within 2–4 hours' },
];

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: spacing.base, paddingHorizontal: spacing.base,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: borderRadius.full,
    backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center',
  },
  title: { ...typography.h4, color: colors.text },
  content: { padding: spacing.base, paddingBottom: spacing.xxxl },

  activeCard: {
    backgroundColor: colors.ink, borderRadius: borderRadius.xl,
    borderTopWidth: 2, borderTopColor: colors.primary,
    overflow: 'hidden',
    padding: spacing.lg, marginBottom: spacing.base,
  },
  activeTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  activeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(249,176,27,0.12)', borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm, paddingVertical: 3,
  },
  activeBadgeText: { ...typography.captionBold, color: colors.primary, fontWeight: '700' },
  activePlanName: { ...typography.h4, color: colors.primary, fontWeight: '600' },
  activePlanTagline: { ...typography.caption, color: colors.primary, fontWeight: '600', marginBottom: spacing.base },
  activeMeta: { flexDirection: 'row', alignItems: 'center' },
  activeMetaItem: { flex: 1, alignItems: 'center' },
  activeMetaLabel: { ...typography.caption, color: colors.primary, fontWeight: '600' },
  activeMetaValue: { ...typography.smallBold, color: colors.primary, fontWeight: '900', marginTop: 2 },
  activeMetaDivider: { width: 1, height: 32, backgroundColor: 'rgba(249,176,27,0.25)' },

  inactiveCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.base,
    backgroundColor: colors.warningLight, borderRadius: borderRadius.xl,
    padding: spacing.base, marginBottom: spacing.base,
    borderWidth: 1, borderColor: colors.warning + '40',
  },
  inactiveTitle: { ...typography.smallBold, color: colors.text },
  inactiveSub: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },

  pendingCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.base,
    backgroundColor: colors.warningLight, borderRadius: borderRadius.xl,
    padding: spacing.lg, marginBottom: spacing.base,
    borderWidth: 1.5, borderColor: colors.warning + '40',
  },
  pendingTitle: { ...typography.smallBold, color: colors.text },
  pendingSub: { ...typography.caption, color: colors.textSecondary, marginTop: 4, lineHeight: 18 },
  refreshBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm },
  refreshText: { ...typography.caption, color: colors.primary, fontWeight: '600' },

  sectionLabel: {
    ...typography.captionBold, color: colors.textSecondary,
    letterSpacing: 0.8, marginBottom: spacing.sm, marginTop: spacing.sm,
  },

  planList: { gap: spacing.sm, marginBottom: spacing.base },
  planCard: {
    backgroundColor: colors.surface, borderRadius: borderRadius.xl,
    padding: spacing.base, borderWidth: 2, borderColor: colors.borderLight,
  },
  planCardSelected: {
    backgroundColor: colors.ink,
    borderTopWidth: 2, borderTopColor: colors.primary,
    borderLeftWidth: 0, borderRightWidth: 0, borderBottomWidth: 0,
    overflow: 'hidden',
  },
  popularBadge: {
    alignSelf: 'flex-end', backgroundColor: colors.primary,
    borderRadius: borderRadius.sm, paddingHorizontal: spacing.sm,
    paddingVertical: 2, marginBottom: spacing.xs,
  },
  popularBadgeText: { fontSize: 9, fontWeight: '800', color: colors.ink, letterSpacing: 1 },
  planRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.base },
  planRadio: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  planRadioSelected: { borderColor: colors.primary },
  planRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  planName: { ...typography.smallBold, color: colors.text },
  planNameSelected: { color: colors.primary, fontWeight: '600' },
  planDuration: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  planDurationSelected: { color: colors.primary, fontWeight: '600' },
  planPriceBox: { alignItems: 'flex-end' },
  planTotal: { ...typography.h4, color: colors.text },
  planTotalSelected: { color: colors.primary, fontWeight: '900' },
  planPerDay: { ...typography.caption, color: colors.textSecondary },
  planPerDaySelected: { color: colors.primary, fontWeight: '600' },

  mainBtn: { marginBottom: spacing.base },

  howCard: {
    backgroundColor: colors.card, borderRadius: borderRadius.xl, padding: spacing.lg,
    marginTop: spacing.sm,
  },
  howTitle: { ...typography.smallBold, color: colors.text, marginBottom: spacing.base },
  howRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.sm },
  howText: { ...typography.small, color: colors.textSecondary, flex: 1, lineHeight: 20 },

  summaryCard: {
    backgroundColor: colors.card, borderRadius: borderRadius.xl,
    padding: spacing.lg, marginBottom: spacing.base,
  },
  summaryRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  summaryLabel: { ...typography.small, color: colors.textSecondary },
  summaryValue: { ...typography.smallBold, color: colors.text },
  amountValue: { ...typography.h3, color: colors.primary },

  cfInfoCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.base,
    backgroundColor: colors.primaryLight, borderRadius: borderRadius.xl,
    padding: spacing.lg, marginBottom: spacing.base,
    borderWidth: 1.5, borderColor: colors.primary + '40',
  },
  cfTitle: { ...typography.smallBold, color: colors.text },
  cfSub: { ...typography.caption, color: colors.textSecondary, marginTop: 4, lineHeight: 18 },

  upiCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.base,
    backgroundColor: colors.primaryLight, borderRadius: borderRadius.xl,
    padding: spacing.lg, marginBottom: spacing.base,
    borderWidth: 1.5, borderColor: colors.primary + '40',
  },
  upiLabel: { ...typography.caption, color: colors.textSecondary },
  upiId: { ...typography.h4, color: colors.primary },
  upiName: { ...typography.caption, color: colors.textSecondary },

  manualLink: { alignItems: 'center', marginBottom: spacing.base },
  manualLinkText: { ...typography.small, color: colors.primary },
  upiAppsRow: {
    flexDirection: 'row', gap: spacing.sm,
    flexWrap: 'wrap', justifyContent: 'center', marginBottom: spacing.base,
  },
  upiAppChip: {
    backgroundColor: colors.surface, borderRadius: borderRadius.full,
    paddingHorizontal: spacing.base, paddingVertical: spacing.xs,
    borderWidth: 1, borderColor: colors.border,
  },
  upiAppText: { ...typography.caption, color: colors.textSecondary, fontWeight: '600' },

  utrCard: {
    backgroundColor: colors.card, borderRadius: borderRadius.xl,
    padding: spacing.xl, alignItems: 'center', marginBottom: spacing.base,
  },
  utrTitle: { ...typography.h4, color: colors.text, marginTop: spacing.base },
  utrSub: {
    ...typography.small, color: colors.textSecondary,
    textAlign: 'center', marginTop: spacing.sm, marginBottom: spacing.lg, lineHeight: 20,
  },
  utrInput: {
    width: '100%', borderWidth: 2, borderColor: colors.primary,
    borderRadius: borderRadius.lg, padding: spacing.base,
    fontSize: 18, fontWeight: '700', color: colors.text,
    textAlign: 'center', letterSpacing: 2, backgroundColor: colors.surface,
  },
  utrInputError: { borderColor: colors.error },
  errorBox: {
    backgroundColor: colors.errorLight, borderRadius: borderRadius.md,
    padding: spacing.sm, marginTop: spacing.sm, width: '100%',
  },
  errorText: { ...typography.small, color: colors.error, textAlign: 'center' },
  utrSummary: {
    flexDirection: 'row', justifyContent: 'space-between',
    backgroundColor: colors.surface, borderRadius: borderRadius.lg,
    padding: spacing.base, marginBottom: spacing.base,
  },
  utrSummaryLabel: { ...typography.smallBold, color: colors.textSecondary },
  noteCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
    backgroundColor: colors.infoLight, borderRadius: borderRadius.lg,
    padding: spacing.base, marginTop: spacing.sm,
  },
  noteText: { ...typography.caption, color: colors.info, flex: 1, lineHeight: 18 },
});
