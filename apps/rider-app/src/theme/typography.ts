import { Platform } from 'react-native';

const fontFamily = Platform.select({
  ios:     'Inter',
  android: 'Inter',
  default: 'Inter',
});

export const typography = {
  h1:          { fontSize: 28, fontWeight: '900' as const, lineHeight: 34, fontFamily, letterSpacing: -0.5 },
  h2:          { fontSize: 24, fontWeight: '800' as const, lineHeight: 30, fontFamily, letterSpacing: -0.5 },
  h3:          { fontSize: 20, fontWeight: '700' as const, lineHeight: 26, fontFamily, letterSpacing: -0.3 },
  h4:          { fontSize: 17, fontWeight: '700' as const, lineHeight: 22, fontFamily },
  body:        { fontSize: 15, fontWeight: '400' as const, lineHeight: 22, fontFamily },
  bodyBold:    { fontSize: 15, fontWeight: '600' as const, lineHeight: 22, fontFamily },
  small:       { fontSize: 13, fontWeight: '400' as const, lineHeight: 18, fontFamily },
  smallBold:   { fontSize: 13, fontWeight: '600' as const, lineHeight: 18, fontFamily },
  caption:     { fontSize: 11, fontWeight: '400' as const, lineHeight: 15, fontFamily },
  captionBold: { fontSize: 11, fontWeight: '600' as const, lineHeight: 15, fontFamily },
  button:      { fontSize: 15, fontWeight: '800' as const, lineHeight: 20, fontFamily },
  label:       { fontSize: 10, fontWeight: '700' as const, lineHeight: 14, fontFamily, letterSpacing: 0.5 },
  // ink card text — same weight as chips, used for all labels inside black cards
  inkLabel:    { fontSize: 10, fontWeight: '600' as const, lineHeight: 14, fontFamily },
} as const;
