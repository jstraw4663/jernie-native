import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Brand, Core, Typography, Spacing } from '@/src/design/tokens';
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
    router.push('/onboarding/step-4');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>First stop</Text>
        <Text style={styles.title}>Where does this trip start?</Text>
      </View>
      <StopForm onSubmit={handleSubmit} />
    </View>
  );
}

const styles = StyleSheet.create({
  // Core.bg (light) rather than Brand.navy — StopForm's own inputs/text are styled for a light
  // surface (Core.text, Core.surfaceMuted; see AddStopSheet's identical Core.bg host), so this
  // screen matches that instead of forcing StopForm onto a dark background it wasn't built for.
  container: {
    flex: 1,
    backgroundColor: Core.bg,
  },
  header: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xxxl,
  },
  eyebrow: {
    ...Typography.roles.labelCaps,
    color: Brand.gold,
    marginBottom: Spacing.sm,
  },
  title: {
    ...Typography.roles.h1,
    color: Core.text,
  },
});
