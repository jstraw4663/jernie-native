// Design tokens — single source of truth for all visual constants.
//
// Regenerated from `.claude/skills/jernie-design/tokens/*.css`. The old navy / gold / cream
// palette is gone, not deprecated: no token here reproduces it, so nothing can quietly fall
// back to it. Numeric spacing/radius values are unitless (React Native takes numbers).
//
// Naming: the CSS calls these `--ink`, `--line`, `--accent`; this file keeps the names the
// 54 consuming files already use (`text`, `border`, `action`) so the migration is a value
// change, not a rename. Each key carries its CSS origin in a comment.

// ─── Palettes ────────────────────────────────────────────────────────────────
// Two palettes, one shape. Dark is warm charcoal, never a literal inversion — the neutrals
// carry some of the photography's warmth so images sit *in* the surface, not on top of it.
//
// Nothing consumes `dark` yet. The app is pinned to light in app.config.js, and the ~12
// screens that predate the redesign build their styles at module scope where a hook cannot
// reach. New components take the palette from `useTheme()`; when every surface is on it,
// unpin the config. See docs/redesign-roadmap.md.

export type Palette = {
  surface: string; surfaceSunken: string; surfaceMuted: string;
  border: string; borderSoft: string;
  text: string; textMuted: string; textFaint: string; textDisabled: string; textInverse: string;
  action: string; actionSoft: string; actionLine: string;
  warning: string; warningSoft: string; warningLine: string; warningInk: string;
  error: string; errorSoft: string;
};

const light: Palette = {
  // Surfaces
  surface:       '#FFFFFF',              // --surface        every screen background
  surfaceSunken: '#FAFAFA',              // --surface-sunken
  surfaceMuted:  '#F4F4F4',              // --surface-chip   chips, inert fills
  border:        '#EBEBEB',              // --line
  borderSoft:    '#F4F4F4',              // --line-soft

  // Ink
  text:          '#1B1B1B',              // --ink
  textMuted:     '#717171',              // --ink-2
  textFaint:     '#B0B0B0',              // --ink-3
  textDisabled:  '#C4C4C4',              // --ink-4
  textInverse:   '#FFFFFF',              // --ink-inverse

  // Accent — anything the traveller has secured: booked, checked in, now.
  // This is the only accent. There is no second one.
  action:        '#0F7B6C',              // --accent
  actionSoft:    'rgba(15,123,108,0.09)',// --accent-soft   selected fill
  actionLine:    'rgba(15,123,108,0.22)',// --accent-line   selected border

  // Amber is unfinished. Red is broken, and appears almost nowhere — a missing booking is
  // amber, never red. There is no `success`: secured is `action`.
  warning:       '#B56B00',              // --warning
  warningSoft:   'rgba(181,107,0,0.06)', // --warning-soft
  warningLine:   'rgba(181,107,0,0.40)', // --warning-line
  warningInk:    '#8A6320',              // --warning-ink   text on a warning fill
  error:         '#A3485F',              // --error         cancelled or failed booking only
  errorSoft:     '#F5E8EB',              // --error-soft
};

const dark: Palette = {
  surface:       '#201C1A',
  surfaceSunken: '#191614',
  surfaceMuted:  '#2A2624',
  border:        '#332E2B',
  borderSoft:    '#2A2624',

  text:          '#F5F1ED',
  textMuted:     '#A79E97',
  textFaint:     '#6E655F',
  textDisabled:  '#4A4340',
  textInverse:   '#201C1A',

  action:        '#5CCBB4',
  actionSoft:    'rgba(92,203,180,0.13)',
  actionLine:    'rgba(92,203,180,0.28)',

  // Dark amber is lighter and less saturated than light amber — #B56B00 on a charcoal
  // surface reads as brown, not as a warning. `warningInk` collapses onto `warning`
  // because there is no darker ink that stays legible on a 11%-amber fill.
  warning:       '#E0A244',
  warningSoft:   'rgba(224,162,68,0.11)',
  warningLine:   'rgba(224,162,68,0.38)',
  warningInk:    '#E0A244',
  error:         '#D98098',
  errorSoft:     'rgba(217,128,152,0.12)',
};

