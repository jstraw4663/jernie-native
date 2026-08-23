// The only swipe hint the stop rail gets — no arrows.
//
// Lives on its own because two layers draw it: the rail at rest, and the bar the active
// card becomes. Both are the same control on the same index, so they are the same code.
import { Pressable, View } from 'react-native';
import { createThemedStyles } from '@/src/design/useTheme';

/** Widths the row is built from, so a layer that has to leave room for it can. */
const DOT = 5;
const DOT_ACTIVE = 16;
const DOT_GAP = 4;

/** How wide the row will be for `count` dots — the bar reserves this before it exists. */
export function dotsWidth(count: number): number {
  return count < 1 ? 0 : DOT_ACTIVE + (count - 1) * (DOT + DOT_GAP);
}

export interface StopDotsProps {
  count: number;
  index: number;
  onPress: (i: number) => void;
  tint: string;
  idle: string;
}

/**
 * The active dot widens to 16 rather than growing, so the row's height never shifts — which
 * is what lets the bar stay exactly 62 tall through a stop change.
 */
export function StopDots({ count, index, onPress, tint, idle }: StopDotsProps) {
  const [s] = useStyles();
  return (
    <View style={s.dots}>
      {Array.from({ length: count }).map((_, i) => (
        <Pressable
          key={i}
          onPress={() => onPress(i)}
          accessibilityRole="button"
          accessibilityLabel={`Stop ${i + 1} of ${count}`}
          accessibilityState={{ selected: i === index }}
          // The dot is 5px; the tap target has to be 44. Generous slop rather than a bigger
          // dot, because the row's height is what keeps the pinned bar at 62.
          hitSlop={{ top: 19, bottom: 19, left: 6, right: 6 }}
          style={[s.dot, { width: i === index ? DOT_ACTIVE : DOT, backgroundColor: i === index ? tint : idle }]}
        />
      ))}
    </View>
  );
}

const useStyles = createThemedStyles(() => ({
  dots: { flexDirection: 'row', gap: DOT_GAP, flexShrink: 0 },
  dot: { height: DOT, borderRadius: 3 },
}));
