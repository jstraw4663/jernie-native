// Filter bubble, vibe pill, or day selector. Selection applies immediately — a chip row
// behind an Apply button is a filter sheet, not a chip row.
// Reference: .claude/skills/jernie-design/components/core/Chip.{d.ts,jsx}
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useDerivedValue, withSpring } from 'react-native-reanimated';
import { Animation, PRESSED_OPACITY, Radius, Spacing, Typography } from '@/src/design/tokens';
import { createThemedStyles } from '@/src/design/useTheme';
import { tap } from './haptics';

const AnimatedText = Animated.createAnimatedComponent(Text);

export type ChipVariant = 'filter' | 'solid' | 'dropdown';

export interface ChipProps {
  label: string;
  icon?: ReactNode;
  selected?: boolean;
  /** `filter` outlined · `solid` grey fill · `dropdown` adds a caret. */
  variant?: ChipVariant;
  onPress?: () => void;
  testID?: string;
}

export function Chip({ label, icon, selected = false, variant = 'filter', onPress, testID }: ChipProps) {
  const [s, t] = useStyles();

  // Selection springs rather than cuts — `spring-gentle`, per react-native-mapping.md.
  // One progress value drives fill, border and label together so they can never disagree
  // mid-flight. `interpolateColor` clamps, so the spring's overshoot past 1 is harmless.
  const p = useDerivedValue(() => withSpring(selected ? 1 : 0, Animation.springs.gentle), [selected]);

  const restingBg = variant === 'solid' ? t.surfaceMuted : 'transparent';
  const box = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(p.value, [0, 1], [restingBg, t.action]),
    borderColor:     interpolateColor(p.value, [0, 1], [t.border, t.action]),
  }));
  const ink = useAnimatedStyle(() => ({
    color: interpolateColor(p.value, [0, 1], [t.text, t.textInverse]),
  }));

  const handlePress = onPress ? () => { tap(); onPress(); } : undefined;

  return (
    <Pressable
      testID={testID}
      onPress={handlePress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={({ pressed }) => pressed && onPress ? s.pressed : undefined}
    >
      <Animated.View style={[s.chip, box]}>
        {icon ? <View style={s.slot}>{icon}</View> : null}
        <AnimatedText style={[s.label, ink]} numberOfLines={1}>{label}</AnimatedText>
        {variant === 'dropdown' ? <Text style={s.caret}>▾</Text> : null}
      </Animated.View>
    </Pressable>
  );
}

const useStyles = createThemedStyles((t) => ({
  chip: {
    height: 34,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  label: { ...Typography.roles.chip },
  // The caret is a character, not an icon — the same call the icon sweep made for arrows
  // and rating stars. It does not take the selected colour in the reference, nor here.
  caret: { fontSize: 10, color: t.textMuted, fontFamily: Typography.family.sans },
  slot: { alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: PRESSED_OPACITY },
}));
