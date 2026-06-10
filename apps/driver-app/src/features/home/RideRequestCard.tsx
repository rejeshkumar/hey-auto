import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Platform } from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { useDriverStore, IncomingRideRequest } from '../../hooks/useDriverStore';

const TIMEOUT = 60;

interface Props {
  request: IncomingRideRequest;
  navigation: any;
}

export function RideRequestCard({ request, navigation }: Props) {
  const { acceptRide, setIncomingRequest, setPhase } = useDriverStore();
  const [countdown, setCountdown] = useState(TIMEOUT);
  const [accepting, setAccepting] = useState(false);
  const progressAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: 0, duration: TIMEOUT * 1000, useNativeDriver: false,
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
    } catch { setAccepting(false); }
  };

  const handleDecline = () => {
    setIncomingRequest(null);
    setPhase('online_idle');
  };

  const progressWidth = progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const isUrgent = countdown <= 15;
  const isParcel = request.rideType === 'PARCEL';

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>

        {/* Dark hero — rider name is the headline */}
        <View style={styles.hero}>
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressBar, { width: progressWidth, backgroundColor: isUrgent ? colors.error : colors.primary }]} />
          </View>
          <View style={styles.heroContent}>
            <View style={{ flex: 1 }}>
              <View style={styles.badgeRow}>
                <View style={[styles.badge, isParcel && styles.badgeParcel]}>
                  <Text style={styles.badgeText}>{isParcel ? '📦 PARCEL' : 'NEW RIDE'}</Text>
                </View>
                {request.standName && (
                  <View style={styles.queueBadge}>
                    <Text style={styles.queueBadgeText}>🚏 Queue #{request.queuePosition}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.riderName}>{request.riderName || 'Rider'}</Text>
              {request.riderRating != null && (
                <Text style={styles.riderContext}>⭐ {request.riderRating.toFixed(1)} rider</Text>
              )}
              {isParcel && request.recipientName && (
                <Text style={styles.riderContext}>To: {request.recipientName}</Text>
              )}
            </View>
            <View style={styles.timerBlock}>
              <Text style={styles.timerExpires}>Expires in</Text>
              <Text style={[styles.timerNum, isUrgent && { color: colors.error }]}>{countdown}</Text>
              <Text style={styles.timerSec}>sec</Text>
            </View>
          </View>
        </View>

        {/* White body */}
        <View style={styles.body}>
          <View style={styles.fareRow}>
            <Text style={styles.fareLabel}>Fare</Text>
            <Text style={styles.fareAmount}>₹{Math.round(request.estimatedFare ?? 0)}</Text>
          </View>

          <View style={styles.routeCard}>
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

          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{((request.estimatedDistanceKm ?? request.distance) ?? 0).toFixed(1)} km</Text>
              <Text style={styles.statLabel}>Distance</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{request.estimatedDurationMin ?? '—'} min</Text>
              <Text style={styles.statLabel}>Ride time</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{(request.distance ?? 0).toFixed(1)} km</Text>
              <Text style={styles.statLabel}>To pickup</Text>
            </View>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.declineBtn} onPress={handleDecline}>
              <Text style={styles.declineText}>Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.acceptBtn, accepting && styles.acceptBtnDisabled]}
              onPress={handleAccept} disabled={accepting}
            >
              <Icon name={accepting ? 'loading' : 'check-circle'} size={20} color={colors.ink} />
              <Text style={styles.acceptText}>{accepting ? 'Accepting...' : 'Accept Ride'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end', zIndex: 999, elevation: 999,
  },
  card: { borderTopLeftRadius: borderRadius.xxl, borderTopRightRadius: borderRadius.xxl, overflow: 'hidden', backgroundColor: colors.white },
  hero: { backgroundColor: '#0A0A0A', paddingBottom: spacing.lg },
  progressTrack: { height: 3, backgroundColor: 'rgba(255,255,255,0.1)' },
  progressBar: { height: 3 },
  heroContent: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  badgeRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  badge: { borderWidth: 1, borderColor: 'rgba(218,165,32,0.4)', backgroundColor: 'rgba(218,165,32,0.12)', borderRadius: borderRadius.sm, paddingHorizontal: 8, paddingVertical: 3 },
  badgeParcel: { borderColor: 'rgba(59,130,246,0.4)', backgroundColor: 'rgba(59,130,246,0.12)' },
  badgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 1.2, color: colors.primary },
  queueBadge: { borderWidth: 1, borderColor: 'rgba(0,201,107,0.4)', backgroundColor: 'rgba(0,201,107,0.12)', borderRadius: borderRadius.sm, paddingHorizontal: 8, paddingVertical: 3 },
  queueBadgeText: { fontSize: 9, fontWeight: '700', color: colors.secondary },
  riderName: { fontSize: 26, fontWeight: '900', color: colors.white, letterSpacing: -0.5, marginBottom: 4 },
  riderContext: { ...typography.small, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  timerBlock: { alignItems: 'center', minWidth: 56 },
  timerExpires: { fontSize: 8, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 2 },
  timerNum: { fontSize: 36, fontWeight: '900', color: colors.primary, lineHeight: 40 },
  timerSec: { fontSize: 9, color: 'rgba(255,255,255,0.3)', fontWeight: '600' },
  body: { backgroundColor: colors.white, padding: spacing.lg, paddingTop: spacing.base },
  fareRow: { marginBottom: spacing.base },
  fareLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: colors.textSecondary, marginBottom: 2 },
  fareAmount: { fontSize: 40, fontWeight: '900', color: colors.primary, letterSpacing: -1.5, lineHeight: 44 },
  routeCard: { flexDirection: 'row', gap: spacing.md, backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.base, marginBottom: spacing.base },
  routeIconCol: { alignItems: 'center', paddingTop: 14 },
  routeDot: { width: 9, height: 9, borderRadius: 5 },
  routeLine: { width: 2, flex: 1, backgroundColor: colors.border, marginVertical: 3, minHeight: 16 },
  routeAddresses: { flex: 1, gap: spacing.sm },
  routeStop: {},
  routeStopLabel: { fontSize: 8, fontWeight: '700', letterSpacing: 0.8, color: colors.textSecondary, textTransform: 'uppercase' },
  routeStopAddr: { ...typography.smallBold, color: colors.text, marginTop: 1 },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  statBox: { flex: 1, backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.sm, alignItems: 'center' },
  statVal: { fontSize: 15, fontWeight: '800', color: colors.text },
  statLabel: { fontSize: 9, fontWeight: '600', color: colors.textSecondary, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  actions: { flexDirection: 'row', gap: spacing.md, paddingBottom: Platform.OS === 'ios' ? 20 : 8 },
  declineBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.base, borderRadius: borderRadius.xl, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  declineText: { ...typography.button, color: colors.textSecondary },
  acceptBtn: { flex: 2.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.base, borderRadius: borderRadius.xl, backgroundColor: colors.primary, elevation: 4, shadowColor: colors.primary, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.4, shadowRadius: 8 },
  acceptBtnDisabled: { opacity: 0.6 },
  acceptText: { ...typography.button, color: colors.ink },
});
