import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert, TextInput, Platform, ScrollView } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { useTranslation } from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Button } from '../../components';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { useDriverStore } from '../../hooks/useDriverStore';
import { useLocationStore } from '../../hooks/useLocationStore';
import { driverApi } from '../../services/driver';
import { socketService } from '../../services/socket';
import { mapsApi, RouteStep } from '../../services/maps';
import { decodePolyline } from '../../utils/polyline';

export function ActiveRideScreen({ navigation }: any) {
  const { t } = useTranslation();
  const {
    phase, currentRideId, incomingRequest, riderLocation,
    setPhase, setRiderLocation, resetRide, loadEarnings,
  } = useDriverStore();
  const { currentLat, currentLng } = useLocationStore();
  const [otpInput, setOtpInput] = useState('');
  const [otpError, setOtpError] = useState('');
  const [loading, setLoading] = useState(false);
  const [completedFare, setCompletedFare] = useState<number | null>(null);
  const [routeCoords, setRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);
  const [turnByTurn, setTurnByTurn] = useState<RouteStep[]>([]);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);

  const pickup = incomingRequest ? { lat: incomingRequest.pickupLat, lng: incomingRequest.pickupLng, address: incomingRequest.pickupAddress } : null;
  const dropoff = incomingRequest ? { lat: incomingRequest.dropoffLat, lng: incomingRequest.dropoffLng, address: incomingRequest.dropoffAddress } : null;

  useEffect(() => {
    if (pickup && currentLat && currentLng) {
      fetchRoute({ lat: currentLat, lng: currentLng }, pickup);
    }
  }, [pickup, currentLat, currentLng]);

  const fetchRoute = async (origin: { lat: number; lng: number }, dest: { lat: number; lng: number }) => {
    try {
      const { data } = await mapsApi.getRoute(origin.lat, origin.lng, dest.lat, dest.lng);
      if (data.success) {
        setRouteCoords(decodePolyline(data.data.polyline));
        setTurnByTurn(data.data.steps);
        setCurrentStepIdx(0);
      }
    } catch {}
  };

  useEffect(() => {
    socketService.on('ride:rider_location', (data: any) => {
      setRiderLocation({ lat: data.lat, lng: data.lng });
    });

    socketService.on('ride:cancelled_by_rider', (data: any) => {
      Alert.alert(t('ride.cancelRide'), data.reason || 'Rider cancelled');
      resetRide();
      navigation.replace('MainTabs');
    });

    return () => {
      socketService.off('ride:rider_location');
      socketService.off('ride:cancelled_by_rider');
    };
  }, []);

  const handleMarkArrived = async () => {
    if (!currentRideId) return;
    setLoading(true);
    try {
      await driverApi.arrivedAtPickup(currentRideId);
      setPhase('arrived_at_pickup');
    } catch (err) {
      console.error('Mark arrived error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartRide = async () => {
    if (!currentRideId || otpInput.length < 4) return;
    setOtpError('');
    setLoading(true);
    try {
      await driverApi.startRide(currentRideId, otpInput);
      setPhase('on_trip');
      if (dropoff && currentLat && currentLng) {
        fetchRoute({ lat: currentLat, lng: currentLng }, dropoff);
      }
    } catch (err: any) {
      setOtpError(t('ride.invalidOtp'));
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteRide = async () => {
    if (!currentRideId) return;
    setLoading(true);
    try {
      const { data } = await driverApi.completeRide(currentRideId);
      setCompletedFare(data.data?.totalAmount || incomingRequest?.estimatedFare || 0);
      setPhase('trip_completed');
      loadEarnings();
    } catch (err) {
      console.error('Complete ride error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDone = () => {
    resetRide();
    navigation.replace('MainTabs');
  };

  const handleCallRider = () => {
    // In production, get rider phone from ride details
    Alert.alert(t('ride.callRider'), 'Opening phone dialer');
  };

  const handleNavigate = () => {
    if (!pickup) return;
    const url = Platform.OS === 'ios'
      ? `maps://app?daddr=${pickup.lat},${pickup.lng}`
      : `google.navigation:q=${pickup.lat},${pickup.lng}`;
    Linking.openURL(url).catch(() => {
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${pickup.lat},${pickup.lng}`);
    });
  };

  const mapCenter = {
    latitude: currentLat || 12.0368,
    longitude: currentLng || 75.3614,
    latitudeDelta: 0.015,
    longitudeDelta: 0.015,
  };

  return (
    <View style={styles.container}>
      <MapView style={styles.map} provider={PROVIDER_GOOGLE} region={mapCenter} showsUserLocation>
        {pickup && <Marker coordinate={{ latitude: pickup.lat, longitude: pickup.lng }} pinColor={colors.map.pickup} title={t('rideRequest.pickup')} />}
        {dropoff && <Marker coordinate={{ latitude: dropoff.lat, longitude: dropoff.lng }} pinColor={colors.map.dropoff} title={t('rideRequest.dropoff')} />}
        {routeCoords.length > 0 && (
          <Polyline coordinates={routeCoords} strokeColor={colors.map.route} strokeWidth={4} />
        )}
      </MapView>

      {/* Turn-by-turn banner */}
      {turnByTurn.length > 0 && currentStepIdx < turnByTurn.length && phase !== 'trip_completed' && (
        <View style={styles.navBanner}>
          <View style={styles.navIcon}>
            <Icon name={getManeuverIcon(turnByTurn[currentStepIdx].maneuver)} size={22} color={colors.white} />
          </View>
          <View style={styles.navInfo}>
            <Text style={styles.navInstruction} numberOfLines={2}>{turnByTurn[currentStepIdx].instruction}</Text>
            <Text style={styles.navDistance}>{(turnByTurn[currentStepIdx].distanceKm * 1000).toFixed(0)}m</Text>
          </View>
        </View>
      )}

      <View style={styles.bottomSheet}>
        {/* HEADING TO PICKUP */}
        {phase === 'heading_to_pickup' && (
          <>
            <Text style={styles.phaseTitle}>{t('ride.headingToPickup')}</Text>
            {pickup && <Text style={styles.addressText}>{pickup.address}</Text>}

            {incomingRequest && (
              <View style={styles.riderCard}>
                <View style={styles.riderAvatar}><Text style={{ fontSize: 24 }}>👤</Text></View>
                <View style={styles.riderInfo}>
                  <Text style={styles.riderName}>{incomingRequest.riderName}</Text>
                  <View style={styles.ratingRow}>
                    <Icon name="star" size={14} color={colors.rating} />
                    <Text style={styles.ratingText}>{incomingRequest.riderRating.toFixed(1)}</Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.actionIcon} onPress={handleCallRider}>
                  <Icon name="phone" size={22} color={colors.secondary} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionIcon} onPress={handleNavigate}>
                  <Icon name="navigation-variant" size={22} color={colors.info} />
                </TouchableOpacity>
              </View>
            )}

            <Button title={t('ride.markArrived')} onPress={handleMarkArrived} loading={loading} />
          </>
        )}

        {/* ARRIVED AT PICKUP */}
        {phase === 'arrived_at_pickup' && (
          <>
            <Text style={styles.phaseTitle}>{t('ride.arrivedAtPickup')}</Text>
            <Text style={styles.phaseSubtitle}>{t('ride.enterOtp')}</Text>

            <View style={styles.otpSection}>
              <TextInput
                style={[styles.otpInput, otpError && styles.otpInputError]}
                placeholder="● ● ● ●"
                placeholderTextColor={colors.textLight}
                value={otpInput}
                onChangeText={(v) => { setOtpInput(v.replace(/[^0-9]/g, '').slice(0, 4)); setOtpError(''); }}
                keyboardType="number-pad"
                maxLength={4}
                textAlign="center"
              />
              {otpError ? <Text style={styles.otpError}>{otpError}</Text> : null}
            </View>

            <Button title={t('ride.startRide')} onPress={handleStartRide} loading={loading} disabled={otpInput.length < 4} />
          </>
        )}

        {/* ON TRIP */}
        {phase === 'on_trip' && (
          <>
            <Text style={styles.phaseTitle}>{t('ride.onTrip')}</Text>
            {dropoff && (
              <View style={styles.destCard}>
                <Icon name="map-marker" size={20} color={colors.error} />
                <Text style={styles.destText} numberOfLines={1}>{dropoff.address}</Text>
              </View>
            )}
            {incomingRequest && (
              <View style={styles.farePreview}>
                <Text style={styles.fareLabel}>{t('rideRequest.estimatedFare')}</Text>
                <Text style={styles.fareAmount}>₹{Math.round(incomingRequest.estimatedFare)}</Text>
              </View>
            )}
            <Button title={t('ride.completeRide')} variant="secondary" onPress={handleCompleteRide} loading={loading} />
          </>
        )}

        {/* TRIP COMPLETED */}
        {phase === 'trip_completed' && (
          <View style={styles.completedSection}>
            <Icon name="check-circle" size={56} color={colors.success} />
            <Text style={styles.completedTitle}>{t('ride.rideCompleted')}</Text>
            <Text style={styles.completedFare}>₹{Math.round(completedFare || 0)}</Text>
            <Text style={styles.completedLabel}>{t('ride.fareCollected')}</Text>
            <Button title={t('common.done')} onPress={handleDone} style={{ marginTop: spacing.xl }} />
          </View>
        )}
      </View>
    </View>
  );
}

function getManeuverIcon(maneuver?: string): string {
  if (!maneuver) return 'arrow-up';
  if (maneuver.includes('left')) return 'arrow-left';
  if (maneuver.includes('right')) return 'arrow-right';
  if (maneuver.includes('uturn')) return 'arrow-u-down-left';
  if (maneuver.includes('roundabout')) return 'rotate-right';
  if (maneuver.includes('merge')) return 'call-merge';
  return 'arrow-up';
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  bottomSheet: {
    backgroundColor: colors.white, borderTopLeftRadius: borderRadius.xxl, borderTopRightRadius: borderRadius.xxl,
    padding: spacing.lg, paddingBottom: spacing.xxxl,
  },
  phaseTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.xs },
  phaseSubtitle: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.base },
  addressText: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.base },
  riderCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
    borderRadius: borderRadius.lg, padding: spacing.base, marginBottom: spacing.lg, gap: spacing.md,
  },
  riderAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.secondaryLight, alignItems: 'center', justifyContent: 'center' },
  riderInfo: { flex: 1 },
  riderName: { ...typography.bodyBold, color: colors.text },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  ratingText: { ...typography.caption, color: colors.text },
  actionIcon: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.white,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border,
  },
  otpSection: { marginBottom: spacing.lg },
  otpInput: {
    borderWidth: 2, borderColor: colors.border, borderRadius: borderRadius.lg,
    paddingVertical: spacing.base, fontSize: 28, fontWeight: '800', color: colors.text,
    letterSpacing: 16, backgroundColor: colors.surface,
  },
  otpInputError: { borderColor: colors.error },
  otpError: { ...typography.small, color: colors.error, textAlign: 'center', marginTop: spacing.sm },
  destCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.base, marginBottom: spacing.base,
  },
  destText: { ...typography.body, color: colors.text, flex: 1 },
  farePreview: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: spacing.lg, paddingVertical: spacing.sm,
  },
  fareLabel: { ...typography.body, color: colors.textSecondary },
  fareAmount: { ...typography.h3, color: colors.primary },
  completedSection: { alignItems: 'center', paddingVertical: spacing.lg },
  completedTitle: { ...typography.h2, color: colors.text, marginTop: spacing.base },
  completedFare: { fontSize: 48, fontWeight: '800', color: colors.earnings, marginTop: spacing.sm },
  completedLabel: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs },
  navBanner: {
    position: 'absolute', top: Platform.OS === 'ios' ? 55 : 35,
    left: spacing.base, right: spacing.base,
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.primary, borderRadius: borderRadius.xl, padding: spacing.base,
    elevation: 6, shadowColor: colors.black, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 8,
  },
  navIcon: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  navInfo: { flex: 1 },
  navInstruction: { ...typography.smallBold, color: colors.white },
  navDistance: { ...typography.caption, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
});
