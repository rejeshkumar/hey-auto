import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Linking,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { useHotspotStore, Hotspot } from '../../hooks/useHotspotStore';

const ORANGE = '#F97316';
const ORANGE_BG = 'rgba(249,115,22,0.10)';
const AUTO_DISMISS_MS = 30_000;

export function HotspotAlertBanner() {
  const { hotspots, visible, dismiss } = useHotspotStore();

  const slideAnim = useRef(new Animated.Value(-120)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible && hotspots.length > 0) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        friction: 8,
        tension: 60,
      }).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ]),
      ).start();

      dismissTimer.current = setTimeout(() => {
        slideOut();
      }, AUTO_DISMISS_MS);
    } else {
      slideOut();
    }

    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, [visible, hotspots]);

  function slideOut() {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    pulseAnim.stopAnimation();
    Animated.timing(slideAnim, {
      toValue: -120,
      duration: 250,
      useNativeDriver: true,
    }).start(() => dismiss());
  }

  if (!visible || hotspots.length === 0) return null;

  const primary = hotspots[0];
  const extraCount = hotspots.length - 1;

  function handleGo() {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${primary.lat},${primary.lng}&travelmode=driving`;
    Linking.openURL(url).catch(() => {});
    slideOut();
  }

  return (
    <Animated.View
      style={[styles.container, { transform: [{ translateY: slideAnim }] }]}
      pointerEvents="box-none"
    >
      <View style={styles.banner}>
        <View style={styles.leftAccent} />

        <View style={styles.dotWrap}>
          <Animated.View style={[styles.pulseDot, { opacity: pulseAnim }]} />
        </View>

        <View style={styles.content}>
          <Text style={styles.title}>🔥 High Demand Nearby</Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {primary.label}
          </Text>
          <Text style={styles.meta}>
            {primary.pendingCount} riders · {primary.distanceKm.toFixed(1)} km away
            {extraCount > 0 ? ` · +${extraCount} more areas` : ''}
          </Text>
        </View>

        <TouchableOpacity style={styles.goBtn} onPress={handleGo} activeOpacity={0.85}>
          <Text style={styles.goBtnText}>Go</Text>
          <Icon name="arrow-right" size={14} color={colors.white} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.closeBtn} onPress={slideOut} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Icon name="close" size={16} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 110 : 96,
    left: spacing.base,
    right: spacing.base,
    zIndex: 100,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    paddingVertical: spacing.sm + 2,
    paddingRight: spacing.sm,
    elevation: 8,
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.25)',
  },
  leftAccent: {
    width: 4,
    alignSelf: 'stretch',
    backgroundColor: ORANGE,
    marginRight: spacing.sm,
  },
  dotWrap: {
    width: 10,
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  pulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: ORANGE,
  },
  content: {
    flex: 1,
    marginRight: spacing.sm,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 1,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: ORANGE,
    marginBottom: 2,
  },
  meta: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  goBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: ORANGE,
    paddingVertical: 7,
    paddingHorizontal: spacing.base,
    borderRadius: borderRadius.full,
    marginRight: spacing.sm,
  },
  goBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.white,
  },
  closeBtn: {
    padding: 4,
  },
});
