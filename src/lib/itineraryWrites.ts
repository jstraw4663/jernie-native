import { database } from '@/src/lib/firebase';
import { generateId } from '@/src/utils/id';
import { buildAddToItineraryItem } from '@/src/domain/explore';
import type { Place, ItineraryDay } from '@/src/types';

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
