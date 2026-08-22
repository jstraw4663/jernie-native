import { useCallback } from 'react';
import { database, getAuthedUser } from '@/src/lib/firebase';
import { generateId } from '@/src/utils/id';
import { syncItineraryDaysForRange } from '@/src/domain/itinerary';
import type { Stop } from '@/src/types';

export interface AddStopInput {
  city: string;
  region: string;
  lat: number;
  lon: number;
  dates: { start: string; end: string };
}

export interface AddStopState {
  addStop: (tripId: string, input: AddStopInput) => Promise<string>;
}

/**
 * Adds a stop to an already-existing trip. Unlike `createTrip()`, this needs no two-step
 * dance — the trip already exists, so `trips/{tripId}/ownerUid` is already committed, and the
 * plain `stops` write rule (`ownerUid === auth.uid || member exists`) permits one direct write
 * to `trips/{tripId}/stops/{newStopId}`.
 *
 * Ordering is append-only: reads the trip's CURRENT stops (never a stale/cached list — a caller
 * holding an older `stops` array from context could otherwise recompute a colliding `order`) and
 * writes with `order: Math.max(...orders, -1) + 1`, which behaves like `currentStops.length` for
 * a dense 0..n-1 sequence but also tolerates gaps. No mid-trip insertion or renumbering — that's
 * explicitly out of scope; a newly added stop always lands at the end.
 *
 * Also seeds one empty itinerary day per date in the stop's range, in the SAME root-level
 * multi-path update as the stop itself — so a stop can never exist without its day rows, which
 * is what left newly added stops with a blank itinerary section. Each leaf path is still
 * permission-checked individually, so `stops` and `itinerary` rules both apply as before.
 */
export function useAddStop(): AddStopState {
  const addStop = useCallback(async (tripId: string, input: AddStopInput): Promise<string> => {
    await getAuthedUser();

    const stopsSnap = await database().ref(`trips/${tripId}/stops`).once('value');
    const rawStops = (stopsSnap.val() as Record<string, { order?: number }> | null) ?? {};
    const orders = Object.values(rawStops).map(s => s.order ?? 0);
    const nextOrder = Math.max(...orders, -1) + 1;

    const stopId = generateId();
    const stop: Stop = {
      id: stopId,
      tripId,
      city: input.city,
      region: input.region,
      // Deprecated and never rendered; written only because the field is non-optional
      // on Stop and the record is immutable once created. See src/design/icons.ts.
      emoji: '',
      lat: input.lat,
      lon: input.lon,
      dates: input.dates,
      order: nextOrder,
    };

    const { toAdd } = syncItineraryDaysForRange({
      stopId,
      dates: input.dates,
      existingDays: [],
      generateId,
    });

    const updates: Record<string, unknown> = { [`trips/${tripId}/stops/${stopId}`]: stop };
    for (const day of toAdd) {
      updates[`trips/${tripId}/itinerary/${stopId}/${day.id}`] = day;
    }
    await database().ref().update(updates);

    return stopId;
  }, []);

  return { addStop };
}
