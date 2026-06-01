export const colors = {
  // Brand
  primary:       '#f9b01b',
  primaryDark:   '#c98a00',
  primaryLight:  '#f9b01b1a',   // 10% tint for chip backgrounds

  // Ink — every highlighted card background
  ink:           '#0A0A0A',
  inkBorder:     '#1A1A1A',     // subtle card border on white

  // Secondary
  secondary:     '#00C96B',     // online / arrived / success
  secondaryLight:'rgba(0,201,107,0.12)',
  secondaryBorder:'rgba(0,201,107,0.25)',

  // Backgrounds
  background:    '#FFFFFF',
  surface:       '#F7F7F5',
  card:          '#F2F2F0',

  // Text (on white surfaces)
  text:          '#0A0A0A',
  textSecondary: '#666666',
  textLight:     '#999999',

  // Borders (on white surfaces)
  border:        '#E8E8E8',
  borderLight:   '#F0F0F0',

  // Semantic
  error:         '#F03A3A',
  errorLight:    '#FEECEC',
  warning:       '#F59E0B',
  warningLight:  '#FEF3C7',
  info:          '#3B82F6',
  infoLight:     '#DBEAFE',
  success:       '#00C96B',
  successLight:  'rgba(0,201,107,0.12)',

  // Utility
  black:         '#000000',
  white:         '#FFFFFF',
  transparent:   'transparent',
  overlay:       'rgba(0,0,0,0.5)',
  rating:        '#f9b01b',
  online:        '#00C96B',
  offline:       '#F03A3A',

  map: {
    pickup:      '#00C96B',
    dropoff:     '#F03A3A',
    route:       '#f9b01b',
    driverMarker:'#f9b01b',
  },
} as const;
