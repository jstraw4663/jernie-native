import { useCallback } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useUserTrips } from '@/src/hooks/useUserTrips';
import { TripLoadingScreen } from '@/src/features/jernie/TripLoadingScreen';
import { Core, Radius, Spacing, Typography } from '@/src/design/tokens';

export default function MyTripsScreen() {
  const router = useRouter();
  const { trips, status } = useUserTrips();

  const goToTrip = useCallback(
    (tripId: string) => {
      // `replace`, not `push`: leaving this screen for a trip should actually unmount
      // whatever trip screen (and its live RTDB listeners) was here before, rather than
      // stacking trips underneath each other indefinitely as the user switches around.
      router.replace(`/(trips)/${tripId}/(tabs)/jernie` as never);
    },
    [router],
  );

  if (status === 'loading') {
    return <TripLoadingScreen />;
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <Text style={styles.title}>My Trips</Text>
      {trips.length === 0 ? (
        <Text style={styles.sub}>You haven't joined any trips yet.</Text>
      ) : (
        trips.map(trip => (
          <Pressable
            key={trip.tripId}
            testID={`trip-row-${trip.tripId}`}
            style={styles.row}
            onPress={() => goToTrip(trip.tripId)}
          >
            <View>
              <Text style={styles.rowTitle}>{trip.tripId}</Text>
              <Text style={styles.rowMeta}>{trip.role}</Text>
            </View>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Core.bg },
  container: { padding: Spacing.xl },
  title: { ...Typography.roles.h1, color: Core.text, marginBottom: Spacing.lg },
  sub: { ...Typography.roles.meta, color: Core.textMuted },
  row: {
    backgroundColor: Core.surface,
    borderRadius: Radius.list,
    borderWidth: 1,
    borderColor: Core.border,
    paddingVertical: Spacing.base,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  rowTitle: { ...Typography.roles.h3, color: Core.text },
  rowMeta: { ...Typography.roles.meta, color: Core.textMuted, marginTop: Spacing.xxs, textTransform: 'capitalize' },
});
