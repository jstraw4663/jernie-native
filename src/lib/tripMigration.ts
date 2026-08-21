import { database, getAuthedUser } from '@/src/lib/firebase';
import { writeTripOnce } from '@/src/lib/atomicTripWrite';
import { generateId } from '@/src/utils/id';
import {
  stageMigration,
  readStagedMigration,
  clearStagedMigration,
  type StagedTrip,
} from '@/src/lib/migrationStaging';

// Carries an anonymous user's trips into an existing account on a sign-in collision.
//
// The trip is COPIED to a new id, never transferred. database.rules.json's trips/$tripId
// write rule is `!data.exists() && newData.child('ownerUid').val() === auth.uid`: the node is
// create-once, ownerUid has no child rule of its own, and so no client can ever rewrite it.
// A transfer would also need the destination uid while still signed in as the anonymous one,
// which is impossible — that uid is only learned by signing in, and signing in destroys the
// anonymous credential. Copying costs a new invite link, which costs nothing in practice:
// sharing an invite is gated behind being signed in, so a trip owned by an anonymous uid has
// never been shared and can have no other members.

export interface MigrationResult {
  created: string[];
  failed: number;
}

/**
 * The trips an anonymous uid can actually take with it: the live ones it owns. A trip it
 * merely joined belongs to someone else and cannot be copied; an archived one is in Recently
 * Deleted and shouldn't be resurrected under a new id.
 */
export function migratableTripIds(
  trips: { tripId: string; role: string; deletedAt?: number | null }[],
): string[] {
  return trips.filter(t => t.role === 'organizer' && !t.deletedAt).map(t => t.tripId);
}

export async function captureTrips(tripIds: string[]): Promise<StagedTrip[]> {
  const snaps = await Promise.all(
    tripIds.map(id => database().ref(`trips/${id}`).once('value')),
  );
  return snaps
    .map((snap, i) => ({ tripId: tripIds[i], data: snap.exists() ? snap.val() : null }))
    .filter((t): t is StagedTrip => t.data !== null);
}

/**
 * Deep substitution over both keys and string values.
 *
 * Uids appear as map keys (members/{uid}, confirms/{uid}) and as values (ownerUid, addedBy,
 * createdBy, suggestedBy), and trip ids appear as the trip's own `id` and as a `tripId` on
 * every nested entity. Substituting generically rather than enumerating fields means a field
 * added later is carried across without this module needing to know about it.
 */
export function remap(node: unknown, subs: Record<string, string>): unknown {
  if (typeof node === 'string') return subs[node] ?? node;
  if (Array.isArray(node)) return node.map(n => remap(n, subs));
  if (node && typeof node === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node)) {
      out[subs[k] ?? k] = remap(v, subs);
    }
    return out;
  }
  return node;
}

async function copyOne(staged: StagedTrip, fromUid: string, toUid: string): Promise<string> {
  const source = staged.data as Record<string, unknown>;
  const newTripId = generateId();
  const newInviteToken = generateId();

  const subs: Record<string, string> = { [staged.tripId]: newTripId, [fromUid]: toUid };
  const oldToken = source.inviteToken;
  if (typeof oldToken === 'string' && oldToken) subs[oldToken] = newInviteToken;

  const remapped = remap(source, subs) as Record<string, unknown>;

  // `members` carries a .validate that reads trips/{id}/ownerUid back out of the tree, and
  // during this set() that path is still uncommitted — the exact reason createTrip.ts and
  // devSeed.ts split their writes in two. `joinProofs` belonged to the abandoned uid and
  // means nothing under an owner who needs no proof.
  const { members, joinProofs: _joinProofs, ...step1 } = remapped;
  step1.ownerUid = toUid;
  step1.id = newTripId;
  step1.inviteToken = newInviteToken;

  // 'throw' rather than 'continue': newTripId is freshly generated, so an already-exists
  // denial here is a real fault, not a benign re-run.
  await writeTripOnce(newTripId, step1, 'throw');

  const handle = (members as Record<string, { handle?: string }> | undefined)?.[toUid]?.handle;
  const joinedAt = Date.now();
  await database().ref().update({
    [`trips/${newTripId}/members/${toUid}`]: {
      uid: toUid,
      handle: handle ?? 'You',
      role: 'organizer',
      joinedAt,
    },
    [`users/${toUid}/trips/${newTripId}`]: { role: 'organizer', joinedAt },
    [`inviteTokens/${newInviteToken}`]: newTripId,
  });

  return newTripId;
}

/**
 * Copies whatever is staged into the currently signed-in account. Safe to call on every
 * launch: it returns immediately when nothing is staged.
 */
export async function migrateStagedTrips(): Promise<MigrationResult> {
  const staged = readStagedMigration();
  if (!staged) return { created: [], failed: 0 };

  const user = await getAuthedUser();
  // Still the uid the payload was captured from — the sign-in never happened, and copying a
  // trip onto its own owner would just duplicate it. Leave the payload for the real sign-in.
  if (user.uid === staged.fromUid) return { created: [], failed: 0 };

  const created: string[] = [];
  const remaining: StagedTrip[] = [];
  for (const trip of staged.trips) {
    try {
      created.push(await copyOne(trip, staged.fromUid, user.uid));
    } catch {
      // Per-trip, so one bad trip cannot strand the rest. What's left stays staged and is
      // retried on the next launch.
      remaining.push(trip);
    }
  }

  if (remaining.length === 0) clearStagedMigration();
  else stageMigration({ fromUid: staged.fromUid, trips: remaining });

  return { created, failed: remaining.length };
}

/**
 * Signs into the colliding account, optionally bringing the anonymous uid's trips along.
 *
 * Ordering is the whole point: the capture happens while the anonymous credential still
 * works, and the staging write happens before the sign-in that destroys it.
 */
export async function adoptAccount(
  signIn: () => Promise<void>,
  opts: { fromUid: string; tripIds: string[]; migrate: boolean },
): Promise<MigrationResult> {
  if (opts.migrate && opts.tripIds.length > 0) {
    const captured = await captureTrips(opts.tripIds);
    if (captured.length > 0) stageMigration({ fromUid: opts.fromUid, trips: captured });
  }
  await signIn();
  return migrateStagedTrips();
}
