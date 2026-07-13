import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Core, Semantic, Typography, Radius, Shadow, Spacing } from '@/src/design/tokens';
import { runPwaImport } from '@/scripts/importPwaTrip';
import { getBuildLabel } from '@/src/version';

export default function ProfileTab() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.sub}>Settings · Traveler rail · Admin — Plan 6</Text>
      {__DEV__ && <Text style={styles.buildLabel}>{getBuildLabel()}</Text>}
      {__DEV__ && <PwaImportDebugButton />}
    </View>
  );
}

// ── TEMPORARY: one-time PWA data import trigger (Task 9 follow-up) ──────────────
// Remove this whole component + its import of `runPwaImport` once the real Maine 2026
// trip has been imported once. See scripts/importPwaTrip.ts / .superpowers/sdd/task-9-report.md.

type ImportStatus =
  | { kind: 'idle' }
  | { kind: 'running' }
  | { kind: 'success'; inviteToken: string }
  | { kind: 'error'; message: string };

function PwaImportDebugButton() {
  const [status, setStatus] = useState<ImportStatus>({ kind: 'idle' });

  const handlePress = async () => {
    setStatus({ kind: 'running' });
    try {
      const result = await runPwaImport();
      setStatus({ kind: 'success', inviteToken: result.inviteToken });
    } catch (err) {
      setStatus({ kind: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  };

  return (
    <View style={styles.debugBlock}>
      <Text style={styles.debugWarning}>⚠️ One-time Maine trip import — remove after use</Text>

      <TouchableOpacity
        style={[styles.debugButton, status.kind === 'running' && styles.debugButtonDisabled]}
        onPress={handlePress}
        disabled={status.kind === 'running'}
      >
        {status.kind === 'running' ? (
          <ActivityIndicator color={Core.textInverse} />
        ) : (
          <Text style={styles.debugButtonText}>Run PWA import</Text>
        )}
      </TouchableOpacity>

      {status.kind === 'success' && (
        <View style={[styles.debugStatusCard, styles.debugStatusSuccess]}>
          <Text style={styles.debugStatusLabel}>Import succeeded — invite token:</Text>
          <Text selectable style={styles.debugToken}>{status.inviteToken}</Text>
        </View>
      )}

      {status.kind === 'error' && (
        <View style={[styles.debugStatusCard, styles.debugStatusError]}>
          <Text style={styles.debugStatusLabel}>Import failed:</Text>
          <Text selectable style={styles.debugErrorText}>{status.message}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Core.bg, justifyContent: 'center', alignItems: 'center', padding: 24 },
  title: { ...Typography.roles.display, color: Core.text, marginBottom: 8 },
  sub: { ...Typography.roles.meta, color: Core.textMuted, textAlign: 'center' },
  buildLabel: { ...Typography.roles.mono, color: Core.textFaint, textAlign: 'center', marginTop: Spacing.md },

  debugBlock: { marginTop: Spacing.xxl, width: '100%', alignItems: 'center', gap: Spacing.sm },
  debugWarning: {
    ...Typography.roles.label,
    color: Semantic.warning,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  debugButton: {
    backgroundColor: Semantic.warning,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    minWidth: 200,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.cardResting,
  },
  debugButtonDisabled: { opacity: 0.7 },
  debugButtonText: { ...Typography.roles.button, color: Core.textInverse },
  debugStatusCard: {
    borderRadius: Radius.md,
    padding: Spacing.md,
    width: '100%',
    gap: Spacing.xxs,
  },
  debugStatusSuccess: { backgroundColor: Semantic.successTint },
  debugStatusError: { backgroundColor: Semantic.errorTint },
  debugStatusLabel: { ...Typography.roles.label, color: Core.text },
  debugToken: { ...Typography.roles.mono, color: Core.text },
  debugErrorText: { ...Typography.roles.meta, color: Semantic.error },
});
