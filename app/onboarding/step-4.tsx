import { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Core, Radius, Spacing, Typography } from '@/src/design/tokens';
import { iconFor, type ItemCategory } from '@/src/design/icons';
import { useOnboardingDraft } from '@/src/contexts/OnboardingDraftContext';
import { createTrip } from '@/src/lib/createTrip';
import type { SetupIntent } from '@/src/types';

type SubmitStatus = 'idle' | 'submitting' | 'error';

const TILES: { key: keyof SetupIntent; label: string; category: ItemCategory }[] = [
  { key: 'flights', label: 'Flights', category: 'flight' },
  { key: 'stays', label: 'Stays', category: 'stay' },
  { key: 'car', label: 'Car', category: 'car' },
  { key: 'restaurants', label: 'Restaurants', category: 'food' },
];

// Step 5 (invite) is deferred — this is the wizard's final screen this round.
// `inviteToken` still gets generated for free inside createTrip(), it's just not surfaced yet.
export default function OnboardingStep4() {
  const router = useRouter();
  const { draft, setSetupIntent } = useOnboardingDraft();
  const [status, setStatus] = useState<SubmitStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const toggleTile = (key: keyof SetupIntent) => {
    setSetupIntent({ ...draft.setupIntent, [key]: !draft.setupIntent[key] });
  };

  const handleSubmit = async () => {
    // Double-tap guard, and a defensive no-op if firstStop is somehow still null (shouldn't
    // happen — step-2 is the only route into this screen — but createTrip() requires it).
    if (status === 'submitting' || !draft.firstStop) return;
    setStatus('submitting');
    setError(null);
    try {
      const tripId = await createTrip({
        name: draft.name,
        organizerHandle: draft.organizerHandle,
        pills: draft.pills,
        firstStop: draft.firstStop,
        setupIntent: draft.setupIntent,
        colorPack: draft.colorPack,
      });
      router.replace(`/(trips)/${tripId}/(tabs)/jernie` as never);
    } catch (err) {
      // The draft context itself is untouched by this failure — it lives above this screen in
      // _layout.tsx, so the user's Step 1/2 answers and these tile choices are all still here to
      // retry with, no re-entry required.
      setStatus('error');
      setError(err instanceof Error ? err.message : "Couldn't create this trip — try again.");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>Almost there</Text>
      <Text style={styles.title}>What have you booked?</Text>
      <Text style={styles.sub}>We'll build your setup checklist from this — you can change it later.</Text>

      <View style={styles.tileGrid}>
        {TILES.map(tile => {
          const selected = draft.setupIntent[tile.key];
          return (
            <TouchableOpacity
              key={tile.key}
              testID={`step4-tile-${tile.key}`}
              style={[styles.tile, selected && styles.tileSelected]}
              onPress={() => toggleTile(tile.key)}
            >
              {(() => { const Glyph = iconFor(tile.category); return <Glyph size={22} color={selected ? Core.action : Core.textMuted} weight={selected ? 'fill' : 'regular'} />; })()}
              <Text style={[styles.tileLabel, selected && styles.tileLabelSelected]}>{tile.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {status === 'error' && error && <Text style={styles.errorText}>{error}</Text>}

      <TouchableOpacity
        testID="step4-submit-button"
        style={[styles.submitButton, (status === 'submitting' || !draft.firstStop) && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={status === 'submitting' || !draft.firstStop}
      >
        {status === 'submitting' ? (
          <ActivityIndicator color={Core.action} />
        ) : (
          <Text style={styles.submitButtonText}>
            {status === 'error' ? 'Retry' : 'Build my setup list'}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Core.surface,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  eyebrow: {
    ...Typography.roles.caps,
    color: Core.action,
    marginBottom: Spacing.sm,
  },
  title: {
    ...Typography.roles.display,
    color: Core.text,
    marginBottom: Spacing.sm,
  },
  sub: {
    ...Typography.roles.body,
    color: Core.textMuted,
    marginBottom: Spacing.xl,
  },
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Core.border,
    borderRadius: Radius.tile,
    paddingVertical: Spacing.lg,
    gap: Spacing.xs,
  },
  tileSelected: {
    backgroundColor: Core.action,
    borderColor: Core.action,
  },
  tileEmoji: {
    fontSize: 28,
  },
  tileLabel: {
    ...Typography.roles.button,
    color: Core.text,
  },
  tileLabelSelected: {
    color: Core.textInverse,
  },
  errorText: {
    ...Typography.roles.sub,
    color: '#F5A9B8',
    marginBottom: Spacing.base,
  },
  submitButton: {
    backgroundColor: Core.action,
    borderRadius: Radius.icon,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    ...Typography.roles.button,
    color: Core.textInverse,
  },
});
