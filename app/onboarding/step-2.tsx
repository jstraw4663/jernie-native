import { View, Text, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Core, Spacing, Typography } from '@/src/design/tokens';
import { StopForm, type ResolvedStop } from '@/src/features/jernie/StopForm';
import { useOnboardingDraft } from '@/src/contexts/OnboardingDraftContext';

// `StopForm` owns all of its own readiness logic (geocode + dates) and won't call `onSubmit`
// until both are resolved — nothing here re-validates that. This screen's only job is to catch
// the resolved stop and move the wizard forward; the write is purely local (into the in-memory
// draft context), so `onSubmit` can be synchronous.
export default function OnboardingStep2() {
  const router = useRouter();
  const { setFirstStop } = useOnboardingDraft();

  const handleSubmit = (stop: ResolvedStop) => {
    setFirstStop(stop);
    router.push('/onboarding/step-3');
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>First stop</Text>
        <Text style={styles.title}>Where does this trip start?</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <StopForm onSubmit={handleSubmit} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  // Every wizard step is Core.surface now — the design's wizard is white throughout, and
  // StopForm's own inputs and text were already styled for a light surface.
  container: {
    flex: 1,
    backgroundColor: Core.surface,
  },
  header: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xxxl,
  },
  eyebrow: {
    ...Typography.roles.caps,
    color: Core.action,
    marginBottom: Spacing.sm,
  },
  title: {
    ...Typography.roles.display,
    color: Core.text,
  },
  scrollContent: {
    flexGrow: 1,
  },
});
