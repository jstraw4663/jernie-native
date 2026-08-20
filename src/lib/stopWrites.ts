import { database, getAuthedUser } from '@/src/lib/firebase';
import { stripUndefined } from '@/src/utils/stripUndefined';
import {
  buildStopRemovalUpdates, parseBookingsFromSnapshot, parseItineraryFromSnapshot, parsePlacesFromSnapshot,
} from '@/src/domain/cascade';
import { syncItineraryDaysForRange } from '@/src/domain/itinerary';
import { generateId } from '@/src/utils/id';
import type { ItineraryDay, Stop } from '@/src/types';

export type StopPatch = Partial<Pick<Stop, 'city' | 'region' | 'emoji' | 'lat' | 'lon' | 'dates'>>;

/** One stop's day map as stored under `trips/{tripId}/itinerary/{stopId}`. */
function parseStopDays(raw: unknown): ItineraryDay[] {
  const rec = (raw ?? {}) as Record<string, Omit<ItineraryDay, 'id'> & { id?: string }>;
  // RTDB omits empty containers, so a day written with `items: []` comes back without the key.
  return Object.entries(rec).map(([key, d]) => ({ ...d, id: d.id ?? key, items: d.items ?? [] } as ItineraryDay));
}

export async function updateStop(tripId: string, stopId: string, patch: StopPatch): Promise<void> {
  await getAuthedUser();
  const cleaned = stripUndefined(patch);

  // Only a date change can invalidate the day rows, so anything else stays a single
  // cheap write against the stop node — no itinerary read at all.
  if (!patch.dates) {
    await database().ref(`trips/${tripId}/stops/${stopId}`).update(cleaned);
    return;
  }

  const snap = await database().ref(`trips/${tripId}/itinerary/${stopId}`).once('value');
  const { toAdd, toRemoveIds } = syncItineraryDaysForRange({
    stopId,
    dates: patch.dates,
    existingDays: parseStopDays(snap.val()),
    generateId,
  });

  // One root-level multi-path update so the new dates and their day rows land together —
  // a stop is never left showing a range its itinerary doesn't cover.
  const updates: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(cleaned)) {
    updates[`trips/${tripId}/stops/${stopId}/${field}`] = value;
  }
  for (const day of toAdd) {
    updates[`trips/${tripId}/itinerary/${stopId}/${day.id}`] = day;
  }
  for (const dayId of toRemoveIds) {
    updates[`trips/${tripId}/itinerary/${stopId}/${dayId}`] = null;
  }
  await database().ref().update(updates);
}

export async function removeStop(tripId: string, stopId: string): Promise<void> {
  await getAuthedUser();
  const [bookingsSnap, itinerarySnap, placesSnap] = await Promise.all([
    database().ref(`trips/${tripId}/bookings`).once('value'),
    database().ref(`trips/${tripId}/itinerary`).once('value'),
    database().ref(`trips/${tripId}/places`).once('value'),
  ]);
  const data = {
    bookings: parseBookingsFromSnapshot(bookingsSnap.val()),
    itinerary: parseItineraryFromSnapshot(itinerarySnap.val()),
    places: parsePlacesFromSnapshot(placesSnap.val()),
  };
  const updates = buildStopRemovalUpdates(tripId, stopId, data);
  await database().ref().update(updates);
}
