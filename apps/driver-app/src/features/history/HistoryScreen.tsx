import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ScreenWrapper } from '../../components';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { driverApi, RideHistoryItem } from '../../services/driver';

export function HistoryScreen() {
  const { t } = useTranslation();
  const [rides, setRides] = useState<RideHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => { loadRides(); }, []);

  const loadRides = async (pageNum = 1) => {
    try {
      const { data } = await driverApi.getRideHistory(pageNum);
      if (pageNum === 1) setRides(data.data);
      else setRides((prev) => [...prev, ...data.data]);
      setHasMore(data.hasMore);
      setPage(pageNum);
    } catch (err) {
      console.error('Load rides error:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  const getStatusColor = (status: string) =>
    status === 'COMPLETED' ? colors.success : status.includes('CANCELLED') ? colors.error : colors.warning;

  const renderRide = ({ item }: { item: RideHistoryItem }) => (
    <View style={styles.rideCard}>
      <View style={styles.rideHeader}>
        <Text style={styles.rideDate}>{formatDate(item.requestedAt)} • {formatTime(item.requestedAt)}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {item.status === 'COMPLETED' ? t('history.completed') : t('history.cancelled')}
          </Text>
        </View>
      </View>

      <View style={styles.routeRow}>
        <View style={styles.routeDots}>
          <View style={[styles.routeDot, { backgroundColor: colors.secondary }]} />
          <View style={styles.routeLine} />
          <View style={[styles.routeDot, { backgroundColor: colors.error }]} />
        </View>
        <View style={styles.routeAddresses}>
          <Text style={styles.routeAddr} numberOfLines={1}>{item.pickupAddress}</Text>
          <Text style={styles.routeAddr} numberOfLines={1}>{item.dropoffAddress}</Text>
        </View>
      </View>

      <View style={styles.rideFooter}>
        <Text style={styles.rideAmount}>₹{Math.round(item.totalAmount || item.estimatedFare)}</Text>
        {item.tipAmount > 0 && <Text style={styles.tipText}>+₹{item.tipAmount} tip</Text>}
        {item.rider && <Text style={styles.riderLabel}>{item.rider.fullName}</Text>}
      </View>
    </View>
  );

  return (
    <ScreenWrapper>
      <Text style={styles.screenTitle}>{t('history.title')}</Text>
      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 100 }} />
      ) : (
        <FlatList
          data={rides}
          keyExtractor={(item) => item.id}
          renderItem={renderRide}
          contentContainerStyle={styles.list}
          onEndReached={() => { if (hasMore) loadRides(page + 1); }}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Icon name="car-off" size={60} color={colors.textLight} />
              <Text style={styles.emptyText}>{t('history.noRides')}</Text>
            </View>
          }
        />
      )}
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  screenTitle: { ...typography.h2, color: colors.text, marginTop: spacing.lg, marginBottom: spacing.base },
  list: { paddingBottom: spacing.xxl },
  rideCard: {
    backgroundColor: colors.white, borderRadius: borderRadius.lg, padding: spacing.base, marginBottom: spacing.md,
    elevation: 1, shadowColor: colors.black, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3,
  },
  rideHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  rideDate: { ...typography.caption, color: colors.textSecondary },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: borderRadius.sm },
  statusText: { ...typography.captionBold },
  routeRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  routeDots: { alignItems: 'center', paddingTop: 2 },
  routeDot: { width: 8, height: 8, borderRadius: 4 },
  routeLine: { width: 2, height: 16, backgroundColor: colors.border, marginVertical: 2 },
  routeAddresses: { flex: 1, gap: spacing.sm },
  routeAddr: { ...typography.small, color: colors.text },
  rideFooter: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    borderTopWidth: 1, borderTopColor: colors.borderLight, paddingTop: spacing.sm,
  },
  rideAmount: { ...typography.h4, color: colors.primary },
  tipText: { ...typography.captionBold, color: colors.earnings },
  riderLabel: { ...typography.small, color: colors.textSecondary, marginLeft: 'auto' },
  empty: { alignItems: 'center', marginTop: 100, gap: spacing.base },
  emptyText: { ...typography.body, color: colors.textLight },
});
