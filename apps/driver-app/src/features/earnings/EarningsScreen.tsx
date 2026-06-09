import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { ScreenWrapper } from '../../components';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { useDriverStore } from '../../hooks/useDriverStore';
import { driverApi, DailyEarning } from '../../services/driver';

type Period = 'today' | 'thisWeek' | 'thisMonth';

export function EarningsScreen() {
  const { t } = useTranslation();
  const { earnings, loadEarnings } = useDriverStore();
  const [period, setPeriod] = useState<Period>('today');
  const [loading, setLoading] = useState(true);
  const [dailyEarnings, setDailyEarnings] = useState<DailyEarning[]>([]);

  useEffect(() => {
    loadEarnings().finally(() => setLoading(false));
    driverApi.getDailyEarnings(7).then((r) => setDailyEarnings(r.data.data ?? [])).catch(() => {});
  }, []);

  const getAmount = () => {
    if (!earnings) return 0;
    switch (period) {
      case 'today': return earnings.today;
      case 'thisWeek': return earnings.thisWeek;
      case 'thisMonth': return earnings.thisMonth;
    }
  };

  const getRides = () => {
    if (!earnings) return 0;
    switch (period) {
      case 'today': return earnings.totalRidesToday;
      case 'thisWeek': return earnings.totalRidesWeek;
      case 'thisMonth': return earnings.totalRidesMonth;
    }
  };

  if (loading) {
    return (
      <ScreenWrapper>
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 100 }} />
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Platform.OS === 'ios' ? 32 : 80 }}>
        <Text style={styles.screenTitle}>{t('earnings.title')}</Text>

        <View style={styles.periodTabs}>
          {(['today', 'thisWeek', 'thisMonth'] as Period[]).map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.tab, period === p && styles.tabActive]}
              onPress={() => setPeriod(p)}
            >
              <Text style={[styles.tabText, period === p && styles.tabTextActive]}>
                {t(`earnings.${p}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.mainCard}>
          <Text style={styles.amountLabel}>{t(`earnings.${period}`)}</Text>
          <Text style={styles.amount}>₹{getAmount()}</Text>
          <View style={styles.mainStats}>
            <View style={styles.mainStat}>
              <Icon name="car" size={20} color={colors.primary} />
              <Text style={styles.mainStatValue}>{getRides()}</Text>
              <Text style={styles.mainStatLabel}>{t('earnings.totalRides')}</Text>
            </View>
            <View style={styles.mainStatDivider} />
            <View style={styles.mainStat}>
              <Icon name="chart-line" size={20} color={colors.secondary} />
              <Text style={styles.mainStatValue}>₹{earnings?.averagePerRide || 0}</Text>
              <Text style={styles.mainStatLabel}>{t('earnings.averagePerRide')}</Text>
            </View>
            <View style={styles.mainStatDivider} />
            <View style={styles.mainStat}>
              <Icon name="hand-heart" size={20} color={colors.rating} />
              <Text style={styles.mainStatValue}>₹{earnings?.tipsToday || 0}</Text>
              <Text style={styles.mainStatLabel}>{t('earnings.tips')}</Text>
            </View>
          </View>
        </View>

        {dailyEarnings.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Last 7 Days</Text>
            {dailyEarnings.map((day) => {
              const d = new Date(day.date);
              const label = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
              return (
                <View key={day.date} style={styles.dayCard}>
                  <View style={styles.dayLeft}>
                    <Text style={styles.dayLabel}>{label}</Text>
                    <Text style={styles.dayRides}>{day.rides} ride{day.rides !== 1 ? 's' : ''}</Text>
                  </View>
                  <View style={styles.dayRight}>
                    <Text style={styles.dayAmount}>₹{Math.round(day.totalEarnings)}</Text>
                    {day.tips > 0 && <Text style={styles.dayTips}>+₹{Math.round(day.tips)} tips</Text>}
                  </View>
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  screenTitle: { ...typography.h2, color: colors.text, marginTop: spacing.base, marginBottom: spacing.base },
  periodTabs: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  tab: {
    flex: 1, paddingVertical: spacing.md, borderRadius: borderRadius.lg,
    borderWidth: 1.5, borderColor: colors.border, alignItems: 'center',
  },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { ...typography.smallBold, color: colors.text },
  tabTextActive: { color: colors.white },
  mainCard: {
    backgroundColor: colors.white, borderRadius: borderRadius.xl, padding: spacing.xl,
    alignItems: 'center', elevation: 2,
    shadowColor: colors.black, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4,
  },
  amountLabel: { ...typography.small, color: colors.textSecondary },
  amount: { ...typography.bigNumber, color: colors.earnings, marginVertical: spacing.sm },
  mainStats: { flexDirection: 'row', marginTop: spacing.lg, gap: spacing.base },
  mainStat: { flex: 1, alignItems: 'center', gap: spacing.xs },
  mainStatValue: { ...typography.h4, color: colors.text },
  mainStatLabel: { ...typography.caption, color: colors.textSecondary, textAlign: 'center' },
  mainStatDivider: { width: 1, backgroundColor: colors.border },
  sectionTitle: { ...typography.h4, color: colors.text, marginTop: spacing.xl, marginBottom: spacing.base },
  dayCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.white, borderRadius: borderRadius.lg, padding: spacing.base,
    marginBottom: spacing.sm, elevation: 1,
    shadowColor: colors.black, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2,
    borderLeftWidth: 3, borderLeftColor: colors.primary,
  },
  dayLeft: { flex: 1 },
  dayLabel: { ...typography.body, color: colors.text, fontWeight: '600' },
  dayRides: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  dayRight: { alignItems: 'flex-end' },
  dayAmount: { ...typography.h4, color: colors.earnings, fontWeight: '700' },
  dayTips: { ...typography.caption, color: colors.secondary },
});
