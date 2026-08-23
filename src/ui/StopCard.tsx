// One stop in the horizontal rail that sits on the home hero. Swipeable, and the only
// navigation between stops.
//
// The card is custom; the scroll is not. Session 4 puts these in a horizontal
// `Animated.ScrollView` with `snapToInterval={302}` — 292 wide plus a 10px gap — and
// `decelerationRate="fast"`. Dots below the rail are the only swipe hint; no arrows.
// Reference: .claude/skills/jernie-design/components/travel/StopCard.{d.ts,jsx}
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { interpolate, interpolateColor, useAnimatedStyle, useDerivedValue, withSpring } from 'react-native-reanimated';
import { Animation, PRESSED_OPACITY, Radius, Shadow, Spacing } from '@/src/design/tokens';
import { createThemedStyles } from '@/src/design/useTheme';
import { hexWithAlpha } from '@/src/utils/colors';
import { tap } from './haptics';

export const STOP_CARD_WIDTH = 292;

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

  const toneColor = statusTone === 'warning' ? t.warning : t.action;
  // Resolved here, on the JS thread. `useAnimatedStyle`'s body is a worklet, and calling a
  // plain function like `hexWithAlpha` from the UI thread throws. It is constant per render
  // anyway, so the worklet closes over the finished string.
  const ringOff = hexWithAlpha(toneColor, 0);
  const handlePress = onPress ? () => { tap(); onPress(); } : undefined;

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
      <Animated.View style={[s.card, lift]}>
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
    width: STOP_CARD_WIDTH,
    flexShrink: 0,
    backgroundColor: t.surface,
    borderRadius: Radius.card,
    borderWidth: 1.5,
    paddingVertical: Spacing.md,
    paddingHorizontal: 13,
    // Colour and offset only — opacity, radius and elevation are animated above, so the
    // card lifts further off the photo as it becomes the selected one.
    shadowColor: Shadow.card.shadowColor,
    shadowOffset: Shadow.card.shadowOffset,
  },
  top:  { flexDirection: 'row', gap: Spacing.rowPad },
  head: { flex: 1, minWidth: 0, gap: 5 },

  kicker: { fontSize: 9.5,  lineHeight: 9.5, fontFamily: 'DMSans-Bold',     fontWeight: '700' as const, letterSpacing: 1.14, textTransform: 'uppercase' as const },
  name:   { fontSize: 16,   lineHeight: 17.6, fontFamily: 'DMSans-Bold',    fontWeight: '700' as const, letterSpacing: -0.35, color: t.text },
  dates:  { fontSize: 11.5, lineHeight: 11.5, fontFamily: 'DMSans',         fontWeight: '400' as const, color: t.textMuted },

  photo: { width: 54, height: 54, borderRadius: 14, overflow: 'hidden', flexShrink: 0 },

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
