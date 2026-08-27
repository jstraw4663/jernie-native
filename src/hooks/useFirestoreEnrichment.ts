import { useEffect, useRef, useState } from 'react';
import { getDocsByIds } from '@/src/lib/firestoreBatchGet';
import { enrichPlaces, type MissingPlace } from '@/src/lib/enrichmentClient';
import { canonicalPlaceKey } from '@/src/domain/placeEnrichment';
import { isOverQuota } from '@/src/domain/callableError';
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
 * A key is only sent to the callable while its own call is genuinely in flight: a
 * `useRef` set of in-flight canonical keys stops a later re-render (e.g. `places`
 * gaining one new place) from re-firing enrichment for a key whose enrichPlaces call
 * hasn't settled yet. The key is removed from that set the moment its chunk's call
 * settles — success or failure, and regardless of whether that effect run has since
 * been cancelled — so a key whose in-flight call gets discarded due to cancellation
 * (see below) becomes eligible for a fresh attempt on the very next effect run that
 * still finds it missing, rather than being silently skipped forever.
 *
 * As with the read path, a place with no known lat/lon is never looked up at all (see
 * Place.lat/lon — most curated places today lack these). Any failure along the way — the
 * batched read, or the enrichment callable — is swallowed silently and leaves the map as
 * it already was: enrichment is optional, and sheets fall back to curated fields when
 * it's unavailable.
 *
 * One failure is remembered rather than merely swallowed: a callable refused for being
 * over the API quota latches its whole batch out of enrichment for the rest of the mount,
 * because that answer is already known and retrying it only spends invocations to be
 * refused again. See the catch inside the effect for why the scope is the mount.
 *
 * The returned map is keyed by canonical key — use getPlaceEnrichment() (src/domain/
 * placeEnrichment.ts) to look up a specific Place rather than indexing by place.id.
 */
export function useFirestoreEnrichment(places: Place[]): Record<string, PlaceEnrichment> {
  const [map, setMap] = useState<Record<string, PlaceEnrichment>>({});
  // Keys whose enrichPlaces call is currently pending — NOT a permanent "already tried"
  // record. See the hook's doc comment above for why entries are removed on settlement.
  const inFlightKeys = useRef<Set<string>>(new Set());
  // Keys the API quota has already refused. The one exception to the rule above, and the
  // reason it is a separate set: see the note on the catch that fills it.
  const refusedKeys = useRef<Set<string>>(new Set());

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
        // Keys with a call currently in flight are excluded so an overlapping re-render
        // never re-fires the callable for one that's still genuinely pending — but a
        // key whose prior call has already settled (including one whose result was
        // discarded due to cancellation) is fair game again here.
        const misses = keys.filter(
          key =>
            !(key in existing) && !inFlightKeys.current.has(key) && !refusedKeys.current.has(key),
        );
        if (misses.length === 0) return;
        misses.forEach(key => inFlightKeys.current.add(key));

        const missingPlaces: MissingPlace[] = misses.map(key => {
          const place = placesByKey.get(key);
          // Unreachable: `misses` is always a subset of `keys`, and `keys` is exactly
          // `placesByKey`'s key set.
          if (!place) throw new Error(`useFirestoreEnrichment: no place found for key ${key}`);
          return { canonicalKey: key, name: place.name, lat: place.lat, lon: place.lon, fsq_id: place.fsq_id };
        });

        // Chunked so a miss list bigger than the callable's own cap still gets sent —
        // each chunk is independent, so one failing chunk doesn't discard another
        // chunk's successful results (Promise.allSettled, not Promise.all). Each
        // chunk's places are removed from the in-flight set as soon as that chunk's
        // own call settles — unconditionally, not gated behind `cancelled` — so the
        // "in flight" set always reflects calls genuinely still pending right now.
        Promise.allSettled(
          chunk(missingPlaces, ENRICH_BATCH_SIZE).map(batch =>
            enrichPlaces(batch)
              // Being over quota is the one failure worth remembering. Every other one —
              // a dropped connection, a cold start, a Foursquare timeout — clears by
              // itself, so the released in-flight slot below is exactly right for them:
              // the key is missing, so the next effect run tries again. A refusal is not
              // like that. The answer is already known and stays "no" until the window
              // rolls, so retrying it spends a Cloud Function invocation and a Firestore
              // transaction purely to be refused again — on every render that changes the
              // key set. The refusal is charged against the whole batch, so the whole
              // batch is latched.
              //
              // Deliberately per-mount, not module-level: the burst window is a minute
              // (functions/src/quota.ts), and re-entering a screen is a slow, user-paced
              // retry that lines up with it rolling over. Latching for the process
              // lifetime would strand these places long after the quota freed up.
              //
              // Rethrown so the Promise.allSettled below still sees a rejection and the
              // finally still frees the in-flight slot.
              .catch(err => {
                if (isOverQuota(err)) {
                  batch.forEach(place => refusedKeys.current.add(place.canonicalKey));
                }
                throw err;
              })
              .finally(() => {
                batch.forEach(place => inFlightKeys.current.delete(place.canonicalKey));
              }),
          ),
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
