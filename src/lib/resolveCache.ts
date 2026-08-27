// An in-session memo of what `resolveQuery` already answered.
//
// The add sheet debounces at 350ms, so every pause while typing is a billed Foursquare
// call. Backspacing, retyping, or reopening the sheet on the same query would each pay
// again. This costs nothing and removes all of that.
//
// In memory only, deliberately. A cross-session Firestore cache would save more, but it
// needs a TTL story (restaurants close), a rules block and a retention argument — and at
// Foursquare's 500 free Pro calls a month there is nothing yet to save. The seam is here
// when that changes.
//
// What is cached is the RESPONSE, never the built Candidates: candidate ids are
// tray-local, and replaying them would let the same place enter the tray twice under one
// id, so removing one would remove both.

import type { CandidateType, ProviderResult, TypeConfidence } from '@/src/domain/candidate';

export interface CachedResolve {
  resolvedType: CandidateType;
  typeConfidence: TypeConfidence;
  results: ProviderResult[];
}

/**
 * Bounded so a long session cannot grow this without limit — every keystroke burst that
 * pauses is a new entry. Fifty covers far more than one planning session's worth of
 * distinct queries.
 */
export const RESOLVE_CACHE_MAX_ENTRIES = 50;

const cache = new Map<string, CachedResolve>();

/**
 * Keyed on the query, the tapped type, and the stop the search is anchored to. The stop
 * matters: "harbor" near Bar Harbor and "harbor" near Portland are different searches
 * that would otherwise share an entry.
 *
 * Coordinates round to 4dp, the same precision canonicalPlaceKey and routeCacheKey use.
 */
export function resolveCacheKey(
  query: string,
  typeHint: CandidateType | null,
  stopLat: number,
  stopLon: number,
): string {
  const normalized = query.trim().toLowerCase();
  return `${normalized}|${typeHint ?? 'any'}|${stopLat.toFixed(4)},${stopLon.toFixed(4)}`;
}

export function getCachedResolve(key: string): CachedResolve | undefined {
  return cache.get(key);
}

export function setCachedResolve(key: string, value: CachedResolve): void {
  // Map preserves insertion order, so the first key is always the oldest.
  if (cache.size >= RESOLVE_CACHE_MAX_ENTRIES && !cache.has(key)) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, value);
}

/**
 * Empties the cache. Worth calling when the signed-in user changes — results are anchored
 * to a trip's stops, and a different account should not inherit them.
 */
export function clearResolveCache(): void {
  cache.clear();
}
