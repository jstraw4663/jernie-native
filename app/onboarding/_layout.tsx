import { Stack } from 'expo-router';
import { OnboardingDraftProvider } from '@/src/contexts/OnboardingDraftContext';

export default function OnboardingLayout() {
  return (
    <OnboardingDraftProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </OnboardingDraftProvider>
  );
}
