// The add sheet's one lookup endpoint.
//
// Division of labour, and the reason for it: the CLIENT guesses the type locally on every
// keystroke — "picking a type dims the other four to 42%" cannot wait on a cold start —
// and this callable resolves it, free to override the guess. That override is exactly the
// design's "No match. Looks like an activity, so we picked Do".
//
// What this returns is provider facts plus a settled type, NOT a finished Candidate. The
// candidate envelope carries a `commit` payload built from `NewBooking` / `NewPlace`, and
// those live in the root app beside the schema they write. `functions/` is a separate
// TypeScript project and cannot import across that boundary, so building candidates here
// would mean duplicating the whole write schema and keeping it in sync by hand. Instead
// src/lib/resolveClient.ts turns this response into candidates via the already-tested pure
// builders in src/domain/candidate.ts — one translation, in the layer that owns the types.
//
// Routing is deliberately NOT called from here. A drive time is resolved lazily for the
// one candidate the user taps; doing it per result row would cost N routing calls per
// search instead of one, which is the single largest cost lever in the whole flow.
//
// Shape shared with the other callables in this folder: onCall, auth check first, secrets
// bound explicitly, structured per-call JSON logging.

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FOURSQUARE_API_KEY } from './secrets';
import { ENFORCE_APP_CHECK } from './appCheck';
import { searchFoursquarePlaces } from './providers/foursquare';
import { classifyQueryText, resolveType } from './classify';
import { chargeQuota } from './quota';
import type { CandidateType, TypeConfidence } from './types';
import type { ProviderCandidate } from './providers/types';

/**
 * Shortest query worth a billed Foursquare call. One or two characters match half the map
 * and cost money to say so.
 *
 * This duplicates MIN_QUERY_LENGTH in the root app's src/lib/resolveClient.ts, and should:
 * the client gate stops the call being made, this one stops it being made ANYWAY. A
 * client-side guard is a UX affordance, not a spend control — anything holding a valid
 * auth token can invoke this callable directly.
 */
const MIN_QUERY_LENGTH = 3;

/** The only types with a real provider in v1. Everything else falls through to the manual card. */
const PLACE_TYPES: readonly CandidateType[] = ['eat', 'stay', 'do'];

const ALL_TYPES: readonly CandidateType[] = ['flight', 'stay', 'eat', 'do', 'drive'];

interface ResolveQueryResponse {
  resolvedType: CandidateType;
  typeConfidence: TypeConfidence;
  /** Empty means "looked and found nothing" — the design's "Nothing found" card. */
  results: ProviderCandidate[];
}

interface ValidatedRequest {
  query: string;
  /** What the user explicitly TAPPED, not what the client guessed. Null when untouched. */
  typeHint: CandidateType | null;
  lat: number;
  lon: number;
}

type LogOutcome = 'matched' | 'not_found' | 'skipped' | 'error';

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
  const body = (data ?? {}) as {
    query?: unknown;
    typeHint?: unknown;
    context?: { stopLat?: unknown; stopLon?: unknown };
  };

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

  const typeHint =
    typeof body.typeHint === 'string' && ALL_TYPES.includes(body.typeHint as CandidateType)
      ? (body.typeHint as CandidateType)
      : null;

  // A search has to be anchored somewhere. Every entry point in the design carries a stop
  // (the tab bar's "+" carries today's), so a request without one is a caller bug rather
  // than a user situation worth degrading gracefully for.
  const { stopLat, stopLon } = body.context ?? {};
  if (typeof stopLat !== 'number' || typeof stopLon !== 'number') {
    throw new HttpsError('invalid-argument', 'request.data.context must carry stopLat and stopLon.');
  }

  return { query, typeHint, lat: stopLat, lon: stopLon };
}

export const resolveQuery = onCall(
  { secrets: [FOURSQUARE_API_KEY], enforceAppCheck: ENFORCE_APP_CHECK },
  async (request): Promise<ResolveQueryResponse> => {
    // Same requirement as enrichPlaces/searchStops — this spends real API credit on the
    // caller's behalf.
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required.');
    }

    const { query, typeHint, lat, lon } = validate(request.data);
    const startedAt = Date.now();

    // Short-circuit before spending anything: a type with no provider in v1 goes straight
    // to the manual card, and so does a recognised flight number.
    if (typeHint && !PLACE_TYPES.includes(typeHint)) {
      logOutcome(query, 'skipped', Date.now() - startedAt);
      return { resolvedType: typeHint, typeConfidence: 'explicit', results: [] };
    }

    if (!typeHint && classifyQueryText(query) === 'flight') {
      logOutcome(query, 'skipped', Date.now() - startedAt);
      return { resolvedType: 'flight', typeConfidence: 'fallback', results: [] };
    }

    // Below both short-circuits, deliberately: neither reaches a provider, so neither costs
    // anything, and metering them would let a typed flight number eat a place-search budget.
    await chargeQuota(request.auth.uid, 'resolveQuery', 1);

    let results: ProviderCandidate[];
    try {
      results = await searchFoursquarePlaces({ query, lat, lon });
    } catch (err) {
      // Never collapsed into an empty result set: the sheet renders "the lookup failed"
      // and "there is nothing by that name" completely differently.
      logOutcome(query, 'error', Date.now() - startedAt, errorMessage(err));
      throw new HttpsError('internal', 'Place lookup failed.');
    }

    // An empty string rather than undefined when we DID find something that simply has no
    // category — that still counts as a guess off a real result, not a blind fallback.
    const topCategory = results.length > 0 ? results[0].category ?? '' : undefined;
    const { resolvedType, typeConfidence } = resolveType(typeHint, topCategory, query);

    logOutcome(query, results.length > 0 ? 'matched' : 'not_found', Date.now() - startedAt);
    return { resolvedType, typeConfidence, results };
  }
);
