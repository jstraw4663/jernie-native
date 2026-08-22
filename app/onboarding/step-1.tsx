import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import type { Icon } from 'phosphor-react-native';
import { BuildingsIcon } from 'phosphor-react-native/src/icons/Buildings';
import { CarProfileIcon } from 'phosphor-react-native/src/icons/CarProfile';
import { FishIcon } from 'phosphor-react-native/src/icons/Fish';
import { FlowerLotusIcon } from 'phosphor-react-native/src/icons/FlowerLotus';
import { HeartIcon } from 'phosphor-react-native/src/icons/Heart';
import { MusicNotesIcon } from 'phosphor-react-native/src/icons/MusicNotes';
import { PersonSimpleHikeIcon } from 'phosphor-react-native/src/icons/PersonSimpleHike';
import { PersonSimpleSkiIcon } from 'phosphor-react-native/src/icons/PersonSimpleSki';
import { TentIcon } from 'phosphor-react-native/src/icons/Tent';
import { TreePalmIcon } from 'phosphor-react-native/src/icons/TreePalm';
import { UsersThreeIcon } from 'phosphor-react-native/src/icons/UsersThree';
import { WineIcon } from 'phosphor-react-native/src/icons/Wine';
import { Core, Radius, Spacing, Typography } from '@/src/design/tokens';
import { useOnboardingDraft } from '@/src/contexts/OnboardingDraftContext';
import { useAuth } from '@/src/contexts/AuthContext';
import { useCollisionSignIn } from '@/src/hooks/useCollisionSignIn';

// A handful of hardcoded suggestions, per the design doc — freeform, not an exhaustive preset
// list. Tapping toggles membership in `pills`; there's no text-entry path for custom pills in
// this MVP (YAGNI — nothing downstream needs it yet). Ordering matters for existing tests
// (__tests__/app/onboarding-step-1.test.tsx references pill-0/pill-2 by index) — append new
// suggestions rather than reordering the first four. Spans a range of trip archetypes (not
// just food/activity tags) so groups planning something other than a food-and-hike trip still
// find something that fits.
// The label is what gets stored on the trip, so it carries no glyph — the icon is a
// rendering choice, not data. Trips created before this change keep their emoji labels;
// they are display-only strings and need no migration.
const VIBE_SUGGESTIONS: { label: string; Glyph: Icon }[] = [
  { label: 'Seafood',    Glyph: FishIcon },
  { label: 'Hiking',     Glyph: PersonSimpleHikeIcon },
  { label: 'Beach',      Glyph: TreePalmIcon },
  { label: 'Wine',       Glyph: WineIcon },
  { label: 'City',       Glyph: BuildingsIcon },
  { label: 'Family',     Glyph: UsersThreeIcon },
  { label: 'Romantic',   Glyph: HeartIcon },
  { label: 'Nightlife',  Glyph: MusicNotesIcon },
  { label: 'Road Trip',  Glyph: CarProfileIcon },
  { label: 'Ski',        Glyph: PersonSimpleSkiIcon },
  { label: 'Camping',    Glyph: TentIcon },
  { label: 'Relax',      Glyph: FlowerLotusIcon },
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
  const adoptOnCollision = useCollisionSignIn();
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
      // On the flow this screen exists for — a fresh install with nothing at stake — the
      // prompt is skipped entirely and this reads as an ordinary sign-in.
      const result = await adoptOnCollision(outcome.signIn);
      setSigningIn(false);
      if (result.status === 'untrusted') {
        setSignInError("Can't verify your trips yet — try again in a moment.");
      } else if (result.status === 'failed') {
        setSignInError("Couldn't sign in. Try again.");
      } else if (result.status === 'signed-in') {
        router.replace('/');
      }
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
        placeholderTextColor={Core.textFaint}
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
        placeholderTextColor={Core.textFaint}
        value={organizerHandle}
        onChangeText={setOrganizerHandleLocal}
        returnKeyType="done"
        onSubmitEditing={handleContinue}
      />

      <Text style={styles.label}>Vibe (optional)</Text>
      <View style={styles.chipRow}>
        {VIBE_SUGGESTIONS.map(({ label, Glyph }, i) => {
          const selected = selectedPills.includes(label);
          return (
            <TouchableOpacity
              key={label}
              testID={`step1-pill-${i}`}
              style={[styles.chip, selected && styles.chipSelected]}
              onPress={() => togglePill(label)}
            >
              <Glyph size={13} color={selected ? Core.textInverse : Core.textMuted} weight={selected ? 'fill' : 'regular'} />
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
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
    marginBottom: Spacing.xl,
  },
  label: {
    ...Typography.roles.chip,
    color: Core.textMuted,
    marginBottom: Spacing.sm,
  },
  input: {
    ...Typography.roles.body,
    color: Core.text,
    borderWidth: 1,
    borderColor: Core.border,
    borderRadius: Radius.icon,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: Core.border,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
  },
  chipSelected: {
    backgroundColor: Core.action,
    borderColor: Core.action,
  },
  chipText: {
    ...Typography.roles.button,
    color: Core.text,
  },
  chipTextSelected: {
    color: Core.textInverse,
  },
  continueButton: {
    backgroundColor: Core.action,
    borderRadius: Radius.icon,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButtonDisabled: {
    opacity: 0.4,
  },
  continueButtonText: {
    ...Typography.roles.button,
    color: Core.textInverse,
  },
  signIn: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
    marginTop: Spacing.sm,
  },
  signInText: {
    ...Typography.roles.body,
    color: Core.textFaint,
    textDecorationLine: 'underline',
  },
  signInError: {
    ...Typography.roles.sub,
    color: '#F5A9B8',
    marginTop: Spacing.base,
    textAlign: 'center',
  },
});
