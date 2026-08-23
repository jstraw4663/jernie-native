// An empty state that is also an action. The first-run home is built from these — never
// render an illustration-and-caption empty state where a prompt row would do.
// Order them by what generates gaps: stay, then transport, then everything else.
// Reference: .claude/skills/jernie-design/components/travel/PromptRow.{d.ts,jsx}
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { PRESSED_OPACITY, Radius, Spacing, Typography } from '@/src/design/tokens';
import { createThemedStyles } from '@/src/design/useTheme';
import { tap } from './haptics';

export interface PromptRowProps {
  title: string;
  sub: string;
  /** "Add", "Paste", "Invite". */
  action?: string;
  icon?: ReactNode;
  /** Amber treatment — this one blocks a real requirement. */
  urgent?: boolean;
  onPress?: () => void;
  testID?: string;
}

export function PromptRow({ title, sub, action, icon, urgent, onPress, testID }: PromptRowProps) {
  const [s, t] = useStyles();
  const handlePress = onPress ? () => { tap(); onPress(); } : undefined;

  return (
    <Pressable
      testID={testID}
      onPress={handlePress}
      disabled={!handlePress}
      accessibilityRole={handlePress ? 'button' : undefined}
      accessibilityLabel={`${title}. ${sub}`}
      style={({ pressed }) => [s.row, urgent ? s.rowUrgent : s.rowPlain, pressed && handlePress && s.pressed]}
    >
      <View style={[s.tile, { backgroundColor: urgent ? t.warningSoft : t.surfaceMuted }]}>{icon}</View>

      <View style={s.body}>
        <Text style={s.title} numberOfLines={2}>{title}</Text>
        <Text style={[s.sub, { color: urgent ? t.warning : t.textMuted }]} numberOfLines={2}>{sub}</Text>
      </View>

      {action ? (
        <View style={s.pill}><Text style={s.pillTxt} numberOfLines={1}>{action}</Text></View>
      ) : null}
    </Pressable>
  );
}

const useStyles = createThemedStyles((t) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.rowPad,
    paddingHorizontal: Spacing.md,
    borderWidth: 1.5,
    // See GapRow: Android squares off dashes above radius 15.
    borderStyle: 'dashed' as const,
    borderRadius: Radius.row,
  },
  rowUrgent: { borderColor: t.warningLine, backgroundColor: t.warningSoft },
  rowPlain:  { borderColor: t.border },

  tile: {
    width: 40, height: 40,
    borderRadius: Radius.tile,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },

  body:  { flex: 1, minWidth: 0 },
  title: { ...Typography.roles.row, color: t.text },
  sub:   { ...Typography.roles.sub, marginTop: 3 },

  // The whole row is the press target, so the pill is a View — a nested Pressable here
  // would create two hit areas for one action.
  pill:    { height: 28, paddingHorizontal: 11, borderRadius: 14, backgroundColor: t.text, justifyContent: 'center', flexShrink: 0 },
  pillTxt: { fontSize: 11, lineHeight: 11, fontFamily: 'DMSans-Bold', fontWeight: '700' as const, color: t.surface },
  pressed: { opacity: PRESSED_OPACITY },
}));
