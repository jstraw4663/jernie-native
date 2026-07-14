import { useEffect, useState } from 'react';
import { firestore } from '@/src/lib/firebase';
import { canonicalPlaceKey } from '@/src/domain/placeEnrichment';
import type { Place, PlaceEnrichment } from '@/src/types';

/**
 * One-time, read-only lookup of cached place enrichment — real data imported once from
 * the retired PWA's Firestore (see scripts/importFirestoreEnrichment.ts). Deliberately
 * NOT live enrichment: no writes, no TTL/refresh logic, no external API calls.
 *
 * Looks up the flat, global `place_enrichment` collection by each place's canonical key
 * (only possible for places with known coordinates — see Place.lat/lon; most curated
 * places don't have these yet, only the ones backfilled by the one-time import). The
 * returned map is keyed by canonical key — use getPlaceEnrichment() (src/domain/
 * placeEnrichment.ts) to look up a specific Place rather than indexing by place.id.
 */
export function useFirestoreEnrichment(places: Place[]): Record<string, PlaceEnrichment> {
  const [map, setMap] = useState<Record<string, PlaceEnrichment>>({});

  const keys = Array.from(new Set(
    places
      .filter((p): p is Place & { lat: number; lon: number } => p.lat != null && p.lon != null)
      .map(p => canonicalPlaceKey(p.name, p.lat, p.lon)),
  ));
  const dependencyKey = keys.join(',');

  useEffect(() => {
    if (keys.length === 0) {
      setMap({});
      return;
    }
    let cancelled = false;

    Promise.all(keys.map(key => firestore().collection('place_enrichment').doc(key).get()))
      .then(docs => {
        if (cancelled) return;
        const result: Record<string, PlaceEnrichment> = {};
        docs.forEach(doc => {
          if (doc.exists()) result[doc.id] = doc.data() as PlaceEnrichment;
        });
        setMap(result);
      })
      .catch(() => { /* enrichment is optional — swallow, sheets fall back to curated fields */ });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dependencyKey]);

  return map;
}
