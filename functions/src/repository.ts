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

const COLLECTION = 'place_enrichment';

export async function getEnrichment(canonicalKey: string): Promise<PlaceEnrichment | undefined> {
  const snapshot = await getFirestore().collection(COLLECTION).doc(canonicalKey).get();
  return snapshot.exists ? (snapshot.data() as PlaceEnrichment) : undefined;
}

export async function writeEnrichment(canonicalKey: string, data: PlaceEnrichment): Promise<void> {
  await getFirestore().collection(COLLECTION).doc(canonicalKey).set(data);
}
