import { fetchFoursquareMatch } from '../../src/providers/foursquare';

jest.mock('../../src/secrets', () => ({
  FOURSQUARE_API_KEY: { value: jest.fn(() => 'test-fsq-key') },
}));

const mockFetch = jest.fn();
(global as unknown as { fetch: typeof fetch }).fetch = mockFetch as unknown as typeof fetch;

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

// A representative "Places Pro + Premium" sample response object, shaped per the live
// OpenAPI schema confirmed in research (fsq_place_id/latitude/longitude top-level,
// location.formatted_address, tel, website, hours.display, rating, price as 1-4 int,
// stats.total_ratings).
const SAMPLE_PLACE = {
  fsq_place_id: 'abc123',
  name: 'Test Cafe',
  latitude: 45.0,
  longitude: -70.0,
  location: {
    address: '123 Main St',
    formatted_address: '123 Main St, Testville, TS 00000',
  },
  tel: '+15551234567',
  website: 'https://testcafe.example.com',
  hours: { display: 'Mon-Fri 9:00 AM-5:00 PM' },
  rating: 8.5,
  price: 2,
  stats: { total_ratings: 42 },
};

describe('fetchFoursquareMatch', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('by-search path (no fsq_id given)', () => {
    test('calls GET /places/search with the correct URL/headers and maps fields', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ results: [SAMPLE_PLACE] }));

      const result = await fetchFoursquareMatch({ name: 'Test Cafe', lat: 45.0, lon: -70.0 });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      const parsed = new URL(url);
      expect(parsed.origin + parsed.pathname).toBe('https://places-api.foursquare.com/places/search');
      expect(parsed.searchParams.get('query')).toBe('Test Cafe');
      expect(parsed.searchParams.get('ll')).toBe('45,-70');
      expect(parsed.searchParams.get('sort')).toBe('RELEVANCE');
      expect(Number(parsed.searchParams.get('radius'))).toBeGreaterThan(0);
      expect(Number(parsed.searchParams.get('limit'))).toBeGreaterThan(0);
      const fields = parsed.searchParams.get('fields');
      expect(fields).toContain('fsq_place_id');
      // Regression guard: once `fields` is specified at all, Foursquare stops
      // returning its "Pro fields by default" set, so `latitude`/`longitude` MUST be
      // requested explicitly or the distance sanity-check silently has nothing to
      // compare against on a real API call (a mocked-fetch test alone wouldn't catch
      // this, since the mock returns whatever object we hand it regardless of what
      // `fields` asked for).
      expect(fields).toContain('latitude');
      expect(fields).toContain('longitude');

      expect(init.headers).toEqual({
        Authorization: 'Bearer test-fsq-key',
        'X-Places-Api-Version': '2025-06-17',
      });
      expect(init.signal).toBeInstanceOf(AbortSignal);

      expect(result).toEqual({
        fsq_id: 'abc123',
        phone: '+15551234567',
        website: 'https://testcafe.example.com',
        hours: ['Mon-Fri 9:00 AM-5:00 PM'],
        address: '123 Main St, Testville, TS 00000',
        rating: 8.5,
        ratingCount: 42,
        price: '$$',
      });
    });

    test('rejects a top candidate farther than ~200m from the curated lat/lon', async () => {
      // ~0.01 deg latitude ≈ 1.1km north — well outside the 200m sanity-check radius.
      const farPlace = { ...SAMPLE_PLACE, latitude: 45.01, longitude: -70.0 };
      mockFetch.mockResolvedValue(jsonResponse({ results: [farPlace] }));

      const result = await fetchFoursquareMatch({ name: 'Test Cafe', lat: 45.0, lon: -70.0 });

      expect(result).toBeNull();
    });

    test('accepts a top candidate comfortably within ~200m', async () => {
      // ~0.001 deg latitude ≈ 111m — within the 200m sanity-check radius.
      const nearPlace = { ...SAMPLE_PLACE, latitude: 45.001, longitude: -70.0 };
      mockFetch.mockResolvedValue(jsonResponse({ results: [nearPlace] }));

      const result = await fetchFoursquareMatch({ name: 'Test Cafe', lat: 45.0, lon: -70.0 });

      expect(result?.fsq_id).toBe('abc123');
    });

    test('returns null for a 2xx response with zero result candidates', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ results: [] }));

      const result = await fetchFoursquareMatch({ name: 'Nonexistent Place', lat: 45.0, lon: -70.0 });

      expect(result).toBeNull();
    });

    test('returns null rather than silently accepting a candidate missing coordinates', async () => {
      // Regression guard: NaN > 200 is `false` in JS, so a naive distance check would
      // otherwise accept a candidate it can't actually verify.
      const noCoordsPlace = { ...SAMPLE_PLACE, latitude: undefined, longitude: undefined };
      mockFetch.mockResolvedValue(jsonResponse({ results: [noCoordsPlace] }));

      const result = await fetchFoursquareMatch({ name: 'Test Cafe', lat: 45.0, lon: -70.0 });

      expect(result).toBeNull();
    });
  });

  describe('by-ID path (fsq_id given — place_id_locked re-fetch)', () => {
    test('calls GET /places/{fsq_id} details-by-ID and skips search entirely', async () => {
      mockFetch.mockResolvedValue(jsonResponse(SAMPLE_PLACE));

      const result = await fetchFoursquareMatch({
        name: 'Test Cafe',
        lat: 45.0,
        lon: -70.0,
        fsq_id: 'abc123',
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      const parsed = new URL(url);
      expect(parsed.origin + parsed.pathname).toBe('https://places-api.foursquare.com/places/abc123');
      expect(parsed.searchParams.get('fields')).toContain('fsq_place_id');
      expect(init.headers).toEqual({
        Authorization: 'Bearer test-fsq-key',
        'X-Places-Api-Version': '2025-06-17',
      });

      expect(result).toEqual({
        fsq_id: 'abc123',
        phone: '+15551234567',
        website: 'https://testcafe.example.com',
        hours: ['Mon-Fri 9:00 AM-5:00 PM'],
        address: '123 Main St, Testville, TS 00000',
        rating: 8.5,
        ratingCount: 42,
        price: '$$',
      });
    });
  });

  describe('error contract — throw, never swallow or return null', () => {
    test('throws on a network error', async () => {
      mockFetch.mockRejectedValue(new Error('getaddrinfo ENOTFOUND places-api.foursquare.com'));

      await expect(fetchFoursquareMatch({ name: 'Test Cafe', lat: 45.0, lon: -70.0 })).rejects.toThrow();
    });

    test('throws on a timeout/abort', async () => {
      mockFetch.mockRejectedValue(new DOMException('The operation was aborted.', 'TimeoutError'));

      await expect(fetchFoursquareMatch({ name: 'Test Cafe', lat: 45.0, lon: -70.0 })).rejects.toThrow();
    });

    test('throws on a non-2xx HTTP status from search', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ message: 'Internal error' }, false, 500));

      await expect(fetchFoursquareMatch({ name: 'Test Cafe', lat: 45.0, lon: -70.0 })).rejects.toThrow();
    });

    test('throws on a non-2xx HTTP status from details-by-ID (e.g. a stale locked fsq_id)', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ message: 'not found' }, false, 404));

      await expect(
        fetchFoursquareMatch({ name: 'Test Cafe', lat: 45.0, lon: -70.0, fsq_id: 'stale-id' })
      ).rejects.toThrow();
    });
  });
});
