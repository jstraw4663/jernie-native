// One stop in the horizontal rail that sits on the home hero. Swipeable, and the only
// navigation between stops.
//
// The card is custom; the scroll is not. Session 4 puts these in a horizontal
// `Animated.ScrollView` with `snapToInterval={302}` — 292 wide plus a 10px gap — and
// `decelerationRate="fast"`. Dots below the rail are the only swipe hint; no arrows.
// Reference: .claude/skills/jernie-design/components/travel/StopCard.{d.ts,jsx}
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { PRESSED_OPACITY, Radius, Shadow, Spacing } from '@/src/design/tokens';
import { createThemedStyles } from '@/src/design/useTheme';
import { tap } from './haptics';

export const STOP_CARD_WIDTH = 292;

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
  const handlePress = onPress ? () => { tap(); onPress(); } : undefined;

  return (
    <Pressable
      testID={testID}
      onPress={handlePress}
      disabled={!handlePress}
      accessibilityRole="button"
      accessibilityLabel={`${kicker}. ${name}. ${dates}. ${status}`}
      accessibilityState={{ selected: !!active }}
      style={({ pressed }) => [
        s.card,
        // A ring, not a shadow change — selection never alters elevation. This is the one
        // place the system pairs a border with a shadow, and the reference does the same.
        { borderColor: active ? toneColor : 'transparent', opacity: active ? 1 : 0.62 },
        pressed && handlePress && s.pressed,
      ]}
    >
      <View style={s.top}>
        <View style={s.head}>
          <Text style={[s.kicker, { color: active ? t.action : t.textFaint }]} numberOfLines={1}>{kicker}</Text>
          <Text style={s.name} numberOfLines={1}>{name}</Text>
          <Text style={s.dates} numberOfLines={1}>{dates}</Text>
        </View>
        {photo ? <View style={s.photo}>{photo}</View> : null}
      </View>

      <View style={s.foot}>
        <Text style={[s.status, { color: toneColor }]} numberOfLines={1}>{status}</Text>
        {count ? <Text style={s.count} numberOfLines={1}>{count}</Text> : null}
      </View>
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
    ...Shadow.card,
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
