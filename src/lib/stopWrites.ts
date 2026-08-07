import { database, authReady } from '@/src/lib/firebase';
import { stripUndefined } from '@/src/utils/stripUndefined';
import {
  buildStopRemovalUpdates, parseBookingsFromSnapshot, parseItineraryFromSnapshot, parsePlacesFromSnapshot,
} from '@/src/domain/cascade';
import type { Stop } from '@/src/types';

export type StopPatch = Partial<Pick<Stop, 'city' | 'region' | 'emoji' | 'lat' | 'lon' | 'dates'>>;

export async function updateStop(tripId: string, stopId: string, patch: StopPatch): Promise<void> {
  await authReady;
  await database().ref(`trips/${tripId}/stops/${stopId}`).update(stripUndefined(patch));
}

export async function removeStop(tripId: string, stopId: string): Promise<void> {
  await authReady;
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
