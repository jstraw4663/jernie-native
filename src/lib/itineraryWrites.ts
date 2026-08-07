import { database, authReady } from '@/src/lib/firebase';
import { generateId } from '@/src/utils/id';
import { stripUndefined } from '@/src/utils/stripUndefined';
import { buildAddToItineraryItem } from '@/src/domain/explore';
import { buildCustomItineraryItem, type CustomItineraryItemInput } from '@/src/domain/itinerary';
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
  await authReady;
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
  await authReady;
  const cleaned = stripUndefined(patch);
  const updatedItems = day.items.map(i => (i.id === itemId ? { ...i, ...cleaned } : i));
  await database().ref(`trips/${tripId}/itinerary/${day.stopId}/${day.id}/items`).set(updatedItems);
}

/** Type-agnostic remove: works identically for 'place', 'booking', and 'custom' items. */
export async function removeItineraryItem(tripId: string, day: ItineraryDay, itemId: string): Promise<void> {
  await authReady;
  const remaining = day.items.filter(i => i.id !== itemId);
  await database().ref(`trips/${tripId}/itinerary/${day.stopId}/${day.id}/items`).set(remaining);
}
