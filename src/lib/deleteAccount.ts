import { database } from '@/src/lib/firebase';
import { archiveTrip } from '@/src/lib/tripWrites';

/**
 * Removes the user's own data. The auth user itself is deleted by the caller, AFTER this
 * resolves — so a partial failure leaves the user signed in and able to retry rather than
 * stranded with an orphaned auth record and no way back in.
 *
 * Deliberately not a full cascade: members, group references and other travellers' views
 * of a deleted organizer need a Cloud Function. See docs/superpowers/known-issues.md.
 */
export async function deleteAccountData(uid: string, ownedTripIds: string[]): Promise<void> {
  for (const tripId of ownedTripIds) {
    await archiveTrip(tripId);
  }
  await database().ref(`users/${uid}`).remove();
}
