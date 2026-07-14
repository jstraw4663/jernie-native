import { useEffect, useRef, useState } from 'react';
import { getDocsByIds } from '@/src/lib/firestoreBatchGet';
import { enrichPlaces, type MissingPlace } from '@/src/lib/enrichmentClient';
import { canonicalPlaceKey } from '@/src/domain/placeEnrichment';
import type { Place, PlaceEnrichment } from '@/src/types';

// Mirrors functions/src/enrichPlaces.ts's MAX_BATCH_SIZE — the deployed callable rejects
// outright above this count (Global Constraint #10's chunk-size alignment), so a large
// miss list is split into batches no bigger than this before ever calling enrichPlaces.
const ENRICH_BATCH_SIZE = 30;

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/**
 * Cache-aside lookup of place enrichment, keyed by each place's canonical key (see
 * src/domain/placeEnrichment.ts). On mount, and whenever the set of canonical keys
 * derived from `places` changes:
 *
 *   1. Batch-reads the cached docs for every canonical key in one call to
 *      getDocsByIds('place_enrichment', keys) (src/lib/firestoreBatchGet.ts) and
 *      returns them immediately.
 *   2. Any key with no cached doc at all is a cache miss. A doc with `fsq_not_found:
 *      true` is NOT a miss — it means a live lookup already ran and found nothing, so
 *      it's treated as present and never re-queried (v1 has no TTL/refresh; see roadmap).
 *   3. Misses are sent to the deployed `enrichPlaces` Cloud Function
 *      (src/lib/enrichmentClient.ts), which live-queries Foursquare and writes the
 *      result back to Firestore server-side; this hook only merges whatever comes back
 *      into the map it returns and never writes to Firestore itself.
 *
 * Each canonical key is only ever sent to the callable once per mount: a `useRef` set of
 * already-attempted keys stops a later re-render (e.g. `places` gaining one new place)
 * from re-firing enrichment for keys already in flight or already resolved — only the
 * genuinely new keys go out.
 *
 * As with the read path, a place with no known lat/lon is never looked up at all (see
 * Place.lat/lon — most curated places today lack these). Any failure along the way — the
 * batched read, or the enrichment callable — is swallowed silently and leaves the map as
 * it already was: enrichment is optional, and sheets fall back to curated fields when
 * it's unavailable.
 *
 * The returned map is keyed by canonical key — use getPlaceEnrichment() (src/domain/
 * placeEnrichment.ts) to look up a specific Place rather than indexing by place.id.
 */
export function useFirestoreEnrichment(places: Place[]): Record<string, PlaceEnrichment> {
  const [map, setMap] = useState<Record<string, PlaceEnrichment>>({});
  const attemptedKeys = useRef<Set<string>>(new Set());

  const placesByKey = new Map<string, { name: string; lat: number; lon: number; fsq_id?: string }>();
  places.forEach(p => {
    if (p.lat == null || p.lon == null) return;
    const key = canonicalPlaceKey(p.name, p.lat, p.lon);
    if (!placesByKey.has(key)) {
      placesByKey.set(key, { name: p.name, lat: p.lat, lon: p.lon, fsq_id: p.fsq_id });
    }
  });
  const keys = Array.from(placesByKey.keys());
  const dependencyKey = keys.join(',');

  useEffect(() => {
    if (keys.length === 0) {
      setMap({});
      return;
    }
    let cancelled = false;

    getDocsByIds<PlaceEnrichment>('place_enrichment', keys)
      .then(existing => {
        if (cancelled) return;
        setMap(existing);

        // A miss is a key entirely absent from `existing` — a doc with fsq_not_found:
        // true still exists() and so is already present here (Global Constraint #5).
        // Keys already attempted this mount (in flight or previously resolved/failed)
        // are excluded so an overlapping re-render never re-fires the callable for them.
        const misses = keys.filter(key => !(key in existing) && !attemptedKeys.current.has(key));
        if (misses.length === 0) return;
        misses.forEach(key => attemptedKeys.current.add(key));

        const missingPlaces: MissingPlace[] = misses.map(key => {
          const place = placesByKey.get(key);
          // Unreachable: `misses` is always a subset of `keys`, and `keys` is exactly
          // `placesByKey`'s key set.
          if (!place) throw new Error(`useFirestoreEnrichment: no place found for key ${key}`);
          return { canonicalKey: key, name: place.name, lat: place.lat, lon: place.lon, fsq_id: place.fsq_id };
        });

        // Chunked so a miss list bigger than the callable's own cap still gets sent —
        // each chunk is independent, so one failing chunk doesn't discard another
        // chunk's successful results (Promise.allSettled, not Promise.all).
        Promise.allSettled(
          chunk(missingPlaces, ENRICH_BATCH_SIZE).map(batch => enrichPlaces(batch)),
        ).then(settlements => {
          if (cancelled) return;
          const merged: Record<string, PlaceEnrichment> = {};
          settlements.forEach(settlement => {
            if (settlement.status === 'fulfilled') Object.assign(merged, settlement.value);
          });
          if (Object.keys(merged).length === 0) return;
          setMap(current => ({ ...current, ...merged }));
        });
      })
      .catch(() => { /* enrichment is optional — swallow, sheets fall back to curated fields */ });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dependencyKey]);

  return map;
}
