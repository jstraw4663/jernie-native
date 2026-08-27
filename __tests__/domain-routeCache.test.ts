import { routeCacheKey, isRouteFresh } from '@/src/domain/routeCache';

const PORTLAND = { lat: 43.6591, lon: -70.2568 };
const BAR_HARBOR = { lat: 44.3876, lon: -68.2039 };

// This key is the contract between the client (which derives it and reads route_cache
// directly) and routeBetween (which writes to whatever key it is handed). Nothing
// validates that the two agree, so drift here silently misses the cache and quietly
// doubles the Mapbox bill rather than failing.
describe('routeCacheKey', () => {
  test('is stable for the same pair of points', () => {
    expect(routeCacheKey(PORTLAND, BAR_HARBOR)).toBe(routeCacheKey(PORTLAND, BAR_HARBOR));
  });

  test('matches the documented shape', () => {
    expect(routeCacheKey(PORTLAND, BAR_HARBOR)).toBe('43.6591_-70.2568__44.3876_-68.2039');
  });

  // Same rounding as canonicalPlaceKey — 4dp is about 11m, loose enough that two
  // providers' coordinates for the same building share an entry, tight enough not to
  // merge genuinely different places.
  test('rounds to 4dp so near-identical coordinates share one entry', () => {
    const nudged = { lat: 43.65911, lon: -70.25684 };
    expect(routeCacheKey(nudged, BAR_HARBOR)).toBe(routeCacheKey(PORTLAND, BAR_HARBOR));
  });

  test('pads coordinates to a fixed width so 43.1 and 43.1000 agree', () => {
    expect(routeCacheKey({ lat: 43.1, lon: -70 }, BAR_HARBOR)).toBe(
      routeCacheKey({ lat: 43.1000, lon: -70.0 }, BAR_HARBOR),
    );
  });

  // Direction matters: one-way systems and ferry legs are not symmetric, and conflating
  // them would serve the wrong duration in one direction with no way to notice.
  test('distinguishes the two directions of travel', () => {
    expect(routeCacheKey(PORTLAND, BAR_HARBOR)).not.toBe(routeCacheKey(BAR_HARBOR, PORTLAND));
  });

  test('handles coordinates on both sides of the equator and meridian', () => {
    expect(routeCacheKey({ lat: -33.8688, lon: 151.2093 }, { lat: -37.8136, lon: 144.9631 }))
      .toBe('-33.8688_151.2093__-37.8136_144.9631');
  });
});

// The retention window is duplicated between here and functions/src/routeBetween.ts —
// the client applies it so a hit never reaches the callable, the server applies it as a
// backstop for a client that asks anyway. Both are documented as needing to match.
describe('isRouteFresh', () => {
  test('an entry written just now is fresh', () => {
    expect(isRouteFresh(Date.now())).toBe(true);
  });

  test('an entry a few days old is still fresh', () => {
    expect(isRouteFresh(Date.now() - 5 * 24 * 60 * 60 * 1000)).toBe(true);
  });

  test('an entry past the retention window is stale', () => {
    expect(isRouteFresh(Date.now() - 400 * 24 * 60 * 60 * 1000)).toBe(false);
  });

  test('a missing or malformed timestamp is treated as stale, never as fresh', () => {
    expect(isRouteFresh(undefined)).toBe(false);
    expect(isRouteFresh(Number.NaN)).toBe(false);
  });
});
