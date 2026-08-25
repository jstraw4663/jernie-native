import { database, getAuthedUser } from '@/src/lib/firebase';
import { generateId } from '@/src/utils/id';
import { stripUndefined } from '@/src/utils/stripUndefined';
import { buildAddToItineraryItem } from '@/src/domain/explore';
import {
  buildCustomItineraryItem, reorderItineraryItems,
  type CustomItineraryItemInput, type ItineraryItemMove,
} from '@/src/domain/itinerary';
import type { ItineraryDay, ItineraryItem, Place } from '@/src/types';

/**
 * Adds a place to the itinerary on the given day. `useTripData` is fetch-once, not a
 * live listener, so callers should call TripContext's `refetch()` afterward to see the
 * new item reflected — a brief round trip rather than optimistic local-merge state.
 */
export async function addPlaceToItinerary(tripId: string, place: Place, day: ItineraryDay): Promise<void> {
  const newItem = buildAddToItineraryItem(place, day.items, generateId());
  await database()
    .ref(`trips/${tripId}/itinerary/${day.stopId}/${day.id}/items`)
    .set([...day.items, newItem]);
}

/** Adds a free-text custom item to the itinerary on the given day. */
export async function addCustomItineraryItem(
  tripId: string,
  day: ItineraryDay,
  input: CustomItineraryItemInput,
): Promise<void> {
  await getAuthedUser();
  const newItem = buildCustomItineraryItem(input, day.items, generateId());
  await database().ref(`trips/${tripId}/itinerary/${day.stopId}/${day.id}/items`).set([...day.items, newItem]);
}

export type ItineraryItemPatch = Partial<Omit<ItineraryItem, 'id' | 'type' | 'placeId' | 'bookingId'>>;

/** Type-agnostic patch: works identically for 'place', 'booking', and 'custom' items. */
export async function updateItineraryItem(
  tripId: string,
  day: ItineraryDay,
  itemId: string,
  patch: ItineraryItemPatch,
): Promise<void> {
  await getAuthedUser();
  const cleaned = stripUndefined(patch);
  const updatedItems = day.items.map(i => (i.id === itemId ? { ...i, ...cleaned } : i));
  await database().ref(`trips/${tripId}/itinerary/${day.stopId}/${day.id}/items`).set(updatedItems);
}

/** Type-agnostic remove: works identically for 'place', 'booking', and 'custom' items. */
export async function removeItineraryItem(tripId: string, day: ItineraryDay, itemId: string): Promise<void> {
  await getAuthedUser();
  const remaining = day.items.filter(i => i.id !== itemId);
  await database().ref(`trips/${tripId}/itinerary/${day.stopId}/${day.id}/items`).set(remaining);
}

function itemsFromSnapshot(raw: unknown): ItineraryItem[] {
  if (Array.isArray(raw)) return raw.filter(Boolean) as ItineraryItem[];
  return Object.values((raw ?? {}) as Record<string, ItineraryItem>);
}

/**
 * Idempotently removes one item from the latest server day. This is the delayed-commit
 * delete path: it never writes a potentially visibility-filtered UI copy of the day.
 *
 * A transaction rather than read-then-set, matching `reorderItineraryDayItems` below — the
 * Undo window is four seconds wide, and a read-then-set would drop anything a companion added
 * to the same day in between. Warming the reference first avoids treating an uncached
 * transaction's initial null as a deleted day.
 */
export async function removeItineraryItemById(
  tripId: string,
  stopId: string,
  dayId: string,
  itemId: string,
): Promise<void> {
  await getAuthedUser();
  const itemsRef = database().ref(`trips/${tripId}/itinerary/${stopId}/${dayId}/items`);
  const initial = itemsFromSnapshot((await itemsRef.once('value')).val());
  // Already gone is success, not a race: Retry after a failed commit lands here.
  if (!initial.some(item => item.id === itemId)) return;

  // The only abort this transform can produce is "the item is already gone", which is the
  // outcome we wanted. A genuine retry exhaustion rejects the promise instead, so nothing is
  // swallowed by returning normally here.
  await itemsRef.transaction((raw: unknown) => {
    if (raw === null || raw === undefined) return undefined;
    const current = itemsFromSnapshot(raw);
    if (!current.some(item => item.id === itemId)) return undefined;
    return current.filter(item => item.id !== itemId);
  });
}

/**
 * Reorders against the latest complete server array in an RTDB transaction. Warming the
 * reference first avoids treating an uncached transaction's initial null value as a deleted
 * day; the transaction still retries our pure transform if another client wins the race.
 */
export async function reorderItineraryDayItems(
  tripId: string,
  stopId: string,
  dayId: string,
  move: ItineraryItemMove,
): Promise<void> {
  await getAuthedUser();
  const itemsRef = database().ref(`trips/${tripId}/itinerary/${stopId}/${dayId}/items`);
  const initial = itemsFromSnapshot((await itemsRef.once('value')).val());
  if (!initial.some(item => item.id === move.itemId)) {
    throw new Error('Itinerary item no longer exists');
  }

  const result = await itemsRef.transaction((raw: unknown) => {
    if (raw === null || raw === undefined) return undefined;
    const current = itemsFromSnapshot(raw);
    if (!current.some(item => item.id === move.itemId)) return undefined;
    return reorderItineraryItems(current, move);
  });
  if (!result.committed) throw new Error('Itinerary changed before the move could be saved');
}
