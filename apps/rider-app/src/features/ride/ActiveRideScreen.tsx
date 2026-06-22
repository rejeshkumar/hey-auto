import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert, Platform, Share } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button, StaticMapView, RiderLiveMapView } from '../../components';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { useRideStore } from '../../hooks/useRideStore';
import { rideApi, RideWithDriver } from '../../services/ride';
import { riderApi } from '../../services/rider';
import { socketService } from '../../services/socket';

export function ActiveRideScreen({ navigation }: any) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const {
    phase, currentRide, driverInfo, driverLocation, rideOtp, pickup, dropoff,
    fareEstimate,
    setPhase, setDriverInfo, setDriverLocation, setRideOtp, setCompletedRideData, resetRide,
  } = useRideStore();
  const [sharing, setSharing] = useState(false);
  const [searchSecs, setSearchSecs] = useState(0);
  const searchStartedAt = React.useRef<number | null>(null);

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
          const MIN_SEARCH_MS = 30_000;
          const elapsed = searchStartedAt.current ? Date.now() - searchStartedAt.current : MIN_SEARCH_MS;
          const remaining = Math.max(0, MIN_SEARCH_MS - elapsed);
          if (remaining > 0) {
            setTimeout(() => setPhase('no_drivers'), remaining);
          } else {
            setPhase('no_drivers');
          }
        }
      } catch {}
    };
    pollRideStatus();
    const interval = setInterval(() => {
      const p = useRideStore.getState().phase;
      if (p !== 'ride_completed' && p !== 'no_drivers') pollRideStatus();
    }, 5000);
    return () => clearInterval(interval);
  }, [currentRide?.id]);

  useEffect(() => {
    if (phase !== 'searching_driver') { setSearchSecs(0); return; }
    setSearchSecs(0);
    searchStartedAt.current = Date.now();
    const t = setInterval(() => setSearchSecs(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

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
    socketService.on('ride:no_drivers', () => {
      const MIN_SEARCH_MS = 30_000;
      const elapsed = searchStartedAt.current ? Date.now() - searchStartedAt.current : MIN_SEARCH_MS;
      const remaining = Math.max(0, MIN_SEARCH_MS - elapsed);
      if (remaining > 0) {
        setTimeout(() => setPhase('no_drivers'), remaining);
      } else {
        setPhase('no_drivers');
      }
    });

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
        message: `Track my Aye Auto ride live 🛺\n${data.data.url}`,
        url: data.data.url,
      });
    } catch {
      Alert.alert('Could not create sharing link. Please try again.');
    } finally {
      setSharing(false);
    }
  };

  const handleOpenMaps = () => {
    if (!dropoff) return;
    // Open Google Maps in navigation/driving mode — shows turn-by-turn to destination
    const nativeUrl = Platform.OS === 'ios'
      ? `comgooglemaps://?daddr=${dropoff.lat},${dropoff.lng}&directionsmode=driving`
      : `google.navigation:q=${dropoff.lat},${dropoff.lng}&mode=d`;
    const webFallback = `https://www.google.com/maps/dir/?api=1&destination=${dropoff.lat},${dropoff.lng}&travelmode=driving`;
    Linking.openURL(nativeUrl).catch(() => Linking.openURL(webFallback));
  };

  // Treat 0,0 as no location (default when server hasn't sent driver GPS yet)
  const validDriverLoc = driverLocation
    || (driverInfo && (driverInfo.driverLat !== 0 || driverInfo.driverLng !== 0)
      ? { lat: driverInfo.driverLat, lng: driverInfo.driverLng }
      : null);

  // Show live map for all phases except searching/no_drivers
  // Falls back to pickup-centered map if driver location not yet received
  const showLiveMap = phase !== 'searching_driver' && phase !== 'no_drivers'
    && (validDriverLoc != null || pickup != null);

  const liveDriverLoc = validDriverLoc;

  const estimatedFare = Math.round(currentRide?.estimatedFare || fareEstimate?.totalFare || 0);

  return (
    <View style={styles.container}>
      {showLiveMap ? (
        <RiderLiveMapView
          driverLat={liveDriverLoc?.lat}
          driverLng={liveDriverLoc?.lng}
          pickupLat={pickup?.lat}
          pickupLng={pickup?.lng}
          dropoffLat={dropoff?.lat}
          dropoffLng={dropoff?.lng}
          showDropoff={phase === 'on_ride'}
          style={styles.map}
        />
      ) : (
        <View style={styles.map} />
      )}

      {/* SOS */}
      <TouchableOpacity style={styles.sosBtn} onPress={handleSOS}>
        <MaterialCommunityIcons name="alert" size={16} color={colors.white} />
        <Text style={styles.sosText}>SOS</Text>
      </TouchableOpacity>

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
            <Text style={styles.searchTimer}>
              {searchSecs < 30
                ? 'Checking nearby drivers...'
                : searchSecs < 90
                ? 'Expanding search area...'
                : 'Almost there, checking more drivers...'}
              {'  '}{Math.floor(searchSecs / 60) > 0 ? `${Math.floor(searchSecs / 60)}m ` : ''}{searchSecs % 60}s
            </Text>
            <Button title={t('ride.cancelRide')} variant="outline" onPress={handleCancel} style={{ marginTop: spacing.base }} />
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

        {/* Driver assigned / arriving — Namma Yatri style */}
        {(phase === 'driver_assigned' || phase === 'driver_arriving') && driverInfo && (
          <>
            <Text style={styles.onYourWayTitle}>Driver is on the way 🛺</Text>

            {/* Driver card */}
            <View style={styles.driverCardNY}>
              <View style={styles.avatarCircle}>
                <Text style={{ fontSize: 28 }}>👤</Text>
              </View>
              <View style={styles.driverMid}>
                <Text style={styles.driverNameNY}>{driverInfo.driverName.toUpperCase()}</Text>
                <Text style={styles.driverTypeLabel}>AUTO RICKSHAW</Text>
                <View style={styles.driverMetaRow}>
                  <MaterialCommunityIcons name="star" size={12} color={colors.rating} />
                  <Text style={styles.ratingNY}>{driverInfo.driverRating.toFixed(1)}</Text>
                  <View style={styles.metaDot} />
                  <MaterialCommunityIcons name="shield-check" size={12} color={colors.secondary} />
                  <Text style={styles.verifiedText}>Verified</Text>
                </View>
              </View>
              <TouchableOpacity onPress={handleCallDriver} style={styles.plateBadgeWrap}>
                <View style={styles.plateBadge}>
                  <Text style={styles.plateText}>{driverInfo.vehicleRegistrationNo}</Text>
                </View>
                <View style={styles.callBadge}>
                  <MaterialCommunityIcons name="phone" size={14} color={colors.secondary} />
                  <Text style={styles.callBadgeText}>Call</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Fare row */}
            {estimatedFare > 0 && (
              <View style={styles.fareEstRow}>
                <View>
                  <Text style={styles.fareEstLabel}>Fare estimate</Text>
                  <Text style={styles.fareEstSub}>Pay via cash</Text>
                </View>
                <Text style={styles.fareEstAmt}>₹{estimatedFare}</Text>
              </View>
            )}

            <Button title={t('ride.cancelRide')} variant="outline" onPress={handleCancel} size="md" style={{ marginTop: spacing.xs }} />
          </>
        )}

        {/* Driver arrived — OTP */}
        {phase === 'driver_arrived' && (
          <>
            <View style={styles.arrivedBanner}>
              <MaterialCommunityIcons name="map-marker-check" size={20} color={colors.secondary} />
              <Text style={styles.arrivedText}>Driver has arrived at your location!</Text>
            </View>
            <View style={styles.otpCard}>
              <Text style={styles.otpLabel}>{t('ride.shareOtp')}</Text>
              <Text style={styles.otpCode}>{rideOtp}</Text>
              <Text style={styles.otpHint}>Tell this number to your driver to start the ride</Text>
            </View>
            {driverInfo && (
              <View style={styles.driverCardCompact}>
                <View style={styles.avatarSmall}>
                  <Text style={{ fontSize: 22 }}>👤</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.driverNameNY}>{driverInfo.driverName}</Text>
                  <Text style={styles.plateTextSmall}>{driverInfo.vehicleRegistrationNo}</Text>
                </View>
                <TouchableOpacity style={styles.callCircle} onPress={handleCallDriver}>
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
              <Text style={styles.onRideText}>You're on your way! 🛺</Text>
              {estimatedFare > 0 && (
                <Text style={styles.onRideFare}>₹{estimatedFare}</Text>
              )}
            </View>

            {pickup && dropoff && (
              <View style={styles.routeSummaryCard}>
                <View style={styles.routeSummaryIconCol}>
                  <View style={[styles.routeSummaryDot, { backgroundColor: colors.secondary }]} />
                  <View style={styles.routeSummaryLine} />
                  <View style={[styles.routeSummaryDot, { backgroundColor: colors.error }]} />
                </View>
                <View style={styles.routeSummaryAddresses}>
                  <View style={styles.routeSummaryStop}>
                    <Text style={styles.routeSummaryLabel}>FROM</Text>
                    <Text style={styles.routeSummaryAddr} numberOfLines={1}>{pickup.address}</Text>
                  </View>
                  <View style={styles.routeSummaryStop}>
                    <Text style={styles.routeSummaryLabel}>TO</Text>
                    <Text style={styles.routeSummaryAddr} numberOfLines={1}>{dropoff.address}</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Open Google Maps in navigation mode */}
            {dropoff && (
              <TouchableOpacity style={styles.mapsRow} onPress={handleOpenMaps} activeOpacity={0.75}>
                <MaterialCommunityIcons name="google-maps" size={22} color="#4285F4" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.mapsRowTitle}>Navigate in Google Maps</Text>
                  <Text style={styles.mapsRowSub} numberOfLines={1}>Directions to {dropoff.address}</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            )}

            {/* Share trip */}
            <TouchableOpacity style={styles.shareRowCard} onPress={handleShareTrip} disabled={sharing} activeOpacity={0.8}>
              <View style={styles.shareRowLeft}>
                <MaterialCommunityIcons name="share-variant-outline" size={20} color={colors.text} />
                <View>
                  <Text style={styles.shareRowTitle}>Share Your Trip</Text>
                  <Text style={styles.shareRowSub}>Send a live tracking link to anyone</Text>
                </View>
              </View>
              <View style={styles.shareBtn}>
                <Text style={styles.shareBtnText}>{sharing ? 'Sharing…' : 'Share'}</Text>
                <MaterialCommunityIcons name="share" size={13} color={colors.ink} />
              </View>
            </TouchableOpacity>

            {driverInfo && (
              <TouchableOpacity style={styles.callRow} onPress={handleCallDriver}>
                <MaterialCommunityIcons name="phone" size={18} color={colors.secondary} />
                <Text style={styles.callRowText}>{t('ride.callDriver')} · {driverInfo.driverName}</Text>
              </TouchableOpacity>
            )}
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
    marginBottom: spacing.lg, borderWidth: 3, borderColor: colors.primary,
  },
  searchingInner: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center',
  },
  phaseTitle: { ...typography.h3, color: colors.text, textAlign: 'center', marginBottom: spacing.xs },
  phaseSub: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  searchTimer: { ...typography.small, color: colors.textLight, textAlign: 'center', marginTop: spacing.sm },

  // Driver assigned — Namma Yatri style
  onYourWayTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.base },

  driverCardNY: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surface, borderRadius: borderRadius.xl,
    padding: spacing.base, marginBottom: spacing.sm,
    borderWidth: 1, borderColor: colors.border,
  },
  avatarCircle: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  driverMid: { flex: 1 },
  driverNameNY: { fontSize: 15, fontWeight: '800', color: colors.text, letterSpacing: 0.3 },
  driverTypeLabel: { fontSize: 11, fontWeight: '600', color: colors.textSecondary, marginTop: 1 },
  driverMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  ratingNY: { ...typography.captionBold, color: colors.text },
  metaDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: colors.border },
  verifiedText: { ...typography.caption, color: colors.secondary, fontWeight: '600' },

  plateBadgeWrap: { alignItems: 'center', gap: 4 },
  plateBadge: {
    backgroundColor: colors.primary, borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm, paddingVertical: 4,
  },
  plateText: { fontSize: 12, fontWeight: '800', color: colors.ink, letterSpacing: 0.5 },
  callBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: colors.secondaryLight, borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm, paddingVertical: 3,
  },
  callBadgeText: { fontSize: 11, fontWeight: '700', color: colors.secondary },

  fareEstRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surface, borderRadius: borderRadius.xl,
    padding: spacing.base, marginBottom: spacing.sm,
    borderWidth: 1, borderColor: colors.border,
  },
  fareEstLabel: { ...typography.bodyBold, color: colors.text },
  fareEstSub: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  fareEstAmt: { fontSize: 26, fontWeight: '800', color: colors.primary },

  mapsRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: '#EEF4FF', borderRadius: borderRadius.xl,
    padding: spacing.base, marginBottom: spacing.sm,
    borderWidth: 1, borderColor: '#C7D9FF',
  },
  mapsRowTitle: { fontSize: 13, fontWeight: '700', color: '#1A56DB' },
  mapsRowSub: { fontSize: 11, color: colors.textSecondary, marginTop: 1 },

  shareRowCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.ink, borderRadius: borderRadius.xl,
    overflow: 'hidden', padding: spacing.base, marginBottom: spacing.sm,
    borderTopWidth: 2, borderTopColor: colors.primary,
  },
  shareRowLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  shareRowTitle: { fontSize: 13, fontWeight: '700', color: colors.primary },
  shareRowSub: { fontSize: 11, color: colors.primary, opacity: 0.6, marginTop: 1 },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.primary, borderRadius: borderRadius.lg,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.base,
  },
  shareBtnText: { fontSize: 12, fontWeight: '800', color: colors.ink },

  // Driver arrived
  arrivedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.ink, borderRadius: borderRadius.xl, overflow: 'hidden',
    padding: spacing.base, marginBottom: spacing.base,
    borderTopWidth: 2, borderTopColor: colors.secondary,
  },
  arrivedText: { ...typography.bodyBold, color: colors.primary, fontWeight: '600' },
  otpCard: {
    backgroundColor: colors.ink, borderRadius: borderRadius.xl, overflow: 'hidden',
    padding: spacing.lg, alignItems: 'center', marginBottom: spacing.base,
    borderTopWidth: 2, borderTopColor: colors.primary,
  },
  otpLabel: { ...typography.smallBold, color: colors.primary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  otpCode: { fontSize: 60, fontWeight: '900', color: colors.primary, letterSpacing: 16, marginTop: spacing.sm },
  otpHint: { ...typography.caption, color: colors.primary, fontWeight: '600', marginTop: spacing.sm, textAlign: 'center' },
  driverCardCompact: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surface, borderRadius: borderRadius.xl,
    padding: spacing.base, borderWidth: 1, borderColor: colors.border,
  },
  avatarSmall: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  plateTextSmall: { ...typography.captionBold, color: colors.primary, marginTop: 2 },
  callCircle: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.secondaryLight, alignItems: 'center', justifyContent: 'center',
  },

  // On ride
  onRideBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.secondary, borderRadius: borderRadius.xl,
    padding: spacing.base, marginBottom: spacing.base,
  },
  onRideText: { ...typography.bodyBold, color: colors.white, flex: 1 },
  onRideFare: { fontSize: 18, fontWeight: '800', color: colors.white },

  routeSummaryCard: {
    flexDirection: 'row', gap: spacing.sm,
    backgroundColor: colors.surface, borderRadius: borderRadius.xl,
    padding: spacing.base, marginBottom: spacing.sm,
    borderWidth: 1, borderColor: colors.border,
  },
  routeSummaryIconCol: { alignItems: 'center', paddingTop: 14 },
  routeSummaryDot: { width: 9, height: 9, borderRadius: 4.5 },
  routeSummaryLine: { width: 2, flex: 1, backgroundColor: colors.border, marginVertical: 3, minHeight: 18 },
  routeSummaryAddresses: { flex: 1, gap: spacing.xs },
  routeSummaryStop: { paddingVertical: spacing.xs },
  routeSummaryLabel: { ...typography.captionBold, color: colors.textSecondary, letterSpacing: 0.5 },
  routeSummaryAddr: { ...typography.smallBold, color: colors.text, marginTop: 1 },

  callRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, paddingVertical: spacing.sm,
  },
  callRowText: { ...typography.smallBold, color: colors.secondary },
});
