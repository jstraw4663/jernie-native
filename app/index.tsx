import { Redirect } from 'expo-router';

// For Phase 1: redirect directly to the dev trip.
// Phase 2: check users/{uid}/trips and route accordingly.
const DEV_TRIP_ID = 'dev-trip-001';

export default function Index() {
  return <Redirect href={`/(trips)/${DEV_TRIP_ID}/(tabs)/jernie`} />;
}
