// One-time migration: copies real Google Places enrichment data the retired PWA already
// cached (and paid for) in its own Firebase project's Firestore into jernie-native-dev's
// Firestore, at a flat, GLOBAL collection keyed by an app-owned canonical key (normalized
// name + rounded lat/lon — see src/domain/placeEnrichment.ts), not by trip or by any
// provider's proprietary ID. This is what lets the same physical place enriched via
// different trips (or eventually different providers) share one cached record instead of
// duplicating API spend. It's a pure reuse of already-fetched data — ZERO new external
// API calls.
//
// The legacy cached docs mostly don't carry their own `name` (the old schema didn't need
// it — docs were keyed by the RTDB place's own id) and use different field names than the
// current PlaceEnrichment type (`addr` not `address`, `user_ratings_total` not
// `ratingCount`, string `price_level` not `price`) — see importFirestoreEnrichment.transform.ts.
// So this script also reads the current RTDB places (for `name`, matched by the id
// preserved 1:1 through the original RTDB import) and, for every place it successfully
// migrates, backfills `lat`/`lon` onto that RTDB Place record — without stored coordinates,
// the app has no way to compute the same canonical key later to look enrichment back up.
//
// Runs in plain Node via firebase-admin — unlike the RTDB trip-data import
// (scripts/importPwaTrip.ts), which had to run inside the RN app because
// @react-native-firebase is native-only, the Admin SDK works fine standalone.
//
// ── HOW TO RUN ──────────────────────────────────────────────────────────────────────
//   1. Generate a service account key for the SOURCE project (jernie-e36d8):
//      Firebase Console → jernie-e36d8 → Project Settings → Service Accounts →
//      Generate new private key. Save it OUTSIDE this repo (e.g. your scratchpad) —
//      never commit it (*firebase-adminsdk*.json is gitignored regardless, as a backstop).
//   2. Generate a second service account key for the TARGET project (jernie-native-dev),
//      same steps, same warning.
//   3. Run:
//        SOURCE_SERVICE_ACCOUNT=/path/to/jernie-e36d8-key.json \
//        TARGET_SERVICE_ACCOUNT=/path/to/jernie-native-dev-key.json \
//        npx ts-node --compiler-options '{"module":"commonjs"}' scripts/importFirestoreEnrichment.ts
//   4. Watch the console summary: how many docs were found, copied, and skipped.
//   5. Delete both key files once done (or store them somewhere safe — never in this repo).

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getDatabase } from 'firebase-admin/database';
import { buildMigration } from './importFirestoreEnrichment.transform';

const SOURCE_TRIP_ID = 'maine-2026'; // trip id in the OLD PWA's Firestore data
const TARGET_TRIP_ID = 'maine-2026'; // trip id in jernie-native's RTDB (see importPwaTrip.transform.ts's NEW_TRIP_ID)
const TARGET_DATABASE_URL = 'https://jernie-native-dev-default-rtdb.firebaseio.com';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

async function main() {
  const sourceKeyPath = requireEnv('SOURCE_SERVICE_ACCOUNT');
  const targetKeyPath = requireEnv('TARGET_SERVICE_ACCOUNT');

  const sourceApp = initializeApp({ credential: cert(sourceKeyPath) }, 'source');
  const targetApp = initializeApp(
    { credential: cert(targetKeyPath), databaseURL: TARGET_DATABASE_URL },
    'target',
  );

  const sourceFirestore = getFirestore(sourceApp);
  const targetFirestore = getFirestore(targetApp);
  const targetRtdb = getDatabase(targetApp);

  // Current RTDB place names, for matching against the legacy (name-less) enrichment docs.
  const placesSnap = await targetRtdb.ref(`trips/${TARGET_TRIP_ID}/places`).get();
  const rtdbPlaces = (placesSnap.val() ?? {}) as Record<string, { name: string }>;
  const rtdbNamesById: Record<string, string> = {};
  for (const [id, place] of Object.entries(rtdbPlaces)) rtdbNamesById[id] = place.name;

  const sourceCollection = sourceFirestore.collection(`place_enrichment/${SOURCE_TRIP_ID}/places`);
  const snapshot = await sourceCollection.get();

  if (snapshot.empty) {
    console.log(`[importFirestoreEnrichment] No cached enrichment docs found at place_enrichment/${SOURCE_TRIP_ID}/places in the source project. Nothing to import.`);
    return;
  }

  const rawDocsById: Record<string, unknown> = {};
  snapshot.forEach(docSnap => { rawDocsById[docSnap.id] = docSnap.data(); });

  const { copied, skipped } = buildMigration(rawDocsById, rtdbNamesById);

  // Write the global, canonical-key-keyed enrichment docs.
  const firestoreBatch = targetFirestore.batch();
  for (const { canonicalKey, enrichment } of copied) {
    firestoreBatch.set(targetFirestore.doc(`place_enrichment/${canonicalKey}`), enrichment);
  }
  await firestoreBatch.commit();

  // Backfill lat/lon onto each corresponding RTDB Place record so the app can compute
  // the same canonical key later to look this enrichment back up.
  const rtdbUpdate: Record<string, number> = {};
  for (const { rtdbPlaceId, enrichment } of copied) {
    rtdbUpdate[`trips/${TARGET_TRIP_ID}/places/${rtdbPlaceId}/lat`] = enrichment.lat;
    rtdbUpdate[`trips/${TARGET_TRIP_ID}/places/${rtdbPlaceId}/lon`] = enrichment.lon;
  }
  if (Object.keys(rtdbUpdate).length > 0) {
    await targetRtdb.ref().update(rtdbUpdate);
  }

  console.log(
    `[importFirestoreEnrichment] Done. Found ${snapshot.size} cached docs — ` +
    `copied ${copied.length} (backfilled lat/lon on ${copied.length} RTDB places), ` +
    `skipped ${skipped.length}${skipped.length ? ` (${skipped.join(', ')})` : ''}.`,
  );
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('[importFirestoreEnrichment] Failed:', err);
    process.exit(1);
  });
