import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { ScreenWrapper } from '../../components';
import { colors, typography, spacing, borderRadius } from '../../theme';

interface PaymentMethod {
  id: string;
  type: 'cash' | 'upi' | 'wallet';
  label: string;
  sublabel: string;
  icon: string;
  iconColor: string;
}

const METHODS: PaymentMethod[] = [
  { id: 'cash', type: 'cash', label: 'Cash', sublabel: 'Pay directly to driver', icon: 'cash', iconColor: colors.success },
  { id: 'upi', type: 'upi', label: 'UPI', sublabel: 'GPay, PhonePe, Paytm, BHIM', icon: 'contactless-payment', iconColor: colors.info },
  { id: 'wallet', type: 'wallet', label: 'Aye Auto Wallet', sublabel: '₹0.00 balance', icon: 'wallet', iconColor: colors.primary },
];

export function PaymentMethodsScreen({ navigation }: any) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState('cash');

  return (
    <ScreenWrapper>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('profile.paymentMethods')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

        <Text style={styles.sectionLabel}>DEFAULT PAYMENT METHOD</Text>
        <View style={styles.card}>
          {METHODS.map((method, idx) => (
            <TouchableOpacity
              key={method.id}
              style={[styles.methodRow, idx < METHODS.length - 1 && styles.methodBorder]}
              onPress={() => setSelected(method.id)}
            >
              <View style={[styles.methodIcon, { backgroundColor: method.iconColor + '20' }]}>
                <Icon name={method.icon} size={22} color={method.iconColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.methodLabel}>{method.label}</Text>
                <Text style={styles.methodSub}>{method.sublabel}</Text>
              </View>
              <View style={[styles.radio, selected === method.id && styles.radioActive]}>
                {selected === method.id && <View style={styles.radioDot} />}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionLabel}>WALLET</Text>
        <View style={styles.walletCard}>
          <View style={styles.walletTop}>
            <View>
              <Text style={styles.walletBalance}>₹0.00</Text>
              <Text style={styles.walletLabel}>Aye Auto Wallet Balance</Text>
            </View>
            <Icon name="wallet" size={32} color={colors.primary} />
          </View>
          <TouchableOpacity style={styles.topupBtn}>
            <Icon name="plus-circle" size={18} color={colors.white} />
            <Text style={styles.topupText}>Add Money</Text>
          </TouchableOpacity>
          <Text style={styles.walletNote}>
            Wallet top-up coming soon. UPI and Cash payments are available now.
          </Text>
        </View>

        <Text style={styles.sectionLabel}>HOW IT WORKS</Text>
        <View style={styles.card}>
          {[
            { icon: 'cash', color: colors.success, title: 'Cash', desc: 'Pay the driver directly after the ride. Most popular in Taliparamba.' },
            { icon: 'contactless-payment', color: colors.info, title: 'UPI', desc: 'Scan the QR code shown at ride completion. Instant & safe.' },
            { icon: 'wallet', color: colors.primary, title: 'Wallet', desc: 'Pre-load money for faster checkout. Coming soon.' },
          ].map((item, idx, arr) => (
            <View key={item.title} style={[styles.infoRow, idx < arr.length - 1 && styles.methodBorder]}>
              <View style={[styles.methodIcon, { backgroundColor: item.color + '20' }]}>
                <Icon name={item.icon} size={20} color={item.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.infoTitle}>{item.title}</Text>
                <Text style={styles.infoDesc}>{item.desc}</Text>
              </View>
            </View>
          ))}
        </View>

      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.base, paddingHorizontal: spacing.base },
  backBtn: { width: 40, height: 40, borderRadius: borderRadius.full, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.h4, color: colors.text },
  content: { padding: spacing.base, paddingBottom: spacing.xxxl },
  sectionLabel: { ...typography.captionBold, color: colors.textSecondary, letterSpacing: 0.8, marginBottom: spacing.sm, marginTop: spacing.base },
  card: { backgroundColor: colors.card, borderRadius: borderRadius.xl, overflow: 'hidden', elevation: 1, shadowColor: colors.black, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3 },
  methodRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.base, padding: spacing.base },
  methodBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  methodIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  methodLabel: { ...typography.smallBold, color: colors.text },
  methodSub: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  radioActive: { borderColor: colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  walletCard: { backgroundColor: colors.card, borderRadius: borderRadius.xl, padding: spacing.base, elevation: 1, shadowColor: colors.black, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3 },
  walletTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.base },
  walletBalance: { ...typography.h2, color: colors.text },
  walletLabel: { ...typography.caption, color: colors.textSecondary },
  topupBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.primary, borderRadius: borderRadius.lg, padding: spacing.base, marginBottom: spacing.sm },
  topupText: { ...typography.smallBold, color: colors.white },
  walletNote: { ...typography.caption, color: colors.textSecondary, textAlign: 'center' },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.base, padding: spacing.base },
  infoTitle: { ...typography.smallBold, color: colors.text },
  infoDesc: { ...typography.caption, color: colors.textSecondary, marginTop: 2, lineHeight: 18 },
});
