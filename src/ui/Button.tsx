// The one action on a screen, or the one action in a sheet.
// Reference: .claude/skills/jernie-design/components/core/Button.{d.ts,jsx}
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { PRESSED_OPACITY, Radius, Spacing, Typography } from '@/src/design/tokens';
import { createThemedStyles } from '@/src/design/useTheme';
import { tap } from './haptics';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'accent' | 'dark';
export type ButtonSize = 'lg' | 'md' | 'sm';

export interface ButtonProps {
  label: string;
  /** `primary` is the screen's single commit action. `dark` is Apple sign-in only. */
  variant?: ButtonVariant;
  /** `lg` 52px for footers · `md` 44px inline · `sm` 30px inside a row. */
  size?: ButtonSize;
  icon?: ReactNode;
  iconRight?: ReactNode;
  disabled?: boolean;
  /** Stretches to the container. Ignored at `sm`, which is always hug-width. */
  full?: boolean;
  onPress?: () => void;
  testID?: string;
}

export function Button({
  label, variant = 'primary', size = 'lg', icon, iconRight, disabled, full = true, onPress, testID,
}: ButtonProps) {
  const [s, t] = useStyles();

  // Foreground for `accent`: white in light, near-black in dark. The reference hard-codes
  // #fff, which is right on #0F7B6C but unreadable on the dark palette's #5CCBB4 mint.
  // `textInverse` IS #FFFFFF in light, so the light rendering is unchanged.
  const skin = {
    primary:   { bg: t.text,      fg: t.surface, border: 'transparent' },
    secondary: { bg: t.surface,   fg: t.text,    border: t.border },
    ghost:     { bg: 'transparent', fg: t.textMuted, border: 'transparent' },
    accent:    { bg: t.action,    fg: t.textInverse, border: 'transparent' },
    dark:      { bg: '#000',      fg: '#FFF',    border: 'transparent' },
  }[variant];

  const handlePress = onPress
    ? () => { tap(); onPress(); }
    : undefined;

  return (
    <Pressable
      testID={testID}
      onPress={handlePress}
      disabled={disabled || !onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        s.base,
        s[size],
        size !== 'sm' && (full ? s.full : s.hug),
        { backgroundColor: skin.bg, borderColor: skin.border },
        disabled && s.disabled,
        pressed && !disabled && s.pressed,
      ]}
    >
      {icon ? <View style={s.slot}>{icon}</View> : null}
      <Text style={[size === 'sm' ? s.labelSm : s.label, { color: skin.fg }]} numberOfLines={1}>
        {label}
      </Text>
      {iconRight ? <View style={s.slot}>{iconRight}</View> : null}
    </Pressable>
  );
}

const useStyles = createThemedStyles(() => ({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    // 1.5 on every variant, transparent where the design shows no border, so switching
    // variant never shifts the button by the border's width.
    borderWidth: 1.5,
  },
  lg: { height: 52, borderRadius: Radius.row,  paddingHorizontal: 18 },
  md: { height: 44, borderRadius: Radius.tile, paddingHorizontal: 18 },
  sm: { height: 30, borderRadius: Radius.full, paddingHorizontal: 13, alignSelf: 'flex-start' },

  full: { alignSelf: 'stretch' },
  hug:  { alignSelf: 'flex-start' },

  label:   { ...Typography.roles.button },
  labelSm: { fontSize: 11.5, lineHeight: 11.5, fontFamily: 'DMSans-Bold', fontWeight: '700' as const },

  disabled: { opacity: 0.5 },
  pressed:  { opacity: PRESSED_OPACITY },

  slot: { alignItems: 'center', justifyContent: 'center' },
}));
