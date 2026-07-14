// Thin Admin SDK wrapper over the flat, global `place_enrichment` Firestore collection
// (see the root app's src/domain/placeEnrichment.ts for how canonicalKey is derived —
// normalized name + rounded lat/lon, not any provider's proprietary place ID). Uses the
// Admin SDK (firebase-admin/firestore), not the client SDK — this runs server-side with
// full read/write access; firestore.rules only ever grants clients read on this
// collection ("allow write: if false" — Cloud Functions are the only writer).
//
// getFirestore() is called per-operation (not memoized at module scope) so this module
// only touches the default app lazily, after whatever entrypoint has called
// initializeApp() — and so it stays trivially mockable in tests.

import { getFirestore } from 'firebase-admin/firestore';
import type { PlaceEnrichment } from './types';

const COLLECTION = 'place_enrichment';

export async function getEnrichment(canonicalKey: string): Promise<PlaceEnrichment | undefined> {
  const snapshot = await getFirestore().collection(COLLECTION).doc(canonicalKey).get();
  return snapshot.exists ? (snapshot.data() as PlaceEnrichment) : undefined;
}

export async function writeEnrichment(canonicalKey: string, data: PlaceEnrichment): Promise<void> {
  await getFirestore().collection(COLLECTION).doc(canonicalKey).set(data);
}
