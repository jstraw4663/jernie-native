// Adapter for Mapbox Search Box.
//
// ENDPOINT CONFIDENCE. The forward-search path, the response envelope, `feature_type:
// "place"`, and BOTH coordinate locations were confirmed against a real response on
// 2026-08-26 (see the verified fixture in __tests__/providers/mapbox.test.ts). Two things
// remain unobserved and should be checked when first exercised:
//   - the `poi` branch: no POI result has been seen directly, so ACTIVITY_FEATURE_TYPES
//     is still documentation-derived.
//   - the Directions response below, which has not been called live at all.
//
// WHY SEARCH BOX AND NOT GEOCODING v6: the design's stop sheet needs both "Camden, Maine"
// (a town) and "Camden Hills State Park" (a POI) in one result list — that is the whole
// point of "a place that could be either says so, and offers both". Geocoding v6 dropped
// POI support; Search Box carries both.
//
// WHY /forward AND NOT /suggest + /retrieve: session billing makes suggest+retrieve
// cheaper for a pure type-ahead, but the design shows a drive time on every result ROW
// ("Camden, Maine · 1h 50m from Portland"), which needs coordinates for every result.
// /suggest returns none, so the session saving would be spent again on a retrieve per row.
// /forward returns coordinates for the whole list in one call.

import { MAPBOX_ACCESS_TOKEN } from '../secrets';
import type { GeoCandidate, GeoSearch, RouteLookup } from './types';

const BASE_URL = 'https://api.mapbox.com';

const REQUEST_TIMEOUT_MS = 8000;

const DEFAULT_LIMIT = 8;

// Feature types that can serve as a trip stop — somewhere you sleep, in other words.
// `region` (a whole state) and `address`/`street` (too granular to be a stop) are
// deliberately excluded; a stop is a town-sized thing.
const STOP_FEATURE_TYPES = new Set(['place', 'locality', 'city']);

const ACTIVITY_FEATURE_TYPES = new Set(['poi']);

interface MapboxCoordinates {
  latitude?: number;
  longitude?: number;
}

interface MapboxContext {
  region?: { name?: string; region_code?: string };
}

interface MapboxProperties {
  name?: string;
  place_formatted?: string;
  feature_type?: string;
  coordinates?: MapboxCoordinates;
  poi_category?: string[];
  context?: MapboxContext;
  /** Straight-line metres from the `proximity` anchor. */
  distance?: number;
}

interface MapboxFeature {
  properties?: MapboxProperties;
  geometry?: { coordinates?: number[] };
}

interface MapboxForwardResponse {
  features?: MapboxFeature[];
}

async function mapboxGet(path: string, params: Record<string, string>): Promise<unknown> {
  const url = new URL(`${BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set('access_token', MAPBOX_ACCESS_TOKEN.value());

  let response: Response;
  try {
    response = await fetch(url.toString(), { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  } catch (err) {
    throw new Error(`Mapbox request to ${path} failed: ${(err as Error).message}`);
  }

  if (!response.ok) {
    throw new Error(`Mapbox request to ${path} failed with status ${response.status}`);
  }

  return response.json();
}

// Mapbox documents coordinates in `properties.coordinates` as named lat/lon, and GeoJSON
// also puts them in `geometry.coordinates` as the [lon, lat] pair. Both are read, named
// fields first, because the pair is order-dependent and a silent swap is a class of bug
// that survives review — it produces plausible-looking numbers in the wrong hemisphere.
function readCoordinates(feature: MapboxFeature): { lat: number; lon: number } | null {
  const named = feature.properties?.coordinates;
  if (typeof named?.latitude === 'number' && typeof named?.longitude === 'number') {
    return { lat: named.latitude, lon: named.longitude };
  }

  const pair = feature.geometry?.coordinates;
  if (Array.isArray(pair) && typeof pair[0] === 'number' && typeof pair[1] === 'number') {
    return { lon: pair[0], lat: pair[1] };
  }

  return null;
}

function mapFeature(feature: MapboxFeature): GeoCandidate | null {
  const coordinates = readCoordinates(feature);
  if (!coordinates) return null;

  const name = feature.properties?.name;
  if (!name) return null;

  const featureType = feature.properties?.feature_type ?? '';

  const distance = feature.properties?.distance;

  return {
    name,
    lat: coordinates.lat,
    lon: coordinates.lon,
    context: feature.properties?.place_formatted,
    region: feature.properties?.context?.region?.region_code,
    distanceMetres: typeof distance === 'number' ? distance : undefined,
    featureType,
    canBeStop: STOP_FEATURE_TYPES.has(featureType),
    canBeActivity: ACTIVITY_FEATURE_TYPES.has(featureType),
  };
}

export const searchMapboxPlaces: GeoSearch = async (input) => {
  // Mapbox takes proximity as lon,lat — the GeoJSON order, and the reverse of
  // Foursquare's `ll=lat,lon`. The two adapters in this folder disagree on purpose.
  //
  // Omitted entirely when there is no anchor, rather than sent as a placeholder: Mapbox
  // simply drops the distance bias without it, whereas a stand-in coordinate silently
  // biases the whole result list somewhere wrong. Both halves are required — a lone `lat`
  // cannot form a coordinate, so it is treated as no anchor at all rather than paired
  // with an undefined that would stringify into the URL.
  const anchored = typeof input.lat === 'number' && typeof input.lon === 'number';

  const data = (await mapboxGet('/search/searchbox/v1/forward', {
    q: input.query,
    ...(anchored ? { proximity: `${input.lon},${input.lat}` } : {}),
    limit: String(input.limit ?? DEFAULT_LIMIT),
  })) as MapboxForwardResponse;

  return (data.features ?? [])
    .map(mapFeature)
    .filter((candidate): candidate is GeoCandidate => candidate !== null);
};

// ── Directions ───────────────────────────────────────────────────────────────

const METRES_PER_MILE = 1609.344;

interface MapboxRoute {
  duration?: number;   // seconds
  distance?: number;   // metres
}

interface MapboxDirectionsResponse {
  code?: string;
  routes?: MapboxRoute[];
}

/**
 * Drive time and distance between two points.
 *
 * Two deliberate choices, both about cost:
 *
 *  - The `driving` profile, never `driving-traffic`. A traffic-aware ETA is a pricier SKU
 *    and is inherently uncacheable, and nothing in the design needs one — "leave by 18:20"
 *    is computed from a static duration. A static drive time between two fixed points does
 *    not change, which is what lets the result be cached long-term.
 *  - `overview=false`, so no route geometry is returned at all. Geometry is the part of a
 *    Directions response most obviously Mapbox's own data; never receiving it means the
 *    only thing we retain is a pair of integers we computed.
 */
export const fetchMapboxRoute: RouteLookup = async (input) => {
  const coordinates = `${input.from.lon},${input.from.lat};${input.to.lon},${input.to.lat}`;

  const data = (await mapboxGet(`/directions/v5/mapbox/driving/${coordinates}`, {
    overview: 'false',
    alternatives: 'false',
  })) as MapboxDirectionsResponse;

  const route = data.routes?.[0];
  if (!route || typeof route.duration !== 'number' || typeof route.distance !== 'number') {
    // Covers both an explicit `code: "NoRoute"` and an `Ok` response with an empty list.
    // A genuinely unreachable destination is a normal outcome, not an error.
    return null;
  }

  return {
    minutes: Math.round(route.duration / 60),
    miles: Math.round((route.distance / METRES_PER_MILE) * 10) / 10,
  };
};
