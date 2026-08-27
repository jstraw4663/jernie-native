// Adapter for the live Foursquare Places API. This talks to the *new* Places API host
// (`https://places-api.foursquare.com`), NOT the deprecated v3 host
// (`api.foursquare.com/v3`), which was retired 2026-05-15 (Global Constraint #2).
//
// Live-API research (see .superpowers/sdd/task-2-report.md at the repo root for full
// citations and confidence levels): confirmed directly from Foursquare's own published OpenAPI spec,
// embedded in https://docs.foursquare.com/fsq-developers-places/reference/place-search and
// .../place-details (fetched 2026-07-14):
//   - Base URL: https://places-api.foursquare.com
//   - Auth: `Authorization: Bearer <key>` (securityScheme "ServiceKeyBearerTokenAuth",
//     type "http", scheme "bearer")
//   - `X-Places-Api-Version` header: required, schema declares
//     `"default":"2025-06-17","enum":["2025-06-17"]` — the only currently valid value.
//   - Search: `GET /places/search`; Details: `GET /places/{fsq_place_id}`.
//   - Place identifier field is `fsq_place_id` in BOTH the URL path segment and the
//     response body (confirmed via the embedded OAS `parameters`/`responses` schemas AND
//     the "Places Pro" field table on the response-fields doc page). The legacy v3 API
//     used `fsq_id`; the new Places API renamed it to `fsq_place_id` everywhere. Our own
//     `ProviderMatch.fsq_id` / `PlaceEnrichment.fsq_id` field names are OUR storage
//     convention (carried over from the v3-era naming) and are intentionally NOT renamed
//     to match — this file is the translation boundary between FSQ's current field name
//     and our stored one.
//
// BILLING — confirmed 2026-08-26 against foursquare.com/pricing and
// docs.foursquare.com/data-products/docs/places-pro-and-premium. This settles the
// "confirm before production deploy" note this file used to carry.
//
//   Pro fields:     fsq_place_id, name, latitude, longitude, location, tel, website,
//                   categories, date_closed
//   Premium fields: hours, rating, price, photos, tips, description, popularity
//                   (`stats`/rating count is not named in the docs, but it travels with
//                   `rating` and should be treated as Premium)
//
// The tier is per CALL and binary: ONE Premium field makes the entire call Premium. Field
// COUNT does not affect price at all, so trimming Pro fields saves nothing — only the
// NUMBER of calls matters. There is no tier below Pro.
//
//   Pro:     first 500 calls/month free, then $15.00 CPM  (1.5¢ per call)
//   Premium: no free allowance whatever, $18.75 CPM       (1.875¢ from the first call)
//
// Premium is therefore only ~25% dearer per call, but forfeits the entire free tier.
// That is why the enrichment path below bills Premium — it needs hours/rating/price and
// there is no way around that — while the search path further down is kept strictly Pro.

import { FOURSQUARE_API_KEY } from '../secrets';
import type { ProviderAdapter, ProviderCandidate, ProviderMatch, ProviderSearch } from './types';

const BASE_URL = 'https://places-api.foursquare.com';

// Pinned dated version — see file header for source. Bump only after re-confirming
// against live docs/a real API call, since Foursquare validates this header strictly.
const API_VERSION = '2025-06-17';

const REQUEST_TIMEOUT_MS = 8000;

// Search radius: wide enough to absorb ordinary geocoding/address-entry slop in the
// curated place's stored lat/lon, comfortably above MAX_MATCH_DISTANCE_METERS so a
// legitimately-close match isn't excluded from the candidate set itself (only from
// acceptance, below) — but still tight enough to avoid pulling in an unrelated venue
// from across the street or the next block over.
const SEARCH_RADIUS_METERS = 400;

// We only ever consult the top-ranked (sort=RELEVANCE) candidate, but ask for a small
// handful rather than exactly 1 — same cost (Foursquare bills per call, not per result
// row) and gives a little headroom for future debugging/logging of near-misses.
const SEARCH_LIMIT = 5;

// Global Constraint #4: reject a candidate farther than ~200m from the curated place's
// own coordinates.
const MAX_MATCH_DISTANCE_METERS = 200;

