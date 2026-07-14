// Canonical keying for the global, cross-trip `place_enrichment` Firestore cache.
//
// The cache is keyed by an app-owned identifier — normalized name + rounded coordinates —
// rather than any single provider's proprietary place ID (Google Place ID, Foursquare
// fsq_id, Yelp business ID). No industry-standard ID is shared across those providers,
// so keying by one would silently break cross-provider dedup the moment enrichment moves
// from Google (the legacy import) to Foursquare/Yelp (the locked future design). Provider
// IDs are still recorded as fields on the cached doc, just never as the key.

import type { Place, PlaceEnrichment } from '@/src/types';

const COMBINING_DIACRITICS = /[̀-ͯ]/g;

/**
 * Deterministic key for a physical place: a URL-safe slug of its name plus lat/lon
 * rounded to 4 decimal places (~11m precision — loose enough to absorb the few-meter
 * GPS disagreement typical between different providers' coordinates for the same
 * building, tight enough not to merge distinct nearby places).
 */
export function canonicalPlaceKey(name: string, lat: number, lon: number): string {
  const slug = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(COMBINING_DIACRITICS, '') // strip accents (e.g. "café" -> "cafe")
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${slug}_${lat.toFixed(4)}_${lon.toFixed(4)}`;
}

/**
 * Looks up a place's cached enrichment from a map keyed by canonical key (as returned by
 * useFirestoreEnrichment). Returns undefined for a place with no known coordinates (most
 * curated places today — coordinates are only backfilled where the one-time enrichment
 * import, or a future auto-seed flow, has resolved them) or with no cache entry.
 */
export function getPlaceEnrichment(
  map: Record<string, PlaceEnrichment>,
  place: Pick<Place, 'name' | 'lat' | 'lon'>,
): PlaceEnrichment | undefined {
  if (place.lat == null || place.lon == null) return undefined;
  return map[canonicalPlaceKey(place.name, place.lat, place.lon)];
}

/**
 * A place's display photo: the curated `photoUrl` if set, otherwise the first photo
 * from its cached Firestore enrichment (most curated places only have the latter —
 * `photoUrl` is rarely set by hand).
 */
export function resolvePlacePhoto(
  place: Pick<Place, 'name' | 'lat' | 'lon' | 'photoUrl'>,
  map: Record<string, PlaceEnrichment>,
): string | undefined {
  return place.photoUrl ?? getPlaceEnrichment(map, place)?.photos[0];
}
