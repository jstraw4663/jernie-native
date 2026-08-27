// Wizard progress (segments) or trip completeness (value). Disappears at 100% and never
// returns — the caller decides that; this only draws.
// Reference: .claude/skills/jernie-design/components/core/ProgressBar.{d.ts,jsx}
import { useState } from 'react';
import { type LayoutChangeEvent, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { Animation, Radius } from '@/src/design/tokens';
import { createThemedStyles } from '@/src/design/useTheme';

// `--ease-standard` from tokens/motion.css.
const EASE = Easing.bezier(0.2, 0.8, 0.2, 1);

export interface ProgressBarProps {
  /** 0-100, for a continuous bar. */
  value?: number;
  /** Discrete step segments, for the onboarding wizard. Wins over `value`. */
  segments?: { total: number; done: number };
  height?: number;
  testID?: string;
}

export function ProgressBar({ value = 0, segments, height = 5, testID }: ProgressBarProps) {
  const [s, t] = useStyles();
  const [trackWidth, setTrackWidth] = useState(0);

  if (segments) {
    return (
      <View
        testID={testID}
        style={s.segRow}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: segments.total, now: segments.done }}
      >
        {Array.from({ length: segments.total }).map((_, i) => (
          <View key={i} style={[s.segment, { backgroundColor: i < segments.done ? t.action : t.border }]} />
        ))}
      </View>
    );
  }

  const pct = Math.max(0, Math.min(100, value));
  // Animated in pixels off a measured track rather than as a percentage string — the
  // percentage form works, but only after Reanimated has resolved the parent's layout,
  // which shows as a visible jump on first paint.
  const fill = useAnimatedStyle(() => ({
    width: withTiming(trackWidth * (pct / 100), { duration: Animation.duration.normal, easing: EASE }),
  }));

  const onLayout = (e: LayoutChangeEvent) => setTrackWidth(e.nativeEvent.layout.width);

  return (
    <View
      testID={testID}
      onLayout={onLayout}
      style={[s.track, { height, borderRadius: height / 2 }]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }}
    >
      <Animated.View style={[s.fill, fill]} />
    </View>
  );
}

const useStyles = createThemedStyles((t) => ({
  segRow:  { flexDirection: 'row', gap: 5 },
  segment: { flex: 1, height: 4, borderRadius: 2 },

  track: { backgroundColor: t.surfaceMuted, overflow: 'hidden' },
  fill:  { height: '100%', backgroundColor: t.action, borderRadius: Radius.full },
}));
