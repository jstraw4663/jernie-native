// Design tokens — single source of truth for all visual constants.
// Numeric spacing/radius values are unitless (React Native uses numbers, not px strings).
// Layer order: Brand → Core → Semantic → TypeColors → Trip/Stop (dynamic, per-trip)

export const Brand = {
  navy:     '#0D2B3E',
  navySoft: '#2C5880',
  gold:     '#C89A2B',
} as const;

export const Core = {
  bg:           '#F7F4EF',
  surface:      '#FCFAF7',
  surfaceMuted: '#F1ECE4',
  surfaceRaised:'#FAFAF8',
  border:       '#DDD5CA',
  text:         '#28231E',
  textMuted:    '#6E665E',
  textFaint:    '#999591',
  textInverse:  '#FFFFFF',
  white:        '#FFFFFF',
  navyTint10:   'rgba(13,43,62,0.10)',
  navyTint20:   'rgba(13,43,62,0.20)',
  overlay:      'rgba(0,0,0,0.45)',
  action:       '#2F6F73',
} as const;

export const Semantic = {
  confirmed:      '#C89A2B',
  confirmedTint:  '#FDF0DC',
  confirmedDark:  '#7A5810',
  selected:       '#2C5880',
  selectedTint:   '#EAF0F8',
  saved:          '#2F6F73',
  success:        '#3E7B52',
  successTint:    '#D1F0DF',
  warning:        '#B56B00',
  warningTint:    '#F5E8D0',
  error:          '#A3485F',
  errorTint:      '#F5E8EB',
} as const;

export const TypeColors = {
  flight:   '#2C5880',
  car:      '#5A7082',
  stay:     '#465E7A',
  food:     '#B44F1E',
  bars:     '#8E4E2F',
  hike:     '#2F6B47',
  activity: '#7A4F82',
  sight:    '#8A5A2B',
  shopping: '#6B4A3A',
} as const;

export const WeatherColors = {
  clear:        '#E8A020',
  mostlyClear:  '#E8A020',
  partlyCloudy: '#94A3B8',
  cloudy:       '#94A3B8',
  fog:          '#94A3B8',
  rain:         '#60A5FA',
  snow:         '#BAE6FD',
  storm:        '#7C3AED',
} as const;

// 4px base unit — use multiples (4, 8, 12, 16, 20, 24, 32, 48, 64)
export const Spacing = {
  xxs:  2,
  xs:   4,
  sm:   8,
  md:   12,
  base: 16,
  lg:   20,
  xl:   24,
  xxl:  32,
  xxxl: 48,
} as const;

export const Radius = {
  sm:   4,
  md:   8,
  lg:   12,
  xl:   16,
  hero: 32,
  card: 20,
  list: 12,
  full: 9999,
} as const;

// Typography — Fraunces (serif), DM Sans (sans), DM Mono (mono)
// Font files in assets/fonts/ — loaded via expo-font in app/_layout.tsx
export const Typography = {
  family: {
    serif: 'Fraunces',
    sans:  'DMSans',
    mono:  'DMMono',
  },
  roles: {
    display:   { fontSize: 36, lineHeight: 40, fontWeight: '400' as const, fontFamily: 'Fraunces', letterSpacing: -0.54 },
    h1:        { fontSize: 28, lineHeight: 34, fontWeight: '400' as const, fontFamily: 'Fraunces' },
    h1Bold:    { fontSize: 28, lineHeight: 34, fontWeight: '700' as const, fontFamily: 'Fraunces' },
    h2:        { fontSize: 22, lineHeight: 28, fontWeight: '400' as const, fontFamily: 'Fraunces' },
    h2Italic:  { fontSize: 22, lineHeight: 28, fontWeight: '400' as const, fontFamily: 'Fraunces', fontStyle: 'italic' as const },
    h3:        { fontSize: 18, lineHeight: 24, fontWeight: '600' as const, fontFamily: 'DMSans' },
    body:      { fontSize: 16, lineHeight: 26, fontWeight: '400' as const, fontFamily: 'DMSans' },
    bodyBold:  { fontSize: 16, lineHeight: 26, fontWeight: '700' as const, fontFamily: 'DMSans' },
    bodySoft:  { fontSize: 15, lineHeight: 25, fontWeight: '400' as const, fontFamily: 'Fraunces', fontStyle: 'italic' as const },
    label:     { fontSize: 13, lineHeight: 18, fontWeight: '600' as const, fontFamily: 'DMSans' },
    labelCaps: { fontSize: 11, lineHeight: 16, fontWeight: '700' as const, fontFamily: 'DMSans', letterSpacing: 1.32, textTransform: 'uppercase' as const },
    meta:      { fontSize: 13, lineHeight: 18, fontWeight: '400' as const, fontFamily: 'DMSans' },
    button:    { fontSize: 15, lineHeight: 20, fontWeight: '600' as const, fontFamily: 'DMSans' },
    mono:      { fontSize: 13, lineHeight: 18, fontWeight: '400' as const, fontFamily: 'DMMono', letterSpacing: 0.26 },
  },
  weight: {
    regular:  '400',
    medium:   '500',
    semibold: '600',
    bold:     '700',
  },
} as const;

export const Shadow = {
  none:        undefined,
  cardResting: { shadowColor: '#0D2B3E', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8,  elevation: 2 },
  cardHover:   { shadowColor: '#0D2B3E', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 4 },
  cardLifted:  { shadowColor: '#0D2B3E', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 32, elevation: 8 },
  sheet:       { shadowColor: '#0D2B3E', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.14, shadowRadius: 24, elevation: 12 },
} as const;

export const Animation = {
  duration: {
    fast:   175,
    normal: 300,
    slow:   420,
    sheet:  460,
  },
  springs: {
    gentle:    { damping: 26, stiffness: 240 },
    snappy:    { damping: 28, stiffness: 340 },
    bouncy:    { damping: 20, stiffness: 260 },
    drag:      { damping: 36, stiffness: 400 },
  },
} as const;
