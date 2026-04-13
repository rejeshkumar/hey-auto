import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useTranslation } from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Button } from '../../components';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { useRideStore, RidePhase } from '../../hooks/useRideStore';
import { rideApi } from '../../services/ride';
import { socketService } from '../../services/socket';

export function ActiveRideScreen({ navigation }: any) {
  const { t } = useTranslation();
  const {
    phase, currentRide, driverInfo, driverLocation, rideOtp, pickup, dropoff,
    setPhase, setDriverInfo, setDriverLocation, setRideOtp, setCompletedRideData, resetRide,
  } = useRideStore();

  useEffect(() => {
    socketService.on('ride:driver_assigned', (data: any) => {
      setDriverInfo({
        driverId: data.driverId,
        driverName: data.driverName,
        driverPhone: data.driverPhone,
        driverRating: data.driverRating,
        vehicleRegistrationNo: data.vehicleRegistrationNo,
        vehicleColor: data.vehicleColor,
        vehicleModel: data.vehicleModel,
        driverLat: data.driverLat,
        driverLng: data.driverLng,
      });
      setPhase('driver_assigned');
    });

    socketService.on('ride:driver_location', (data: any) => {
      setDriverLocation({ lat: data.lat, lng: data.lng });
    });

    socketService.on('ride:driver_arrived', (data: any) => {
      setRideOtp(data.rideOtp);
      setPhase('driver_arrived');
    });

    socketService.on('ride:started', () => setPhase('on_ride'));

    socketService.on('ride:completed', (data: any) => {
      setCompletedRideData(data);
      setPhase('ride_completed');
      navigation.replace('RideComplete');
    });

    socketService.on('ride:cancelled', (data: any) => {
      Alert.alert(t('ride.cancelRide'), data.reason || '');
      resetRide();
      navigation.replace('MainTabs');
    });

    socketService.on('ride:no_drivers', () => setPhase('no_drivers'));

    return () => {
      socketService.off('ride:driver_assigned');
      socketService.off('ride:driver_location');
      socketService.off('ride:driver_arrived');
      socketService.off('ride:started');
      socketService.off('ride:completed');
      socketService.off('ride:cancelled');
      socketService.off('ride:no_drivers');
    };
  }, []);

  const handleCancel = () => {
    Alert.alert(t('ride.cancelConfirm'), '', [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.confirm'),
        style: 'destructive',
        onPress: async () => {
          if (currentRide) {
            await rideApi.cancelRide(currentRide.id);
          }
          resetRide();
          navigation.replace('MainTabs');
        },
      },
    ]);
  };

  const handleCallDriver = () => {
    if (driverInfo?.driverPhone) {
      Linking.openURL(`tel:${driverInfo.driverPhone}`);
    }
  };

  const handleSOS = () => {
    Alert.alert(t('safety.sosActivated'), t('safety.sosSub'));
    Linking.openURL('tel:112');
  };

  const mapCenter = driverLocation || (pickup ? { lat: pickup.lat, lng: pickup.lng } : { lat: 12.0368, lng: 75.3614 });

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        region={{
          latitude: mapCenter.lat,
          longitude: mapCenter.lng,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        showsUserLocation
      >
        {pickup && <Marker coordinate={{ latitude: pickup.lat, longitude: pickup.lng }} pinColor={colors.map.pickup} />}
        {dropoff && <Marker coordinate={{ latitude: dropoff.lat, longitude: dropoff.lng }} pinColor={colors.map.dropoff} />}
        {driverLocation && (
          <Marker coordinate={{ latitude: driverLocation.lat, longitude: driverLocation.lng }}>
            <View style={styles.autoMarker}><Text style={styles.autoEmoji}>🛺</Text></View>
          </Marker>
        )}
      </MapView>

      {/* SOS Button */}
      <TouchableOpacity style={styles.sosBtn} onPress={handleSOS}>
        <Text style={styles.sosText}>{t('ride.sos')}</Text>
      </TouchableOpacity>

      <View style={styles.bottomSheet}>
        {phase === 'searching_driver' && (
          <View style={styles.center}>
            <View style={styles.pulseOuter}><View style={styles.pulseInner}><Text style={{ fontSize: 30 }}>🛺</Text></View></View>
            <Text style={styles.statusTitle}>{t('ride.searchingDriver')}</Text>
            <Text style={styles.statusSub}>{t('ride.searchingSub')}</Text>
            <Button title={t('ride.cancelRide')} variant="outline" onPress={handleCancel} style={{ marginTop: spacing.lg }} />
          </View>
        )}

        {phase === 'no_drivers' && (
          <View style={styles.center}>
            <Icon name="alert-circle-outline" size={60} color={colors.warning} />
            <Text style={styles.statusTitle}>{t('ride.noDrivers')}</Text>
            <Text style={styles.statusSub}>{t('ride.noDriversSub')}</Text>
            <Button title={t('common.retry')} onPress={() => { resetRide(); navigation.replace('MainTabs'); }} style={{ marginTop: spacing.lg }} />
          </View>
        )}

        {(phase === 'driver_assigned' || phase === 'driver_arriving') && driverInfo && (
          <>
            <Text style={styles.statusTitle}>{t('ride.driverOnWay')}</Text>
            <View style={styles.driverCard}>
              <View style={styles.driverAvatar}><Text style={{ fontSize: 28 }}>👤</Text></View>
              <View style={styles.driverInfo}>
                <Text style={styles.driverName}>{driverInfo.driverName}</Text>
                <Text style={styles.vehicleNo}>{driverInfo.vehicleRegistrationNo}</Text>
                <View style={styles.ratingRow}>
                  <Icon name="star" size={14} color={colors.rating} />
                  <Text style={styles.ratingText}>{driverInfo.driverRating.toFixed(1)}</Text>
                  {driverInfo.vehicleColor && <Text style={styles.vehicleColor}> • {driverInfo.vehicleColor}</Text>}
                </View>
              </View>
              <TouchableOpacity style={styles.callBtn} onPress={handleCallDriver}>
                <Icon name="phone" size={22} color={colors.primary} />
              </TouchableOpacity>
            </View>
            <Button title={t('ride.cancelRide')} variant="outline" onPress={handleCancel} size="md" />
          </>
        )}

        {phase === 'driver_arrived' && (
          <>
            <Text style={styles.statusTitle}>{t('ride.driverArrived')}</Text>
            <View style={styles.otpCard}>
              <Text style={styles.otpLabel}>{t('ride.shareOtp')}</Text>
              <Text style={styles.otpCode}>{rideOtp}</Text>
            </View>
            {driverInfo && (
              <View style={styles.driverCard}>
                <View style={styles.driverAvatar}><Text style={{ fontSize: 28 }}>👤</Text></View>
                <View style={styles.driverInfo}>
                  <Text style={styles.driverName}>{driverInfo.driverName}</Text>
                  <Text style={styles.vehicleNo}>{driverInfo.vehicleRegistrationNo}</Text>
                </View>
                <TouchableOpacity style={styles.callBtn} onPress={handleCallDriver}>
                  <Icon name="phone" size={22} color={colors.primary} />
                </TouchableOpacity>
              </View>
            )}
          </>
        )}

        {phase === 'on_ride' && (
          <>
            <Text style={styles.statusTitle}>{t('ride.rideStarted')}</Text>
            <Text style={styles.statusSub}>{t('ride.enjoyRide')}</Text>
            {dropoff && <Text style={styles.destText}>→ {dropoff.address}</Text>}
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.actionBtn} onPress={handleCallDriver}>
                <Icon name="phone" size={20} color={colors.primary} />
                <Text style={styles.actionText}>{t('ride.callDriver')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn}>
                <Icon name="share-variant" size={20} color={colors.primary} />
                <Text style={styles.actionText}>{t('ride.shareRide')}</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  sosBtn: {
    position: 'absolute',
    top: 55,
    right: spacing.base,
    backgroundColor: colors.error,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    elevation: 5,
  },
  sosText: { ...typography.captionBold, color: colors.white, letterSpacing: 1 },
  bottomSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius.xxl,
    borderTopRightRadius: borderRadius.xxl,
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
    minHeight: 200,
  },
  center: { alignItems: 'center', paddingVertical: spacing.lg },
  pulseOuter: { width: 100, height: 100, borderRadius: 50, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  pulseInner: { width: 70, height: 70, borderRadius: 35, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  statusTitle: { ...typography.h3, color: colors.text, textAlign: 'center', marginBottom: spacing.xs },
  statusSub: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  driverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.base,
    marginVertical: spacing.base,
    gap: spacing.md,
  },
  driverAvatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  driverInfo: { flex: 1 },
  driverName: { ...typography.bodyBold, color: colors.text },
  vehicleNo: { ...typography.smallBold, color: colors.primary, marginTop: 2 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  ratingText: { ...typography.caption, color: colors.text },
  vehicleColor: { ...typography.caption, color: colors.textSecondary },
  callBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  otpCard: {
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    marginVertical: spacing.base,
  },
  otpLabel: { ...typography.small, color: colors.textSecondary },
  otpCode: { fontSize: 36, fontWeight: '800', color: colors.primary, letterSpacing: 12, marginTop: spacing.sm },
  destText: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm },
  actionRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionText: { ...typography.smallBold, color: colors.primary },
  autoMarker: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  autoEmoji: { fontSize: 28 },
});
