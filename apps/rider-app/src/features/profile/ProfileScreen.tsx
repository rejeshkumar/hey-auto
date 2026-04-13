import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ScreenWrapper } from '../../components';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { useAuthStore } from '../../hooks/useAuthStore';

interface MenuItemProps {
  icon: string;
  label: string;
  onPress: () => void;
  color?: string;
}

function MenuItem({ icon, label, onPress, color }: MenuItemProps) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <View style={[styles.menuIcon, color ? { backgroundColor: color + '20' } : {}]}>
        <Icon name={icon} size={22} color={color || colors.primary} />
      </View>
      <Text style={styles.menuLabel}>{label}</Text>
      <Icon name="chevron-right" size={22} color={colors.textLight} />
    </TouchableOpacity>
  );
}

export function ProfileScreen({ navigation }: any) {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuthStore();

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

  return (
    <ScreenWrapper>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.screenTitle}>{t('profile.title')}</Text>

        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.fullName?.[0]?.toUpperCase() || '?'}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.fullName || 'User'}</Text>
            <Text style={styles.profilePhone}>{user?.phone}</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('EditProfile')}>
            <Icon name="pencil" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.menuSection}>
          <MenuItem icon="history" label={t('profile.myRides')} onPress={() => navigation.navigate('History')} />
          <MenuItem icon="map-marker-star" label={t('profile.savedPlaces')} onPress={() => {}} />
          <MenuItem icon="credit-card" label={t('profile.paymentMethods')} onPress={() => {}} />
          <MenuItem icon="phone-alert" label={t('profile.emergencyContacts')} onPress={() => {}} />
        </View>

        <View style={styles.menuSection}>
          <TouchableOpacity style={styles.menuItem} onPress={handleLanguageToggle}>
            <View style={styles.menuIcon}>
              <Icon name="translate" size={22} color={colors.primary} />
            </View>
            <Text style={styles.menuLabel}>{t('profile.language')}</Text>
            <Text style={styles.langValue}>{i18n.language === 'ml' ? 'മലയാളം' : 'English'}</Text>
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
  screenTitle: { ...typography.h2, color: colors.text, marginTop: spacing.lg, marginBottom: spacing.lg },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    gap: spacing.base,
    elevation: 2,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { ...typography.h2, color: colors.white },
  profileInfo: { flex: 1 },
  profileName: { ...typography.h4, color: colors.text },
  profilePhone: { ...typography.small, color: colors.textSecondary, marginTop: 2 },
  menuSection: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    marginBottom: spacing.base,
    overflow: 'hidden',
    elevation: 1,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.base,
    paddingHorizontal: spacing.base,
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: { ...typography.body, color: colors.text, flex: 1 },
  langValue: { ...typography.smallBold, color: colors.primary, marginRight: spacing.sm },
  version: { ...typography.caption, color: colors.textLight, textAlign: 'center', marginVertical: spacing.xl },
});