// Explicitly requested on every call. Once `fields` is specified at all, Foursquare
// stops applying its "all Pro fields by default" behavior, so every field we use —
// Pro or Premium, including `latitude`/`longitude` which the distance sanity-check
// depends on even though we don't otherwise map them onto ProviderMatch — must be
// listed here (see the tier note in the file header).
const RESPONSE_FIELDS = [
  'fsq_place_id',
  'name',
  'latitude',
  'longitude',
  'location',
  'tel',
  'website',
  'hours',
  'rating',
  'price',
  'stats',
].join(',');

interface FsqLocation {
  address?: string;
  formatted_address?: string;
}

interface FsqHours {
  display?: string;
}

interface FsqStats {
  total_ratings?: number;
}

interface FsqCategory {
  name?: string;
}

interface FsqPlace {
  fsq_place_id: string;
  name: string;
  latitude: number;
  longitude: number;
  location?: FsqLocation;
  tel?: string;
  website?: string;
  hours?: FsqHours;
  rating?: number;
  price?: number;
  stats?: FsqStats;
  categories?: FsqCategory[];
}

interface FsqSearchResponse {
  results?: FsqPlace[];
}

function authHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${FOURSQUARE_API_KEY.value()}`,
    'X-Places-Api-Version': API_VERSION,
  };
}

// Equirectangular approximation — accurate enough at the ~100s-of-meters scale this
// check operates at, and avoids pulling in a haversine library (Global Constraint #4:
// "no new dependency").
function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const EARTH_RADIUS_METERS = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const x = toRad(lon2 - lon1) * Math.cos(toRad((lat1 + lat2) / 2));
  const y = toRad(lat2 - lat1);
  return Math.sqrt(x * x + y * y) * EARTH_RADIUS_METERS;
}

// FSQ's `price` is an integer 1-4 ("1 = Cheap" ... "4 = Very Expensive" per Foursquare's
// response-fields docs); PlaceEnrichment.price is a dollar-sign string ("$$$") matching
// the app's own Place.price convention.
function priceToDollarSign(price: number | undefined): string | undefined {
  if (price == null || !Number.isInteger(price) || price < 1 || price > 4) return undefined;
  return '$'.repeat(price);
}

function mapPlace(place: FsqPlace): ProviderMatch {
  return {
    fsq_id: place.fsq_place_id,
    phone: place.tel || undefined,
    website: place.website || undefined,
    // FSQ's `hours.display` is a single Foursquare-formatted human-readable summary
    // string, not a pre-split per-day list — we don't attempt to parse `hours.regular`
    // into individual lines ourselves, since that would mean inventing a day-name/
    // time-formatting convention the API doesn't document. One-element array keeps the
    // `string[]` shape ProviderMatch/PlaceEnrichment expect (consumers already just
    // `.join(' · ')` them).
    hours: place.hours?.display ? [place.hours.display] : undefined,
    address: place.location?.formatted_address || place.location?.address || undefined,
    rating: place.rating,
    ratingCount: place.stats?.total_ratings,
    price: priceToDollarSign(place.price),
  };
}

async function fsqGet(path: string, params: Record<string, string>): Promise<unknown> {
  const url = new URL(`${BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      headers: authHeaders(),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    throw new Error(`Foursquare request to ${path} failed: ${(err as Error).message}`);
  }

  if (!response.ok) {
    throw new Error(`Foursquare request to ${path} failed with status ${response.status}`);
  }

  return response.json();
}

export const fetchFoursquareMatch: ProviderAdapter = async (input) => {
  // `place_id_locked: true` re-fetch path (Global Constraint #6) — an already-known
  // fsq_place_id skips search entirely and goes straight to details-by-ID.
  if (input.fsq_id) {
    const place = (await fsqGet(`/places/${encodeURIComponent(input.fsq_id)}`, {
      fields: RESPONSE_FIELDS,
    })) as FsqPlace;
    return mapPlace(place);
  }

  const data = (await fsqGet('/places/search', {
    query: input.name,
    ll: `${input.lat},${input.lon}`,
    radius: String(SEARCH_RADIUS_METERS),
    limit: String(SEARCH_LIMIT),
    sort: 'RELEVANCE',
    fields: RESPONSE_FIELDS,
  })) as FsqSearchResponse;

  const top = data.results?.[0];
  if (!top) return null;

  // Guard against `NaN > MAX_MATCH_DISTANCE_METERS` silently evaluating to `false` (and
  // so silently *accepting* an unverifiable candidate) if a result were ever missing
  // coordinates — treat that as no-match rather than skip the sanity check.
  if (typeof top.latitude !== 'number' || typeof top.longitude !== 'number') return null;

  if (distanceMeters(input.lat, input.lon, top.latitude, top.longitude) > MAX_MATCH_DISTANCE_METERS) {
    return null;
  }

  return mapPlace(top);
};

