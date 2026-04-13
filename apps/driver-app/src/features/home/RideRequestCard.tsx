import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { useDriverStore, IncomingRideRequest } from '../../hooks/useDriverStore';

interface Props {
  request: IncomingRideRequest;
  navigation: any;
}

export function RideRequestCard({ request, navigation }: Props) {
  const { t } = useTranslation();
  const { acceptRide, setIncomingRequest, setPhase } = useDriverStore();
  const [countdown, setCountdown] = useState(30);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleDecline();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleAccept = async () => {
    setAccepting(true);
    try {
      await acceptRide(request.rideId);
      navigation.navigate('ActiveRide');
    } catch (err) {
      console.error('Accept error:', err);
      setAccepting(false);
    }
  };

  const handleDecline = () => {
    setIncomingRequest(null);
    setPhase('online_idle');
  };

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('rideRequest.newRequest')}</Text>
          <View style={styles.timer}>
            <Text style={styles.timerText}>{countdown}s</Text>
          </View>
        </View>

        <View style={styles.fareRow}>
          <Text style={styles.fareAmount}>₹{Math.round(request.estimatedFare)}</Text>
          <View style={styles.fareDetails}>
            <Text style={styles.fareDetail}>{request.estimatedDistanceKm.toFixed(1)} km</Text>
            <Text style={styles.fareDetail}>{request.estimatedDurationMin} min</Text>
          </View>
        </View>

        <View style={styles.routeSection}>
          <View style={styles.routeRow}>
            <View style={styles.routeDots}>
              <View style={[styles.dot, { backgroundColor: colors.secondary }]} />
              <View style={styles.routeLine} />
              <View style={[styles.dot, { backgroundColor: colors.error }]} />
            </View>
            <View style={styles.routeAddresses}>
              <View>
                <Text style={styles.routeLabel}>{t('rideRequest.pickup')}</Text>
                <Text style={styles.routeAddr} numberOfLines={1}>{request.pickupAddress}</Text>
              </View>
              <View>
                <Text style={styles.routeLabel}>{t('rideRequest.dropoff')}</Text>
                <Text style={styles.routeAddr} numberOfLines={1}>{request.dropoffAddress}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.riderRow}>
          <View style={styles.riderInfo}>
            <Text style={styles.riderName}>{request.riderName}</Text>
            <View style={styles.ratingRow}>
              <Icon name="star" size={14} color={colors.rating} />
              <Text style={styles.ratingText}>{request.riderRating.toFixed(1)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.declineBtn} onPress={handleDecline}>
            <Text style={styles.declineText}>{t('rideRequest.decline')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.acceptBtn, accepting && { opacity: 0.6 }]}
            onPress={handleAccept}
            disabled={accepting}
          >
            <Icon name="check" size={22} color={colors.white} />
            <Text style={styles.acceptText}>{t('rideRequest.accept')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.4)', paddingTop: 100,
    flex: 1, justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: colors.white, borderTopLeftRadius: borderRadius.xxl, borderTopRightRadius: borderRadius.xxl,
    padding: spacing.lg, paddingBottom: spacing.xxxl,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.base },
  title: { ...typography.h3, color: colors.text },
  timer: { backgroundColor: colors.primaryLight, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.full },
  timerText: { ...typography.bodyBold, color: colors.primary },
  fareRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
  fareAmount: { fontSize: 36, fontWeight: '800', color: colors.primary },
  fareDetails: { alignItems: 'flex-end' },
  fareDetail: { ...typography.small, color: colors.textSecondary },
  routeSection: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.base, marginBottom: spacing.base },
  routeRow: { flexDirection: 'row', gap: spacing.md },
  routeDots: { alignItems: 'center', paddingTop: 4 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  routeLine: { width: 2, height: 24, backgroundColor: colors.border, marginVertical: 2 },
  routeAddresses: { flex: 1, gap: spacing.md },
  routeLabel: { ...typography.captionBold, color: colors.textSecondary },
  routeAddr: { ...typography.body, color: colors.text },
  riderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
  riderInfo: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  riderName: { ...typography.bodyBold, color: colors.text },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { ...typography.small, color: colors.text },
  actions: { flexDirection: 'row', gap: spacing.md },
  declineBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: spacing.base, borderRadius: borderRadius.lg,
    borderWidth: 1.5, borderColor: colors.border,
  },
  declineText: { ...typography.button, color: colors.textSecondary },
  acceptBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    paddingVertical: spacing.base, borderRadius: borderRadius.lg, backgroundColor: colors.secondary,
  },
  acceptText: { ...typography.button, color: colors.white },
});
