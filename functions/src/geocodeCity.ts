// Resolves free-text city input (e.g. "Portland, ME" or "Lower East Side, Manhattan") to
// lat/lon/city/region via Google's Geocoding API, so the onboarding wizard's first-stop
// step and the Add Stop feature can turn typed text into a real Stop record
// (`{ city, region, lat, lon }`, see the root app's src/types.ts).
//
// Pattern-matched directly on `enrichPlaces.ts`: onCall, auth check first, secret bound
// via `{ secrets: [...] }`, structured per-call JSON logging.
//
// A Google "zero results" response is a normal, expected outcome (the user typo'd a
// city, or it just doesn't exist) — it comes back as a structured `{ found: false }`
// result, not a thrown error, so the client can show an inline retry rather than a
// crash. A thrown HttpsError is reserved for cases the client can't meaningfully
// recover from inline: network failure, a non-2xx HTTP response, or Google reporting a
// non-OK/non-ZERO_RESULTS status (OVER_QUERY_LIMIT, REQUEST_DENIED, INVALID_REQUEST,
// UNKNOWN_ERROR).

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { GOOGLE_PLACES_API_KEY } from './secrets';

const GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

const REQUEST_TIMEOUT_MS = 8000;

interface GeocodeCityFound {
  found: true;
  lat: number;
  lon: number;
  // Best-effort: derived from whichever address_components type is present (see
  // deriveCity/deriveRegion below). Left undefined rather than guessed at when Google's
  // result genuinely doesn't carry a matching component — the caller (StopForm, Task 4)
  // decides how to fall back, e.g. pre-filling with the user's original query text.
  city?: string;
  region?: string;
}

interface GeocodeCityNotFound {
  found: false;
}

type GeocodeCityResponse = GeocodeCityFound | GeocodeCityNotFound;

interface GoogleAddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

interface GoogleGeocodeResult {
  // Both marked optional (rather than required, despite Google's docs always
  // including them on a well-formed OK result) because the handler below treats this
  // as untrusted external data and validates them at runtime before use — see the
  // geometry/location guard, mirroring providers/foursquare.ts's own
  // `typeof top.latitude !== 'number'` guard on its (also nominally-required) coordinate
  // fields.
  address_components?: GoogleAddressComponent[];
  geometry?: { location?: { lat: number; lng: number } };
}

interface GoogleGeocodeResponse {
  status: string;
  results?: GoogleGeocodeResult[];
  error_message?: string;
}

type LogOutcome = 'matched' | 'not_found' | 'error';

function logOutcome(query: string, outcome: LogOutcome, durationMs: number, error?: string): void {
  const line = JSON.stringify({ query, outcome, durationMs, ...(error ? { error } : {}) });
  // 'error' outcomes go to console.error (so they surface at the correct severity in
  // Cloud Logging) — everything else is routine, expected activity and goes to
  // console.log. Mirrors enrichPlaces.ts's logOutcome.
  // eslint-disable-next-line no-console
  if (outcome === 'error') {
    console.error(line);
  } else {
    console.log(line);
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function validateQuery(data: unknown): string {
  const query = (data as { query?: unknown } | null)?.query;
  if (typeof query !== 'string' || query.trim().length === 0) {
    throw new HttpsError('invalid-argument', 'request.data.query must be a non-empty string.');
  }
  return query.trim();
}

// Pulls the first address_components entry matching any of `types`, tried in priority
// order — lets callers fall back from a precise type (`locality`) to a looser one
// (`sublocality`/`neighborhood`) when the precise one isn't present, e.g. for a query
// like "Lower East Side" that Google resolves to a neighborhood rather than a city.
function findComponent(
  components: GoogleAddressComponent[],
  types: string[]
): GoogleAddressComponent | undefined {
  for (const type of types) {
    const match = components.find((c) => c.types.includes(type));
    if (match) return match;
  }
  return undefined;
}

function deriveCity(components: GoogleAddressComponent[]): string | undefined {
  return findComponent(components, ['locality', 'sublocality', 'neighborhood'])?.long_name;
}

// short_name (e.g. "ME") matches the app's own Stop.region convention (see
// src/fixtures/devTrip.ts), not the spelled-out long_name ("Maine").
function deriveRegion(components: GoogleAddressComponent[]): string | undefined {
  return findComponent(components, ['administrative_area_level_1'])?.short_name;
}

async function fetchGeocode(query: string): Promise<GoogleGeocodeResponse> {
  const url = new URL(GEOCODE_URL);
  url.searchParams.set('address', query);
  url.searchParams.set('key', GOOGLE_PLACES_API_KEY.value());

  let response: Response;
  try {
    response = await fetch(url.toString(), { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  } catch (err) {
    throw new Error(`Geocoding request failed: ${errorMessage(err)}`);
  }

  if (!response.ok) {
    throw new Error(`Geocoding request failed with status ${response.status}`);
  }

  return (await response.json()) as GoogleGeocodeResponse;
}

export const geocodeCity = onCall(
  { secrets: [GOOGLE_PLACES_API_KEY] },
  async (request): Promise<GeocodeCityResponse> => {
    // Same requirement as enrichPlaces.ts:98-100 — this triggers a real, paid Google API
    // call on the caller's behalf.
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required.');
    }

    const query = validateQuery(request.data);
    const startedAt = Date.now();

    let data: GoogleGeocodeResponse;
    try {
      data = await fetchGeocode(query);
    } catch (err) {
      logOutcome(query, 'error', Date.now() - startedAt, errorMessage(err));
      throw new HttpsError('internal', 'Geocoding lookup failed.');
    }

    if (data.status === 'ZERO_RESULTS') {
      logOutcome(query, 'not_found', Date.now() - startedAt);
      return { found: false };
    }

    const top = data.results?.[0];
    if (data.status !== 'OK' || !top) {
      // Any other status (OVER_QUERY_LIMIT, REQUEST_DENIED, INVALID_REQUEST,
      // UNKNOWN_ERROR, or a malformed OK response missing its first result) is a real
      // failure, not "no match" — surface it as a thrown error rather than a structured
      // not-found, so it isn't silently treated as "the city doesn't exist."
      logOutcome(query, 'error', Date.now() - startedAt, data.error_message ?? data.status);
      throw new HttpsError('internal', 'Geocoding lookup failed.');
    }

    const location = top.geometry?.location;
    if (typeof location?.lat !== 'number' || typeof location?.lng !== 'number') {
      // Guard against a well-formed "OK" status whose first result is nonetheless
      // missing/malformed geometry — same reasoning as providers/foursquare.ts's own
      // coordinate guard: an unguarded `top.geometry.location.lat` read here would
      // either throw an unguarded TypeError past this function's error handling
      // entirely, or (if only one of lat/lng were present) silently produce a
      // half-valid result. Checked, and logged as an error, BEFORE the 'matched' log
      // line below — never log success and then fail.
      logOutcome(query, 'error', Date.now() - startedAt, 'OK response missing geometry.location');
      throw new HttpsError('internal', 'Geocoding lookup failed.');
    }

    // address_components is used only for the best-effort, already-optional city/region
    // fields (see GeocodeCityFound) — unlike geometry/location, a missing/malformed
    // array here isn't a failure worth aborting the whole lookup over; it just yields
    // city/region: undefined, same as when no component matches any known type.
    const addressComponents = Array.isArray(top.address_components) ? top.address_components : [];

    logOutcome(query, 'matched', Date.now() - startedAt);
    return {
      found: true,
      lat: location.lat,
      lon: location.lng,
      city: deriveCity(addressComponents),
      region: deriveRegion(addressComponents),
    };
  }
);
