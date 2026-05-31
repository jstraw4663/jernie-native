import { Stack, useLocalSearchParams } from 'expo-router';
import { NavigationProvider } from '@/src/contexts/NavigationContext';
import { TripProvider } from '@/src/contexts/TripContext';

export default function TripShellLayout() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  return (
    <NavigationProvider tripId={tripId}>
      <TripProvider tripId={tripId}>
        <Stack screenOptions={{ headerShown: false }} />
      </TripProvider>
    </NavigationProvider>
  );
}