// ── Free-text search ─────────────────────────────────────────────────────────
//
// A different contract from fetchFoursquareMatch above, on purpose. Matching VERIFIES a
// place whose coordinates we already hold: it searches a tight 400m and rejects anything
// beyond 200m, because a wrong match silently corrupts an existing record. Searching RANKS
// places the user has no coordinates for, so both of those behaviours would be bugs here.

// The radius a stop can answer for, and deliberately not larger.
//
// Measured, not estimated: Thurston's Lobster Pound in Bernard is 20.3km from Bar Harbor,
// so it falls outside this by 300 metres and a live search for "thurston" anchored on Bar
// Harbor returns nothing. That was checked on 2026-08-27 and kept anyway — an earlier
// version of this comment claimed Bernard was 12km away and therefore a legitimate result,
// and both halves of that were wrong.
//
// It is a 45-minute drive each way. Somewhere that far is not a place you eat while based
// in Bar Harbor; it is a reason to add Southwest Harbor as its own stop, which is exactly
// what the add flow is for. Widening this to catch it would make every stop's results
// bleed into its neighbours' and make "near this stop" mean nothing.
//
// Cost is not the constraint here — radius does not change the price of a call — so if
// this is ever revisited, revisit it on whether the results still feel local.
const SEARCH_AREA_RADIUS_METERS = 20000;

const SEARCH_RESULT_LIMIT = 10;

// PRO-TIER FIELDS ONLY — and this constant is the single place that decision lives.
//
// Adding any Premium field here (hours, rating, price, stats) flips EVERY search call to
// Premium: ~25% more per call, and the loss of the 500 free Pro calls a month. Search
// fires on every debounced keystroke burst, so it is the highest-volume call in the app
// and the worst place to spend the free allowance.
//
// That is the entire cost of the switch, and it is a one-line change should the design's
// "Seafood · 4.6 · Bernard, ME" rating on the result ROW turn out to be worth it. Today
// it is not: the rating arrives later from place_enrichment when the detail sheet opens.
//
// A test asserts the Premium fields are absent, so this cannot drift by accident.
const SEARCH_RESPONSE_FIELDS = [
  'fsq_place_id',
  'name',
  'latitude',
  'longitude',
  'location',
  'categories',
].join(',');

function mapCandidate(place: FsqPlace): ProviderCandidate {
  return {
    fsq_id: place.fsq_place_id,
    name: place.name,
    lat: place.latitude,
    lon: place.longitude,
    address: place.location?.formatted_address || place.location?.address || undefined,
    category: place.categories?.[0]?.name,
  };
}

export const searchFoursquarePlaces: ProviderSearch = async (input) => {
  const data = (await fsqGet('/places/search', {
    query: input.query,
    ll: `${input.lat},${input.lon}`,
    radius: String(input.radiusMeters ?? SEARCH_AREA_RADIUS_METERS),
    limit: String(input.limit ?? SEARCH_RESULT_LIMIT),
    sort: 'RELEVANCE',
    fields: SEARCH_RESPONSE_FIELDS,
  })) as FsqSearchResponse;

  // Same guard as the matcher's: a result without usable coordinates cannot be placed on
  // a map, distance-sorted, or turned into an enrichment cache key, so it is dropped
  // rather than emitted with NaN coordinates that fail somewhere further downstream.
  return (data.results ?? [])
    .filter(place => typeof place.latitude === 'number' && typeof place.longitude === 'number')
    .map(mapCandidate);
};
