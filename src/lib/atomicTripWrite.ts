import { database } from '@/src/lib/firebase';

/**
 * Writes a brand-new trip object to `trips/{tripId}`, treating a `database/permission-denied`
 * rejection as "already exists" rather than a real failure.
 *
 * A pre-write existence *read* can't work here: `.read` on trips/{tripId} requires already
 * being the trip's owner or a member, which is impossible for a trip that doesn't exist yet.
 * The `!data.exists()` write rule is what actually enforces the once-only guarantee, so this
 * attempts the write directly and inspects the rejection instead.
 */
export async function writeTripOnce(
  tripId: string,
  tripData: unknown,
  onAlreadyExists: 'continue' | 'throw',
): Promise<void> {
  try {
    await database().ref(`trips/${tripId}`).set(tripData);
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code !== 'database/permission-denied') throw err;
    if (onAlreadyExists === 'throw') {
      throw new Error(
        `trips/${tripId} already exists — refusing to overwrite. This script is meant to run ` +
        `exactly once. Delete the node manually first if you really intend to re-run it.`,
      );
    }
    // else: already seeded on an earlier run — fall through, step 2 still needs to happen.
  }
}
