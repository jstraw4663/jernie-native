import { Stack, useLocalSearchParams } from 'expo-router';
import { NavigationProvider } from '@/src/contexts/NavigationContext';

export default function TripShellLayout() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  return (
    <NavigationProvider tripId={tripId}>
      <Stack screenOptions={{ headerShown: false }} />
    </NavigationProvider>
  );
}
