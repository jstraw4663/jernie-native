// Pure merge logic — turns a provider match (or a confirmed no-match) into the
// PlaceEnrichment document to be written at place_enrichment/{canonicalKey}. No I/O:
// this function neither reads nor writes Firestore (that's repository.ts, called by
// enrichPlaces.ts in Task 4) and never reaches into curated Place/RTDB data beyond the
// { name, lat, lon } identity fields passed in explicitly (Global Constraint #7).

import type { ProviderMatch } from './providers/types';
import type { PlaceEnrichment } from './types';

export function mergeEnrichment(
  existing: PlaceEnrichment | undefined,
  match: ProviderMatch | null,
  place: { name: string; lat: number; lon: number }
): PlaceEnrichment {
  const cached_at = Date.now();

  // Clean no-match (Task 2's ProviderAdapter contract: `null` only for a genuine
  // "looked and found nothing", never for an error — that distinction is Task 4's
  // concern, not this function's). Set the fsq_not_found sentinel (Global Constraint
  // #5) so future runs know a live lookup already came up empty, while preserving
  // whatever address/photos a prior successful match already cached. This is
  // deliberately a fresh minimal document rather than a full merge of `existing` —
  // only the two required (non-optional) PlaceEnrichment fields, address and photos,
  // are carried forward, with empty-safe defaults when there's nothing to carry.
  if (match === null) {
    return {
      name: place.name,
      lat: place.lat,
      lon: place.lon,
      address: existing?.address ?? '',
      photos: existing?.photos ?? [],
      fsq_not_found: true,
      cached_at,
      place_id_locked: true,
    };
  }

  // A match was found: the fresh Foursquare response is authoritative for every field
  // it covers, and always overwrites whatever was previously cached for that field —
  // including clearing it to `undefined` if Foursquare no longer reports it (e.g. a
  // phone number removed since the last fetch). `address`/`photos` are the two
  // exceptions: they're required (non-optional) on PlaceEnrichment but optional on
  // ProviderMatch, so a blind overwrite could produce an invalid document — fall back
  // to the existing cached value (or an empty default) when the match didn't supply
  // one. Fields Foursquare doesn't know about at all (googlePlaceId, reviews,
  // reviews_cached_at) carry over from `existing` untouched via the spread below.
  return {
    ...existing,
    name: place.name,
    lat: place.lat,
    lon: place.lon,
    fsq_id: match.fsq_id,
    phone: match.phone,
    website: match.website,
    hours: match.hours,
    address: match.address ?? existing?.address ?? '',
    rating: match.rating,
    ratingCount: match.ratingCount,
    price: match.price,
    photos: match.photos ?? existing?.photos ?? [],
    cached_at,
    place_id_locked: true,
    // A match was found this run, so any stale "not found" sentinel from a previous
    // run no longer applies.
    fsq_not_found: undefined,
  };
}