export const palettes = { light, dark };
export type ThemeName = keyof typeof palettes;

// The static palette. Every screen written before the redesign consumes this directly.
export const Core = {
  ...light,

  // Not themed. White on a photograph is white in both themes — the scrim, not the
  // palette, is what keeps it legible.
  white:       '#FFFFFF',
  onPhoto:     '#FFFFFF',                // --on-photo
  onPhoto2:    'rgba(255,255,255,0.72)', // --on-photo-2    secondary line over a photo
  onPhotoChip: 'rgba(255,255,255,0.18)', // --on-photo-chip chip fill over a photo
} as const;

// Three stops, not two. The mid stop is what stops the gradient from banding across a
// bright sky. Feed these to expo-linear-gradient in order; see reference/photo-scrim.md.
export const Scrim = {
  top:    'rgba(16,24,20,0.50)',  // --scrim-top
  mid:    'rgba(16,24,20,0.12)',  // --scrim-mid
  bottom: 'rgba(20,32,27,0.90)',  // --scrim-bottom    dark: rgba(14,12,11,0.94)
} as const;

// The static half of the amber/red story, for the screens that predate the redesign.
// Same relationship as `Core` has to `palettes`: identical values, no hook required.
// Anything written from Session 3 onward reads `warning*` / `error*` off `useTheme()`
// instead, because dark amber is a different colour, not the same one dimmed.
export const Semantic = {
  warning:     light.warning,
  warningSoft: light.warningSoft,
  warningLine: light.warningLine,
  warningInk:  light.warningInk,
  error:       light.error,
  errorSoft:   light.errorSoft,
} as const;

// One colour per item category — the closed set of 10 from docs/redesign-plan.md §8.
// Colour is the scarce resource here, so subtypes (hotel vs camping) share a category
// colour and differ only by icon.
export const TypeColors = {
  flight:   '#2C5880',
  transit:  '#57518C',  // provisional — validate in the Session 3 gallery
  car:      '#5A7082',
  stay:     '#465E7A',
  food:     '#B44F1E',
  bars:     '#8E4E2F',
  hike:     '#2F6B47',
  activity: '#7A4F82',
  sight:    '#8A5A2B',
  shopping: '#6B4A3A',
} as const;

// 4px base, with 11 for the one place the design insists on it.
export const Spacing = {
  xxs:  2,
  xs:   4,
  sm:   8,
  rowPad: 11,   // --row-pad      vertical padding inside a list row
  md:   12,
  base: 16,
  sectionGap: 18,
  lg:   20,
  xl:   24,
  xxl:  32,
  xxxl: 48,
} as const;

// 20px on every screen edge, no exceptions. Named separately from the scale because it is
// a rule, not a choice.
export const Gutter = 20;

export const Layout = {
  tapMin:          44,   // --tap-min           never smaller
  tabBarHeight:    84,   // --tabbar-h          includes the 24px home-indicator inset
  headerCollapsed: 96,   // --header-collapsed
  collapseRange:  140,   // --collapse-range    the one scroll value the whole app collapses on
} as const;

// Role-named, because the role is what stays consistent across screens — not the number.
export const Radius = {
  icon:   8,     // --radius-icon    small icon tiles inside rows
  tile:   12,    // --radius-tile    40-44px media thumbs
  row:    15,    // --radius-row     bordered rows and cards
  card:   18,    // --radius-card    lifted cards (stop rail)
  sheet:  24,    // --radius-sheet   bottom sheets, top corners only
  full:   9999,  // --radius-full
} as const;

