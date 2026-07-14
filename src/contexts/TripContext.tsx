import React, { createContext, useContext, useMemo, type ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTripData } from '@/src/hooks/useTripData';
import { useTripConfirms } from '@/src/hooks/useTripConfirms';
import { useTripMembers } from '@/src/hooks/useTripMembers';
import { useTripGroups } from '@/src/hooks/useTripGroups';
import { useFirestoreEnrichment } from '@/src/hooks/useFirestoreEnrichment';
import { auth } from '@/src/lib/firebase';
import { filterVisibleToUser } from '@/src/domain/groups';
import { TripLoadingScreen } from '@/src/features/jernie/TripLoadingScreen';
import { TripErrorScreen } from '@/src/features/jernie/TripErrorScreen';
import { Semantic, Spacing, Typography } from '@/src/design/tokens';
import type { Trip, StopWithColor, Booking, ItineraryDay, Place, PlaceEnrichment, TripMember, Group } from '@/src/types';

export interface TripContextValue {
  trip: Trip;
  stops: StopWithColor[];
  bookings: Booking[];        // already visibility-filtered for currentUid
  itinerary: Record<string, ItineraryDay[]>;  // items already visibility-filtered
  places: Place[];            // not group-scoped — Place has no groupIds field
  enrichment: Record<string, PlaceEnrichment>;  // keyed by canonical key — use getPlaceEnrichment()
  members: TripMember[];
  groups: Group[];
  currentUid: string | null;
  confirms: Record<string, boolean>;
  setConfirm: (itemId: string, confirmed: boolean) => void;
  fromCache: boolean;
  status: 'loading' | 'ready' | 'error';
  refetch: () => void;
}

const TripContext = createContext<TripContextValue | null>(null);

export function useTripContext(): TripContextValue {
  const ctx = useContext(TripContext);
  if (!ctx) throw new Error('useTripContext must be used inside TripProvider');
  return ctx;
}

interface TripProviderProps {
  tripId: string;
  children: ReactNode;
}

function OfflineBanner({ onRetry }: { onRetry: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Pressable
      style={[styles.banner, { paddingTop: insets.top + Spacing.sm }]}
      onPress={onRetry}
    >
      <Text style={styles.bannerText}>Showing saved trip · Tap to retry</Text>
    </Pressable>
  );
}

export function TripProvider({ tripId, children }: TripProviderProps) {
  const tripData = useTripData(tripId);
  const confirmsState = useTripConfirms(tripId);
  const membersState = useTripMembers(tripId);
  const groupsState = useTripGroups(tripId);
  const enrichment = useFirestoreEnrichment(tripData.places);

  const currentUid = auth().currentUser?.uid ?? null;
  const isOrganizer = membersState.members.some(
    m => m.uid === currentUid && m.role === 'organizer',
  );

  // Re-filtering the whole trip is wasted work on renders triggered by unrelated state
  // (e.g. a single confirm-checkbox toggle) — memoize so `bookings`/`itinerary` only get
  // new identities when the data they're actually derived from changes, which also lets
  // downstream consumers (e.g. jernie.tsx's own useMemo) skip recomputing too.
  const bookings = useMemo(
    () => filterVisibleToUser(tripData.bookings, currentUid, groupsState.groups, isOrganizer),
    [tripData.bookings, currentUid, groupsState.groups, isOrganizer],
  );

  const itinerary = useMemo(() => {
    const result: Record<string, ItineraryDay[]> = {};
    for (const [stopId, days] of Object.entries(tripData.itinerary)) {
      result[stopId] = days.map(day => ({
        ...day,
        items: filterVisibleToUser(day.items, currentUid, groupsState.groups, isOrganizer),
      }));
    }
    return result;
  }, [tripData.itinerary, currentUid, groupsState.groups, isOrganizer]);

  if (tripData.status === 'loading' && tripData.trip === null) {
    return <TripLoadingScreen />;
  }

  if (tripData.status === 'error' && tripData.trip === null) {
    return <TripErrorScreen onRetry={tripData.retry} />;
  }

  const value: TripContextValue = {
    trip: tripData.trip!,
    stops: tripData.stops,
    bookings,
    itinerary,
    places: tripData.places,
    enrichment,
    members: membersState.members,
    groups: groupsState.groups,
    currentUid,
    confirms: confirmsState.confirms,
    setConfirm: confirmsState.setConfirm,
    fromCache: tripData.fromCache,
    status: tripData.status,
    refetch: tripData.retry,
  };

  return (
    <TripContext.Provider value={value}>
      <View style={styles.container}>
        {children}
        {tripData.fromCache && <OfflineBanner onRetry={tripData.retry} />}
      </View>
    </TripContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: Semantic.warningTint,
    paddingBottom: Spacing.sm,
    paddingHorizontal: Spacing.base,
    alignItems: 'center',
  },
  bannerText: {
    ...Typography.roles.meta,
    color: Semantic.warning,
  },
});
