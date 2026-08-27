import functions from '@react-native-firebase/functions';
import { generateId } from '@/src/utils/id';
import { getCachedResolve, resolveCacheKey, setCachedResolve } from '@/src/lib/resolveCache';
import {
  buildCandidate,
  type Candidate,
  type CandidateContext,
  type CandidateType,
  type ProviderResult,
  type TypeConfidence,
} from '@/src/domain/candidate';

export interface ResolveContext extends CandidateContext {
  /** The stop the search is anchored on — every entry point in the design carries one. */
  stopLat: number;
  stopLon: number;
}

export interface ResolveResult {
  resolvedType: CandidateType;
  typeConfidence: TypeConfidence;
  /**
   * A miss still produces one card carrying the user's own words, so this is empty in
   * exactly one case: the query was shorter than MIN_QUERY_LENGTH and no lookup ran.
   * The user is still typing, so there is nothing to show — not even a "nothing found".
   */
  candidates: Candidate[];
}

/**
 * Below this, no lookup runs at all.
 *
 * One or two characters match half the map and cost a billed call to say so. Three is
 * where a query starts to mean something — and since the field is debounced, every pause
 * under this length would otherwise be money spent on a result nobody would use.
 */
export const MIN_QUERY_LENGTH = 3;

interface ResolveQueryRequest {
  query: string;
  typeHint: CandidateType | null;
  context: { stopLat: number; stopLon: number };
}

interface ResolveQueryResponse {
  resolvedType: CandidateType;
  typeConfidence: TypeConfidence;
  results: ProviderResult[];
}

/**
 * Resolves what the user typed into cards the sheet can render.
 *
 * The callable returns provider facts and a settled type; the schema translation happens
 * here, through the pure builders in src/domain/candidate.ts. See functions/src/
 * resolveQuery.ts for why the split falls where it does.
 *
 * ALWAYS returns at least one candidate. "A miss is not a dead end — it is the same
 * screen with empty fields", so an empty result set becomes a single card typed as
 * whatever the server guessed, with the user's own words as its title and that type's
 * field table ready for manual entry. The caller never has to special-case emptiness.
 *
 * Hours are deliberately NOT fetched here. They live in place_enrichment and only matter
 * once a card is on screen, so looking them up per result would mean a Firestore read for
 * every row of every debounced keystroke burst. The card enriches lazily instead.
 *
 * Throws if the callable rejects, matching enrichmentClient and stopSearchClient — a failed
 * lookup is a retry, which is a different thing from finding nothing.
 */
export async function resolveQuery(
  query: string,
  typeHint: CandidateType | null,
  context: ResolveContext,
): Promise<ResolveResult> {
  const trimmed = query.trim();

  if (trimmed.length < MIN_QUERY_LENGTH) {
    return { resolvedType: typeHint ?? 'do', typeConfidence: 'fallback', candidates: [] };
  }

  const cacheKey = resolveCacheKey(trimmed, typeHint, context.stopLat, context.stopLon);

  // Only successful responses are ever cached — a failed lookup must stay retryable, or
  // one outage would poison this query for the rest of the session.
  let cached = getCachedResolve(cacheKey);

  if (!cached) {
    const callable = functions().httpsCallable<ResolveQueryRequest, ResolveQueryResponse>('resolveQuery');

    const response = await callable({
      query: trimmed,
      typeHint,
      context: { stopLat: context.stopLat, stopLon: context.stopLon },
    });

    cached = response.data;
    setCachedResolve(cacheKey, cached);
  }

  const { resolvedType, typeConfidence, results } = cached;

  // Candidates are rebuilt on every call, cache hit or not, so each carries a fresh
  // tray-local id — see the note in resolveCache.ts.
  const build = (result: ProviderResult | null) =>
    buildCandidate({ result, type: resolvedType, typeConfidence, context, query: trimmed, generateId });

  return {
    resolvedType,
    typeConfidence,
    candidates: results.length > 0 ? results.map(build) : [build(null)],
  };
}
