import functions from '@react-native-firebase/functions';

/**
 * One stop the user can pick, as returned by the `searchStops` callable
 * (functions/src/searchStops.ts).
 */
export interface StopSearchResult {
  name: string;
  /** Short code ("ME"), the convention `Stop.region` uses. */
  region?: string;
  lat: number;
  lon: number;
  /** Subtitle line, excluding the name — "Maine, United States". */
  context?: string;
  /** Straight-line metres from the anchor, when one was supplied. Never a drive time. */
  distanceMetres?: number;
}

interface SearchStopsRequest {
  query: string;
  near?: { lat: number; lon: number };
}

interface SearchStopsResponse {
  results: StopSearchResult[];
}

/**
 * Below this, no lookup runs at all.
 *
 * The same gate resolveClient applies for the same reason: one or two characters match
 * half the map and cost a billed call to say so. The callable enforces it again on its own
 * side — this one saves the round trip, that one is the actual spend control.
 */
export const MIN_STOP_QUERY_LENGTH = 3;

/**
 * Ranked stops matching free text, best first.
 *
 * Replaced `geocodeCity`, which returned exactly one result. That single answer is why
 * this returns a list: "Portland" is a town in Maine, another in Oregon and another in
 * Victoria, and resolving that by provider rank meant the form committed to a city the
 * user never chose and had no way to see was a choice.
 *
 * `near` biases results toward somewhere — the trip's current stop, typically. It is
 * optional because the onboarding wizard's first stop genuinely has nothing to anchor to,
 * and an invented anchor is worse than none: it silently ranks the whole list wrong.
 *
 * Returns [] both for "nothing matched" and for a query too short to be worth sending.
 * Throws if the callable itself fails — matching enrichmentClient and resolveClient, and
 * keeping "the lookup failed" (a retry) distinct from "there is no such place" (a
 * spelling prompt), which the form renders differently.
 */
export async function searchStops(
  query: string,
  near?: { lat: number; lon: number },
): Promise<StopSearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < MIN_STOP_QUERY_LENGTH) return [];

  const callable = functions().httpsCallable<SearchStopsRequest, SearchStopsResponse>('searchStops');

  // Spread rather than `near: undefined`, so an unanchored search sends no key at all.
  const response = await callable({ query: trimmed, ...(near ? { near } : {}) });
  return response.data.results;
}
