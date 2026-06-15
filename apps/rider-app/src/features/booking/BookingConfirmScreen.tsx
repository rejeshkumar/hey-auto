import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform, ScrollView, Alert, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button, StaticMapView } from '../../components';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { useRideStore } from '../../hooks/useRideStore';
import { rideApi, FareEstimate } from '../../services/ride';
import { decodePolyline } from '../../utils/polyline';

export function BookingConfirmScreen({ navigation }: any) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { pickup, dropoff, fareEstimate, setFareEstimate, setCurrentRide, setRideOtp, setPhase, paymentMethod, setPaymentMethod, rideType, setParcelDetails, parcelDescription, recipientName, recipientPhone } = useRideStore();
  const [loading, setLoading] = useState(true);
  const [estimateErrMsg, setEstimateErrMsg] = useState('');
  const [booking, setBooking] = useState(false);
  const isParcel = rideType === 'PARCEL';

  useEffect(() => {
    if (pickup && dropoff) fetchEstimate();
  }, []);

  const fetchEstimate = async () => {
    if (!pickup || !dropoff) return;
    setLoading(true);
    try {
      const { data } = await rideApi.getFareEstimate({
        pickupLat: pickup.lat, pickupLng: pickup.lng,
        dropoffLat: dropoff.lat, dropoffLng: dropoff.lng,
        rideType,
      });
      setFareEstimate(data.data);
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.message || 'Network error';
      setEstimateErrMsg(msg);
      setFareEstimate(null as any);
    } finally {
      setLoading(false);
    }
  };

  const handleBookRide = async () => {
    if (!pickup || !dropoff) return;
    setBooking(true);
    try {
      if (isParcel && !recipientName?.trim()) {
        Alert.alert('Required', 'Please enter the recipient name for parcel delivery');
        setBooking(false);
        return;
      }
      const { data } = await rideApi.requestRide({
        pickupLat: pickup.lat, pickupLng: pickup.lng, pickupAddress: pickup.address,
        dropoffLat: dropoff.lat, dropoffLng: dropoff.lng, dropoffAddress: dropoff.address,
        paymentMethod,
        rideType,
        parcelDescription,
        recipientName,
        recipientPhone,
      });
      setCurrentRide(data.data);
      if (data.data.rideOtp) setRideOtp(data.data.rideOtp);
      setPhase('searching_driver');
      navigation.replace('ActiveRide');
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.message || 'Something went wrong';
      Alert.alert('Booking failed', msg);
    } finally {
      setBooking(false);
    }
  };

  if (!pickup || !dropoff) return null;

  // Center map between pickup and dropoff
  const mapCenter = {
    lat: (pickup.lat + dropoff.lat) / 2,
    lng: (pickup.lng + dropoff.lng) / 2,
  };
  const mapMarkers = [
    { lat: pickup.lat,  lng: pickup.lng,  color: '0x00C853', label: 'A' },
    { lat: dropoff.lat, lng: dropoff.lng, color: '0xFF3B30', label: 'B' },
  ];

  return (
    <View style={styles.container}>
      <StaticMapView center={mapCenter} markers={mapMarkers} style={styles.map} />

      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <MaterialCommunityIcons name="arrow-left" size={22} color={colors.text} />
      </TouchableOpacity>

      <ScrollView
        style={styles.bottomSheet}
        contentContainerStyle={[styles.bottomSheetContent, { paddingBottom: Math.max(insets.bottom + 16, 32) }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Route summary */}
        <View style={styles.routeCard}>
          <View style={styles.routeIconCol}>
            <View style={[styles.routeDot, { backgroundColor: colors.secondary }]} />
            <View style={styles.routeLine} />
            <View style={[styles.routeDot, { backgroundColor: colors.error }]} />
          </View>
          <View style={styles.routeAddresses}>
            <View style={styles.routeStop}>
              <Text style={styles.routeStopLabel}>FROM</Text>
              <Text style={styles.routeStopAddr} numberOfLines={1}>{pickup.address}</Text>
            </View>
            <View style={styles.routeStop}>
              <Text style={styles.routeStopLabel}>TO</Text>
              <Text style={styles.routeStopAddr} numberOfLines={1}>{dropoff.address}</Text>
            </View>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Getting best fare...</Text>
          </View>
        ) : !fareEstimate ? (
          <View style={styles.errorWrap}>
            <MaterialCommunityIcons name="wifi-off" size={40} color={colors.textLight} />
            <Text style={styles.errorText}>{estimateErrMsg || 'Could not get fare estimate'}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={fetchEstimate}>
              <Text style={styles.retryText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Fare breakdown */}
            <View style={styles.fareCard}>
              <View style={styles.fareHeader}>
                <Text style={styles.fareTitle}>{t('booking.fareEstimate')}</Text>
                <View style={styles.govtBadge}>
                  <MaterialCommunityIcons name="shield-check" size={12} color={colors.primary} />
                  <Text style={styles.govtText}>{t('booking.govtRate')}</Text>
                </View>
              </View>

              <View style={styles.fareRows}>
                <View style={styles.fareRow}>
                  <Text style={styles.fareLabel}>{t('booking.baseFare')}</Text>
                  <Text style={styles.fareValue}>₹{fareEstimate.baseFare}</Text>
                </View>
                <View style={styles.fareRow}>
                  <Text style={styles.fareLabel}>{t('booking.distanceCharge')} · {fareEstimate.distanceKm} km</Text>
                  <Text style={styles.fareValue}>₹{fareEstimate.distanceFare}</Text>
                </View>
                <View style={styles.fareRow}>
                  <Text style={styles.fareLabel}>{t('booking.timeCharge')} · {fareEstimate.durationMin} min</Text>
                  <Text style={styles.fareValue}>₹{fareEstimate.timeFare}</Text>
                </View>
                {fareEstimate.nightSurcharge > 0 && (
                  <View style={styles.fareRow}>
                    <Text style={styles.fareLabel}>{t('booking.nightCharge')}</Text>
                    <Text style={styles.fareValue}>₹{fareEstimate.nightSurcharge}</Text>
                  </View>
                )}
              </View>

              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>{t('booking.totalFare')}</Text>
                <Text style={styles.totalValue}>₹{fareEstimate.totalFare}</Text>
              </View>
            </View>

            {/* Payment method */}
            <View style={styles.paymentRow}>
              <Text style={styles.paymentLabel}>{t('booking.paymentMethod')}</Text>
              <View style={styles.paymentOptions}>
                {(['CASH', 'UPI'] as const).map((method) => (
                  <TouchableOpacity
                    key={method}
                    style={[styles.paymentBtn, paymentMethod === method && styles.paymentBtnActive]}
                    onPress={() => setPaymentMethod(method)}
                  >
                    <MaterialCommunityIcons
                      name={method === 'CASH' ? 'cash' : 'cellphone'}
                      size={18}
                      color={paymentMethod === method ? colors.primary : colors.textSecondary}
                    />
                    <Text style={[styles.paymentBtnText, paymentMethod === method && styles.paymentBtnTextActive]}>
                      {t(`booking.${method.toLowerCase()}`)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Parcel fields */}
            {isParcel && (
              <View style={styles.parcelSection}>
                <Text style={styles.parcelSectionTitle}>📦 Parcel Details</Text>
                <TextInput
                  style={styles.parcelInput}
                  placeholder="Recipient name *"
                  placeholderTextColor={colors.textSecondary}
                  value={recipientName || ''}
                  onChangeText={(v) => setParcelDetails({ recipientName: v })}
                />
                <TextInput
                  style={styles.parcelInput}
                  placeholder="Recipient phone"
                  placeholderTextColor={colors.textSecondary}
                  value={recipientPhone || ''}
                  onChangeText={(v) => setParcelDetails({ recipientPhone: v })}
                  keyboardType="phone-pad"
                />
                <TextInput
                  style={[styles.parcelInput, { minHeight: 60, textAlignVertical: 'top' }]}
                  placeholder="Parcel description (optional)"
                  placeholderTextColor={colors.textSecondary}
                  value={parcelDescription || ''}
                  onChangeText={(v) => setParcelDetails({ parcelDescription: v })}
                  multiline
                />
              </View>
            )}

            <Button
              title={isParcel ? `Send Parcel · ₹${fareEstimate.totalFare}` : `${t('booking.bookRide')} · ₹${fareEstimate.totalFare}`}
              onPress={handleBookRide}
              loading={booking}
            />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  map: { flex: 1, backgroundColor: '#EAF3EA' },

  backBtn: {
    position: 'absolute', top: Platform.OS === 'ios' ? 56 : 40,
    left: spacing.base, width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center',
    elevation: 4, shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4,
  },

  bottomSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius.xxl,
    borderTopRightRadius: borderRadius.xxl,
    maxHeight: '65%',
    elevation: 12,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 16,
  },
  bottomSheetContent: {
    padding: spacing.lg,
  },

  routeCard: {
    flexDirection: 'row', gap: spacing.md,
    marginBottom: spacing.base,
  },
  routeIconCol: { alignItems: 'center', paddingTop: 16 },
  routeDot: { width: 10, height: 10, borderRadius: 5 },
  routeLine: { width: 2, flex: 1, backgroundColor: colors.border, marginVertical: 3, minHeight: 20 },
  routeAddresses: { flex: 1, gap: spacing.sm },
  routeStop: {
    backgroundColor: colors.surface, borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.base, paddingVertical: spacing.sm,
    borderWidth: 1, borderColor: colors.border,
  },
  routeStopLabel: { ...typography.captionBold, color: colors.textSecondary, letterSpacing: 0.5 },
  routeStopAddr: { ...typography.smallBold, color: colors.text, marginTop: 2 },

  loadingWrap: { alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.base },
  loadingText: { ...typography.small, color: colors.textSecondary },

  errorWrap: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.base },
  errorText: { ...typography.body, color: colors.textSecondary },
  retryBtn: { backgroundColor: colors.primary, paddingVertical: spacing.sm, paddingHorizontal: spacing.xl, borderRadius: borderRadius.xl },
  retryText: { ...typography.smallBold, color: colors.text },

  fareCard: {
    backgroundColor: colors.ink, borderRadius: borderRadius.xl,
    overflow: 'hidden',
    padding: spacing.base, marginBottom: spacing.base,
    borderTopWidth: 2, borderTopColor: colors.primary,
  },
  fareHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.base },
  fareTitle: { ...typography.bodyBold, color: colors.primary, fontWeight: '600' },
  govtBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(249,176,27,0.1)', paddingHorizontal: spacing.sm,
    paddingVertical: 3, borderRadius: borderRadius.full,
  },
  govtText: { ...typography.captionBold, color: colors.primary },
  fareRows: { gap: 6, marginBottom: spacing.sm },
  fareRow: { flexDirection: 'row', justifyContent: 'space-between' },
  fareLabel: { ...typography.small, color: colors.primary, fontWeight: '600' },
  fareValue: { ...typography.small, color: colors.primary, fontWeight: '600' },
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderTopWidth: 1, borderTopColor: 'rgba(249,176,27,0.3)',
    paddingTop: spacing.sm, marginTop: spacing.xs,
  },
  totalLabel: { ...typography.bodyBold, color: colors.primary, fontWeight: '600' },
  totalValue: { fontSize: 24, fontWeight: '900', color: colors.primary },

  paymentRow: { marginBottom: spacing.lg },
  paymentLabel: { ...typography.label, color: colors.textSecondary, marginBottom: spacing.sm },
  paymentOptions: { flexDirection: 'row', gap: spacing.sm },
  paymentBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.base,
    borderRadius: borderRadius.xl, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  paymentBtnActive: {
    backgroundColor: colors.ink, borderWidth: 0,
    borderTopWidth: 2, borderTopColor: colors.primary,
    overflow: 'hidden',
  },
  paymentBtnText: { ...typography.smallBold, color: colors.textSecondary },
  paymentBtnTextActive: { color: colors.primary, fontWeight: '600' },
  parcelSection: { marginBottom: spacing.lg },
  parcelSectionTitle: { ...typography.bodyBold, color: colors.text, marginBottom: spacing.sm },
  parcelInput: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: borderRadius.lg,
    padding: spacing.base, ...typography.body, color: colors.text,
    backgroundColor: colors.surface, marginBottom: spacing.sm,
  },
});
