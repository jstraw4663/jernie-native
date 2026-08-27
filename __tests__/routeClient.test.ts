jest.mock('@react-native-firebase/firestore');
jest.mock('@react-native-firebase/functions');

import { mockCollection, mockDoc, mockGet } from '@react-native-firebase/firestore';
import { mockHttpsCallable, mockHttpsCallableRun } from '@react-native-firebase/functions';
import { fetchRoute } from '@/src/lib/routeClient';

const PORTLAND = { lat: 43.6591, lon: -70.2568 };
const BAR_HARBOR = { lat: 44.3876, lon: -68.2039 };
const KEY = '43.6591_-70.2568__44.3876_-68.2039';

function snapshot(data: unknown | null) {
  return { exists: () => data !== null, data: () => data };
}

beforeEach(() => {
  jest.clearAllMocks();
  (mockGet as jest.Mock).mockResolvedValue(snapshot(null));
  (mockHttpsCallableRun as jest.Mock).mockResolvedValue({
    data: { found: true, minutes: 200, miles: 177.7 },
  });
});

// The whole point of reading Firestore first: a cache hit costs one Firestore read
// instead of a Cloud Function invocation plus a billed Mapbox call.
describe('fetchRoute', () => {
  test('a fresh cached route is served without invoking the callable', async () => {
    (mockGet as jest.Mock).mockResolvedValue(
      snapshot({ found: true, minutes: 200, miles: 177.7, cachedAt: Date.now() }),
    );

    const route = await fetchRoute(PORTLAND, BAR_HARBOR);

    expect(mockCollection).toHaveBeenCalledWith('route_cache');
    expect(mockDoc).toHaveBeenCalledWith(KEY);
    expect(mockHttpsCallableRun).not.toHaveBeenCalled();
    expect(route).toEqual({ minutes: 200, miles: 177.7 });
  });

  test('a cache miss invokes the callable with the derived key', async () => {
    const route = await fetchRoute(PORTLAND, BAR_HARBOR);

    expect(mockHttpsCallable).toHaveBeenCalledWith('routeBetween');
    expect(mockHttpsCallableRun).toHaveBeenCalledWith({
      cacheKey: KEY,
      from: PORTLAND,
      to: BAR_HARBOR,
    });
    expect(route).toEqual({ minutes: 200, miles: 177.7 });
  });

  test('a stale cached entry is refetched rather than served', async () => {
    (mockGet as jest.Mock).mockResolvedValue(
      snapshot({ found: true, minutes: 1, miles: 1, cachedAt: Date.now() - 400 * 24 * 3600 * 1000 }),
    );

    const route = await fetchRoute(PORTLAND, BAR_HARBOR);

    expect(mockHttpsCallableRun).toHaveBeenCalled();
    expect(route).toEqual({ minutes: 200, miles: 177.7 });
  });

  test('a cached "no route" is honoured without invoking the callable', async () => {
    (mockGet as jest.Mock).mockResolvedValue(snapshot({ found: false, cachedAt: Date.now() }));

    const route = await fetchRoute(PORTLAND, BAR_HARBOR);

    expect(mockHttpsCallableRun).not.toHaveBeenCalled();
    expect(route).toBeNull();
  });

  test('the callable reporting no route resolves to null, not an error', async () => {
    (mockHttpsCallableRun as jest.Mock).mockResolvedValue({ data: { found: false } });

    await expect(fetchRoute(PORTLAND, BAR_HARBOR)).resolves.toBeNull();
  });

  // Firestore being unreachable is not a reason to have no answer — the callable is a
  // perfectly good, if slower and costlier, path to the same number.
  test('a Firestore read failure falls through to the callable', async () => {
    (mockGet as jest.Mock).mockRejectedValue(new Error('firestore unavailable'));

    const route = await fetchRoute(PORTLAND, BAR_HARBOR);

    expect(mockHttpsCallableRun).toHaveBeenCalled();
    expect(route).toEqual({ minutes: 200, miles: 177.7 });
  });

  // A rejected callable propagates, matching enrichmentClient/stopSearchClient: the caller
  // decides whether a missing drive time is worth surfacing or silently omitting.
  test('a callable failure propagates to the caller', async () => {
    (mockHttpsCallableRun as jest.Mock).mockRejectedValue(new Error('internal'));

    await expect(fetchRoute(PORTLAND, BAR_HARBOR)).rejects.toThrow('internal');
  });
});
