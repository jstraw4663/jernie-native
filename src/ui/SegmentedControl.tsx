// Two to four mutually exclusive lenses on the same data (Agenda's by type / by day /
// by stop). If the options load *different* data, they are tabs, not segments.
//
// Custom by decision, not by omission: `@react-native-segmented-control` is iOS-only and
// renders the platform control, which will not take these tokens. See
// reference/custom-components.md.
// Reference: .claude/skills/jernie-design/components/core/SegmentedControl.{d.ts,jsx}
import type { ReactNode } from 'react';
import { useState } from 'react';
import { type LayoutChangeEvent, Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { Animation, Radius, Shadow, Typography } from '@/src/design/tokens';
import { createThemedStyles } from '@/src/design/useTheme';
import { tap } from './haptics';

const PAD = 3;   // inset of the track around the pill
const GAP = 1;   // between segments

export interface SegmentedOption { value: string; label: string; icon?: ReactNode }

export interface SegmentedControlProps {
  options: SegmentedOption[];
  value: string;
  onChange?: (value: string) => void;
  size?: 'sm' | 'md';
  testID?: string;
}

export function SegmentedControl({ options, value, onChange, size = 'md', testID }: SegmentedControlProps) {
  const [s, t] = useStyles();
  const [trackWidth, setTrackWidth] = useState(0);

  const h = size === 'sm' ? 28 : 38;
  const n = Math.max(options.length, 1);
  const segW = trackWidth > 0 ? (trackWidth - PAD * 2 - GAP * (n - 1)) / n : 0;
  const index = Math.max(options.findIndex(o => o.value === value), 0);

  // The pill slides; the labels do not animate. `spring-snappy` — this is the tab-switch
  // spring, per react-native-mapping.md.
  const pill = useAnimatedStyle(() => ({
    width: segW,
    transform: [{ translateX: withSpring(PAD + index * (segW + GAP), Animation.springs.snappy) }],
  }));

  const onLayout = (e: LayoutChangeEvent) => setTrackWidth(e.nativeEvent.layout.width);

  return (
    <View testID={testID} style={[s.track, { height: h }]} onLayout={onLayout}>
      {segW > 0 ? <Animated.View style={[s.pill, { height: h - PAD * 2 }, pill]} /> : null}

      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => { if (!on) { tap(); onChange?.(o.value); } }}
            accessibilityRole="tab"
            accessibilityLabel={o.label}
            accessibilityState={{ selected: on }}
            style={[s.segment, { height: h - PAD * 2 }]}
          >
            {o.icon}
            <Text style={[s.label, { color: on ? t.text : t.textMuted }]} numberOfLines={1}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = createThemedStyles((t) => ({
  track: {
    borderRadius: Radius.tile,
    backgroundColor: t.surfaceMuted,
    flexDirection: 'row',
    alignItems: 'center',
    padding: PAD,
    gap: GAP,
  },
  // Absolutely positioned so it can slide behind the labels. The active pill is the only
  // place `Shadow.row` appears on a flat surface.
  pill: {
    position: 'absolute',
    left: 0,
    top: PAD,
    borderRadius: 10,
    backgroundColor: t.surface,
    ...Shadow.row,
  },
  segment: {
    flex: 1,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  label: { ...Typography.roles.chip },
}));
