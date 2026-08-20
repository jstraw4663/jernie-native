// One-time PWA → jernie-native data import (Task 9 of the data-model rebuild plan).
//
// Reads the retired PWA's trip.json (a point-in-time copy is bundled at
// `./pwaTripSnapshot.json` — re-copy it from `~/jernie/public/trip.json` first if that
// file has changed since 2026-07-07), transforms it into the new schema via the pure
// functions in `./importPwaTrip.transform.ts`, and writes the real Maine 2026 trip into
// the real `jernie-native-dev` Firebase project as `trips/maine-2026`, following the same
// two-step write protocol as Task 5 / `src/lib/devSeed.ts` / `src/hooks/useJoinTrip.ts`:
//   step 1 — a standalone `set()` of the whole trip object (trip + stops + bookings +
//            itinerary + places + groups), awaited to completion
//   step 2 — only after step 1 resolves, one bundled `update()` for
//            trips/{tripId}/members/{uid}, users/{uid}/trips/{tripId}, inviteTokens/{token}
//
// ── Why this is NOT a plain `node`/`ts-node` CLI script ──────────────────────────────
// This repo has no Firebase Admin SDK / service account set up (no `firebase-admin`
// dependency, no credentials file) — the only Firebase client configured is
// `@react-native-firebase/{auth,database}` (see `src/lib/firebase.ts`), which is a native
// (JSI) module that only runs inside a real RN app process, never under plain Node. So
// `runPwaImport()` below must be invoked from *within a running instance of the app*,
// signed in against the real project — see "HOW TO RUN FOR REAL" below. This is the
// "run it from within a debug screen in the app" option the brief offered, chosen because
// the RN Firebase client is what's already set up in this repo.
//
// ── HOW TO RUN FOR REAL (NOT done by writing this file — a deliberate later step) ────
//   1. Confirm `scripts/pwaTripSnapshot.json` still matches the live `~/jernie/public/trip.json`.
//   2. Temporarily wire a call to `runPwaImport()` behind a manual trigger — e.g. a button
//      on a debug screen, or a one-off `onPress` — in a dev build running on a device/
//      simulator signed in (anonymously) against the real `jernie-native-dev` project.
//      Do NOT auto-run it the way `maybeSeedDevData()` auto-runs in `__DEV__` — this
//      writes real data exactly once and must be a deliberate, single tap.
//   3. Tap it once. Watch the console for `[importPwaTrip] Imported trip "maine-2026"...`
//      and the freshly generated invite token it logs (share that with Jennie once she's
//      ready to join).
//   4. Remove the temporary trigger.
//   5. Verify per the brief: load the trip in the app, confirm stops/bookings/itinerary/
//      places render, confirm the merged rental (Portland pickup → Southwest Harbor/Bangor
//      dropoff) and the Beehive-vs-Jordan-Pond group-scoped item behave correctly.

import { auth, getAuthedUser, database } from '@/src/lib/firebase';
import { writeTripOnce } from '@/src/lib/atomicTripWrite';
import pwaTripRaw from './pwaTripSnapshot.json';
import { buildImportPayload, NEW_TRIP_ID, type PwaData } from './importPwaTrip.transform';

export * from './importPwaTrip.transform';

/** Not cryptographically secure, but neither is the rest of this codebase's id/token
 * generation (see `src/lib/writeQueue.ts`'s `generateId`) — sufficient entropy for a
 * private family trip's invite link, and explicitly not a low-entropy literal like the
 * dev fixture's `'abc123'`. */
function generateInviteToken(): string {
  const part = () => Math.random().toString(36).slice(2, 10);
  return (part() + part() + part()).slice(0, 24);
}

export async function runPwaImport(): Promise<{ tripId: string; inviteToken: string }> {
  await getAuthedUser();
  const uid = auth().currentUser?.uid;
  if (!uid) throw new Error('not authenticated — anonymous sign-in must complete before running the import');

  const inviteToken = generateInviteToken();
  const payload = buildImportPayload(pwaTripRaw as unknown as PwaData, {
    uid,
    now: Date.now(),
    inviteToken,
  });

  // Step 1 — standalone, awaited to completion before step 2 is even attempted.
  // This script must run exactly once, so a pre-existing trip is a real error, not a
  // resumable state — see writeTripOnce() for why this can't be a pre-write existence read.
  await writeTripOnce(payload.tripId, payload.tripWrite, 'throw');

  // Step 2 — only after step 1 has committed.
  await database().ref().update(payload.step2Update);

  console.log(`[importPwaTrip] Imported trip "${payload.tripId}" as uid ${uid}. Invite token: ${inviteToken}`);
  return { tripId: payload.tripId, inviteToken };
}
