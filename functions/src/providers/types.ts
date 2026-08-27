// Shared shape for place-data providers. Foursquare is the only implementation in v1
// (see plan's Global Constraint #1 — no Yelp/Google code anywhere), but the adapter
// contract is kept provider-agnostic so a second provider could implement
// `ProviderAdapter` later without touching the merge logic (Task 3) or callable
// entrypoint (Task 4) that consume it.

export interface ProviderMatch {
  fsq_id?: string;
  phone?: string;
  website?: string;
  hours?: string[];
  address?: string;
  rating?: number;
  ratingCount?: number;
  price?: string;
  photos?: string[];
}

// Contract (binding for every implementation, see functions/src/providers/foursquare.ts
// for the live one):
//   - THROWS on network error, timeout, or any non-2xx HTTP response from the provider.
//   - Returns `null` ONLY for a successful response that found no acceptable match
//     (zero candidates, or the best candidate failed a sanity check e.g. distance).
//   - Never conflates "provider call failed" with "provider says no match" — callers
//     (Task 3/4) rely on that distinction to set the `fsq_not_found` sentinel only on
//     a genuine `null`, not on a thrown error.
export type ProviderAdapter = (input: {
  name: string;
  lat: number;
  lon: number;
  fsq_id?: string;
}) => Promise<ProviderMatch | null>;

// ── Search ───────────────────────────────────────────────────────────────────

/**
 * One ranked result from a free-text search. Deliberately NOT an extension of
 * `ProviderMatch`: that shape carries phone/hours/rating/price/photos, which Foursquare
 * bills at Premium tier and the search path never requests. Inheriting it would advertise
 * fields a search candidate structurally cannot have, and invite a caller to read them.
 *
 * Enrichment is a separate, later step against `place_enrichment` — see the root app's
 * src/hooks/useFirestoreEnrichment.ts.
 */
export interface ProviderCandidate {
  fsq_id?: string;
  name: string;
  lat: number;
  lon: number;
  address?: string;
  /** Provider's own category label, e.g. "Seafood Restaurant" — drives the eat/stay/do guess. */
  category?: string;
}

// Contract (binding for every implementation):
//   - THROWS on network error, timeout, or any non-2xx HTTP response.
//   - Returns [] for a successful response that matched nothing. As with ProviderAdapter,
//     "the call failed" and "there are no matches" are never conflated — the add sheet
//     renders those two states completely differently (a retry vs. the manual card).
//   - Applies NO distance rejection. That belongs to matching, which verifies a place we
//     already have coordinates for; searching ranks places we do not.
export type ProviderSearch = (input: {
  query: string;
  lat: number;
  lon: number;
  radiusMeters?: number;
  limit?: number;
}) => Promise<ProviderCandidate[]>;

// ── Geographic search (stops and POIs) ───────────────────────────────────────

/**
 * One result from a place/POI search, for the Add Stop sheet.
 *
 * `canBeStop` and `canBeActivity` are what make the design's "a place that could be
 * either says so, and offers both" expressible: a town is a stop, a trailhead is an
 * activity, and something tagged both is offered as both rather than silently filed.
 */
export interface GeoCandidate {
  name: string;
  lat: number;
  lon: number;
  /**
   * Formatted context line. Note this EXCLUDES the name — Camden's is "Maine, United
   * States", not "Camden, Maine, United States" — which makes it a clean subtitle under
   * the name rather than a repetition of it.
   */
  context?: string;
  /**
   * Short region code ("ME"), the same convention `Stop.region` uses. Its presence is
   * what lets a search result become a Stop without a second lookup — the reason the
   * Google geocode this replaced needed a `deriveRegion` step of its own.
   */
  region?: string;
  /**
   * Straight-line metres from the proximity anchor, supplied free by Mapbox on every
   * result. Not a drive time — but enough to sort by, or to say "a long way from your
   * stop", without spending a routing call.
   */
  distanceMetres?: number;
  /** The provider's own type string, kept for debugging a surprising classification. */
  featureType: string;
  canBeStop: boolean;
  canBeActivity: boolean;
}

// Same contract as ProviderSearch: THROWS on transport/HTTP failure, returns [] for a
// successful search that matched nothing.
//
// The anchor is OPTIONAL, unlike ProviderSearch's. A stop search can legitimately happen
// with nothing to anchor to — the onboarding wizard's first stop precedes the trip that
// would supply one — and the alternative, making the caller invent an anchor, is worse
// than having none: (0,0) biases every first search toward the Gulf of Guinea, and the
// device's own location biases it toward home, which is the one place a trip is not.
export type GeoSearch = (input: {
  query: string;
  lat?: number;
  lon?: number;
  limit?: number;
  /**
   * Provider feature types to restrict the search to. Omit for everything.
   *
   * This is not an optimisation, it is correctness: a provider ranks its whole catalogue
   * together, so an unfiltered search for a town competes with airports, streets and shops
   * of the same name and frequently loses. Discarding those after the fact discards the
   * page they arrived on, and the caller sees nothing rather than the town it asked for.
   */
  types?: readonly string[];
}) => Promise<GeoCandidate[]>;

// ── Routing ──────────────────────────────────────────────────────────────────

export interface LatLon {
  lat: number;
  lon: number;
}

/**
 * A drive between two points, reduced to the two numbers the cards actually show.
 *
 * Deliberately NOT the provider's response: no geometry, no legs, no steps. Keeping only
 * derived scalars is what makes the result cacheable as our own data rather than as
 * stored provider output.
 */
export interface RouteResult {
  minutes: number;
  miles: number;
}

// Contract: THROWS on transport/HTTP failure; returns null when the provider succeeded but
// found no drivable route between the two points (an island, a data gap).
export type RouteLookup = (input: { from: LatLon; to: LatLon }) => Promise<RouteResult | null>;
