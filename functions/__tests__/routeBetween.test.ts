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
      mockGetRoute.mockResolvedValue({ found: true, minutes: 200, miles: 177.7, cachedAt: Date.now() , expiresAt: new Date()});

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
      // Deliberately an exact key set rather than a "does not contain geometry" check: a
      // new key has to be added here consciously, which is what makes this catch the
      // accidental spread of a provider response rather than only the fields we thought of.
      expect(Object.keys(stored).sort()).toEqual(['cachedAt', 'expiresAt', 'found', 'miles', 'minutes']);
    });

    test('an entry past the retention window is refetched, not served', async () => {
      const ancient = Date.now() - 400 * 24 * 60 * 60 * 1000;
      mockGetRoute.mockResolvedValue({ found: true, minutes: 1, miles: 1, cachedAt: ancient , expiresAt: new Date()});

      const result = await routeBetween.run(req(VALID));

      expect(mockRoute).toHaveBeenCalled();
      expect(result).toEqual({ found: true, minutes: 200, miles: 177.7 });
    });

    test('an entry inside the retention window is served as-is', async () => {
      const recent = Date.now() - 5 * 24 * 60 * 60 * 1000;
      mockGetRoute.mockResolvedValue({ found: true, minutes: 1, miles: 1, cachedAt: recent , expiresAt: new Date()});

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
      mockGetRoute.mockResolvedValue({ found: false, cachedAt: Date.now() , expiresAt: new Date()});

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
  // Firestore's TTL policy deletes a document when a named field's TIMESTAMP passes. It
  // cannot read epoch milliseconds, so `cachedAt` — which the client uses for its own
  // freshness check and which must stay a number — can never be the TTL field. Without a
  // second field the collection grows for ever: stale entries are overwritten on next use
  // but nothing ever removes a route nobody asks for again.
  describe('expiry', () => {
    test('writes a Date the TTL policy can act on', async () => {
      await routeBetween.run(req(VALID));

      const [, record] = mockWriteRoute.mock.calls[0] as [string, { expiresAt: unknown }];
      expect(record.expiresAt).toBeInstanceOf(Date);
    });

    test('expires a cached route after the retention window it is served for', async () => {
      const before = Date.now();
      await routeBetween.run(req(VALID));
      const after = Date.now();

      const [, record] = mockWriteRoute.mock.calls[0] as [string, { expiresAt: Date }];
      const thirtyDays = 30 * 24 * 60 * 60 * 1000;
      expect(record.expiresAt.getTime()).toBeGreaterThanOrEqual(before + thirtyDays);
      expect(record.expiresAt.getTime()).toBeLessThanOrEqual(after + thirtyDays);
    });

    // A "no drivable route" record is cached precisely so it is not re-queried for ever,
    // and it costs a billed call to establish. It expires on the same clock as a hit.
    test('a no-route record expires too, rather than being kept for ever', async () => {
      mockRoute.mockResolvedValue(null);

      await routeBetween.run(req(VALID));

      const [, record] = mockWriteRoute.mock.calls[0] as [string, { found: boolean; expiresAt: unknown }];
      expect(record.found).toBe(false);
      expect(record.expiresAt).toBeInstanceOf(Date);
    });

    test('still writes cachedAt as a number, which is what the client reads', async () => {
      await routeBetween.run(req(VALID));

      const [, record] = mockWriteRoute.mock.calls[0] as [string, { cachedAt: unknown }];
      expect(typeof record.cachedAt).toBe('number');
    });
  });

  describe('quota', () => {
    test('charges one unit before calling Mapbox', async () => {
      await routeBetween.run(req(VALID));

      expect(mockCharge).toHaveBeenCalledWith('test-uid', 'routeBetween', 1);
    });

    test('a route served from cache costs no quota at all', async () => {
      mockGetRoute.mockResolvedValue({ found: true, minutes: 200, miles: 177.7, cachedAt: Date.now() , expiresAt: new Date()});

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
