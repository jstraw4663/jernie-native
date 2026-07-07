import { Redirect } from 'expo-router';
import { useUserTrips } from '@/src/hooks/useUserTrips';
import { TripLoadingScreen } from '@/src/features/jernie/TripLoadingScreen';

// Dev-only fallback trip, seeded by maybeSeedDevData() in __DEV__ (see src/lib/devSeed.ts).
const DEV_TRIP_ID = 'dev-trip-001';

export default function Index() {
  const { trips, status } = useUserTrips();

  if (status === 'loading') {
    return <TripLoadingScreen />;
  }

  if (trips.length === 0) {
    if (__DEV__) {
      return <Redirect href={`/(trips)/${DEV_TRIP_ID}/(tabs)/jernie`} />;
    }
    return <Redirect href="/onboarding/step-1" />;
  }

  if (trips.length === 1) {
    return <Redirect href={`/(trips)/${trips[0].tripId}/(tabs)/jernie`} />;
  }

  return <Redirect href="/(home)" />;
}
