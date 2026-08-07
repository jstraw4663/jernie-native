import { useState, useEffect, useCallback } from 'react';
import { createMMKV } from 'react-native-mmkv';
import { database, authReady } from '@/src/lib/firebase';
import type { Trip, Stop, StopWithColor, Booking, ItineraryDay, Place, TripColorPackRef, SetupIntent } from '@/src/types';
import { getStopColor } from '@/src/domain/trip';

const cacheStorage = createMMKV({ id: 'jernie-trip-cache' });

export interface TripDataState {
  trip: Trip | null;
  stops: StopWithColor[];
  bookings: Booking[];
  itinerary: Record<string, ItineraryDay[]>;
  places: Place[];
  status: 'loading' | 'ready' | 'error';
  fromCache: boolean;
  retry: () => void;
}

interface CachedSnapshot {
  trip: Trip;
  stops: StopWithColor[];
  bookings: Booking[];
  itinerary: Record<string, ItineraryDay[]>;
  places: Place[];
  cachedAt: number;
}

// Exported for unit testing. Converts a raw RTDB snapshot value into typed domain objects.
// RTDB stores collections as keyed objects; this injects keys as `id` and sorts appropriately.
export function normalizeTripSnapshot(val: Record<string, unknown>): {
  trip: Trip;
  stops: StopWithColor[];
  bookings: Booking[];
  itinerary: Record<string, ItineraryDay[]>;
  places: Place[];
} {
  const trip: Trip = {
    id: val.id as string,
    name: val.name as string,
    ownerUid: val.ownerUid as string,
    createdAt: val.createdAt as number,
    pills: (val.pills as string[]) ?? [],
    inviteToken: val.inviteToken as string,
    colorPack: val.colorPack as TripColorPackRef,
    setupIntent: val.setupIntent as SetupIntent,
  };

  const rawStops = ((val.stops ?? {}) as Record<string, Omit<Stop, 'id'> & { id?: string }>);
  const stops: StopWithColor[] = Object.entries(rawStops)
    .map(([key, s]) => ({ ...s, id: s.id ?? key } as Stop))
    .sort((a, b) => a.order - b.order)
    .map(stop => ({ ...stop, color: getStopColor(stop, trip) }));

  const rawBookings = ((val.bookings ?? {}) as Record<string, Omit<Booking, 'id'> & { id?: string }>);
  const bookings: Booking[] = Object.entries(rawBookings)
    .map(([key, b]) => ({ ...b, id: b.id ?? key } as Booking));

  const rawItinerary = ((val.itinerary ?? {}) as Record<string, Record<string, Omit<ItineraryDay, 'id'> & { id?: string }>>);
  const itinerary: Record<string, ItineraryDay[]> = {};
  for (const [stopId, days] of Object.entries(rawItinerary)) {
    itinerary[stopId] = Object.entries(days)
      // RTDB omits empty containers — a day whose `items` array was written as `[]` has no
      // `items` key on read at all, so default it back to `[]` here rather than leaving it undefined.
      .map(([key, d]) => ({ ...d, id: d.id ?? key, items: d.items ?? [] } as ItineraryDay))
      .sort((a, b) => a.dateIso.localeCompare(b.dateIso));
  }

  const rawPlaces = ((val.places ?? {}) as Record<string, Omit<Place, 'id'> & { id?: string }>);
  const places: Place[] = Object.entries(rawPlaces)
    .map(([key, p]) => ({ ...p, id: p.id ?? key } as Place));

  return { trip, stops, bookings, itinerary, places };
}

export function useTripData(tripId: string): TripDataState {
  const cacheKey = `trip_snapshot_${tripId}`;

  const [state, setState] = useState<Omit<TripDataState, 'retry'>>(() => {
    try {
      const raw = cacheStorage.getString(cacheKey);
      if (raw) {
        const cached = JSON.parse(raw) as CachedSnapshot;
        return { trip: cached.trip, stops: cached.stops, bookings: cached.bookings, itinerary: cached.itinerary, places: cached.places ?? [], status: 'loading', fromCache: true };
      }
    } catch {}
    return { trip: null, stops: [], bookings: [], itinerary: {}, places: [], status: 'loading', fromCache: false };
  });

  const doFetch = useCallback(async () => {
    setState(prev => ({ ...prev, status: 'loading' }));
    try {
      await authReady;
      const snap = await database().ref(`trips/${tripId}`).once('value');
      const val = snap.val() as Record<string, unknown> | null;
      if (!val) throw new Error('no data');
      const normalized = normalizeTripSnapshot(val);
      const cached: CachedSnapshot = { ...normalized, cachedAt: Date.now() };
      cacheStorage.set(cacheKey, JSON.stringify(cached));
      setState({ ...normalized, status: 'ready', fromCache: false });
    } catch {
      setState(prev => ({ ...prev, status: 'error' }));
    }
  }, [tripId, cacheKey]);

  useEffect(() => {
    doFetch();
  }, [doFetch]);

  const retry = useCallback(() => doFetch(), [doFetch]);

  return { ...state, retry };
}
