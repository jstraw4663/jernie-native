import { View, Text, StyleSheet } from 'react-native';
import { Core, Semantic, Radius, Shadow, Spacing, Typography } from '@/src/design/tokens';
import type { CacheState } from '@/src/domain/profile';

export interface CacheRow {
  label: string;
  state: CacheState;
  detail: string;
}

interface CacheCardProps {
  rows: CacheRow[];
}

// Colour carries the same meaning in every row, so the mapping lives once rather than at
// each call site.
const STATE_COLOR: Record<CacheState, string> = {
  live: Semantic.success,
  connecting: Core.textMuted,
  cached: Semantic.confirmed,
  stale: Semantic.warning,
};

const STATE_LABEL: Record<CacheState, string> = {
  live: 'Live',
  connecting: 'Connecting',
  cached: 'Cached',
  stale: 'Stale',
};

export function CacheCard({ rows }: CacheCardProps) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Offline & cache</Text>
      <View style={[styles.card, Shadow.cardResting]}>
        {rows.map((row, i) => {
          const color = STATE_COLOR[row.state];
          return (
            <View key={row.label} style={[styles.row, i > 0 && styles.rowDivided]}>
              <View style={styles.labels}>
                <Text style={styles.label}>{row.label}</Text>
                <Text style={styles.detail} numberOfLines={1}>{row.detail}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: `${color}1F`, borderColor: `${color}55` }]}>
                <Text style={[styles.badgeText, { color }]}>{STATE_LABEL[row.state]}</Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.sm },
  title: { ...Typography.roles.labelCaps, color: Core.textMuted, paddingHorizontal: Spacing.xs },
  card: { backgroundColor: Core.surface, borderRadius: Radius.card, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.base,
  },
  rowDivided: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Core.border },
  labels: { flex: 1, gap: 1 },
  label: { ...Typography.roles.body, lineHeight: 20, color: Core.text },
  detail: { ...Typography.roles.meta, color: Core.textMuted },
  badge: { borderWidth: 1, borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  badgeText: { ...Typography.roles.labelCaps, fontSize: 10, letterSpacing: 0.8 },
});
