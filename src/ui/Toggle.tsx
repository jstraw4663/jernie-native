// A single on/off preference. Applies immediately — no Save button anywhere near it.
//
// Custom by decision: RN's `Switch` renders the platform control and will not take these
// colours. See reference/custom-components.md.
// Reference: .claude/skills/jernie-design/components/core/Toggle.{d.ts,jsx}
import { Pressable } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useDerivedValue, withSpring } from 'react-native-reanimated';
import { Animation, Core, Shadow } from '@/src/design/tokens';
import { createThemedStyles } from '@/src/design/useTheme';
import { tap } from './haptics';

const W = 44, H = 26, PAD = 2, KNOB = 22;
const TRAVEL = W - PAD * 2 - KNOB;   // 18

export interface ToggleProps {
  on?: boolean;
  onChange?: (on: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  testID?: string;
}

export function Toggle({ on = false, onChange, disabled, accessibilityLabel, testID }: ToggleProps) {
  const [s, t] = useStyles();

  // `spring-snappy` — the toggle spring, per react-native-mapping.md.
  const p = useDerivedValue(() => withSpring(on ? 1 : 0, Animation.springs.snappy), [on]);

  const track = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(p.value, [0, 1], [t.border, t.action]),
  }));
  const knob = useAnimatedStyle(() => ({
    transform: [{ translateX: p.value * TRAVEL }],
  }));

  return (
    <Pressable
      testID={testID}
      onPress={() => { tap(); onChange?.(!on); }}
      disabled={disabled || !onChange}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: on, disabled: !!disabled }}
      // The control is 26px tall; the design's floor for a tap target is 44px.
      hitSlop={{ top: 9, bottom: 9, left: 0, right: 0 }}
      style={disabled ? s.disabled : undefined}
    >
      <Animated.View style={[s.track, track]}>
        <Animated.View style={[s.knob, knob]} />
      </Animated.View>
    </Pressable>
  );
}

const useStyles = createThemedStyles(() => ({
  track: { width: W, height: H, borderRadius: H / 2, padding: PAD, justifyContent: 'center' },
  // White in both themes: the knob reads against teal and against mint alike, and against
  // the resting grey it is the shadow that separates it, not the fill.
  knob:  { width: KNOB, height: KNOB, borderRadius: KNOB / 2, backgroundColor: Core.white, ...Shadow.row },
  disabled: { opacity: 0.5 },
}));
