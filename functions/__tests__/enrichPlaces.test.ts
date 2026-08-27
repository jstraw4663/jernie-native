import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { fetchFoursquareMatch } from '../src/providers/foursquare';
import { getEnrichment, writeEnrichment } from '../src/repository';
import { enrichPlaces } from '../src/enrichPlaces';
import { chargeQuota } from '../src/quota';
import type { ProviderMatch } from '../src/providers/types';
import type { PlaceEnrichment } from '../src/types';

jest.mock('../src/providers/foursquare', () => ({
  fetchFoursquareMatch: jest.fn(),
}));

jest.mock('../src/repository', () => ({
  getEnrichment: jest.fn(),
  writeEnrichment: jest.fn(),
}));

jest.mock('../src/quota', () => ({ chargeQuota: jest.fn() }));

const mockFetch = fetchFoursquareMatch as jest.MockedFunction<typeof fetchFoursquareMatch>;
const mockGetEnrichment = getEnrichment as jest.MockedFunction<typeof getEnrichment>;
const mockWriteEnrichment = writeEnrichment as jest.MockedFunction<typeof writeEnrichment>;
const mockCharge = chargeQuota as jest.MockedFunction<typeof chargeQuota>;

function req(
  data: unknown,
  overrides: Partial<CallableRequest<unknown>> = {}
): CallableRequest<unknown> {
  // Defaults to a truthy `auth`, matching every real invocation this callable will ever
  // receive in production (App Check/Auth already verified it before the handler runs).
  // The dedicated unauthenticated-rejection test below overrides this explicitly.
  return {
    data,
    auth: { uid: 'test-uid' },
    ...overrides,
  } as unknown as CallableRequest<unknown>;
}

function place(canonicalKey: string, overrides: Partial<{ name: string; lat: number; lon: number; fsq_id: string }> = {}) {
  return { canonicalKey, name: `Place ${canonicalKey}`, lat: 1, lon: 2, ...overrides };
}

const MATCH: ProviderMatch = {
  fsq_id: 'fsq-1',
  phone: '+15551234567',
  website: 'https://example.com',
  hours: ['Mon-Sun 9-5'],
  address: '1 Main St',
  rating: 9,
  ratingCount: 100,
  price: '$$',
  photos: ['https://example.com/photo.jpg'],
};

