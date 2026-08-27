import {
  resolveCacheKey,
  getCachedResolve,
  setCachedResolve,
  clearResolveCache,
  RESOLVE_CACHE_MAX_ENTRIES,
} from '@/src/lib/resolveCache';

const ENTRY = {
  resolvedType: 'eat' as const,
  typeConfidence: 'guessed' as const,
  results: [{ name: "Thurston's", lat: 44.2397, lon: -68.3531 }],
};

beforeEach(() => clearResolveCache());

describe('resolveCacheKey', () => {
  test('is stable for the same query and anchor', () => {
    expect(resolveCacheKey('thurston', null, 44.3876, -68.2039))
      .toBe(resolveCacheKey('thurston', null, 44.3876, -68.2039));
  });

  // Case and surrounding whitespace are noise from typing, not different searches.
  test('ignores case and surrounding whitespace', () => {
    expect(resolveCacheKey('  Thurston ', null, 44.3876, -68.2039))
      .toBe(resolveCacheKey('thurston', null, 44.3876, -68.2039));
  });

  test('a different query is a different key', () => {
    expect(resolveCacheKey('thurston', null, 44.3876, -68.2039))
      .not.toBe(resolveCacheKey('havana', null, 44.3876, -68.2039));
  });

  // The same words anchored on a different stop are a genuinely different search —
  // "harbor" near Bar Harbor and near Portland should not share results.
  test('a different stop is a different key', () => {
    expect(resolveCacheKey('thurston', null, 44.3876, -68.2039))
      .not.toBe(resolveCacheKey('thurston', null, 43.6591, -70.2568));
  });

  test('a different tapped type is a different key', () => {
    expect(resolveCacheKey('thurston', null, 44.3876, -68.2039))
      .not.toBe(resolveCacheKey('thurston', 'stay', 44.3876, -68.2039));
  });
});

describe('the cache itself', () => {
  test('returns what was stored', () => {
    const key = resolveCacheKey('thurston', null, 44.3876, -68.2039);
    setCachedResolve(key, ENTRY);

    expect(getCachedResolve(key)).toEqual(ENTRY);
  });

  test('misses on a key never stored', () => {
    expect(getCachedResolve('nothing-here')).toBeUndefined();
  });

  test('clearing empties it', () => {
    const key = resolveCacheKey('thurston', null, 44.3876, -68.2039);
    setCachedResolve(key, ENTRY);
    clearResolveCache();

    expect(getCachedResolve(key)).toBeUndefined();
  });

  // Unbounded, this grows with every keystroke burst for the life of the session.
  test('evicts the oldest entry once full, keeping the newest', () => {
    for (let i = 0; i < RESOLVE_CACHE_MAX_ENTRIES + 1; i++) {
      setCachedResolve(`key-${i}`, ENTRY);
    }

    expect(getCachedResolve('key-0')).toBeUndefined();
    expect(getCachedResolve(`key-${RESOLVE_CACHE_MAX_ENTRIES}`)).toEqual(ENTRY);
  });
});
