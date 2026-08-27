// Keying for the global `route_cache` Firestore collection.
//
// Derived CLIENT-side and passed to the `routeBetween` callable, mirroring how
// `enrichPlaces` takes a client-derived `canonicalKey` (see src/domain/placeEnrichment.ts).
// The alternative — deriving it on both sides — would mean identical rounding logic in two
// TypeScript projects that cannot import from each other, where any drift misses the cache
// silently and doubles the Mapbox bill rather than failing loudly.
//
// Deriving it here also lets the client read `route_cache` from Firestore FIRST and only
// invoke the callable on a miss, exactly as useFirestoreEnrichment already does for
// place_enrichment — a cache hit then costs one Firestore read instead of a function
// invocation plus a routing call.

export interface LatLon {
  lat: number;
  lon: number;
}

/**
 * A deterministic key for "the drive from A to B".
 *
 * Coordinates are rounded to 4 decimal places (~11m), the same precision
 * `canonicalPlaceKey` uses: loose enough that two providers' coordinates for the same
 * building share one cached route, tight enough not to merge distinct nearby places.
 *
 * DIRECTIONAL. A→B and B→A get different keys, because they are genuinely different
 * drives — one-way systems, seasonal roads and ferry legs are not symmetric, and serving
 * a reversed duration would be undetectable in the UI.
 */
export function routeCacheKey(from: LatLon, to: LatLon): string {
  return `${from.lat.toFixed(4)}_${from.lon.toFixed(4)}__${to.lat.toFixed(4)}_${to.lon.toFixed(4)}`;
}

/**
 * How long a cached route stays good, in days.
 *
 * A static drive time never really expires — roads do not move — so the only reason this
 * is finite is that Mapbox's terms on retaining data derived from their APIs are
 * unconfirmed. 30 days is safe under any reading, and still removes almost all repeat
 * cost, because a trip is planned over days rather than months.
 *
 * MUST MATCH `CACHE_RETENTION_DAYS` in functions/src/routeBetween.ts. The client applies
 * it so a hit never reaches the callable; the server applies it as a backstop for a
 * client that asks anyway.
 */
export const ROUTE_CACHE_RETENTION_DAYS = 30;

const RETENTION_MS = ROUTE_CACHE_RETENTION_DAYS * 24 * 60 * 60 * 1000;

/**
 * Whether a cached entry written at `cachedAt` may still be served.
 *
 * A missing or malformed timestamp reads as STALE, never fresh: an entry we cannot date
 * is one we cannot prove is inside the retention window, and re-fetching costs one call
 * whereas wrongly retaining it is the thing the window exists to prevent.
 */
export function isRouteFresh(cachedAt: number | undefined): boolean {
  if (typeof cachedAt !== 'number' || !Number.isFinite(cachedAt)) return false;
  return Date.now() - cachedAt < RETENTION_MS;
}
