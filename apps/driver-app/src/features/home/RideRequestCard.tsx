import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { useDriverStore, IncomingRideRequest } from '../../hooks/useDriverStore';

const TIMEOUT = 60;

interface Props {
  request: IncomingRideRequest;
  navigation: any;
}

export function RideRequestCard({ request, navigation }: Props) {
  const { t } = useTranslation();
  const { acceptRide, setIncomingRequest, setPhase } = useDriverStore();
  const [countdown, setCountdown] = useState(TIMEOUT);
  const [accepting, setAccepting] = useState(false);
  const progressAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: 0,
      duration: TIMEOUT * 1000,
      useNativeDriver: false,
    }).start();

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) { clearInterval(timer); handleDecline(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleAccept = async () => {
    setAccepting(true);
    try {
      await acceptRide(request.rideId);
      const rootNav = navigation.getParent() ?? navigation;
      rootNav.navigate('ActiveRide');
    } catch {
      setAccepting(false);
    }
  };

  const handleDecline = () => {
    setIncomingRequest(null);
    setPhase('online_idle');
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const isUrgent = countdown <= 15;

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        {/* Progress bar */}
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressBar, { width: progressWidth, backgroundColor: isUrgent ? colors.error : colors.primary }]} />
        </View>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.newRideLabel}>{t('rideRequest.newRequest')}</Text>
            <Text style={styles.riderName}>{request.riderName || 'Rider'}</Text>
          </View>
          <View style={styles.timerBlock}>
            <Text style={[styles.timerNum, isUrgent && { color: colors.error }]}>{countdown}</Text>
            <Text style={styles.timerSec}>sec</Text>
          </View>
        </View>

        {/* Fare — the hero number — ink card */}
        <View style={styles.fareHero}>
          <View>
            <Text style={styles.fareLabel}>Fare</Text>
            <Text style={styles.fareAmount}>₹{Math.round(request.estimatedFare ?? 0)}</Text>
          </View>
          <View style={styles.fareMeta}>
            <View style={styles.fareMetaItem}>
              <Icon name="map-marker-distance" size={14} color={colors.primary} />
              <Text style={styles.fareMetaText}>{((request.estimatedDistanceKm ?? request.distance) ?? 0).toFixed(1)} km</Text>
            </View>
            <View style={styles.fareMetaItem}>
              <Icon name="clock-outline" size={14} color={colors.primary} />
              <Text style={styles.fareMetaText}>{request.estimatedDurationMin ?? '—'} min</Text>
            </View>
            {request.riderRating != null && (
              <View style={styles.fareMetaItem}>
                <Icon name="star" size={14} color={colors.primary} />
                <Text style={styles.fareMetaText}>{request.riderRating.toFixed(1)}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Route */}
        <View style={styles.route}>
          <View style={styles.routeIconCol}>
            <View style={[styles.routeDot, { backgroundColor: colors.secondary }]} />
            <View style={styles.routeLine} />
            <View style={[styles.routeDot, { backgroundColor: colors.error }]} />
          </View>
          <View style={styles.routeAddresses}>
            <View style={styles.routeStop}>
              <Text style={styles.routeStopLabel}>PICKUP</Text>
              <Text style={styles.routeStopAddr} numberOfLines={1}>{request.pickupAddress}</Text>
            </View>
            <View style={styles.routeStop}>
              <Text style={styles.routeStopLabel}>DROP</Text>
              <Text style={styles.routeStopAddr} numberOfLines={1}>{request.dropoffAddress}</Text>
            </View>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.declineBtn} onPress={handleDecline}>
            <Text style={styles.declineText}>{t('rideRequest.decline')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.acceptBtn, accepting && styles.acceptBtnDisabled]}
            onPress={handleAccept}
            disabled={accepting}
          >
            <Icon name={accepting ? 'loading' : 'check-circle'} size={22} color={colors.ink} />
            <Text style={styles.acceptText}>{accepting ? 'Accepting...' : t('rideRequest.accept')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
    zIndex: 999, elevation: 999,
  },
  card: {
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius.xxl,
    borderTopRightRadius: borderRadius.xxl,
    overflow: 'hidden',
    paddingBottom: 36,
  },

  progressTrack: { height: 4, backgroundColor: colors.borderLight },
  progressBar: { height: 4 },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm,
  },
  newRideLabel: { ...typography.captionBold, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8 },
  riderName: { ...typography.h3, color: colors.text, marginTop: 2 },
  timerBlock: { alignItems: 'center' },
  timerNum: { fontSize: 32, fontWeight: '800', color: colors.text, lineHeight: 36 },
  timerSec: { ...typography.caption, color: colors.textSecondary },

  fareHero: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.base,
    backgroundColor: colors.ink, marginHorizontal: spacing.lg, borderRadius: borderRadius.xl,
    borderTopWidth: 2, borderTopColor: colors.primary,
    overflow: 'hidden',
    marginBottom: spacing.base,
  },
  fareLabel: { ...typography.captionBold, color: colors.primary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  fareAmount: { fontSize: 60, fontWeight: '900', color: colors.primary, lineHeight: 68 },
  fareMeta: { gap: 6 },
  fareMetaItem: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(249,176,27,0.10)', borderRadius: borderRadius.sm,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  fareMetaText: { ...typography.small, color: colors.primary, fontWeight: '600' },

  route: {
    flexDirection: 'row', gap: spacing.md,
    paddingHorizontal: spacing.lg, marginBottom: spacing.lg,
  },
  routeIconCol: { alignItems: 'center', paddingTop: 18 },
  routeDot: { width: 10, height: 10, borderRadius: 5 },
  routeLine: { width: 2, flex: 1, backgroundColor: colors.border, marginVertical: 3, minHeight: 20 },
  routeAddresses: { flex: 1, gap: spacing.base },
  routeStop: {
    backgroundColor: colors.surface, borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.base, paddingVertical: spacing.sm,
  },
  routeStopLabel: { ...typography.captionBold, color: colors.textSecondary, letterSpacing: 0.5 },
  routeStopAddr: { ...typography.smallBold, color: colors.text, marginTop: 2 },

  actions: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.lg },
  declineBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: spacing.base, borderRadius: borderRadius.xl,
    borderWidth: 1.5, borderColor: colors.border,
  },
  declineText: { ...typography.button, color: colors.textSecondary },
  acceptBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, paddingVertical: spacing.base,
    borderRadius: borderRadius.xl, backgroundColor: colors.primary,
  },
  acceptBtnDisabled: { opacity: 0.6 },
  acceptText: { ...typography.button, color: colors.ink },
});
