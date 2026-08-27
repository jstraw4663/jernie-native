// Stop search — free-text "where are you going" for the Add Stop sheet and the onboarding
// wizard's first-stop step.
//
// Replaces geocodeCity (Google Geocoding), which returned exactly ONE result. That was the
// whole problem: "Portland" is a town in Maine, another in Oregon and another in Victoria,
// and a single-result API resolves that ambiguity silently, by rank, with no way for the
// caller to know a choice was even made. Search Box returns the ranked list, so the person
// planning the trip picks.
//
// Kept separate from resolveQuery rather than folded in as a sixth type, for three
// reasons: a stop is not a Candidate (it has no commit payload of that shape), a stop
// search has no typeHint to resolve, and — unlike every resolveQuery entry point, which
// carries the stop it is anchored to — this one is legitimately called before any trip
// exists at all, so its anchor is optional. Sharing the callable would have meant three
// branches inside one handler to save one file.
//
// Mapbox is MAU-billed, so the marginal call here is close to free. It is still metered:
// the quota exists to catch a loop, and a loop against a cheap endpoint is still a loop.

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { MAPBOX_ACCESS_TOKEN } from './secrets';
import { ENFORCE_APP_CHECK } from './appCheck';
import { searchMapboxPlaces, STOP_FEATURE_TYPES } from './providers/mapbox';
import { chargeQuota } from './quota';

/**
 * Shortest query worth a billed call, matching resolveQuery's MIN_QUERY_LENGTH and
 * duplicated for the same reason: the client's own gate stops the call being made, and
 * this one stops it being made anyway by something holding an auth token and no UI.
 */
const MIN_QUERY_LENGTH = 3;

/** How many stop options to offer. Enough to disambiguate a Portland, short of a wall. */
const RESULT_LIMIT = 6;

/**
 * One stop the user can pick. Deliberately narrower than the provider's GeoCandidate:
 * `featureType`, `canBeStop` and `canBeActivity` are how this callable decides what to
 * return, not something the client needs to re-decide.
 */
interface StopResult {
  name: string;
  /** Short code ("ME"), the convention Stop.region already uses. */
  region?: string;
  lat: number;
  lon: number;
  /** Subtitle line, excluding the name — "Maine, United States". */
  context?: string;
  /** Straight-line metres from the anchor, when there was one. Never a drive time. */
  distanceMetres?: number;
}

interface SearchStopsResponse {
  /** Empty means "looked and found nothing" — a spelling prompt, not a failure. */
  results: StopResult[];
}

interface ValidatedRequest {
  query: string;
  lat?: number;
  lon?: number;
}

type LogOutcome = 'matched' | 'not_found' | 'error';

function logOutcome(query: string, outcome: LogOutcome, durationMs: number, error?: string): void {
  const line = JSON.stringify({ query, outcome, durationMs, ...(error ? { error } : {}) });
  // eslint-disable-next-line no-console
  if (outcome === 'error') console.error(line);
  // eslint-disable-next-line no-console
  else console.log(line);
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function validate(data: unknown): ValidatedRequest {
  const body = (data ?? {}) as { query?: unknown; near?: { lat?: unknown; lon?: unknown } };

  if (typeof body.query !== 'string') {
    throw new HttpsError('invalid-argument', 'request.data.query must be a string.');
  }

  const query = body.query.trim();
  if (query.length < MIN_QUERY_LENGTH) {
    throw new HttpsError(
      'invalid-argument',
      `request.data.query must be at least ${MIN_QUERY_LENGTH} characters.`,
    );
  }

  // A missing or malformed anchor DEGRADES the search rather than failing it — the
  // opposite of resolveQuery, which rejects. There, every entry point carries a stop, so
  // an absent one is a caller bug; here, the wizard's first stop precedes the trip that
  // would supply one, and an unanchored search is simply a search with no distance bias.
  const { lat, lon } = body.near ?? {};
  const anchored = typeof lat === 'number' && typeof lon === 'number';

  return {
    query,
    lat: anchored ? lat : undefined,
    lon: anchored ? lon : undefined,
  };
}

export const searchStops = onCall(
  { secrets: [MAPBOX_ACCESS_TOKEN], enforceAppCheck: ENFORCE_APP_CHECK },
  async (request): Promise<SearchStopsResponse> => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required.');
    }

    const { query, lat, lon } = validate(request.data);
    const startedAt = Date.now();

    // Below validate, so a query too short to search is refused rather than billed.
    await chargeQuota(request.auth.uid, 'searchStops', 1);

    let candidates;
    try {
      candidates = await searchMapboxPlaces({
        query,
        lat,
        lon,
        limit: RESULT_LIMIT,
        // Asked for, not merely filtered for afterwards. Mapbox ranks its whole catalogue
        // together, so an unfiltered town name competes with airports, streets and shops
        // that share it — "portland" alone returns Portland Parish, Jamaica, and nothing
        // else. Discarding those below would discard the page they arrived on, and the
        // caller would see "no such city" for the most obvious query there is.
        types: STOP_FEATURE_TYPES,
      });
    } catch (err) {
      // Never collapsed into an empty list: "nothing by that name" prompts a spelling
      // check, "the lookup failed" prompts a retry, and the sheet renders them
      // differently. The provider's own message stays in the log — it can contain the
      // access token, since it is built from the request URL.
      logOutcome(query, 'error', Date.now() - startedAt, errorMessage(err));
      throw new HttpsError('internal', 'Stop lookup failed.');
    }

    // A POI is somewhere you go, not somewhere you sleep. Offering a trailhead as a stop
    // produces a stop with no lodging and dates that mean nothing — the activity half of
    // the design's "offers both" belongs to resolveQuery, not here.
    const results: StopResult[] = candidates
      .filter(candidate => candidate.canBeStop)
      .map(({ name, region, lat: candidateLat, lon: candidateLon, context, distanceMetres }) => ({
        name,
        region,
        lat: candidateLat,
        lon: candidateLon,
        context,
        distanceMetres,
      }));

    logOutcome(query, results.length > 0 ? 'matched' : 'not_found', Date.now() - startedAt);
    return { results };
  }
);
