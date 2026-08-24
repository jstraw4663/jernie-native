// The two pieces of drawing more than one block needs. Not blocks themselves — a block is
// something a type can list; these are what several of them are made of.
import { Text, View } from 'react-native';
import { Spacing, Typography } from '@/src/design/tokens';
import { createThemedStyles } from '@/src/design/useTheme';
import type { InfoRow } from './types';

/**
 * A block's heading.
 *
 * The canvas draws its first four blocks — stats, description, tags, location — with no
 * heading at all, and they read fine: a paragraph is obviously a description and a row of
 * chips is obviously tags. The list-shaped blocks are not self-evident in the same way, so
 * those carry one. That split is a judgement call the canvas does not make for us, since it
 * only ever drew the Restaurant type down to Location.
 */
export function BlockTitle({ children }: { children: string }) {
  const [s] = useStyles();
  return <Text style={s.title}>{children}</Text>;
}

/**
 * Label-value rows on a fixed 92px label column.
 *
 * **Custom by decision.** `ListRow` is the closest primitive and the wrong shape: it is
 * media + title + subline + trailing, where this is a two-column grid whose labels have to
 * align down the whole block. Nothing in `react-native-mapping.md` covers a definition list.
 * See reference/custom-components.md.
 */
export function InfoList({ rows, testID }: { rows: readonly InfoRow[]; testID?: string }) {
  const [s, t] = useStyles();

  return (
    <View testID={testID} style={s.list}>
      {rows.map((row, i) => (
        <View key={row.label} style={[s.row, i > 0 && s.divided]}>
          <Text style={s.label} numberOfLines={1}>{row.label}</Text>
          <Text
            style={[
              s.value,
              row.tone === 'mono' && s.mono,
              row.tone === 'accent' && { color: t.action },
              row.tone === 'warning' && { color: t.warning },
            ]}
          >
            {row.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

const useStyles = createThemedStyles((t) => ({
  title: { ...Typography.roles.caps, color: t.textFaint, marginBottom: Spacing.sm },

  list:    { borderWidth: 1, borderColor: t.border, borderRadius: 14, overflow: 'hidden' },
  row:     { flexDirection: 'row', gap: Spacing.md, paddingHorizontal: Spacing.md, paddingVertical: 10 },
  divided: { borderTopWidth: 1, borderTopColor: t.borderSoft },

  label: { width: 92, fontSize: 12, lineHeight: 17, fontFamily: 'DMSans-SemiBold', fontWeight: '600' as const, color: t.textMuted },
  value: { flex: 1, fontSize: 12.5, lineHeight: 17, fontFamily: 'DMSans', color: t.text },
  // Codes and times sit in the same column on consecutive rows; mono is what makes that a
  // column rather than three strings that happen to be near each other.
  mono:  { fontFamily: 'DMMono-Medium', fontWeight: '500' as const, fontSize: 12 },
}));