describe('enrichPlaces', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetEnrichment.mockResolvedValue(undefined);
    mockWriteEnrichment.mockResolvedValue(undefined);
    mockCharge.mockReset();
    mockCharge.mockResolvedValue(undefined);
  });

  describe('per-settlement handling', () => {
    test('routes a match, a clean-miss, and an error to the correct treatment', async () => {
      const matched = place('match-key');
      const missed = place('miss-key');
      const errored = place('error-key');

      mockFetch.mockImplementation(async (input) => {
        if (input.name === matched.name) return MATCH;
        if (input.name === missed.name) return null;
        throw new Error('Foursquare request failed with status 500');
      });

      const response = (await enrichPlaces.run(req([matched, missed, errored]))) as {
        results: Record<string, PlaceEnrichment>;
      };

      // Matched: written and included in the response, carrying the match's fields.
      expect(response.results['match-key']).toMatchObject({
        fsq_id: 'fsq-1',
        phone: '+15551234567',
        place_id_locked: true,
      });
      expect(response.results['match-key'].fsq_not_found).toBeUndefined();

      // Clean miss: written and included, with the fsq_not_found sentinel.
      expect(response.results['miss-key']).toMatchObject({
        fsq_not_found: true,
        place_id_locked: true,
      });

      // Errored: excluded entirely — no write, no response entry.
      expect(response.results['error-key']).toBeUndefined();

      expect(mockWriteEnrichment).toHaveBeenCalledTimes(2);
      const writtenKeys = mockWriteEnrichment.mock.calls.map(([key]) => key);
      expect(writtenKeys).toEqual(expect.arrayContaining(['match-key', 'miss-key']));
      expect(writtenKeys).not.toContain('error-key');

      // getEnrichment (existing-doc lookup for the merge) only happens for places that
      // actually get merged/written — not for the one that errored out.
      expect(mockGetEnrichment).toHaveBeenCalledTimes(2);
      expect(mockGetEnrichment).toHaveBeenCalledWith('match-key');
      expect(mockGetEnrichment).toHaveBeenCalledWith('miss-key');
      expect(mockGetEnrichment).not.toHaveBeenCalledWith('error-key');
    });

    test('passes the existing doc from getEnrichment through to the merged/written result', async () => {
      const p = place('existing-key');
      const existing: PlaceEnrichment = {
        name: p.name,
        lat: p.lat,
        lon: p.lon,
        address: 'old address',
        photos: [],
        googlePlaceId: 'google-xyz',
        cached_at: 1,
        place_id_locked: true,
      };
      mockGetEnrichment.mockResolvedValue(existing);
      mockFetch.mockResolvedValue(MATCH);

      const response = (await enrichPlaces.run(req([p]))) as { results: Record<string, PlaceEnrichment> };

      // googlePlaceId isn't something Foursquare knows about — a correct merge carries
      // it over from `existing` rather than dropping it.
      expect(response.results['existing-key'].googlePlaceId).toBe('google-xyz');
      expect(mockWriteEnrichment).toHaveBeenCalledWith('existing-key', response.results['existing-key']);
    });

    test('does not call fetchFoursquareMatch, getEnrichment, or writeEnrichment for an empty batch', async () => {
      const response = (await enrichPlaces.run(req([]))) as { results: Record<string, PlaceEnrichment> };

      expect(response.results).toEqual({});
      expect(mockFetch).not.toHaveBeenCalled();
      expect(mockGetEnrichment).not.toHaveBeenCalled();
      expect(mockWriteEnrichment).not.toHaveBeenCalled();
    });
  });

  describe('30-entry cap', () => {
    test('accepts exactly 30 places', async () => {
      const places = Array.from({ length: 30 }, (_, i) => place(`key-${i}`));
      mockFetch.mockResolvedValue(MATCH);

      const response = (await enrichPlaces.run(req(places))) as { results: Record<string, PlaceEnrichment> };

      expect(Object.keys(response.results)).toHaveLength(30);
      expect(mockFetch).toHaveBeenCalledTimes(30);
    });

    test('rejects a batch of 31 places with a clear invalid-argument error, without calling the provider', async () => {
      const places = Array.from({ length: 31 }, (_, i) => place(`key-${i}`));

      await expect(enrichPlaces.run(req(places))).rejects.toMatchObject({
        code: 'invalid-argument',
      });
      await expect(enrichPlaces.run(req(places))).rejects.toBeInstanceOf(HttpsError);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    test('rejects non-array input', async () => {
      await expect(enrichPlaces.run(req({ not: 'an array' }))).rejects.toMatchObject({
        code: 'invalid-argument',
      });
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('authentication (I1)', () => {
    test('rejects an unauthenticated request with unauthenticated, before doing any work', async () => {
      const p = place('some-key');

      await expect(enrichPlaces.run(req([p], { auth: undefined }))).rejects.toMatchObject({
        code: 'unauthenticated',
      });
      await expect(enrichPlaces.run(req([p], { auth: undefined }))).rejects.toBeInstanceOf(HttpsError);

      expect(mockFetch).not.toHaveBeenCalled();
      expect(mockGetEnrichment).not.toHaveBeenCalled();
      expect(mockWriteEnrichment).not.toHaveBeenCalled();
    });
  });

  describe('per-place Firestore failure isolation (I2)', () => {
    test('a writeEnrichment failure for one place does not affect the others in the same batch', async () => {
      const ok1 = place('ok-1');
      const failing = place('fail-key');
      const ok2 = place('ok-2');

      mockFetch.mockResolvedValue(MATCH);
      mockWriteEnrichment.mockImplementation(async (canonicalKey: string) => {
        if (canonicalKey === 'fail-key') {
          throw new Error('Firestore unavailable');
        }
      });

      const response = (await enrichPlaces.run(req([ok1, failing, ok2]))) as {
        results: Record<string, PlaceEnrichment>;
      };

      expect(response.results['ok-1']).toMatchObject({ fsq_id: 'fsq-1' });
      expect(response.results['ok-2']).toMatchObject({ fsq_id: 'fsq-1' });
      expect(response.results['fail-key']).toBeUndefined();
    });
  });

  describe('concurrency batching beyond a single chunk', () => {
    test('processes a batch larger than the concurrency cap in full', async () => {
      const places = Array.from({ length: 10 }, (_, i) => place(`key-${i}`));
      mockFetch.mockResolvedValue(MATCH);

      const response = (await enrichPlaces.run(req(places))) as { results: Record<string, PlaceEnrichment> };

      expect(Object.keys(response.results)).toHaveLength(10);
      expect(mockWriteEnrichment).toHaveBeenCalledTimes(10);
    });
  });

  describe('structured per-place logging', () => {
    let logSpy: jest.SpyInstance;
    let errorSpy: jest.SpyInstance;

    beforeEach(() => {
      logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      logSpy.mockRestore();
      errorSpy.mockRestore();
    });

    test('emits one JSON log line per place with canonicalKey, outcome, and durationMs, at the right severity (M2)', async () => {
      const matched = place('match-key');
      const missed = place('miss-key');
      const errored = place('error-key');

      mockFetch.mockImplementation(async (input) => {
        if (input.name === matched.name) return MATCH;
        if (input.name === missed.name) return null;
        throw new Error('Foursquare request failed with status 401');
      });

      await enrichPlaces.run(req([matched, missed, errored]));

      const logged = logSpy.mock.calls.map(([line]) => JSON.parse(line as string));
      const errorLogged = errorSpy.mock.calls.map(([line]) => JSON.parse(line as string));

      // Routine outcomes ('matched'/'not_found') go to console.log...
      expect(logged).toEqual(
        expect.arrayContaining([
          { canonicalKey: 'match-key', outcome: 'matched', durationMs: expect.any(Number) },
          { canonicalKey: 'miss-key', outcome: 'not_found', durationMs: expect.any(Number) },
        ])
      );
      expect(logged).toHaveLength(2);

      // ...while the 'error' outcome goes to console.error, not console.log, and now
      // carries enough detail (which stage failed, and the underlying message) to
      // actually diagnose a live failure from Cloud Logging alone.
      expect(errorLogged).toEqual([
        {
          canonicalKey: 'error-key',
          outcome: 'error',
          durationMs: expect.any(Number),
          stage: 'provider',
          error: 'Foursquare request failed with status 401',
        },
      ]);
    });

    test('a Firestore write failure logs stage "write" with the underlying error message', async () => {
      const failing = place('fail-key');
      mockFetch.mockResolvedValue(MATCH);
      mockWriteEnrichment.mockRejectedValue(new Error('Firestore unavailable'));

      await enrichPlaces.run(req([failing]));

      const errorLogged = errorSpy.mock.calls.map(([line]) => JSON.parse(line as string));
      expect(errorLogged).toEqual([
        {
          canonicalKey: 'fail-key',
          outcome: 'error',
          durationMs: expect.any(Number),
          stage: 'write',
          error: 'Firestore unavailable',
        },
      ]);
    });
  });

  // One invocation makes one Foursquare call PER PLACE, so metering invocations would
  // under-count by up to 30x and leave the batch path effectively unmetered.
  describe('quota', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue(null);
    });

    test('charges one unit per place in the batch', async () => {
      await enrichPlaces.run(req([place('a'), place('b'), place('c')]));

      expect(mockCharge).toHaveBeenCalledWith('test-uid', 'enrichPlaces', 3);
    });

    test('charges once for the whole batch, not once per chunk', async () => {
      await enrichPlaces.run(req([place('a'), place('b'), place('c'), place('d'), place('e')]));

      expect(mockCharge).toHaveBeenCalledTimes(1);
    });

    test('a refused charge means no place is ever looked up', async () => {
      mockCharge.mockRejectedValue(new HttpsError('resource-exhausted', 'over quota'));

      await expect(enrichPlaces.run(req([place('a')]))).rejects.toMatchObject({
        code: 'resource-exhausted',
      });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    // An oversized batch is rejected before it is charged: the caller made a mistake and
    // nothing was going to be spent on it.
    test('an oversized batch is rejected without charging anything', async () => {
      const oversized = Array.from({ length: 31 }, (_, i) => place(`k${i}`));

      await expect(enrichPlaces.run(req(oversized))).rejects.toMatchObject({ code: 'invalid-argument' });
      expect(mockCharge).not.toHaveBeenCalled();
    });
  });
});
