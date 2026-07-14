import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { fetchFoursquareMatch } from '../src/providers/foursquare';
import { getEnrichment, writeEnrichment } from '../src/repository';
import { enrichPlaces } from '../src/enrichPlaces';
import type { ProviderMatch } from '../src/providers/types';
import type { PlaceEnrichment } from '../src/types';

jest.mock('../src/providers/foursquare', () => ({
  fetchFoursquareMatch: jest.fn(),
}));

jest.mock('../src/repository', () => ({
  getEnrichment: jest.fn(),
  writeEnrichment: jest.fn(),
}));

const mockFetch = fetchFoursquareMatch as jest.MockedFunction<typeof fetchFoursquareMatch>;
const mockGetEnrichment = getEnrichment as jest.MockedFunction<typeof getEnrichment>;
const mockWriteEnrichment = writeEnrichment as jest.MockedFunction<typeof writeEnrichment>;

function req(data: unknown): CallableRequest<unknown> {
  return { data } as unknown as CallableRequest<unknown>;
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

    beforeEach(() => {
      logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
      logSpy.mockRestore();
    });

    test('emits one JSON log line per place with canonicalKey, outcome, and durationMs', async () => {
      const matched = place('match-key');
      const missed = place('miss-key');
      const errored = place('error-key');

      mockFetch.mockImplementation(async (input) => {
        if (input.name === matched.name) return MATCH;
        if (input.name === missed.name) return null;
        throw new Error('boom');
      });

      await enrichPlaces.run(req([matched, missed, errored]));

      const logged = logSpy.mock.calls.map(([line]) => JSON.parse(line as string));

      expect(logged).toEqual(
        expect.arrayContaining([
          { canonicalKey: 'match-key', outcome: 'matched', durationMs: expect.any(Number) },
          { canonicalKey: 'miss-key', outcome: 'not_found', durationMs: expect.any(Number) },
          { canonicalKey: 'error-key', outcome: 'error', durationMs: expect.any(Number) },
        ])
      );
      expect(logged).toHaveLength(3);
    });
  });
});