// Typography — Fraunces (serif), DM Sans (sans), DM Mono (mono).
// Six static faces in assets/fonts/, loaded via expo-font in app/_layout.tsx.
//
// Weight is selected by FAMILY NAME, not by `fontWeight`. React Native cannot drive a
// variable font's `wght` axis and iOS synthesises nothing, so every weight is its own file
// under its own family. `fontWeight` is kept for react-native-web and accessibility
// tooling, but on device it selects nothing.
//
// Available faces: Fraunces 400 · DMSans 400/600/700 · DMMono 400/500. The design uses no
// italic and no bold serif, so neither is bundled — a role must resolve to a bundled face.
//
// Fraunces names things: never a label, never a button, never below 20px.
// DM Mono carries anything that lines up in a column — that column is why an itinerary
// reads as a timetable.
export const Typography = {
  family: {
    serif: 'Fraunces',
    sans:  'DMSans',
    mono:  'DMMono',
  },
  roles: {
    hero:      { fontSize: 34, lineHeight: 35, fontWeight: '400' as const, fontFamily: 'Fraunces', letterSpacing: -0.51 },
    display:   { fontSize: 31, lineHeight: 33, fontWeight: '400' as const, fontFamily: 'Fraunces' },
    title:     { fontSize: 24, lineHeight: 25, fontWeight: '400' as const, fontFamily: 'Fraunces' },

    screen:    { fontSize: 25,   lineHeight: 26, fontWeight: '700' as const, fontFamily: 'DMSans-Bold', letterSpacing: -0.7 },
    section:   { fontSize: 15,   lineHeight: 17, fontWeight: '700' as const, fontFamily: 'DMSans-Bold' },
    row:       { fontSize: 13.5, lineHeight: 17, fontWeight: '700' as const, fontFamily: 'DMSans-Bold', letterSpacing: -0.3 },
    body:      { fontSize: 13,   lineHeight: 21, fontWeight: '400' as const, fontFamily: 'DMSans' },
    sub:       { fontSize: 11,   lineHeight: 14, fontWeight: '400' as const, fontFamily: 'DMSans' },
    button:    { fontSize: 15,   lineHeight: 15, fontWeight: '600' as const, fontFamily: 'DMSans-SemiBold' },
    chip:      { fontSize: 12.5, lineHeight: 13, fontWeight: '600' as const, fontFamily: 'DMSans-SemiBold' },
    caps:      { fontSize: 10,   lineHeight: 10, fontWeight: '700' as const, fontFamily: 'DMSans-Bold', letterSpacing: 1.3, textTransform: 'uppercase' as const },

    data:      { fontSize: 11,   lineHeight: 11, fontWeight: '500' as const, fontFamily: 'DMMono-Medium' },
    dataSm:    { fontSize: 10.5, lineHeight: 11, fontWeight: '500' as const, fontFamily: 'DMMono-Medium' },
  },
} as const;

// A shadow lifts a card off photography, or a sheet off a screen. Nothing else gets one,
// and a card has a border or a shadow — never both.
export const Shadow = {
  none:  undefined,
  row:   { shadowColor: '#000', shadowOffset: { width: 0, height: 1  }, shadowOpacity: 0.10, shadowRadius: 3,  elevation: 1 },
  float: { shadowColor: '#000', shadowOffset: { width: 0, height: 4  }, shadowOpacity: 0.12, shadowRadius: 14, elevation: 4 },
  card:  { shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.12, shadowRadius: 30, elevation: 8 },
  sheet: { shadowColor: '#000', shadowOffset: { width: 0, height: -14 }, shadowOpacity: 0.28, shadowRadius: 44, elevation: 16 },
} as const;

export const Animation = {
  duration: {
    fast:   175,
    normal: 300,
    slow:   420,
    sheet:  460,
  },
  // Reanimated withSpring configs.
  springs: {
    gentle: { damping: 34, stiffness: 280 },  // chip selection, fades
    snappy: { damping: 44, stiffness: 400 },  // tab switch, toggle
    drag:   { damping: 50, stiffness: 460 },  // sheet detents, rail snap
  },
} as const;

// Press is opacity 0.85 plus a light haptic. Never a scale, never a colour change.
export const PRESSED_OPACITY = 0.85;
