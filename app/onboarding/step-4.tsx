import { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Brand, Core, Typography, Radius, Spacing } from '@/src/design/tokens';
import { useOnboardingDraft } from '@/src/contexts/OnboardingDraftContext';
import { createTrip } from '@/src/lib/createTrip';
import type { SetupIntent } from '@/src/types';

type SubmitStatus = 'idle' | 'submitting' | 'error';

const TILES: { key: keyof SetupIntent; label: string; emoji: string }[] = [
  { key: 'flights', label: 'Flights', emoji: '✈️' },
  { key: 'stays', label: 'Stays', emoji: '🏨' },
  { key: 'car', label: 'Car', emoji: '🚗' },
  { key: 'restaurants', label: 'Restaurants', emoji: '🍽️' },
];

// Steps 3 (auth) and 5 (invite) are deferred — this is the wizard's final screen this round.
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
              <Text style={styles.tileEmoji}>{tile.emoji}</Text>
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
          <ActivityIndicator color={Brand.navy} />
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
    backgroundColor: Brand.navy,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  eyebrow: {
    ...Typography.roles.labelCaps,
    color: Brand.gold,
    marginBottom: Spacing.sm,
  },
  title: {
    ...Typography.roles.h1,
    color: Core.white,
    marginBottom: Spacing.sm,
  },
  sub: {
    ...Typography.roles.body,
    color: 'rgba(255,255,255,0.65)',
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
    borderColor: 'rgba(255,255,255,0.25)',
    borderRadius: Radius.lg,
    paddingVertical: Spacing.lg,
    gap: Spacing.xs,
  },
  tileSelected: {
    backgroundColor: Brand.gold,
    borderColor: Brand.gold,
  },
  tileEmoji: {
    fontSize: 28,
  },
  tileLabel: {
    ...Typography.roles.button,
    color: 'rgba(255,255,255,0.85)',
  },
  tileLabelSelected: {
    color: Brand.navy,
  },
  errorText: {
    ...Typography.roles.meta,
    color: '#F5A9B8',
    marginBottom: Spacing.base,
  },
  submitButton: {
    backgroundColor: Brand.gold,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    ...Typography.roles.button,
    color: Brand.navy,
  },
});
