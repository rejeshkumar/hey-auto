import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { ScreenWrapper } from '../../components';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { driverApi, LeaderboardEntry } from '../../services/driver';

export function RewardsScreen({ navigation }: any) {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [redeeming, setRedeeming] = useState(false);

  useEffect(() => {
    Promise.all([
      driverApi.getProfile(),
      driverApi.getLeaderboard(),
      driverApi.getSubscriptionPlans(),
    ]).then(([p, lb, pl]) => {
      setProfile(p.data.data);
      setLeaderboard(lb.data.data ?? []);
      setPlans(pl.data.data ?? []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleRedeem = (plan: any) => {
    const coinsNeeded = Math.ceil(plan.price);
    const balance = profile?.coinsBalance ?? 0;
    if (balance < coinsNeeded) {
      Alert.alert('Not enough coins', `You need ${coinsNeeded} coins for ${plan.name}. You have ${balance}.`);
      return;
    }
    Alert.alert(
      'Redeem Coins',
      `Activate ${plan.name} for ${coinsNeeded} coins?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Redeem', onPress: async () => {
            setRedeeming(true);
            try {
              await driverApi.redeemCoins(plan.id);
              Alert.alert('✅ Activated!', `${plan.name} is now active.`);
              const p = await driverApi.getProfile();
              setProfile(p.data.data);
            } catch (e: any) {
              Alert.alert('Error', e?.response?.data?.error?.message || 'Could not redeem');
            } finally {
              setRedeeming(false);
            }
          }
        },
      ]
    );
  };

  if (loading) {
    return <ScreenWrapper><ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 100 }} /></ScreenWrapper>;
  }

  const coins = profile?.coinsBalance ?? 0;

  return (
    <ScreenWrapper>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Rewards</Text>

        {/* Coin balance card */}
        <View style={styles.coinCard}>
          <Icon name="circle-multiple-outline" size={36} color={colors.primary} />
          <View style={{ marginLeft: spacing.base, flex: 1 }}>
            <Text style={styles.coinBalance}>{coins}</Text>
            <Text style={styles.coinLabel}>Aye Auto Coins</Text>
            <Text style={styles.coinSub}>Earn 1 coin per ₹10 · Redeem for subscriptions</Text>
          </View>
        </View>

        {/* Redeem section */}
        {plans.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Redeem for Subscription</Text>
            {plans.map((plan) => {
              const coinsNeeded = Math.ceil(plan.price);
              const canRedeem = coins >= coinsNeeded;
              return (
                <View key={plan.id} style={styles.planCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.planName}>{plan.name}</Text>
                    <Text style={styles.planCoins}>{coinsNeeded} coins · {plan.durationDays} day{plan.durationDays > 1 ? 's' : ''}</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.redeemBtn, !canRedeem && styles.redeemBtnDisabled]}
                    onPress={() => handleRedeem(plan)}
                    disabled={!canRedeem || redeeming}
                  >
                    <Text style={[styles.redeemBtnText, !canRedeem && { color: colors.textSecondary }]}>
                      {canRedeem ? 'Redeem' : `Need ${coinsNeeded - coins} more`}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </>
        )}

        {/* Leaderboard */}
        {leaderboard.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>City Leaderboard (Last 30 Days)</Text>
            {leaderboard.map((entry) => (
              <View key={entry.rank} style={[styles.leaderRow, entry.isYou && styles.leaderRowYou]}>
                <Text style={[styles.rankText, entry.rank <= 3 && styles.rankTop]}>{entry.rank}</Text>
                <View style={{ flex: 1, marginLeft: spacing.base }}>
                  <Text style={[styles.leaderName, entry.isYou && styles.leaderNameYou]}>
                    {entry.name}{entry.isYou ? ' (You)' : ''}
                  </Text>
                  <Text style={styles.leaderSub}>{entry.rides} rides · ⭐ {entry.rating.toFixed(1)}</Text>
                </View>
                <Text style={styles.leaderCoins}>{entry.coinsEarned} 🪙</Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.h2, color: colors.text, marginTop: spacing.lg, marginBottom: spacing.base },
  coinCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.ink, borderRadius: borderRadius.xl,
    borderTopWidth: 2, borderTopColor: colors.primary, overflow: 'hidden',
    padding: spacing.lg, marginBottom: spacing.lg,
  },
  coinBalance: { fontSize: 42, fontWeight: '900', color: colors.primary },
  coinLabel: { ...typography.body, color: colors.primary, fontWeight: '600' },
  coinSub: { ...typography.caption, color: 'rgba(249,176,27,0.7)', marginTop: 2 },
  sectionTitle: { ...typography.h4, color: colors.text, marginBottom: spacing.sm, marginTop: spacing.base },
  planCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.white, borderRadius: borderRadius.lg,
    padding: spacing.base, marginBottom: spacing.sm, elevation: 1,
    shadowColor: colors.black, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 2,
  },
  planName: { ...typography.body, color: colors.text, fontWeight: '600' },
  planCoins: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  redeemBtn: {
    backgroundColor: colors.primary, borderRadius: borderRadius.lg,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.base,
  },
  redeemBtnDisabled: { backgroundColor: colors.borderLight },
  redeemBtnText: { ...typography.smallBold, color: colors.ink },
  leaderRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.white, borderRadius: borderRadius.lg,
    padding: spacing.base, marginBottom: spacing.sm, elevation: 1,
    shadowColor: colors.black, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 2,
  },
  leaderRowYou: { borderLeftWidth: 3, borderLeftColor: colors.primary },
  rankText: { ...typography.h4, color: colors.textSecondary, width: 28, textAlign: 'center' },
  rankTop: { color: colors.primary, fontWeight: '900' },
  leaderName: { ...typography.body, color: colors.text, fontWeight: '600' },
  leaderNameYou: { color: colors.primary },
  leaderSub: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  leaderCoins: { ...typography.small, color: colors.textSecondary },
});
