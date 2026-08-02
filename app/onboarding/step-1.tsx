import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Brand, Core, Typography, Radius, Spacing } from '@/src/design/tokens';
import { useOnboardingDraft } from '@/src/contexts/OnboardingDraftContext';

// A handful of hardcoded suggestions, per the design doc — freeform, not an exhaustive preset
// list. Tapping toggles membership in `pills`; there's no text-entry path for custom pills in
// this MVP (YAGNI — nothing downstream needs it yet).
const VIBE_SUGGESTIONS = ['🦞 Seafood', '🏔️ Hiking', '🏖️ Beach', '🍷 Wine'];

export default function OnboardingStep1() {
  const router = useRouter();
  const { draft, setName, setOrganizerHandle, setPills } = useOnboardingDraft();

  // Local, uncommitted text state — only written into the shared draft on Continue, so a
  // half-typed name never leaks into context before the step is actually complete. Seeded from
  // the draft so navigating back to this step (if ever wired up) doesn't lose prior input.
  const [name, setNameLocal] = useState(draft.name);
  const [organizerHandle, setOrganizerHandleLocal] = useState(draft.organizerHandle);
  const [selectedPills, setSelectedPills] = useState<string[]>(draft.pills);

  const canContinue = name.trim().length > 0 && organizerHandle.trim().length > 0;

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
});
