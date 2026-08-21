import { Redirect } from 'expo-router';
import { useUserTrips } from '@/src/hooks/useUserTrips';
import { useAuth } from '@/src/contexts/AuthContext';
import { getSeedOwnerUid } from '@/src/lib/devSeed';
import { TripLoadingScreen } from '@/src/features/jernie/TripLoadingScreen';

// Dev-only fallback trip, seeded by maybeSeedDevData() in __DEV__ (see src/lib/devSeed.ts).
const DEV_TRIP_ID = 'dev-trip-001';

export default function Index() {
  const { trips, status } = useUserTrips();
  const { user } = useAuth();

  if (status === 'loading') {
    return <TripLoadingScreen />;
  }

  if (trips.length === 0) {
    // Only for the uid that actually seeded it. The seed runs once per device and RTDB rules
    // scope the trip to its members, so after a sign-out or account deletion this redirect
    // stranded the new anonymous uid on a trip it cannot read — and hid onboarding, which
    // carries the only sign-in entry point reachable by a user with no trips.
    if (__DEV__ && user?.uid && user.uid === getSeedOwnerUid()) {
      return <Redirect href={`/(trips)/${DEV_TRIP_ID}/(tabs)/jernie`} />;
    }
    return <Redirect href="/onboarding/step-1" />;
  }

  if (trips.length === 1) {
    return <Redirect href={`/(trips)/${trips[0].tripId}/(tabs)/jernie`} />;
  }

  return <Redirect href="/(home)" />;
}
