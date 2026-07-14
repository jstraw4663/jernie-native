import firestore, { documentId } from '@react-native-firebase/firestore';

// Firestore's 'in' operator supports at most this many comparison values per query
// (raised from 10 to 30 by the Firestore backend in 2021 — a server-side limit, not
// something enforced or versioned by the client library). Confirmed against the
// installed @react-native-firebase/firestore@24.0.0 source: no client-side cap is
// declared anywhere in its types or implementation, so this mirrors the documented
// backend limit directly.
const CHUNK_SIZE = 30;

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/**
 * Reads multiple Firestore docs by id from a single collection, in chunked
 * `where(documentId(), 'in', chunk)` batches (≤30 ids per query — see CHUNK_SIZE),
 * and merges the results into one map keyed by doc id. Chunking is entirely internal:
 * callers pass the full id list and get back one merged map, never seeing chunk
 * boundaries. Docs that don't exist are simply absent from the result.
 *
 * Note: uses the modular `documentId()` function (named export), not the namespaced
 * `firestore.FieldPath.documentId()` — the latter is declared in this library's
 * namespaced type definitions but is not actually implemented on the FieldPath class
 * in the installed version (@react-native-firebase/firestore@24.0.0), so calling it
 * would throw at runtime. `documentId()` returns the same underlying FieldPath
 * sentinel and is fully supported by the namespaced `.where()`.
 */
export async function getDocsByIds<T>(collectionName: string, ids: string[]): Promise<Record<string, T>> {
  if (ids.length === 0) return {};

  const chunks = chunk(ids, CHUNK_SIZE);
  const snapshots = await Promise.all(
    chunks.map(idChunk =>
      firestore().collection(collectionName).where(documentId(), 'in', idChunk).get(),
    ),
  );

  const result: Record<string, T> = {};
  snapshots.forEach(snapshot => {
    snapshot.docs.forEach(doc => {
      if (doc.exists()) result[doc.id] = doc.data() as T;
    });
  });
  return result;
}
