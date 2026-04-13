import React from 'react';
import { View, StyleSheet, StatusBar, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme';

interface ScreenWrapperProps {
  children: React.ReactNode;
  style?: ViewStyle;
  padded?: boolean;
  bgColor?: string;
  safeArea?: boolean;
}

export function ScreenWrapper({
  children,
  style,
  padded = true,
  bgColor = colors.background,
  safeArea = true,
}: ScreenWrapperProps) {
  const Container = safeArea ? SafeAreaView : View;

  return (
    <Container style={[styles.container, { backgroundColor: bgColor }, style]}>
      <StatusBar barStyle="dark-content" backgroundColor={bgColor} />
      <View style={[styles.content, padded && styles.padded]}>{children}</View>
    </Container>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1 },
  padded: { paddingHorizontal: spacing.base },
});
