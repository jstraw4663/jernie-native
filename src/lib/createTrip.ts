import { database, getAuthedUser } from '@/src/lib/firebase';
import { writeTripOnce } from '@/src/lib/atomicTripWrite';
import { generateId } from '@/src/utils/id';
import type { Trip, Stop, SetupIntent, TripColorPackRef } from '@/src/types';

export interface CreateTripInput {
  name: string;
  organizerHandle: string;
  pills: string[];
  // All three of lat/lon/dates are required, never defaulted here — a stop can't reach
  // createTrip() without a successful geocode and real dates. That's enforced upstream, in the
  // UI layer (StopForm's submit/"Continue" stays disabled until both are resolved), not here.
  firstStop: {
    city: string;
    region: string;
    lat: number;
    lon: number;
    dates: { start: string; end: string };
  };
  setupIntent: SetupIntent;
  colorPack: TripColorPackRef;
}

// Creating a trip is a strictly sequential two-step write, never a single bundled update() —
// same protocol as devSeed.ts and useJoinTrip.ts. database.rules.json's trips/$tripId write
// rule requires `!data.exists()` and checks `newData.child('ownerUid')`; the members, users
// index, inviteTokens, and stops rules all read back `root.child('trips/' + $tripId +
// 'ownerUid')`. A sibling path bundled into the *same* multi-location update() as the trip's
// own creation only sees pre-update state, not this trip's new ownerUid (empirically verified
// against the RTDB emulator — see devSeed.ts:221-232). So:
//   step 1 — a standalone writeTripOnce() on trips/{tripId}, awaited to completion
//   step 2 — only after step 1 resolves, a single update() bundling the organizer's membership
//            record, the user's trips index entry, the invite token lookup, and the first stop
export async function createTrip(input: CreateTripInput): Promise<string> {
  const user = await getAuthedUser();
  const uid = user.uid;

  const tripId = generateId();
  const inviteToken = generateId();
  const firstStopId = generateId();

  // Chosen in OnboardingDraftContext at wizard start so step 3 can preview it.
  const colorPack: TripColorPackRef = input.colorPack;

  const createdAt = Date.now();

  const trip: Trip = {
    id: tripId,
    name: input.name,
    ownerUid: uid,
    createdAt,
    pills: input.pills,
    inviteToken,
    colorPack,
    setupIntent: input.setupIntent,
  };

  // Step 1 — standalone, awaited to completion before step 2 is even attempted. A freshly
  // generated tripId should never already exist, so a collision here is a real error, not a
  // benign re-run to tolerate (unlike devSeed.ts's fixed dev fixture id) — hence 'throw'.
  await writeTripOnce(tripId, trip, 'throw');

  // Step 2 — only after step 1 has committed. lat/lon/dates come straight from the caller —
  // CreateTripInput requires them, so there's nothing to default or paper over here.
  const firstStop: Stop = {
    id: firstStopId,
    tripId,
    city: input.firstStop.city,
    region: input.firstStop.region,
    // Deprecated and never rendered; written only because the field is non-optional
    // on Stop and the record is immutable once created. See src/design/icons.ts.
    emoji: '',
    lat: input.firstStop.lat,
    lon: input.firstStop.lon,
    dates: input.firstStop.dates,
    order: 0,
  };

  // Accepted risk (same class as useJoinTrip.ts's two-step protocol): if this update() rejects
  // after step 1 already committed, trips/{tripId} is left orphaned — ownerUid set, but no
  // members/users-index/inviteTokens/stops. There is no client-side recovery: the trips/$tripId
  // write rule is `!data.exists() && ...`, so once step 1 commits, `data.exists()` is true and
  // the rule denies ANY further top-level write to that path, including a delete — the node is
  // create-once and immutable at that level, un-deletable by the client. No retry/rollback is
  // attempted here; the rejection below is left to propagate to the caller uncaught, same as
  // useJoinTrip.ts's step 2, so the failure surfaces as a clear error rather than being silently
  // swallowed or retried.
  const joinedAt = createdAt;
  await database().ref().update({
    [`trips/${tripId}/members/${uid}`]: {
      uid,
      handle: input.organizerHandle,
      role: 'organizer',
      joinedAt,
    },
    [`users/${uid}/trips/${tripId}`]: { role: 'organizer', joinedAt },
    [`inviteTokens/${inviteToken}`]: tripId,
    [`trips/${tripId}/stops/${firstStopId}`]: firstStop,
  });

  return tripId;
}
