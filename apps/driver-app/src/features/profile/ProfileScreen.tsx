import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Switch, Platform, TextInput, Modal } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { ScreenWrapper } from '../../components';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { useAuthStore } from '../../hooks/useAuthStore';
import { useDriverStore } from '../../hooks/useDriverStore';
import { driverApi } from '../../services/driver';

interface MenuItemProps {
  icon: string;
  label: string;
  onPress: () => void;
  color?: string;
  rightText?: string;
}

function MenuItem({ icon, label, onPress, color, rightText }: MenuItemProps) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <View style={[styles.menuIcon, color ? { backgroundColor: color + '20' } : {}]}>
        <Icon name={icon} size={22} color={color || colors.primary} />
      </View>
      <Text style={styles.menuLabel}>{label}</Text>
      {rightText && <Text style={styles.rightText}>{rightText}</Text>}
      <Icon name="chevron-right" size={22} color={colors.textLight} />
    </TouchableOpacity>
  );
}

export function ProfileScreen({ navigation }: any) {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuthStore();
  const { profile, loadProfile } = useDriverStore();
  const [acceptsParcels, setAcceptsParcels] = useState(false);
  const [city, setCity] = useState('');
  const [cityModalVisible, setCityModalVisible] = useState(false);
  const [cityInput, setCityInput] = useState('');
  const [savingCity, setSavingCity] = useState(false);

  useEffect(() => {
    loadProfile();
    driverApi.getProfile().then((r) => {
      setAcceptsParcels(!!r.data.data?.acceptsParcels);
      setCity(r.data.data?.city || '');
    }).catch(() => {});
  }, []);

  const handleLogout = () => {
    Alert.alert(t('profile.logout'), t('profile.logoutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('profile.logout'), style: 'destructive', onPress: () => logout() },
    ]);
  };

  const handleLanguageToggle = () => {
    const newLang = i18n.language === 'ml' ? 'en' : 'ml';
    i18n.changeLanguage(newLang);
    const { storage } = require('../../utils/storage');
    storage.set('language', newLang);
  };

  const isVerified = profile?.verificationStatus === 'VERIFIED';

  const handleSaveCity = async () => {
    const trimmed = cityInput.trim().toLowerCase();
    if (!trimmed) return;
    setSavingCity(true);
    try {
      await driverApi.updateProfile({ city: trimmed });
      setCity(trimmed);
      setCityModalVisible(false);
    } catch {
      Alert.alert('Error', 'Could not update city. Please try again.');
    } finally {
      setSavingCity(false);
    }
  };

  return (
    <ScreenWrapper>
      <Modal visible={cityModalVisible} transparent animationType="fade" onRequestClose={() => setCityModalVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setCityModalVisible(false)}>
          <View style={styles.modalCard} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>Update City</Text>
            <Text style={styles.modalSub}>Enter your city name (e.g. bangalore, taliparamba)</Text>
            <TextInput
              style={styles.cityInput}
              value={cityInput}
              onChangeText={setCityInput}
              placeholder="Enter city"
              placeholderTextColor={colors.textLight}
              autoCapitalize="none"
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setCityModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveBtn, savingCity && { opacity: 0.6 }]}
                onPress={handleSaveCity}
                disabled={savingCity}
              >
                <Text style={styles.modalSaveText}>{savingCity ? 'Saving...' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Platform.OS === 'ios' ? 32 : 80 }}>
        <Text style={styles.screenTitle}>{t('profile.title')}</Text>

        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.fullName?.[0]?.toUpperCase() || '?'}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.fullName || 'Driver'}</Text>
            <Text style={styles.profilePhone}>{user?.phone}</Text>
            <View style={[styles.verifyBadge, isVerified ? styles.verifiedBadge : styles.pendingBadge]}>
              <Text style={[styles.verifyText, isVerified ? styles.verifiedText : styles.pendingText]}>
                {isVerified ? t('profile.verified') : t('profile.pending')}
              </Text>
            </View>
          </View>
        </View>

        {profile && (
          <View style={styles.statsCard}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{profile.rating.toFixed(1)}</Text>
              <Text style={styles.statLabel}>{t('ride.riderRating')}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{profile.totalRides}</Text>
              <Text style={styles.statLabel}>{t('earnings.totalRides')}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{profile.acceptanceRate}%</Text>
              <Text style={styles.statLabel}>{t('home.acceptanceRate')}</Text>
            </View>
          </View>
        )}

        <View style={styles.menuSection}>
          <MenuItem icon="map-marker-outline" label="City" onPress={() => { setCityInput(city); setCityModalVisible(true); }} rightText={city || 'Not set'} />
          <MenuItem icon="car" label="My Vehicle" onPress={() => navigation.navigate('Vehicle')} rightText={profile?.vehicles?.[0]?.registrationNo} />
          <MenuItem icon="file-document" label={t('profile.documents')} onPress={() => navigation.navigate('Documents')} />
          <MenuItem icon="star-circle" label="Subscription" onPress={() => navigation.navigate('Subscription')} rightText={profile?.verificationStatus === 'VERIFIED' ? 'Active' : undefined} />
          <MenuItem icon="home-outline" label="Home Location" onPress={() => navigation.navigate('SetHomeLocation')} rightText={profile?.homeAddress ? 'Set' : 'Not set'} />
          <MenuItem icon="circle-multiple-outline" label="Rewards & Coins" onPress={() => navigation.navigate('Rewards')} rightText={profile?.coinsBalance ? `${profile.coinsBalance} 🪙` : undefined} />
          <View style={styles.parcelToggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.parcelToggleLabel}>Accept Parcel Deliveries</Text>
              <Text style={styles.parcelToggleSub}>Receive parcel booking requests</Text>
            </View>
            <Switch
              value={acceptsParcels}
              onValueChange={async (val) => {
                setAcceptsParcels(val);
                try { await driverApi.updateProfile({ acceptsParcels: val } as any); } catch {}
              }}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.white}
            />
          </View>
          <MenuItem icon="cash-multiple" label={t('profile.myEarnings')} onPress={() => navigation.navigate('EarningsTab')} />
          <MenuItem icon="history" label={t('profile.rideHistory')} onPress={() => navigation.navigate('HistoryTab')} />
        </View>

        <View style={styles.menuSection}>
          <TouchableOpacity style={styles.menuItem} onPress={handleLanguageToggle}>
            <View style={styles.menuIcon}><Icon name="translate" size={22} color={colors.primary} /></View>
            <Text style={styles.menuLabel}>{t('profile.language')}</Text>
            <Text style={styles.rightText}>{i18n.language === 'ml' ? 'മലയാളം' : 'English'}</Text>
          </TouchableOpacity>
          <MenuItem icon="help-circle" label={t('profile.help')} onPress={() => {}} />
          <MenuItem icon="information" label={t('profile.about')} onPress={() => {}} />
        </View>

        <View style={styles.menuSection}>
          <MenuItem icon="logout" label={t('profile.logout')} onPress={handleLogout} color={colors.error} />
        </View>

        <Text style={styles.version}>{t('profile.version', { version: '1.0.0' })}</Text>
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  screenTitle: { ...typography.h2, color: colors.text, marginTop: spacing.base, marginBottom: spacing.base },
  profileCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: borderRadius.xl,
    padding: spacing.lg, marginBottom: spacing.base, gap: spacing.base, elevation: 2,
    shadowColor: colors.black, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4,
  },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { ...typography.h2, color: colors.white },
  profileInfo: { flex: 1 },
  profileName: { ...typography.h4, color: colors.text },
  profilePhone: { ...typography.small, color: colors.textSecondary, marginTop: 2 },
  verifyBadge: { alignSelf: 'flex-start', paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: borderRadius.sm, marginTop: spacing.xs },
  verifiedBadge: { backgroundColor: colors.successLight },
  pendingBadge: { backgroundColor: colors.warningLight },
  verifyText: { ...typography.captionBold },
  verifiedText: { color: colors.success },
  pendingText: { color: colors.warning },
  statsCard: {
    flexDirection: 'row', backgroundColor: colors.white, borderRadius: borderRadius.xl, padding: spacing.lg, marginBottom: spacing.base,
    elevation: 1, shadowColor: colors.black, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { ...typography.h3, color: colors.primary },
  statLabel: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: colors.border },
  menuSection: {
    backgroundColor: colors.white, borderRadius: borderRadius.xl, marginBottom: spacing.base, overflow: 'hidden',
    elevation: 1, shadowColor: colors.black, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3,
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.base, paddingHorizontal: spacing.base, gap: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  menuIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { ...typography.body, color: colors.text, flex: 1 },
  rightText: { ...typography.smallBold, color: colors.primary, marginRight: spacing.sm },
  version: { ...typography.caption, color: colors.textLight, textAlign: 'center', marginVertical: spacing.xl },
  parcelToggleRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: spacing.base, paddingHorizontal: spacing.base,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  parcelToggleLabel: { ...typography.body, color: colors.text, fontWeight: '600' },
  parcelToggleSub: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  modalCard: { backgroundColor: colors.white, borderRadius: borderRadius.xl, padding: spacing.xl, width: '100%' },
  modalTitle: { ...typography.h4, color: colors.text, marginBottom: spacing.xs },
  modalSub: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.lg },
  cityInput: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.base, paddingVertical: spacing.sm,
    fontSize: 16, color: colors.text, marginBottom: spacing.lg,
  },
  modalActions: { flexDirection: 'row', gap: spacing.md },
  modalCancelBtn: { flex: 1, paddingVertical: spacing.sm, alignItems: 'center', borderRadius: borderRadius.lg, backgroundColor: colors.surface },
  modalCancelText: { ...typography.button, color: colors.textSecondary },
  modalSaveBtn: { flex: 1, paddingVertical: spacing.sm, alignItems: 'center', borderRadius: borderRadius.lg, backgroundColor: colors.primary },
  modalSaveText: { ...typography.button, color: colors.ink },
});
