import { database, getAuthedUser } from '@/src/lib/firebase';
import { generateId } from '@/src/utils/id';
import { stripUndefined } from '@/src/utils/stripUndefined';
import { buildPlaceRemovalUpdates, parseItineraryFromSnapshot } from '@/src/domain/cascade';
import type { Place } from '@/src/types';

/**
 * A place before it has an id or a tripId.
 *
 * Unlike `Place`, `lat`/`lon` are REQUIRED. They are the canonical enrichment-cache key
 * (see src/domain/placeEnrichment.ts), so a place written without them can never be
 * enriched — it would render forever without a photo, rating or hours. Legacy curated
 * places predate coordinate capture and so keep them optional on `Place` itself, but
 * nothing written from here is allowed to add to that backlog.
 */
export type NewPlace = Omit<Place, 'id' | 'tripId' | 'lat' | 'lon'> & { lat: number; lon: number };

export type PlacePatch = Partial<Omit<Place, 'id' | 'tripId'>>;

/**
 * Saves a place to `trips/{tripId}/places/{newId}`.
 *
 * This path has had a reader since Explore shipped but never a writer — only
 * cascade-delete has ever touched it — which is why the add sheet's "Saved for this stop"
 * rail has always been empty. Mirrors `addBooking` exactly.
 */
export async function addPlace(tripId: string, input: NewPlace): Promise<string> {
  await getAuthedUser();
  const placeId = generateId();
  const place = { ...input, id: placeId, tripId } as Place;
  // Shallow strip is sufficient — Place has no nested optional objects.
  await database().ref(`trips/${tripId}/places/${placeId}`).set(stripUndefined(place));
  return placeId;
}

export async function updatePlace(tripId: string, placeId: string, patch: PlacePatch): Promise<void> {
  await getAuthedUser();
  await database().ref(`trips/${tripId}/places/${placeId}`).update(stripUndefined(patch));
}

/**
 * Deletes a place and any itinerary item referencing it, in one root-level multi-path
 * update so the two can never diverge. Mirrors `removeBooking`.
 */
export async function removePlace(tripId: string, placeId: string): Promise<void> {
  await getAuthedUser();
  const snap = await database().ref(`trips/${tripId}/itinerary`).once('value');
  const itinerary = parseItineraryFromSnapshot(snap.val());
  const updates = buildPlaceRemovalUpdates(tripId, placeId, itinerary);
  await database().ref().update(updates);
}
