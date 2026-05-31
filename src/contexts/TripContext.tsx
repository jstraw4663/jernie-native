import React, { createContext, useContext, type ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTripData } from '@/src/hooks/useTripData';
import { useTripConfirms } from '@/src/hooks/useTripConfirms';
import { TripLoadingScreen } from '@/src/features/jernie/TripLoadingScreen';
import { TripErrorScreen } from '@/src/features/jernie/TripErrorScreen';
import { Semantic, Spacing, Typography } from '@/src/design/tokens';
import type { Trip, Stop, Booking, ItineraryDay } from '@/src/types';

export interface TripContextValue {
  trip: Trip;
  stops: Stop[];
  bookings: Booking[];
  itinerary: Record<string, ItineraryDay[]>;
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

  if (tripData.status === 'loading' && tripData.trip === null) {
    return <TripLoadingScreen />;
  }

  if (tripData.status === 'error' && tripData.trip === null) {
    return <TripErrorScreen onRetry={tripData.retry} />;
  }

  const value: TripContextValue = {
    trip: tripData.trip!,
    stops: tripData.stops,
    bookings: tripData.bookings,
    itinerary: tripData.itinerary,
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
