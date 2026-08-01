import { database, authReady } from '@/src/lib/firebase';
import { writeTripOnce } from '@/src/lib/atomicTripWrite';
import { generateId } from '@/src/utils/id';
import { TRIP_COLOR_PACKS } from '@/src/design/tripPacks';
import type { Trip, Stop, SetupIntent, TripColorPackRef } from '@/src/types';

export interface CreateTripInput {
  name: string;
  organizerHandle: string;
  pills: string[];
  firstStop: {
    city: string;
    region: string;
    lat?: number;
    lon?: number;
    dates?: { start: string; end: string };
  };
  setupIntent: SetupIntent;
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
  const user = await authReady;
  const uid = user.uid;

  const tripId = generateId();
  const inviteToken = generateId();
  const firstStopId = generateId();

  // No UI for pack selection this round — a simple random pick from the 6 defined packs.
  const randomPack = TRIP_COLOR_PACKS[Math.floor(Math.random() * TRIP_COLOR_PACKS.length)];
  const colorPack: TripColorPackRef = {
    id: randomPack.id,
    stopColors: randomPack.stopColors,
    heroGradient: randomPack.heroGradient,
  };

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

  // Step 2 — only after step 1 has committed. Undated first stops default to a single day
  // (today, in both fields) rather than an empty string, so downstream date-range comparisons
  // (e.g. src/domain/trip.ts, CTACardZone.tsx) that lexicographically compare ISO strings still
  // behave sensibly; coordinates default to 0/0 when the caller didn't resolve them via
  // geocoding (mirrors the "Continue anyway" no-coordinates path the wizard/Add Stop UI allows).
  const todayIso = new Date(createdAt).toISOString().split('T')[0];
  const firstStop: Stop = {
    id: firstStopId,
    tripId,
    city: input.firstStop.city,
    region: input.firstStop.region,
    emoji: '📍',
    lat: input.firstStop.lat ?? 0,
    lon: input.firstStop.lon ?? 0,
    dates: input.firstStop.dates ?? { start: todayIso, end: todayIso },
    order: 0,
  };

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
