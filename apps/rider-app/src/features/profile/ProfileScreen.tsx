import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Linking, Share } from 'react-native';
import { ScreenWrapper } from '../../components';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { useAuthStore } from '../../hooks/useAuthStore';
import { riderApi } from '../../services/rider';

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
  const insets = useSafeAreaInsets();

  const handleLogout = () => {
    Alert.alert(t('profile.logout'), t('profile.logoutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('profile.logout'), style: 'destructive', onPress: () => logout() },
    ]);
  };

  const handleDownloadMyData = async () => {
    try {
      const res = await riderApi.downloadMyData();
      const json = JSON.stringify(res.data, null, 2);
      await Share.share({ title: 'My Aye Auto Data', message: json });
    } catch {
      Alert.alert('Error', 'Could not download your data. Please try again or contact privacy@heyauto.in');
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all personal data (name, phone, ride history). This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete My Account', style: 'destructive',
          onPress: () => {
            Alert.alert('Are you sure?', 'Your account will be permanently deleted under the Digital Personal Data Protection Act 2023.', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Yes, Delete', style: 'destructive',
                onPress: async () => {
                  try {
                    await riderApi.deleteAccount();
                    logout();
                  } catch {
                    Alert.alert('Error', 'Could not delete account. Please contact privacy@heyauto.in');
                  }
                },
              },
            ]);
          },
        },
      ],
    );
  };

  const handleLanguageToggle = () => {
    const newLang = i18n.language === 'ml' ? 'en' : 'ml';
    i18n.changeLanguage(newLang);
    const { storage } = require('../../utils/storage');
    storage.set('language', newLang);
  };

  return (
    <ScreenWrapper>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
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
          <MenuItem icon="history" label="My Rides" onPress={() => navigation.navigate('History')} />
          <MenuItem icon="map-marker-star" label="Saved Places" onPress={() => navigation.navigate('SavedPlaces')} />
          <MenuItem icon="credit-card" label="Payment Options" onPress={() => navigation.navigate('PaymentMethods')} />
          <MenuItem icon="shield-account" label="Safety Contacts" onPress={() => navigation.navigate('EmergencyContacts')} />
        </View>

        <View style={styles.menuSection}>
          <TouchableOpacity style={styles.menuItem} onPress={handleLanguageToggle}>
            <View style={styles.menuIcon}>
              <Icon name="translate" size={22} color={colors.primary} />
            </View>
            <Text style={styles.menuLabel}>{t('profile.language')}</Text>
            <Text style={styles.langValue}>{i18n.language === 'ml' ? 'മലയാളം' : 'English'}</Text>
          </TouchableOpacity>
          <MenuItem icon="help-circle" label={t('profile.help')} onPress={() => Linking.openURL('mailto:support@heyauto.in')} />
          <MenuItem icon="shield-lock-outline" label="Privacy Policy" onPress={() => Linking.openURL('https://hey-auto-server-production.up.railway.app/legal/privacy')} />
          <MenuItem icon="download-outline" label="Download My Data" onPress={handleDownloadMyData} />
          <MenuItem icon="information" label={t('profile.about')} onPress={() => {}} />
        </View>

        <View style={styles.menuSection}>
          <MenuItem icon="logout" label={t('profile.logout')} onPress={handleLogout} color={colors.error} />
          <MenuItem icon="delete-forever" label="Delete Account" onPress={handleDeleteAccount} color={colors.error} />
        </View>

        <View style={styles.grievanceCard}>
          <Text style={styles.grievanceTitle}>Grievance Officer · DPDP Act 2023</Text>
          <Text style={styles.grievanceText}>For data privacy concerns or deletion requests:</Text>
          <TouchableOpacity onPress={() => Linking.openURL('mailto:privacy@heyauto.in')}>
            <Text style={styles.grievanceEmail}>privacy@heyauto.in</Text>
          </TouchableOpacity>
          <Text style={styles.grievanceText}>Navam Works LLP · Taliparamba, Kannur, Kerala</Text>
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
  grievanceCard: {
    backgroundColor: colors.surface, borderRadius: borderRadius.xl,
    padding: spacing.base, marginBottom: spacing.base,
    borderWidth: 1, borderColor: colors.borderLight, gap: 4,
  },
  grievanceTitle: { ...typography.smallBold, color: colors.text },
  grievanceText: { ...typography.caption, color: colors.textSecondary },
  grievanceEmail: { ...typography.smallBold, color: colors.primary },
  version: { ...typography.caption, color: colors.textLight, textAlign: 'center', marginVertical: spacing.xl },
});
