import { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Brand, Core, Typography, Radius, Spacing } from '@/src/design/tokens';
import { useOnboardingDraft } from '@/src/contexts/OnboardingDraftContext';
import { useAuth } from '@/src/contexts/AuthContext';
import { useUserTrips } from '@/src/hooks/useUserTrips';
import { confirmAdoptExistingAccount } from '@/src/lib/collisionPrompt';

export default function OnboardingStep3() {
  const router = useRouter();
  const { draft } = useOnboardingDraft();
  const { signInWithApple } = useAuth();
  const { trips, status: tripsStatus } = useUserTrips();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const advance = () => router.push('/onboarding/step-4');

  const handleApple = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const outcome = await signInWithApple();
    if (outcome.ok) { setBusy(false); advance(); return; }

    if (outcome.reason === 'cancelled') { setBusy(false); return; }
    if (outcome.reason === 'credential-already-in-use') {
      // "Create New Trip" from My Trips routes here too (app/(home)/index.tsx), so this
      // screen can't assume nothing is at risk the way the original spec did — a user who
      // already owns trips must be warned before their anonymous uid is abandoned, same as
      // Profile's collision handling. useUserTrips() reports 'loading'/'error' with an empty
      // trips array, which would otherwise read as "nothing to lose" and adopt silently —
      // refuse outright until the count can be trusted.
      if (tripsStatus !== 'ready') {
        setBusy(false);
        setError("Can't verify your trips yet — try again in a moment.");
        return;
      }
      const adopt = await confirmAdoptExistingAccount(trips.length);
      if (!adopt) { setBusy(false); return; }
      try { await outcome.signIn(); setBusy(false); advance(); }
      catch (e) { setBusy(false); setError(e instanceof Error ? e.message : 'Sign in failed'); }
      return;
    }
    setBusy(false);
    setError(outcome.message);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>Keep it safe</Text>
      <Text style={styles.title}>Save your trip</Text>
      <Text style={styles.sub}>
        Sign in and your trip follows you to any phone. Skip and it lives only on this one.
      </Text>

      <View style={[styles.previewCard, { borderColor: draft.colorPack.stopColors[0] }]}>
        <View style={[styles.swatch, { backgroundColor: draft.colorPack.stopColors[0] }]} />
        <Text style={styles.previewName}>{draft.name}</Text>
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <TouchableOpacity
        testID="step3-apple-button"
        style={[styles.appleButton, busy && styles.buttonDisabled]}
        onPress={handleApple}
        disabled={busy}
      >
        {busy ? <ActivityIndicator color={Core.white} /> : <Text style={styles.appleButtonText}>Sign in with Apple</Text>}
      </TouchableOpacity>

      <TouchableOpacity testID="step3-skip" style={styles.skip} onPress={advance} disabled={busy}>
        <Text style={styles.skipText}>Save later</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Brand.navy, justifyContent: 'center', paddingHorizontal: Spacing.xl },
  eyebrow: { ...Typography.roles.labelCaps, color: Brand.gold, marginBottom: Spacing.sm },
  title: { ...Typography.roles.h1, color: Core.white, marginBottom: Spacing.sm },
  sub: { ...Typography.roles.body, color: 'rgba(255,255,255,0.65)', marginBottom: Spacing.xl },
  previewCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.xl,
  },
  swatch: { width: 32, height: 32, borderRadius: Radius.sm },
  previewName: { ...Typography.roles.h2, color: Core.white, flexShrink: 1 },
  appleButton: {
    backgroundColor: '#000000', borderRadius: Radius.md,
    paddingVertical: Spacing.md, alignItems: 'center', justifyContent: 'center',
  },
  appleButtonText: { ...Typography.roles.button, color: Core.white },
  buttonDisabled: { opacity: 0.5 },
  skip: { alignItems: 'center', paddingVertical: Spacing.md, marginTop: Spacing.sm },
  skipText: { ...Typography.roles.body, color: 'rgba(255,255,255,0.55)', textDecorationLine: 'underline' },
  errorText: { ...Typography.roles.meta, color: '#F5A9B8', marginBottom: Spacing.base },
});
