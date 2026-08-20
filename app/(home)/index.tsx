import { useCallback, useMemo } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUserTrips } from '@/src/hooks/useUserTrips';
import { useTripAdmin } from '@/src/hooks/useTripAdmin';
import { TripLoadingScreen } from '@/src/features/jernie/TripLoadingScreen';
import { Brand, Core, Radius, Spacing, Typography } from '@/src/design/tokens';

export default function MyTripsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { trips, status, refetch } = useUserTrips();
  const { restoreTrip } = useTripAdmin();

  const active = useMemo(() => trips.filter(t => !t.deletedAt), [trips]);
  const deleted = useMemo(() => trips.filter(t => t.deletedAt), [trips]);

  // restoreTrip only writes trips/{tripId}.deletedAt — it never touches the
  // users/{uid}/trips index useUserTrips listens on — so its listener never refires on
  // its own. Without this explicit refetch(), a restored trip would sit in "Recently
  // Deleted" with a seemingly-broken Restore button until the screen remounted.
  const onRestore = useCallback(
    async (tripId: string) => {
      await restoreTrip(tripId);
      refetch();
    },
    [restoreTrip, refetch],
  );

  const goToTrip = useCallback(
    (tripId: string) => {
      // `replace`, not `push`: leaving this screen for a trip should actually unmount
      // whatever trip screen (and its live RTDB listeners) was here before, rather than
      // stacking trips underneath each other indefinitely as the user switches around.
      router.replace(`/(trips)/${tripId}/(tabs)/jernie` as never);
    },
    [router],
  );

  const createTrip = useCallback(() => {
    router.push('/onboarding/step-1');
  }, [router]);

  if (status === 'loading') {
    return <TripLoadingScreen />;
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.container, { paddingTop: insets.top + Spacing.sm }]}
    >
      <Text style={styles.title}>My Trips</Text>
      {active.length === 0 ? (
        <Text style={styles.sub}>You haven't joined any trips yet.</Text>
      ) : (
        active.map(trip => (
          <Pressable
            key={trip.tripId}
            testID={`trip-row-${trip.tripId}`}
            style={styles.row}
            onPress={() => goToTrip(trip.tripId)}
          >
            <View>
              <Text style={styles.rowTitle}>{trip.name}</Text>
              <Text style={styles.rowMeta}>{trip.role}</Text>
            </View>
          </Pressable>
        ))
      )}
      <Pressable testID="create-trip-button" style={styles.createButton} onPress={createTrip}>
        <Text style={styles.createButtonText}>Create New Trip</Text>
      </Pressable>
      {deleted.length > 0 && (
        <View style={styles.deletedSection}>
          <Text style={styles.deletedHeading}>Recently Deleted</Text>
          {deleted.map(trip => (
            <View key={trip.tripId} style={styles.deletedRow}>
              <Text style={styles.deletedRowTitle}>{trip.name}</Text>
              <Pressable
                testID={`restore-trip-${trip.tripId}`}
                style={styles.restoreButton}
                onPress={() => onRestore(trip.tripId)}
              >
                <Text style={styles.restoreButtonText}>Restore</Text>
              </Pressable>
            </View>
          ))}
        </View>
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
  createButton: {
    marginTop: Spacing.xxl,
    backgroundColor: Brand.gold,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createButtonText: { ...Typography.roles.button, color: Brand.navy },
  deletedSection: { marginTop: Spacing.xxl },
  deletedHeading: { ...Typography.roles.label, color: Core.textMuted, marginBottom: Spacing.sm },
  deletedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: Radius.list,
    borderWidth: 1,
    borderColor: Core.border,
    paddingVertical: Spacing.base,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  deletedRowTitle: { ...Typography.roles.h3, color: Core.textMuted },
  restoreButton: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Core.border,
  },
  restoreButtonText: { ...Typography.roles.label, color: Core.action },
});
