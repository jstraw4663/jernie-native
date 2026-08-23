// Counts that stand as a record of travel — the Profile passport header. Three or four,
// never more. A new user sees zeros, so that state is designed alongside this (Session 9).
// Reference: .claude/skills/jernie-design/components/travel/StatStrip.{d.ts,jsx}
import { Text, View } from 'react-native';
import { Core } from '@/src/design/tokens';
import { createThemedStyles } from '@/src/design/useTheme';

export interface Stat { value: string; label: string }

export interface StatStripProps {
  stats: Stat[];
  /** True when sitting on a photo scrim — white is white in both themes. */
  onPhoto?: boolean;
  testID?: string;
}

export function StatStrip({ stats, onPhoto, testID }: StatStripProps) {
  const [s, t] = useStyles();

  return (
    <View testID={testID} style={s.row}>
      {stats.map((stat) => (
        <View key={stat.label}>
          <Text style={[s.value, { color: onPhoto ? Core.onPhoto : t.text }]} numberOfLines={1}>{stat.value}</Text>
          <Text style={[s.label, { color: onPhoto ? Core.onPhoto2 : t.textFaint }]} numberOfLines={1}>{stat.label}</Text>
        </View>
      ))}
    </View>
  );
}

const useStyles = createThemedStyles(() => ({
  row:   { flexDirection: 'row', gap: 22 },
  value: { fontSize: 21,  lineHeight: 21,  fontFamily: 'DMSans-Bold',     fontWeight: '700' as const, letterSpacing: -0.5 },
  label: { fontSize: 9.5, lineHeight: 9.5, fontFamily: 'DMSans-SemiBold', fontWeight: '600' as const, letterSpacing: 1.045, textTransform: 'uppercase' as const, marginTop: 5 },
}));
