import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { useTranslation } from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Button } from '../../components';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { useRideStore } from '../../hooks/useRideStore';
import { rideApi, FareEstimate } from '../../services/ride';
import { decodePolyline } from '../../utils/polyline';

export function BookingConfirmScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { pickup, dropoff, fareEstimate, setFareEstimate, setCurrentRide, setPhase, paymentMethod, setPaymentMethod } = useRideStore();
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [routeCoords, setRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);

  useEffect(() => {
    if (pickup && dropoff) fetchEstimate();
  }, [pickup, dropoff]);

  const fetchEstimate = async () => {
    if (!pickup || !dropoff) return;
    setLoading(true);
    try {
      const { data } = await rideApi.getFareEstimate({
        pickupLat: pickup.lat,
        pickupLng: pickup.lng,
        dropoffLat: dropoff.lat,
        dropoffLng: dropoff.lng,
      });
      setFareEstimate(data.data);
      if ((data.data as any).polyline) {
        setRouteCoords(decodePolyline((data.data as any).polyline));
      }
    } catch (err) {
      console.error('Fare estimate error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleBookRide = async () => {
    if (!pickup || !dropoff) return;
    setBooking(true);
    try {
      const { data } = await rideApi.requestRide({
        pickupLat: pickup.lat,
        pickupLng: pickup.lng,
        pickupAddress: pickup.address,
        dropoffLat: dropoff.lat,
        dropoffLng: dropoff.lng,
        dropoffAddress: dropoff.address,
        paymentMethod,
      });
      setCurrentRide(data.data);
      setPhase('searching_driver');
      navigation.replace('ActiveRide');
    } catch (err: any) {
      console.error('Book ride error:', err);
    } finally {
      setBooking(false);
    }
  };

  if (!pickup || !dropoff) return null;

  const midLat = (pickup.lat + dropoff.lat) / 2;
  const midLng = (pickup.lng + dropoff.lng) / 2;
  const latDelta = Math.abs(pickup.lat - dropoff.lat) * 2 + 0.01;
  const lngDelta = Math.abs(pickup.lng - dropoff.lng) * 2 + 0.01;

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        region={{ latitude: midLat, longitude: midLng, latitudeDelta: latDelta, longitudeDelta: lngDelta }}
      >
        <Marker coordinate={{ latitude: pickup.lat, longitude: pickup.lng }} title={t('booking.pickup')} pinColor={colors.map.pickup} />
        <Marker coordinate={{ latitude: dropoff.lat, longitude: dropoff.lng }} title={t('booking.dropoff')} pinColor={colors.map.dropoff} />
        <Polyline
          coordinates={routeCoords.length > 0 ? routeCoords : [
            { latitude: pickup.lat, longitude: pickup.lng },
            { latitude: dropoff.lat, longitude: dropoff.lng },
          ]}
          strokeColor={colors.map.route}
          strokeWidth={4}
          lineDashPattern={routeCoords.length > 0 ? undefined : [10, 5]}
        />
      </MapView>

      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Icon name="arrow-left" size={24} color={colors.text} />
      </TouchableOpacity>

      <View style={styles.bottomSheet}>
        <View style={styles.addressRow}>
          <View style={styles.addressDots}>
            <View style={[styles.dot, { backgroundColor: colors.primary }]} />
            <View style={styles.dashedLine} />
            <View style={[styles.dot, { backgroundColor: colors.error }]} />
          </View>
          <View style={styles.addresses}>
            <Text style={styles.addressText} numberOfLines={1}>{pickup.address}</Text>
            <View style={styles.addressDivider} />
            <Text style={styles.addressText} numberOfLines={1}>{dropoff.address}</Text>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: spacing.xl }} />
        ) : fareEstimate ? (
          <>
            <View style={styles.fareCard}>
              <View style={styles.fareHeader}>
                <Text style={styles.fareTitle}>{t('booking.fareEstimate')}</Text>
                <View style={styles.govtBadge}>
                  <Text style={styles.govtText}>{t('booking.govtRate')}</Text>
                </View>
              </View>
              <View style={styles.fareRow}>
                <Text style={styles.fareLabel}>{t('booking.baseFare')}</Text>
                <Text style={styles.fareValue}>₹{fareEstimate.baseFare}</Text>
              </View>
              <View style={styles.fareRow}>
                <Text style={styles.fareLabel}>{t('booking.distanceCharge')} ({fareEstimate.distanceKm} km)</Text>
                <Text style={styles.fareValue}>₹{fareEstimate.distanceFare}</Text>
              </View>
              <View style={styles.fareRow}>
                <Text style={styles.fareLabel}>{t('booking.timeCharge')} ({fareEstimate.durationMin} min)</Text>
                <Text style={styles.fareValue}>₹{fareEstimate.timeFare}</Text>
              </View>
              {fareEstimate.nightSurcharge > 0 && (
                <View style={styles.fareRow}>
                  <Text style={styles.fareLabel}>{t('booking.nightCharge')}</Text>
                  <Text style={styles.fareValue}>₹{fareEstimate.nightSurcharge}</Text>
                </View>
              )}
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>{t('booking.totalFare')}</Text>
                <Text style={styles.totalValue}>₹{fareEstimate.totalFare}</Text>
              </View>
            </View>

            <View style={styles.paymentRow}>
              <Text style={styles.paymentLabel}>{t('booking.paymentMethod')}</Text>
              <View style={styles.paymentOptions}>
                {(['CASH', 'UPI'] as const).map((method) => (
                  <TouchableOpacity
                    key={method}
                    style={[styles.paymentBtn, paymentMethod === method && styles.paymentBtnActive]}
                    onPress={() => setPaymentMethod(method)}
                  >
                    <Icon
                      name={method === 'CASH' ? 'cash' : 'cellphone'}
                      size={18}
                      color={paymentMethod === method ? colors.white : colors.text}
                    />
                    <Text style={[styles.paymentBtnText, paymentMethod === method && styles.paymentBtnTextActive]}>
                      {t(`booking.${method.toLowerCase()}`)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <Button title={`${t('booking.bookAuto')} • ₹${fareEstimate.totalFare}`} onPress={handleBookRide} loading={booking} />
          </>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  backBtn: {
    position: 'absolute',
    top: 50,
    left: spacing.base,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  bottomSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius.xxl,
    borderTopRightRadius: borderRadius.xxl,
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
    elevation: 10,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  addressRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  addressDots: { alignItems: 'center', paddingTop: 4 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dashedLine: { width: 2, height: 20, backgroundColor: colors.border, marginVertical: 2 },
  addresses: { flex: 1 },
  addressText: { ...typography.small, color: colors.text, paddingVertical: 4 },
  addressDivider: { height: 1, backgroundColor: colors.borderLight },
  fareCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.base,
    marginBottom: spacing.base,
  },
  fareHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  fareTitle: { ...typography.h4, color: colors.text },
  govtBadge: { backgroundColor: colors.primaryLight, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: borderRadius.sm },
  govtText: { ...typography.captionBold, color: colors.primary },
  fareRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  fareLabel: { ...typography.small, color: colors.textSecondary },
  fareValue: { ...typography.small, color: colors.text },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
  },
  totalLabel: { ...typography.bodyBold, color: colors.text },
  totalValue: { ...typography.h3, color: colors.primary },
  paymentRow: { marginBottom: spacing.lg },
  paymentLabel: { ...typography.label, color: colors.textSecondary, marginBottom: spacing.sm },
  paymentOptions: { flexDirection: 'row', gap: spacing.sm },
  paymentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.base,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  paymentBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  paymentBtnText: { ...typography.smallBold, color: colors.text },
  paymentBtnTextActive: { color: colors.white },
});
