import { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Brand, Core, Typography, Radius, Spacing } from '@/src/design/tokens';
import { useOnboardingDraft } from '@/src/contexts/OnboardingDraftContext';
import { useAuth } from '@/src/contexts/AuthContext';
import { useCollisionSignIn } from '@/src/hooks/useCollisionSignIn';

export default function OnboardingStep3() {
  const router = useRouter();
  const { draft } = useOnboardingDraft();
  const { status, user, signInWithApple } = useAuth();
  const adoptOnCollision = useCollisionSignIn();
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
      // already owns trips must be given the choice before their anonymous uid is abandoned.
      const result = await adoptOnCollision(outcome.signIn);
      setBusy(false);
      if (result.status === 'untrusted') {
        setError("Can't verify your trips yet — try again in a moment.");
      } else if (result.status === 'failed') {
        setError("Couldn't sign in. Try again.");
      } else if (result.status === 'signed-in') {
        advance();
      }
      return;
    }
    setBusy(false);
    setError(outcome.message);
  };

  // "Create New Trip" from My Trips (app/(home)/index.tsx) routes here too, so a user who
  // is already linked (creating a second, third, ... trip) can land on this screen. Before
  // this branch, that user was shown the same "Sign in with Apple" button as a genuine
  // first-run user — tapping it hit auth/provider-already-linked and rendered the raw
  // Firebase message, since linking twice with the same account isn't a real flow.
  if (status === 'authenticated') {
    return (
      <View style={styles.container}>
        <Text style={styles.eyebrow}>Keep it safe</Text>
        <Text style={styles.title}>Save your trip</Text>
        <Text style={styles.sub}>
          You're signed in as {user?.email ?? user?.displayName ?? 'your Apple ID'} — this trip is saved to your account.
        </Text>

        <View style={[styles.previewCard, { borderColor: draft.colorPack.stopColors[0] }]}>
          <View style={[styles.swatch, { backgroundColor: draft.colorPack.stopColors[0] }]} />
          <Text style={styles.previewName}>{draft.name}</Text>
        </View>

        <TouchableOpacity testID="step3-continue" style={styles.appleButton} onPress={advance}>
          <Text style={styles.appleButtonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    );
  }

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
