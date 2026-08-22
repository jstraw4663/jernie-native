import { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Animation, Core, Radius, Semantic, Spacing, Typography } from '@/src/design/tokens';
import { getBuildInfo, MILESTONE } from '@/src/version';
import { formatCacheAge } from '@/src/utils/cacheAge';
import { getQueue, flush, subscribe } from '@/src/lib/writeQueue';
import { getDevNowOverride, setDevNowOverride, clearDevNowOverride } from '@/src/utils/devTime';
import type { Place, PlaceEnrichment, WriteQueueEntry } from '@/src/types';

declare const __DEV__: boolean;

interface AdminPanelProps {
  visible: boolean;
  onClose: () => void;
  cachedAt: number | null;
  fromCache: boolean;
  places: Place[];
  enrichment: Record<string, PlaceEnrichment>;
}

/**
 * Hidden diagnostics, opened by five taps on the Profile tab icon.
 *
 * Every card here reflects something the app genuinely does. The migration spec also asks for
 * a filterable realtime API call console; that needs request instrumentation around
 * enrichmentClient/geocodeClient which does not exist, and the queue and cache cards already
 * answer the question it was meant to answer.
 */
export function AdminPanel({ visible, onClose, cachedAt, fromCache, places, enrichment }: AdminPanelProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  // Translated by a measured width rather than a '100%' string: percentage transforms are a
  // recent and uneven RN feature, and a silently-ignored one would leave the panel covering
  // the screen permanently.
  const offset = useSharedValue(width);
  const [queue, setQueue] = useState<WriteQueueEntry[]>(() => getQueue());
  const [warpInput, setWarpInput] = useState(() => getDevNowOverride() ?? '');
  const [warpError, setWarpError] = useState<string | null>(null);

  useEffect(() => {
    offset.value = withSpring(visible ? 0 : width, Animation.springs.snappy);
  }, [visible, width, offset]);

  useEffect(() => {
    if (!visible) return;
    setQueue(getQueue());
    return subscribe(() => setQueue(getQueue()));
  }, [visible]);

  const slide = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value }],
  }));

  const build = getBuildInfo();
  const withCoords = places.filter(p => p.lat != null && p.lon != null).length;
  const enriched = Object.keys(enrichment).length;

  return (
    <Animated.View
      testID="admin-panel"
      pointerEvents={visible ? 'auto' : 'none'}
      style={[styles.panel, { paddingTop: insets.top + Spacing.sm }, slide]}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Admin</Text>
        <Pressable testID="admin-close" onPress={onClose} hitSlop={12}>
          <Text style={styles.close}>Close</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Card title="Build">
          <Row label="Milestone" value={MILESTONE} />
          <Row label="Branch" value={build.gitBranch} />
          <Row label="Commit" value={`${build.gitSha}${build.gitDirty ? ' (dirty)' : ''}`} />
          <Row label="Built" value={build.builtAt} />
        </Card>

        <Card title="Trip snapshot">
          <Row label="Source" value={fromCache ? 'MMKV cache' : 'RTDB (live)'} />
          <Row label="Written" value={cachedAt === null ? 'unknown' : formatCacheAge(cachedAt)} />
        </Card>

        <Card title="Enrichment coverage">
          {/* Places without coordinates can never resolve an enrichment key at all — see
              known-issues.md. This is the number that explains a missing enrichment section. */}
          <Row label="Places" value={String(places.length)} />
          <Row label="With coords" value={`${withCoords} of ${places.length}`} />
          <Row label="Enriched" value={String(enriched)} />
        </Card>

        <Card
          title={`Write queue (${queue.length})`}
          action={queue.length > 0 ? { label: 'Flush', onPress: () => flush() } : undefined}
        >
          {queue.length === 0
            ? <Text style={styles.empty}>Empty — everything is synced.</Text>
            : queue.slice(0, 12).map((entry, i) => (
                <Text key={`${entry.path}-${i}`} style={styles.queuePath} numberOfLines={1}>{entry.path}</Text>
              ))}
        </Card>

        {__DEV__ && (
          <Card
            title="Time warp"
            action={getDevNowOverride()
              ? { label: 'Clear', onPress: () => { clearDevNowOverride(); setWarpInput(''); } }
              : undefined}
          >
            {/* The first UI for devTime.ts, which until now could only be driven by editing
                MMKV by hand. Phase-aware cards are otherwise untestable without waiting for
                real dates to arrive. */}
            <Text style={styles.hint}>Overrides getDevNow(). Reload the app after setting.</Text>
            <TextInput
              testID="time-warp-input"
              style={styles.input}
              value={warpInput}
              onChangeText={setWarpInput}
              placeholder="2026-07-11T10:00:00"
              placeholderTextColor={Core.textFaint}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {warpError ? <Text style={styles.warpError}>{warpError}</Text> : null}
            <Pressable
              testID="time-warp-set"
              style={styles.setButton}
              onPress={() => {
                try {
                  setDevNowOverride(warpInput.trim());
                  setWarpError(null);
                } catch (e) {
                  setWarpError(e instanceof Error ? e.message : 'Could not set that date');
                }
              }}
            >
              <Text style={styles.setButtonText}>Set</Text>
            </Pressable>
          </Card>
        )}
      </ScrollView>
    </Animated.View>
  );
}

function Card({ title, action, children }: {
  title: string;
  action?: { label: string; onPress: () => void };
  children: React.ReactNode;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{title}</Text>
        {action ? (
          <Pressable onPress={action.onPress} hitSlop={8}>
            <Text style={styles.cardAction}>{action.label}</Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function Row({ label, value }: { label: string; value?: string }) {
  if (value === undefined) return null;
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1} selectable>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    top: 0, right: 0, bottom: 0, left: 0,
    backgroundColor: Core.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.md,
  },
  title: { ...Typography.roles.title, color: Core.text },
  close: { ...Typography.roles.button, color: Core.action },
  scroll: { paddingHorizontal: Spacing.base, paddingBottom: Spacing.xxxl, gap: Spacing.md },
  card: {
    backgroundColor: Core.surface,
    borderRadius: Radius.tile,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.xs },
  cardTitle: { ...Typography.roles.caps, color: Core.textMuted },
  cardAction: { ...Typography.roles.chip, color: Core.action },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  rowLabel: { ...Typography.roles.sub, color: Core.textMuted, width: 88 },
  rowValue: { ...Typography.roles.data, color: Core.text, flex: 1 },
  empty: { ...Typography.roles.sub, color: Core.textFaint },
  queuePath: { ...Typography.roles.data, color: Core.text, fontSize: 11 },
  hint: { ...Typography.roles.sub, color: Core.textMuted, marginBottom: Spacing.xs },
  input: {
    ...Typography.roles.data,
    color: Core.text,
    backgroundColor: Core.surfaceMuted,
    borderRadius: Radius.icon,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  setButton: {
    alignSelf: 'flex-start',
    marginTop: Spacing.sm,
    backgroundColor: Core.actionSoft,
    borderRadius: Radius.icon,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
  },
  setButtonText: { ...Typography.roles.chip, color: Core.action },
  warpError: { ...Typography.roles.sub, color: Semantic.error, marginTop: Spacing.xs },
});
