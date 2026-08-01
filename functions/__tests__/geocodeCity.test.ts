import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { geocodeCity } from '../src/geocodeCity';

jest.mock('../src/secrets', () => ({
  GOOGLE_PLACES_API_KEY: { value: jest.fn(() => 'test-google-key') },
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

function req(
  data: unknown,
  overrides: Partial<CallableRequest<unknown>> = {}
): CallableRequest<unknown> {
  // Defaults to a truthy `auth`, matching every real invocation this callable will ever
  // receive in production. The dedicated unauthenticated-rejection test overrides this.
  return {
    data,
    auth: { uid: 'test-uid' },
    ...overrides,
  } as unknown as CallableRequest<unknown>;
}

// A representative "Portland, ME" result — locality + administrative_area_level_1 both
// present, the common case.
const PORTLAND_ME_RESULT = {
  address_components: [
    { long_name: 'Portland', short_name: 'Portland', types: ['locality', 'political'] },
    {
      long_name: 'Cumberland County',
      short_name: 'Cumberland County',
      types: ['administrative_area_level_2', 'political'],
    },
    { long_name: 'Maine', short_name: 'ME', types: ['administrative_area_level_1', 'political'] },
    { long_name: 'United States', short_name: 'US', types: ['country', 'political'] },
  ],
  geometry: { location: { lat: 43.6591, lng: -70.2568 } },
};

describe('geocodeCity', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('authentication', () => {
    test('rejects an unauthenticated request with unauthenticated, before calling Google', async () => {
      await expect(
        geocodeCity.run(req({ query: 'Portland, ME' }, { auth: undefined }))
      ).rejects.toMatchObject({ code: 'unauthenticated' });
      await expect(
        geocodeCity.run(req({ query: 'Portland, ME' }, { auth: undefined }))
      ).rejects.toBeInstanceOf(HttpsError);

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('input validation', () => {
    test('rejects a missing query with invalid-argument, before calling Google', async () => {
      await expect(geocodeCity.run(req({}))).rejects.toMatchObject({ code: 'invalid-argument' });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    test('rejects an empty/whitespace-only query with invalid-argument', async () => {
      await expect(geocodeCity.run(req({ query: '   ' }))).rejects.toMatchObject({
        code: 'invalid-argument',
      });
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('successful match', () => {
    test('calls the Geocoding API with the correct URL/key and extracts lat/lon/city/region', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ status: 'OK', results: [PORTLAND_ME_RESULT] }));

      const result = await geocodeCity.run(req({ query: 'Portland, ME' }));

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      const parsed = new URL(url);
      expect(parsed.origin + parsed.pathname).toBe('https://maps.googleapis.com/maps/api/geocode/json');
      expect(parsed.searchParams.get('address')).toBe('Portland, ME');
      expect(parsed.searchParams.get('key')).toBe('test-google-key');
      expect(init.signal).toBeInstanceOf(AbortSignal);

      expect(result).toEqual({
        found: true,
        lat: 43.6591,
        lon: -70.2568,
        city: 'Portland',
        region: 'ME',
      });
    });
  });

  describe('zero results', () => {
    test('returns a structured not-found result rather than throwing', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ status: 'ZERO_RESULTS', results: [] }));

      const result = await geocodeCity.run(req({ query: 'Asdkjfhaslkdjfh Nowhereville' }));

      expect(result).toEqual({ found: false });
    });
  });

  describe('city/region fallback derivation', () => {
    test('falls back to sublocality when locality is absent', async () => {
      const noLocality = {
        address_components: [
          {
            long_name: 'Manhattan',
            short_name: 'Manhattan',
            types: ['sublocality_level_1', 'sublocality', 'political'],
          },
          { long_name: 'New York', short_name: 'NY', types: ['administrative_area_level_1', 'political'] },
          { long_name: 'United States', short_name: 'US', types: ['country', 'political'] },
        ],
        geometry: { location: { lat: 40.7831, lng: -73.9712 } },
      };
      mockFetch.mockResolvedValue(jsonResponse({ status: 'OK', results: [noLocality] }));

      const result = await geocodeCity.run(req({ query: 'Manhattan, NY' }));

      expect(result).toMatchObject({ found: true, city: 'Manhattan', region: 'NY' });
    });

    test('falls back to neighborhood when locality and sublocality are both absent', async () => {
      const neighborhoodOnly = {
        address_components: [
          { long_name: 'Lower East Side', short_name: 'Lower East Side', types: ['neighborhood', 'political'] },
          { long_name: 'New York', short_name: 'NY', types: ['administrative_area_level_1', 'political'] },
          { long_name: 'United States', short_name: 'US', types: ['country', 'political'] },
        ],
        geometry: { location: { lat: 40.715, lng: -73.985 } },
      };
      mockFetch.mockResolvedValue(jsonResponse({ status: 'OK', results: [neighborhoodOnly] }));

      const result = await geocodeCity.run(req({ query: 'Lower East Side, Manhattan' }));

      expect(result).toMatchObject({ found: true, city: 'Lower East Side', region: 'NY' });
    });

    test('leaves city/region undefined (not throwing) when no matching component is present', async () => {
      const sparse = {
        address_components: [{ long_name: 'United States', short_name: 'US', types: ['country', 'political'] }],
        geometry: { location: { lat: 39.8283, lng: -98.5795 } },
      };
      mockFetch.mockResolvedValue(jsonResponse({ status: 'OK', results: [sparse] }));

      const result = await geocodeCity.run(req({ query: 'United States' }));

      expect(result).toEqual({ found: true, lat: 39.8283, lon: -98.5795, city: undefined, region: undefined });
    });
  });

  describe('error contract — throw, never silently treat as not-found', () => {
    test('throws when Google reports a non-OK, non-ZERO_RESULTS status (e.g. REQUEST_DENIED)', async () => {
      mockFetch.mockResolvedValue(
        jsonResponse({ status: 'REQUEST_DENIED', error_message: 'The provided API key is invalid.' })
      );

      await expect(geocodeCity.run(req({ query: 'Portland, ME' }))).rejects.toMatchObject({
        code: 'internal',
      });
      await expect(geocodeCity.run(req({ query: 'Portland, ME' }))).rejects.toBeInstanceOf(HttpsError);
    });

    test('throws on a network error', async () => {
      mockFetch.mockRejectedValue(new Error('getaddrinfo ENOTFOUND maps.googleapis.com'));

      await expect(geocodeCity.run(req({ query: 'Portland, ME' }))).rejects.toMatchObject({
        code: 'internal',
      });
    });

    test('throws on a non-2xx HTTP status', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ message: 'Internal error' }, false, 500));

      await expect(geocodeCity.run(req({ query: 'Portland, ME' }))).rejects.toMatchObject({
        code: 'internal',
      });
    });
  });

  describe('structured logging', () => {
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

    test('logs a "matched" line via console.log on success', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ status: 'OK', results: [PORTLAND_ME_RESULT] }));

      await geocodeCity.run(req({ query: 'Portland, ME' }));

      const logged = logSpy.mock.calls.map(([line]) => JSON.parse(line as string));
      expect(logged).toEqual([{ query: 'Portland, ME', outcome: 'matched', durationMs: expect.any(Number) }]);
      expect(errorSpy).not.toHaveBeenCalled();
    });

    test('logs an "error" line via console.error, with the underlying message, on a network failure', async () => {
      mockFetch.mockRejectedValue(new Error('getaddrinfo ENOTFOUND maps.googleapis.com'));

      await expect(geocodeCity.run(req({ query: 'Portland, ME' }))).rejects.toThrow();

      const errorLogged = errorSpy.mock.calls.map(([line]) => JSON.parse(line as string));
      expect(errorLogged).toEqual([
        {
          query: 'Portland, ME',
          outcome: 'error',
          durationMs: expect.any(Number),
          error: expect.stringContaining('ENOTFOUND'),
        },
      ]);
      expect(logSpy).not.toHaveBeenCalled();
    });
  });
});
