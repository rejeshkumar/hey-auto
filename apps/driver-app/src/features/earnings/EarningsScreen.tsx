import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ScreenWrapper } from '../../components';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { useDriverStore } from '../../hooks/useDriverStore';

type Period = 'today' | 'thisWeek' | 'thisMonth';

export function EarningsScreen() {
  const { t } = useTranslation();
  const { earnings, loadEarnings } = useDriverStore();
  const [period, setPeriod] = useState<Period>('today');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEarnings().finally(() => setLoading(false));
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
      <ScrollView showsVerticalScrollIndicator={false}>
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
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  screenTitle: { ...typography.h2, color: colors.text, marginTop: spacing.lg, marginBottom: spacing.base },
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
});
