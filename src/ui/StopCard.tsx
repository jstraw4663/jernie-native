// One stop in the horizontal rail that sits on the home hero. Swipeable, and the only
// navigation between stops.
//
// The card is custom; the scroll is not. Session 4 puts these in a horizontal
// `Animated.ScrollView` snapping on `stopCardWidth(screen) + STOP_CARD_GAP` with
// `decelerationRate="fast"`. Dots below the rail are the only swipe hint; no arrows.
// Reference: .claude/skills/jernie-design/components/travel/StopCard.{d.ts,jsx}
import type { ReactNode } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import Animated, { interpolate, interpolateColor, useAnimatedStyle, useDerivedValue, withSpring } from 'react-native-reanimated';
import { Animation, PRESSED_OPACITY, Radius, Shadow, Spacing } from '@/src/design/tokens';
import { createThemedStyles } from '@/src/design/useTheme';
import { hexWithAlpha } from '@/src/utils/colors';

/**
 * The card is a share of the screen, not a fixed number.
 *
 * The canvas draws it 292 wide against a 390pt phone — 75% — and shipping that literal meant
 * it was 78% of an SE and 68% of a Max: the same card carrying visibly different weight
 * depending on the handset. Holding the proportion instead makes every device look like the
 * one the canvas was drawn on. 78% because that is where the narrowest phone already sat, so
 * nothing gets *narrower* than it is today.
 *
 * The clamp is for the ends: a tablet, where 78% of the screen is not a card, and anything
 * narrower than the design was ever drawn for.
 */
export const STOP_CARD_RATIO = 0.78;
const STOP_CARD_MIN = 260;
const STOP_CARD_MAX = 380;

export function stopCardWidth(screenWidth: number): number {
  return Math.round(Math.min(STOP_CARD_MAX, Math.max(STOP_CARD_MIN, screenWidth * STOP_CARD_RATIO)));
}

/** Between cards in the rail. The rail snaps on `stopCardWidth(screen) + this`. */
export const STOP_CARD_GAP = 10;

// Every number the card's own sheet lays out with, named once so a second component can
// reproduce the card exactly. `StopMorph` draws this card and then stretches it into the
// pinned header bar; the swap between the two at scroll zero is only invisible because
// both are laid out from these. Change one here and the morph moves with it — change one
// in the sheet below instead and the swap starts to flinch.
const BORDER = 1.5;
const PAD_V  = Spacing.md;
const PAD_H  = 13;
const THUMB  = 54;
const KICKER_LINE = 9.5;
const HEAD_GAP = 5;
/** marginTop + paddingTop + the hairline + one line of status. */
const FOOT_H = 10 + 9 + 1 + 11;

export const STOP_CARD_HEIGHT = BORDER * 2 + PAD_V * 2 + THUMB + FOOT_H;   // 112

// Width is absent on purpose: it depends on the screen, so anything reproducing the card
// calls `stopCardWidth()` with the same width the card itself measured.
export const STOP_CARD_METRICS = {
  height: STOP_CARD_HEIGHT,
  border: BORDER,
  padH: PAD_H,
  padV: PAD_V,
  /** Between the head and the thumb. */
  gap: Spacing.rowPad,
  thumb: THUMB,
  thumbRadius: 14,
  radius: Radius.card,
  /** Top of the name, from just inside the top border — the kicker sits above it. */
  headTop: PAD_V + KICKER_LINE + HEAD_GAP,
  /** Top of the status row, from just inside the top border. */
  footTop: PAD_V + THUMB + 10,
} as const;

const AnimatedText = Animated.createAnimatedComponent(Text);

export interface StopCardProps {
  name: string;
  dates: string;
  /** "Stop 2 of 3" */
  kicker: string;
  photo?: ReactNode;
  /** "Checked in", "Everything booked", "2 gaps to fix" */
  status: string;
  statusTone?: 'accent' | 'warning';
  /** "11 plans" */
  count?: string;
  active?: boolean;
  onPress?: () => void;
  testID?: string;
}

