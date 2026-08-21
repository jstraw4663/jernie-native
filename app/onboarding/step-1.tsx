import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Brand, Core, Typography, Radius, Spacing } from '@/src/design/tokens';
import { useOnboardingDraft } from '@/src/contexts/OnboardingDraftContext';
import { useAuth } from '@/src/contexts/AuthContext';
import { useUserTrips } from '@/src/hooks/useUserTrips';
import { confirmAdoptExistingAccount } from '@/src/lib/collisionPrompt';

// A handful of hardcoded suggestions, per the design doc — freeform, not an exhaustive preset
// list. Tapping toggles membership in `pills`; there's no text-entry path for custom pills in
// this MVP (YAGNI — nothing downstream needs it yet). Ordering matters for existing tests
// (__tests__/app/onboarding-step-1.test.tsx references pill-0/pill-2 by index) — append new
// suggestions rather than reordering the first four. Spans a range of trip archetypes (not
// just food/activity tags) so groups planning something other than a food-and-hike trip still
// find something that fits.
const VIBE_SUGGESTIONS = [
  '🦞 Seafood',
  '🏔️ Hiking',
  '🏖️ Beach',
  '🍷 Wine',
  '🏙️ City',
  '👨‍👩‍👧 Family',
  '💑 Romantic',
  '🎉 Nightlife',
  '🚐 Road Trip',
  '⛷️ Ski',
  '🏕️ Camping',
  '🧘 Relax',
];

export default function OnboardingStep1() {
  const router = useRouter();
  const { draft, setName, setOrganizerHandle, setPills } = useOnboardingDraft();

  // Local, uncommitted text state — only written into the shared draft on Continue, so a
  // half-typed name never leaks into context before the step is actually complete. Seeded from
  // the draft so navigating back to this step (if ever wired up) doesn't lose prior input.
  const [name, setNameLocal] = useState(draft.name);
  const [organizerHandle, setOrganizerHandleLocal] = useState(draft.organizerHandle);
  const [selectedPills, setSelectedPills] = useState<string[]>(draft.pills);

  // A user with no trips lands here (app/index.tsx), which makes step 1 the only screen a
  // returning user on a new phone can reach. Sign-in used to live only on step 3 — after a
  // trip already existed — so restoring an account meant creating a throwaway trip first and
  // then walking through the collision warning to abandon it.
  const { status, signInWithApple } = useAuth();
  const { trips, status: tripsStatus } = useUserTrips();
  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);

  const canContinue = name.trim().length > 0 && organizerHandle.trim().length > 0;

  const handleSignIn = async () => {
    if (signingIn) return;
    setSigningIn(true);
    setSignInError(null);
    const outcome = await signInWithApple();
    // Deliberately no draft writes on this path — signing in navigates out of the wizard, and
    // a half-typed trip name must not follow the user into their restored account.
    if (outcome.ok) { setSigningIn(false); router.replace('/'); return; }
    if (outcome.reason === 'cancelled') { setSigningIn(false); return; }
    if (outcome.reason === 'credential-already-in-use') {
      // useUserTrips() reports 'loading'/'error' with an empty trips array, which would read
      // as "nothing to lose" and adopt silently — same gate as Profile and step 3.
      if (tripsStatus !== 'ready') {
        setSigningIn(false);
        setSignInError("Can't verify your trips yet — try again in a moment.");
        return;
      }
      // On the flow this screen exists for — a fresh install with no trips — this resolves
      // true without prompting, so the collision never surfaces to the user at all.
      const adopt = await confirmAdoptExistingAccount(trips.length);
      if (!adopt) { setSigningIn(false); return; }
      try { setSigningIn(false); await outcome.signIn(); router.replace('/'); }
      catch { setSigningIn(false); setSignInError("Couldn't sign in. Try again."); }
      return;
    }
    setSigningIn(false);
    setSignInError(outcome.message);
  };

  const togglePill = (pill: string) => {
    setSelectedPills(prev => (prev.includes(pill) ? prev.filter(p => p !== pill) : [...prev, pill]));
  };

  const handleContinue = () => {
    if (!canContinue) return;
    setName(name.trim());
    setOrganizerHandle(organizerHandle.trim());
    setPills(selectedPills);
    router.push('/onboarding/step-2');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.eyebrow}>Let's plan a trip</Text>
      <Text style={styles.title}>What are you calling this one?</Text>

      <Text style={styles.label}>Trip name</Text>
      <TextInput
        testID="step1-trip-name"
        style={styles.input}
        placeholder="e.g. NYC Summer"
        placeholderTextColor="rgba(255,255,255,0.4)"
        value={name}
        onChangeText={setNameLocal}
        autoFocus
        returnKeyType="next"
      />

      <Text style={styles.label}>Your name</Text>
      <TextInput
        testID="step1-organizer-handle"
        style={styles.input}
        placeholder="e.g. Jeremy"
        placeholderTextColor="rgba(255,255,255,0.4)"
        value={organizerHandle}
        onChangeText={setOrganizerHandleLocal}
        returnKeyType="done"
        onSubmitEditing={handleContinue}
      />

      <Text style={styles.label}>Vibe (optional)</Text>
      <View style={styles.chipRow}>
        {VIBE_SUGGESTIONS.map((pill, i) => {
          const selected = selectedPills.includes(pill);
          return (
            <TouchableOpacity
              key={pill}
              testID={`step1-pill-${i}`}
              style={[styles.chip, selected && styles.chipSelected]}
              onPress={() => togglePill(pill)}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{pill}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity
        testID="step1-continue-button"
        style={[styles.continueButton, !canContinue && styles.continueButtonDisabled]}
        onPress={handleContinue}
        disabled={!canContinue}
      >
        <Text style={styles.continueButtonText}>Continue</Text>
      </TouchableOpacity>

      {signInError && <Text style={styles.signInError}>{signInError}</Text>}

      {status !== 'authenticated' && (
        <TouchableOpacity
          testID="step1-signin"
          style={styles.signIn}
          onPress={() => { void handleSignIn(); }}
          disabled={signingIn}
        >
          <Text style={styles.signInText}>
            {signingIn ? 'Signing in…' : 'Already have an account? Sign in'}
          </Text>
        </TouchableOpacity>
      )}
    </KeyboardAvoidingView>
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
    marginBottom: Spacing.xl,
  },
  label: {
    ...Typography.roles.label,
    color: 'rgba(255,255,255,0.65)',
    marginBottom: Spacing.sm,
  },
  input: {
    ...Typography.roles.body,
    color: Core.white,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.base,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  chip: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
  },
  chipSelected: {
    backgroundColor: Brand.gold,
    borderColor: Brand.gold,
  },
  chipText: {
    ...Typography.roles.button,
    color: 'rgba(255,255,255,0.85)',
  },
  chipTextSelected: {
    color: Brand.navy,
  },
  continueButton: {
    backgroundColor: Brand.gold,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButtonDisabled: {
    opacity: 0.4,
  },
  continueButtonText: {
    ...Typography.roles.button,
    color: Brand.navy,
  },
  signIn: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
    marginTop: Spacing.sm,
  },
  signInText: {
    ...Typography.roles.body,
    color: 'rgba(255,255,255,0.55)',
    textDecorationLine: 'underline',
  },
  signInError: {
    ...Typography.roles.meta,
    color: '#F5A9B8',
    marginTop: Spacing.base,
    textAlign: 'center',
  },
});
