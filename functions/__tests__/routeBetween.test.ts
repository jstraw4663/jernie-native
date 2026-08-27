import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { routeBetween } from '../src/routeBetween';
import { fetchMapboxRoute } from '../src/providers/mapbox';
import { getRoute, writeRoute } from '../src/repository';
import { chargeQuota } from '../src/quota';

jest.mock('../src/secrets', () => ({
  MAPBOX_ACCESS_TOKEN: { value: jest.fn(() => 'pk.test-mapbox-token') },
}));

jest.mock('../src/providers/mapbox', () => ({
  fetchMapboxRoute: jest.fn(),
}));

jest.mock('../src/repository', () => ({
  getRoute: jest.fn(),
  writeRoute: jest.fn(),
}));

jest.mock('../src/quota', () => ({ chargeQuota: jest.fn() }));

const mockRoute = fetchMapboxRoute as jest.MockedFunction<typeof fetchMapboxRoute>;
const mockGetRoute = getRoute as jest.MockedFunction<typeof getRoute>;
const mockWriteRoute = writeRoute as jest.MockedFunction<typeof writeRoute>;
const mockCharge = chargeQuota as jest.MockedFunction<typeof chargeQuota>;

const PORTLAND = { lat: 43.6591, lon: -70.2568 };
const BAR_HARBOR = { lat: 44.3876, lon: -68.2039 };
const KEY = '43.6591_-70.2568__44.3876_-68.2039';

function req(data: unknown, overrides: Partial<CallableRequest<unknown>> = {}): CallableRequest<unknown> {
  return { data, auth: { uid: 'test-uid' }, ...overrides } as unknown as CallableRequest<unknown>;
}

const VALID = { cacheKey: KEY, from: PORTLAND, to: BAR_HARBOR };

