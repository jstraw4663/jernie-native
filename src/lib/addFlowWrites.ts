import { database, getAuthedUser } from '@/src/lib/firebase';
import { generateId } from '@/src/utils/id';
import { buildBatchCommit } from '@/src/domain/batchCommit';
import type { Candidate } from '@/src/domain/candidate';
import type { ItineraryDay } from '@/src/types';

/**
 * Commits a tray of candidates in one write, and returns the inverse that undoes it.
 *
 * "Add 3 items writes once and offers one undo, not three toasts." Every booking, place
 * and itinerary item in the tray lands in a SINGLE root-level multi-path update — the
 * same pattern useAddStop uses for a stop and its day rows — so the tray can never
 * half-commit. Each leaf path is still permission-checked individually, so the existing
 * `bookings` / `places` / `itinerary` rules apply exactly as they do to single writes.
 *
 * Offline behaviour is RTDB's own: a queued `update()` is flushed on reconnect. Note that
 * src/lib/writeQueue.ts's `enqueueMany` looks like a fit here and deliberately is not
 * used — nothing in the app enqueues into that queue today (only getQueue/flush/subscribe
 * are wired, in ConnectivityContext and AdminPanel), so routing just this one write
 * through it would make the tray behave differently from every other write in the app.
 *
 * The returned inverse is a plain update payload. Hold it for as long as the undo strip
 * is on screen and pass it to `undoCommit`; drop it when the strip goes away.
 */
export async function commitCandidates(
  tripId: string,
  candidates: readonly Candidate[],
  itinerary: Record<string, ItineraryDay[]>,
): Promise<Record<string, unknown>> {
  const { updates, inverse } = buildBatchCommit({ tripId, candidates, itinerary, generateId });

  if (Object.keys(updates).length === 0) return {};

  await getAuthedUser();
  await database().ref().update(updates);

  return inverse;
}

/**
 * Reverses a committed batch: removes the nodes it created and restores every itinerary
 * items array to exactly what it held before. One write, matching the one that made it.
 */
export async function undoCommit(inverse: Record<string, unknown>): Promise<void> {
  if (Object.keys(inverse).length === 0) return;

  await getAuthedUser();
  await database().ref().update(inverse);
}
