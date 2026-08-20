import { database, getAuthedUser } from '@/src/lib/firebase';
import { stripUndefined } from '@/src/utils/stripUndefined';
import type { Trip } from '@/src/types';

export type TripPatch = Partial<Pick<Trip, 'name' | 'pills'>>;

/** Owner-only per RTDB rules (`name`/`pills` each carry an ownerUid check). */
export async function updateTrip(tripId: string, patch: TripPatch): Promise<void> {
  await getAuthedUser();
  await database().ref(`trips/${tripId}`).update(stripUndefined(patch));
}

/**
 * Soft-delete: stamps `deletedAt` so the trip drops out of the user's active list while
 * all of its data stays intact and restorable. There is no hard delete — RTDB rules make
 * `trips/{tripId}` create-only, and a shared trip's other members would lose it silently.
 */
export async function archiveTrip(tripId: string): Promise<void> {
  await getAuthedUser();
  await database().ref(`trips/${tripId}`).update({ deletedAt: Date.now() });
}

export async function restoreTrip(tripId: string): Promise<void> {
  await getAuthedUser();
  await database().ref(`trips/${tripId}`).update({ deletedAt: null });
}
