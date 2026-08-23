// The workhorse. Every list in the app is this row: an optional lead column, a 44px media
// square, a title, a subline that carries status, and one trailing element.
// Reference: .claude/skills/jernie-design/components/core/ListRow.{d.ts,jsx}
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { PRESSED_OPACITY, Radius, Spacing, Typography } from '@/src/design/tokens';
import { createThemedStyles } from '@/src/design/useTheme';

export type ListRowTone = 'default' | 'accent' | 'plain';
export type ListRowSubTone = 'default' | 'accent' | 'warning';

export interface ListRowProps {
  title: string;
  sub?: string;
  /** 44x44 image or icon tile. */
  media?: ReactNode;
  /** Left-most column, usually a mono time stack. */
  lead?: ReactNode;
  /** Caret, badge, or a `sm` Button. */
  trailing?: ReactNode;
  bordered?: boolean;
  /** `default` outlined card · `accent` current/secured · `plain` divider-separated item. */
  tone?: ListRowTone;
  subTone?: ListRowSubTone;
  onPress?: () => void;
  testID?: string;
}

export function ListRow({
  title, sub, media, lead, trailing, bordered = true, tone = 'default', subTone = 'default', onPress, testID,
}: ListRowProps) {
  const [s, t] = useStyles();

  const subColor = subTone === 'accent' ? t.action : subTone === 'warning' ? t.warning : t.textMuted;

  // No haptic: a list row navigates. Committing presses inside it (a trailing Button)
  // fire their own. See src/ui/haptics.ts.
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={sub ? `${title}. ${sub}` : title}
      style={({ pressed }) => [
        s.row,
        tone === 'plain' ? s.rowPlain : s.rowPadded,
        bordered && (tone === 'accent' ? s.accent : tone === 'plain' ? s.plain : s.default),
        pressed && onPress && s.pressed,
      ]}
    >
      {lead}
      {media}
      <View style={s.body}>
        <Text style={s.title} numberOfLines={1}>{title}</Text>
        {sub ? <Text style={[s.sub, { color: subColor }]} numberOfLines={2}>{sub}</Text> : null}
      </View>
      {trailing}
    </Pressable>
  );
}

const useStyles = createThemedStyles((t) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.rowPad },
  rowPadded: { paddingVertical: 10, paddingHorizontal: Spacing.md, borderRadius: Radius.row },
  rowPlain:  { paddingVertical: 10 },

  default: { borderWidth: 1,   borderColor: t.border },
  accent:  { borderWidth: 1.5, borderColor: t.actionLine, backgroundColor: t.actionSoft },
  plain:   { borderTopWidth: 1, borderTopColor: t.borderSoft },

  body:  { flex: 1, minWidth: 0 },
  title: { ...Typography.roles.row, color: t.text },
  sub:   { ...Typography.roles.sub, marginTop: 2 },

  pressed: { opacity: PRESSED_OPACITY },
}));
