import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert, Platform, Share } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button, StaticMapView } from '../../components';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { useRideStore } from '../../hooks/useRideStore';
import { rideApi, RideWithDriver } from '../../services/ride';
import { riderApi } from '../../services/rider';
import { socketService } from '../../services/socket';

const TALIPARAMBA = { lat: 12.9716, lng: 77.5946 };

export function ActiveRideScreen({ navigation }: any) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const {
    phase, currentRide, driverInfo, driverLocation, rideOtp, pickup, dropoff,
    setPhase, setDriverInfo, setDriverLocation, setRideOtp, setCompletedRideData, resetRide,
  } = useRideStore();
  const [sharing, setSharing] = useState(false);

  // Poll ride status on mount — catches the case where socket event fired
  // before this screen mounted (common race when driver accepts quickly)
  useEffect(() => {
    const pollRideStatus = async () => {
      if (!currentRide?.id) return;
      try {
        const { data } = await rideApi.getRideDetails(currentRide.id);
        const ride = data.data;
        if (!ride) return;
        if (ride.status === 'DRIVER_ASSIGNED' && ride.driver && useRideStore.getState().phase === 'searching_driver') {
          setDriverInfo({
            driverId: ride.driverId ?? '',
            driverName: ride.driver.fullName,
            driverPhone: ride.driver.phone,
            driverRating: 5,
            vehicleRegistrationNo: ride.vehicle?.registrationNo ?? '',
            vehicleColor: ride.vehicle?.color,
            vehicleModel: ride.vehicle?.model,
            driverLat: 0,
            driverLng: 0,
          });
          setPhase('driver_assigned');
        } else if (ride.status === 'DRIVER_ARRIVED') {
          if (ride.rideOtp) setRideOtp(ride.rideOtp);
          setPhase('driver_arrived');
        } else if (ride.status === 'IN_PROGRESS' || ride.status === 'OTP_VERIFIED') {
          setPhase('on_ride');
        } else if (ride.status === 'COMPLETED') {
          setCompletedRideData({
            rideId: ride.id,
            actualFare: ride.actualFare,
            totalAmount: ride.totalAmount,
            actualDistanceKm: ride.actualDistanceKm,
            actualDurationMin: ride.actualDurationMin,
            paymentMethod: ride.paymentMethod,
          });
          setPhase('ride_completed');
          navigation.replace('RideComplete');
        } else if (ride.status === 'NO_DRIVERS') {
          setPhase('no_drivers');
        }
      } catch {}
    };
    pollRideStatus();
    // Poll every 5s until ride completes — covers missed socket events
    const interval = setInterval(() => {
      const p = useRideStore.getState().phase;
      if (p !== 'ride_completed' && p !== 'no_drivers') {
        pollRideStatus();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [currentRide?.id]);

  useEffect(() => {
    socketService.on('ride:driver_assigned', (data: any) => {
      setDriverInfo({
        driverId: data.driverId, driverName: data.driverName, driverPhone: data.driverPhone,
        driverRating: data.driverRating, vehicleRegistrationNo: data.vehicleRegistrationNo,
        vehicleColor: data.vehicleColor, vehicleModel: data.vehicleModel,
        driverLat: data.driverLat, driverLng: data.driverLng,
      });
      setPhase('driver_assigned');
    });
    socketService.on('ride:driver_location', (data: any) => setDriverLocation({ lat: data.lat, lng: data.lng }));
    socketService.on('ride:driver_arrived', (data: any) => { setRideOtp(data.rideOtp); setPhase('driver_arrived'); });
    socketService.on('ride:started', () => setPhase('on_ride'));
    socketService.on('ride:completed', (data: any) => {
      setCompletedRideData(data); setPhase('ride_completed'); navigation.replace('RideComplete');
    });
    socketService.on('ride:cancelled', (data: any) => {
      Alert.alert(t('ride.cancelRide'), data.reason || '');
      resetRide();
      navigation.replace('MainTabs');
    });
    socketService.on('ride:no_drivers', () => setPhase('no_drivers'));

    return () => {
      ['ride:driver_assigned', 'ride:driver_location', 'ride:driver_arrived', 'ride:started',
        'ride:completed', 'ride:cancelled', 'ride:no_drivers'].forEach(e => socketService.off(e));
    };
  }, []);

  const handleRetryRide = async () => {
    if (!pickup || !dropoff) { navigation.replace('MainTabs'); return; }
    setPhase('reviewing_estimate');
    navigation.replace('BookingConfirm');
  };

  const handleCancel = async () => {
    // Check if a cancellation charge applies before confirming
    let chargeMsg = '';
    if (currentRide) {
      try {
        const preview = await rideApi.getCancelPreview(currentRide.id);
        const p = preview.data.data;
        if (p?.chargeApplies && p.amount > 0) {
          chargeMsg = `\n\n₹${p.amount} cancellation fee applies (driver has been waiting ${Math.round(p.waitedMin)} min).`;
        }
      } catch {}
    }
    Alert.alert(t('ride.cancelConfirm'), chargeMsg || '', [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.confirm'), style: 'destructive', onPress: async () => {
          try { if (currentRide) await rideApi.cancelRide(currentRide.id); } catch {}
          resetRide();
          navigation.replace('MainTabs');
        }
      },
    ]);
  };

  const handleCallDriver = () => {
    if (driverInfo?.driverPhone) Linking.openURL(`tel:${driverInfo.driverPhone}`);
  };

  const handleSOS = () => {
    Alert.alert('🚨 ' + t('safety.sosActivated'), t('safety.sosSub'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: 'Call 112 & Alert Contacts', style: 'destructive',
        onPress: () => { riderApi.triggerSOS(currentRide?.id).catch(() => {}); Linking.openURL('tel:112'); },
      },
    ]);
  };

  const handleShareTrip = async () => {
    if (!currentRide) return;
    setSharing(true);
    try {
      const { data } = await rideApi.createShareToken(currentRide.id);
      await Share.share({
        message: `Track my Hey Auto ride live 🛺\n${data.data.url}`,
        url: data.data.url,
      });
    } catch {
      Alert.alert('Could not create sharing link. Please try again.');
    } finally {
      setSharing(false);
    }
  };

  // Map: center on driver if known, else pickup, else default
  const liveDriverLoc = driverLocation
    || (driverInfo ? { lat: driverInfo.driverLat, lng: driverInfo.driverLng } : null);

  const mapCenter = liveDriverLoc || pickup || TALIPARAMBA;

  const mapMarkers = useMemo(() => {
    const m: { lat: number; lng: number; color: string; label?: string }[] = [];
    if (liveDriverLoc) m.push({ lat: liveDriverLoc.lat, lng: liveDriverLoc.lng, color: '0xF5C800', label: 'D' });
    if (pickup) m.push({ lat: pickup.lat, lng: pickup.lng, color: '0x00C853', label: 'P' });
    if (dropoff && phase === 'on_ride') m.push({ lat: dropoff.lat, lng: dropoff.lng, color: '0xFF3B30', label: 'X' });
    return m;
  }, [liveDriverLoc, pickup, dropoff, phase]);

  const showMap = phase !== 'searching_driver' && phase !== 'no_drivers';

  return (
    <View style={styles.container}>
      {showMap ? (
        <StaticMapView
          center={{ lat: mapCenter.lat, lng: mapCenter.lng }}
          markers={mapMarkers}
          style={styles.map}
        />
      ) : (
        <View style={styles.map} />
      )}

      {/* SOS button */}
      <TouchableOpacity style={styles.sosBtn} onPress={handleSOS}>
        <MaterialCommunityIcons name="alert" size={16} color={colors.white} />
        <Text style={styles.sosText}>SOS</Text>
      </TouchableOpacity>

      {/* Share trip button — visible once driver is assigned */}
      {(phase === 'driver_assigned' || phase === 'driver_arriving' || phase === 'driver_arrived' || phase === 'on_ride') && (
        <TouchableOpacity style={styles.shareBtn} onPress={handleShareTrip} disabled={sharing}>
          <MaterialCommunityIcons name="share-variant" size={16} color={colors.primary} />
          <Text style={styles.shareText}>{sharing ? 'Sharing…' : 'Share trip'}</Text>
        </TouchableOpacity>
      )}

      <View style={[styles.bottomSheet, { paddingBottom: Math.max(insets.bottom + 16, spacing.xl) }]}>
        {/* Searching */}
        {phase === 'searching_driver' && (
          <View style={styles.center}>
            <View style={styles.searchingRing}>
              <View style={styles.searchingInner}>
                <Text style={{ fontSize: 36 }}>🛺</Text>
              </View>
            </View>
            <Text style={styles.phaseTitle}>{t('ride.searchingDriver')}</Text>
            <Text style={styles.phaseSub}>{t('ride.searchingSub')}</Text>
            <Button title={t('ride.cancelRide')} variant="outline" onPress={handleCancel} style={{ marginTop: spacing.lg }} />
          </View>
        )}

        {/* No drivers */}
        {phase === 'no_drivers' && (
          <View style={styles.center}>
            <MaterialCommunityIcons name="emoticon-sad-outline" size={56} color={colors.textLight} />
            <Text style={styles.phaseTitle}>{t('ride.noDrivers')}</Text>
            <Text style={styles.phaseSub}>{t('ride.noDriversSub')}</Text>
            <Button title={t('common.retry')} onPress={handleRetryRide} style={{ marginTop: spacing.lg }} />
            <Button title={t('common.cancel')} variant="outline" onPress={() => { resetRide(); navigation.replace('MainTabs'); }} style={{ marginTop: spacing.sm }} />
          </View>
        )}

        {/* Driver assigned / arriving */}
        {(phase === 'driver_assigned' || phase === 'driver_arriving') && driverInfo && (
          <>
            <Text style={styles.statusBadge}>🛺 {t('ride.driverOnWay')}</Text>
            <View style={styles.driverCard}>
              <View style={styles.driverAvatar}>
                <Text style={{ fontSize: 26 }}>👤</Text>
              </View>
              <View style={styles.driverDetails}>
                <Text style={styles.driverName}>{driverInfo.driverName}</Text>
                <View style={styles.vehicleRow}>
                  <Text style={styles.vehicleNo}>{driverInfo.vehicleRegistrationNo}</Text>
                  {driverInfo.vehicleColor && <Text style={styles.vehicleColor}> · {driverInfo.vehicleColor}</Text>}
                </View>
                {driverInfo.driverRating != null && (
                  <View style={styles.ratingRow}>
                    <MaterialCommunityIcons name="star" size={13} color={colors.rating} />
                    <Text style={styles.ratingText}>{driverInfo.driverRating.toFixed(1)}</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity style={styles.callBtn} onPress={handleCallDriver}>
                <MaterialCommunityIcons name="phone" size={20} color={colors.secondary} />
              </TouchableOpacity>
            </View>
            <Button title={t('ride.cancelRide')} variant="outline" onPress={handleCancel} size="md" />
          </>
        )}

        {/* Driver arrived — OTP */}
        {phase === 'driver_arrived' && (
          <>
            <View style={styles.arrivedBanner}>
              <MaterialCommunityIcons name="map-marker-check" size={20} color={colors.secondary} />
              <Text style={styles.arrivedText}>{t('ride.driverArrived')}</Text>
            </View>
            <View style={styles.otpCard}>
              <Text style={styles.otpLabel}>{t('ride.shareOtp')}</Text>
              <Text style={styles.otpCode}>{rideOtp}</Text>
              <Text style={styles.otpHint}>Share this with your Sarathi to start the ride</Text>
            </View>
            {driverInfo && (
              <View style={styles.driverCard}>
                <View style={styles.driverAvatar}>
                  <Text style={{ fontSize: 26 }}>👤</Text>
                </View>
                <View style={styles.driverDetails}>
                  <Text style={styles.driverName}>{driverInfo.driverName}</Text>
                  <Text style={styles.vehicleNo}>{driverInfo.vehicleRegistrationNo}</Text>
                </View>
                <TouchableOpacity style={styles.callBtn} onPress={handleCallDriver}>
                  <MaterialCommunityIcons name="phone" size={20} color={colors.secondary} />
                </TouchableOpacity>
              </View>
            )}
          </>
        )}

        {/* On ride */}
        {phase === 'on_ride' && (
          <>
            <View style={styles.onRideBanner}>
              <MaterialCommunityIcons name="car-connected" size={18} color={colors.white} />
              <Text style={styles.onRideText}>{t('ride.rideStarted')}</Text>
            </View>
            {dropoff && (
              <View style={styles.destCard}>
                <MaterialCommunityIcons name="map-marker" size={20} color={colors.error} />
                <Text style={styles.destText} numberOfLines={2}>{dropoff.address}</Text>
              </View>
            )}
            <TouchableOpacity style={styles.callRow} onPress={handleCallDriver}>
              <MaterialCommunityIcons name="phone" size={18} color={colors.secondary} />
              <Text style={styles.callRowText}>{t('ride.callDriver')}</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  map: { flex: 1, backgroundColor: '#EAF3EA' },

  sosBtn: {
    position: 'absolute', top: Platform.OS === 'ios' ? 56 : 40, right: spacing.base,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.error, paddingVertical: 8, paddingHorizontal: spacing.base,
    borderRadius: borderRadius.full, elevation: 6,
  },
  sosText: { ...typography.captionBold, color: colors.white, letterSpacing: 1 },
  shareBtn: {
    position: 'absolute', top: Platform.OS === 'ios' ? 56 : 40, left: spacing.base,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.white, paddingVertical: 8, paddingHorizontal: spacing.base,
    borderRadius: borderRadius.full, elevation: 6,
    borderWidth: 1.5, borderColor: colors.primary,
  },
  shareText: { ...typography.captionBold, color: colors.primary },

  bottomSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius.xxl, borderTopRightRadius: borderRadius.xxl,
    padding: spacing.lg,
    elevation: 12, shadowColor: colors.black,
    shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 16,
  },

  center: { alignItems: 'center', paddingVertical: spacing.lg },
  searchingRing: {
    width: 110, height: 110, borderRadius: 55,
    backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.lg,
    borderWidth: 3, borderColor: colors.primary,
  },
  searchingInner: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center',
  },
  phaseTitle: { ...typography.h3, color: colors.text, textAlign: 'center', marginBottom: spacing.xs },
  phaseSub: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },

  statusBadge: { ...typography.smallBold, color: colors.secondary, marginBottom: spacing.base },

  driverCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: borderRadius.xl,
    padding: spacing.base, marginVertical: spacing.base,
    borderWidth: 1, borderColor: colors.border,
  },
  driverAvatar: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  driverDetails: { flex: 1 },
  driverName: { ...typography.bodyBold, color: colors.text },
  vehicleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  vehicleNo: { ...typography.smallBold, color: colors.primary },
  vehicleColor: { ...typography.caption, color: colors.textSecondary },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  ratingText: { ...typography.caption, color: colors.text },
  callBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: colors.secondaryLight, alignItems: 'center', justifyContent: 'center',
  },

  arrivedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.ink, borderRadius: borderRadius.xl,
    overflow: 'hidden',
    padding: spacing.base, marginBottom: spacing.base,
    borderTopWidth: 2, borderTopColor: colors.secondary,
  },
  arrivedText: { ...typography.bodyBold, color: colors.primary, fontWeight: '600' },

  otpCard: {
    backgroundColor: colors.ink, borderRadius: borderRadius.xl,
    overflow: 'hidden',
    padding: spacing.lg, alignItems: 'center', marginBottom: spacing.base,
    borderTopWidth: 2, borderTopColor: colors.primary,
  },
  otpLabel: { ...typography.smallBold, color: colors.primary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  otpCode: { fontSize: 60, fontWeight: '900', color: colors.primary, letterSpacing: 16, marginTop: spacing.sm },
  otpHint: { ...typography.caption, color: colors.primary, fontWeight: '600', marginTop: spacing.sm, textAlign: 'center' },

  onRideBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.secondary, borderRadius: borderRadius.xl,
    padding: spacing.base, marginBottom: spacing.base,
  },
  onRideText: { ...typography.bodyBold, color: colors.white },

  destCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
    backgroundColor: colors.surface, borderRadius: borderRadius.xl,
    padding: spacing.base, marginBottom: spacing.base,
    borderWidth: 1, borderColor: colors.border,
  },
  destText: { ...typography.body, color: colors.text, flex: 1 },

  callRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, paddingVertical: spacing.sm,
  },
  callRowText: { ...typography.smallBold, color: colors.secondary },
});
