// Thin Admin SDK wrapper over the flat, global `place_enrichment` Firestore collection
// (see the root app's src/domain/placeEnrichment.ts for how canonicalKey is derived —
// normalized name + rounded lat/lon, not any provider's proprietary place ID). Uses the
// Admin SDK (firebase-admin/firestore), not the client SDK — this runs server-side with
// full read/write access; firestore.rules only ever grants clients read on this
// collection ("allow write: if false" — Cloud Functions are the only writer).
//
// getFirestore() is called per-operation (not memoized at module scope) so this module
// stays trivially mockable in tests. Initialization of the default app/Firestore
// instance itself, however, has to happen somewhere — nothing else in this codebase
// calls initializeApp(), so this module does it eagerly at import time, guarded by
// getApps().length to stay safe if it's ever imported more than once per process.
//
// ignoreUndefinedProperties is required here: mergeEnrichment (see merge.ts) can
// legitimately produce fields with an `undefined` value (Foursquare omitting phone,
// website, hours, etc.), and the Admin SDK's default `.set()` behavior throws on any
// `undefined` value anywhere in the written object. NOTE: this is set via
// `Firestore.settings()`, not via `initializeFirestore(app, { ignoreUndefinedProperties
// })` — despite that being how some docs/snippets phrase it, firebase-admin@13.10.0's
// own `FirestoreSettings` type (the one `initializeFirestore` accepts) only supports
// `preferRest`; `ignoreUndefinedProperties` isn't part of it and is silently dropped
// before it ever reaches the underlying `@google-cloud/firestore` client (confirmed by
// reading firebase-admin's compiled firestore-internal.js, which extracts only
// `preferRest` out of the settings object it's given). `Firestore.settings()` is the
// method that actually accepts and applies `ignoreUndefinedProperties`.
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import type { PlaceEnrichment } from './types';

if (getApps().length === 0) {
  initializeApp();
  getFirestore().settings({ ignoreUndefinedProperties: true });
}

/**
 * The initialized Firestore handle, for other modules that need one.
 *
 * Exported so nothing else has to call `getFirestore()` directly. Importing this module is
 * what applies the one-time `initializeApp()` + `settings({ ignoreUndefinedProperties })`
 * above, and a second module doing its own `getApps().length === 0` check would skip that
 * settings call whenever it happened to load first — leaving enrichment writes to throw on
 * their first undefined field. Routing every caller through here makes that ordering
 * impossible to get wrong.
 */
export function firestore(): ReturnType<typeof getFirestore> {
  return getFirestore();
}

const COLLECTION = 'place_enrichment';

export async function getEnrichment(canonicalKey: string): Promise<PlaceEnrichment | undefined> {
  const snapshot = await getFirestore().collection(COLLECTION).doc(canonicalKey).get();
  return snapshot.exists ? (snapshot.data() as PlaceEnrichment) : undefined;
}

export async function writeEnrichment(canonicalKey: string, data: PlaceEnrichment): Promise<void> {
  await getFirestore().collection(COLLECTION).doc(canonicalKey).set(data);
}

// ── Route cache ──────────────────────────────────────────────────────────────
//
// `route_cache/{cacheKey}` holds ONLY our own derived integers — minutes and miles —
// never Mapbox route geometry or a raw response. That distinction is deliberate and is
// what the retention argument rests on: we are storing a number we computed, not a copy
// of provider output. Directions is called with `overview=false` so the geometry never
// reaches us in the first place (see providers/mapbox.ts).
//
// The key is derived CLIENT-side (see the root app's src/domain/routeCache.ts) and passed
// in, exactly as enrichPlaces takes a client-derived canonicalKey. Both sides would
// otherwise need identical rounding logic, and any drift would silently miss the cache
// rather than fail loudly.

const ROUTE_COLLECTION = 'route_cache';

export interface CachedRoute {
  /** False records a genuine "no drivable route", so it is not re-queried forever. */
  found: boolean;
  minutes?: number;
  miles?: number;
  /**
   * Epoch milliseconds, read by the CLIENT to decide whether an entry may still be served
   * (src/domain/routeCache.ts). A number, not a Timestamp, because that check is plain
   * arithmetic on the client and does not want a Firestore type.
   */
  cachedAt: number;
  /**
   * When Firestore may DELETE this document — a different question from whether it may be
   * served, which is what `cachedAt` answers.
   *
   * A `Date`, which the Admin SDK stores as a Timestamp, because a TTL policy can only act
   * on a timestamp field. That is why this exists at all rather than pointing the policy at
   * `cachedAt`: epoch millis is a number, and a policy on it silently never fires.
   *
   * Enable it once per collection, no application code:
   *   gcloud firestore fields ttls update expiresAt \
   *     --collection-group=route_cache --enable-ttl
   */
  expiresAt: Date;
}

export async function getRoute(cacheKey: string): Promise<CachedRoute | undefined> {
  const snapshot = await getFirestore().collection(ROUTE_COLLECTION).doc(cacheKey).get();
  return snapshot.exists ? (snapshot.data() as CachedRoute) : undefined;
}

export async function writeRoute(cacheKey: string, data: CachedRoute): Promise<void> {
  await getFirestore().collection(ROUTE_COLLECTION).doc(cacheKey).set(data);
}