describe('routeBetween', () => {
  beforeEach(() => {
    mockRoute.mockReset();
    mockGetRoute.mockReset();
    mockWriteRoute.mockReset();
    mockGetRoute.mockResolvedValue(undefined);
    mockWriteRoute.mockResolvedValue(undefined);
    mockCharge.mockReset();
    mockCharge.mockResolvedValue(undefined);
    mockRoute.mockResolvedValue({ minutes: 200, miles: 177.7 });
  });

  describe('guards', () => {
    test('rejects an unauthenticated call', async () => {
      await expect(
        routeBetween.run(req(VALID, { auth: undefined })),
      ).rejects.toMatchObject({ code: 'unauthenticated' });
    });

    test('rejects a call with no cache key', async () => {
      await expect(
        routeBetween.run(req({ from: PORTLAND, to: BAR_HARBOR })),
      ).rejects.toMatchObject({ code: 'invalid-argument' });
    });

    test('rejects a call with malformed coordinates', async () => {
      await expect(
        routeBetween.run(req({ cacheKey: KEY, from: { lat: 'north' }, to: BAR_HARBOR })),
      ).rejects.toMatchObject({ code: 'invalid-argument' });
    });
  });

  describe('cache', () => {
    test('a cached route is returned without calling Mapbox at all', async () => {
      mockGetRoute.mockResolvedValue({ found: true, minutes: 200, miles: 177.7, cachedAt: Date.now() });

      const result = await routeBetween.run(req(VALID));

      expect(mockRoute).not.toHaveBeenCalled();
      expect(result).toEqual({ found: true, minutes: 200, miles: 177.7 });
    });

    test('a cache miss calls Mapbox and stores the result', async () => {
      const result = await routeBetween.run(req(VALID));

      expect(mockRoute).toHaveBeenCalledWith({ from: PORTLAND, to: BAR_HARBOR });
      expect(mockWriteRoute).toHaveBeenCalledWith(KEY, expect.objectContaining({
        found: true, minutes: 200, miles: 177.7,
      }));
      expect(result).toEqual({ found: true, minutes: 200, miles: 177.7 });
    });

    test('stores only our own derived integers, never provider data', async () => {
      await routeBetween.run(req(VALID));

      const [, stored] = mockWriteRoute.mock.calls[0];
      // Whatever else changes, the cache document must never grow a geometry, a legs
      // array, or a raw response — that is the whole basis for retaining it at all.
      expect(Object.keys(stored).sort()).toEqual(['cachedAt', 'found', 'miles', 'minutes']);
    });

    test('an entry past the retention window is refetched, not served', async () => {
      const ancient = Date.now() - 400 * 24 * 60 * 60 * 1000;
      mockGetRoute.mockResolvedValue({ found: true, minutes: 1, miles: 1, cachedAt: ancient });

      const result = await routeBetween.run(req(VALID));

      expect(mockRoute).toHaveBeenCalled();
      expect(result).toEqual({ found: true, minutes: 200, miles: 177.7 });
    });

    test('an entry inside the retention window is served as-is', async () => {
      const recent = Date.now() - 5 * 24 * 60 * 60 * 1000;
      mockGetRoute.mockResolvedValue({ found: true, minutes: 1, miles: 1, cachedAt: recent });

      const result = await routeBetween.run(req(VALID));

      expect(mockRoute).not.toHaveBeenCalled();
      expect(result).toMatchObject({ minutes: 1 });
    });
  });

  describe('no route', () => {
    test('an unreachable pair reports not-found rather than erroring', async () => {
      mockRoute.mockResolvedValue(null);

      const result = await routeBetween.run(req(VALID));

      expect(result).toEqual({ found: false });
    });

    // Caching the negative matters: without it, every render of a card whose two points
    // have no road between them re-queries a paid API forever.
    test('a not-found result is cached too', async () => {
      mockRoute.mockResolvedValue(null);

      await routeBetween.run(req(VALID));

      expect(mockWriteRoute).toHaveBeenCalledWith(KEY, expect.objectContaining({ found: false }));
    });

    test('a cached not-found is served without calling Mapbox', async () => {
      mockGetRoute.mockResolvedValue({ found: false, cachedAt: Date.now() });

      const result = await routeBetween.run(req(VALID));

      expect(mockRoute).not.toHaveBeenCalled();
      expect(result).toEqual({ found: false });
    });
  });

  describe('failures', () => {
    test('a provider failure is an error, never a cached not-found', async () => {
      mockRoute.mockRejectedValue(new Error('Mapbox request failed with status 500'));

      await expect(routeBetween.run(req(VALID))).rejects.toMatchObject({ code: 'internal' });
    });

    test('a provider failure is never written to the cache', async () => {
      mockRoute.mockRejectedValue(new Error('Mapbox request failed with status 500'));

      await expect(routeBetween.run(req(VALID))).rejects.toThrow();
      expect(mockWriteRoute).not.toHaveBeenCalled();
    });

    // A cache read failing is not a reason to fail the request — the provider is still
    // there, and a slow answer beats no answer.
    // The lookup has already been paid for by the time the write happens. Failing the
    // request here would make the client retry and pay for it a second time.
    test('a cache write failure still returns the route it paid for', async () => {
      mockWriteRoute.mockRejectedValue(new Error('firestore unavailable'));

      const result = await routeBetween.run(req(VALID));

      expect(result).toEqual({ found: true, minutes: 200, miles: 177.7 });
    });

    test('a cache read failure falls through to the provider', async () => {
      mockGetRoute.mockRejectedValue(new Error('firestore unavailable'));

      const result = await routeBetween.run(req(VALID));

      expect(result).toEqual({ found: true, minutes: 200, miles: 177.7 });
    });
  });

  // The meter counts BILLED PROVIDER CALLS, not invocations. Charging on entry would bill
  // a user for the cache hits that are the entire point of having a cache.
  describe('quota', () => {
    test('charges one unit before calling Mapbox', async () => {
      await routeBetween.run(req(VALID));

      expect(mockCharge).toHaveBeenCalledWith('test-uid', 'routeBetween', 1);
    });

    test('a route served from cache costs no quota at all', async () => {
      mockGetRoute.mockResolvedValue({ found: true, minutes: 200, miles: 177.7, cachedAt: Date.now() });

      await routeBetween.run(req(VALID));

      expect(mockCharge).not.toHaveBeenCalled();
    });

    test('a refused charge means Mapbox is never called', async () => {
      mockCharge.mockRejectedValue(new HttpsError('resource-exhausted', 'over quota'));

      await expect(routeBetween.run(req(VALID))).rejects.toMatchObject({ code: 'resource-exhausted' });
      expect(mockRoute).not.toHaveBeenCalled();
    });
  });
});