export function StopCard({
  name, dates, kicker, photo, status, statusTone = 'accent', count, active, onPress, testID,
}: StopCardProps) {
  const [s, t] = useStyles();
  const { width: screenWidth } = useWindowDimensions();
  // Inline rather than in the sheet: the sheet is created once per palette and cannot see a
  // screen width. Everything else about the card's geometry is static.
  const width = stopCardWidth(screenWidth);

  const toneColor = statusTone === 'warning' ? t.warning : t.action;
  // Resolved here, on the JS thread. `useAnimatedStyle`'s body is a worklet, and calling a
  // plain function like `hexWithAlpha` from the UI thread throws. It is constant per render
  // anyway, so the worklet closes over the finished string.
  const ringOff = hexWithAlpha(toneColor, 0);
  // No haptic here, unlike every other pressable primitive. Pressing a StopCard does not
  // *do* something — it selects, and the same selection also arrives by swiping the rail
  // and by tapping a dot. Whoever owns the selection fires the one buzz, or a tap gets two
  // and a swipe gets one. See src/ui/haptics.ts.
  const handlePress = onPress;

  // Becoming the selected stop is a state change, so it springs rather than cuts —
  // `spring-gentle`, the same one the Chip's selection uses. The rail's *scroll* is a
  // different feel entirely and uses `spring-drag`; see react-native-mapping.md.
  const p = useDerivedValue(() => withSpring(active ? 1 : 0, Animation.springs.gentle), [active]);

  // Four things carry the weight together: the ring arrives, the card comes back to full
  // opacity and full size, and it lifts further off the photo. Interpolating the ring from
  // its own colour at zero alpha keeps it from darkening through grey on the way in.
  const lift = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 1], [0.62, 1]),
    transform: [{ scale: interpolate(p.value, [0, 1], [0.955, 1]) }],
    borderColor: interpolateColor(p.value, [0, 1], [ringOff, toneColor]),
    shadowOpacity: interpolate(p.value, [0, 1], [0.05, 0.14]),
    shadowRadius: interpolate(p.value, [0, 1], [14, 30]),
    elevation: interpolate(p.value, [0, 1], [3, 9]),
  }));

  const kickerInk = useAnimatedStyle(() => ({
    color: interpolateColor(p.value, [0, 1], [t.textFaint, t.action]),
  }));

  return (
    <Pressable
      testID={testID}
      onPress={handlePress}
      disabled={!handlePress}
      accessibilityRole="button"
      accessibilityLabel={`${kicker}. ${name}. ${dates}. ${status}`}
      accessibilityState={{ selected: !!active }}
      style={({ pressed }) => pressed && handlePress ? s.pressed : undefined}
    >
      <Animated.View style={[s.card, { width }, lift]}>
        <View style={s.top}>
          <View style={s.head}>
            <AnimatedText style={[s.kicker, kickerInk]} numberOfLines={1}>{kicker}</AnimatedText>
            <Text style={s.name} numberOfLines={1}>{name}</Text>
            <Text style={s.dates} numberOfLines={1}>{dates}</Text>
          </View>
          {photo ? <View style={s.photo}>{photo}</View> : null}
        </View>

        <View style={s.foot}>
          <Text style={[s.status, { color: toneColor }]} numberOfLines={1}>{status}</Text>
          {count ? <Text style={s.count} numberOfLines={1}>{count}</Text> : null}
        </View>
      </Animated.View>
    </Pressable>
  );
}

const useStyles = createThemedStyles((t) => ({
  card: {
    flexShrink: 0,
    backgroundColor: t.surface,
    borderRadius: Radius.card,
    borderWidth: BORDER,
    paddingVertical: PAD_V,
    paddingHorizontal: PAD_H,
    // Colour and offset only — opacity, radius and elevation are animated above, so the
    // card lifts further off the photo as it becomes the selected one.
    shadowColor: Shadow.card.shadowColor,
    shadowOffset: Shadow.card.shadowOffset,
  },
  top:  { flexDirection: 'row', gap: Spacing.rowPad },
  head: { flex: 1, minWidth: 0, gap: HEAD_GAP },

  kicker: { fontSize: 9.5,  lineHeight: KICKER_LINE, fontFamily: 'DMSans-Bold',     fontWeight: '700' as const, letterSpacing: 1.14, textTransform: 'uppercase' as const },
  name:   { fontSize: 16,   lineHeight: 17.6, fontFamily: 'DMSans-Bold',    fontWeight: '700' as const, letterSpacing: -0.35, color: t.text },
  dates:  { fontSize: 11.5, lineHeight: 11.5, fontFamily: 'DMSans',         fontWeight: '400' as const, color: t.textMuted },

  photo: { width: THUMB, height: THUMB, borderRadius: 14, overflow: 'hidden', flexShrink: 0 },

  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingTop: 9,
    borderTopWidth: 1,
    borderTopColor: t.borderSoft,
  },
  status: { fontSize: 11,   lineHeight: 11, fontFamily: 'DMSans-SemiBold', fontWeight: '600' as const },
  count:  { fontSize: 10.5, lineHeight: 10.5, fontFamily: 'DMSans',        fontWeight: '400' as const, color: t.textFaint, marginLeft: 'auto' },

  pressed: { opacity: PRESSED_OPACITY },
}));
