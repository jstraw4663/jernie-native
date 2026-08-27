import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { searchStops } from '../src/searchStops';
import { searchMapboxPlaces, STOP_FEATURE_TYPES } from '../src/providers/mapbox';
import { chargeQuota } from '../src/quota';
import type { GeoCandidate } from '../src/providers/types';

jest.mock('../src/secrets', () => ({
  MAPBOX_ACCESS_TOKEN: { value: jest.fn(() => 'pk.test-mapbox-token') },
}));

jest.mock('../src/providers/mapbox', () => ({
  searchMapboxPlaces: jest.fn(),
  // Not mocked away — the point of the filter tests below is that the callable asks for
  // the real constant, not a list it invented.
  STOP_FEATURE_TYPES: jest.requireActual('../src/providers/mapbox').STOP_FEATURE_TYPES,
}));

jest.mock('../src/quota', () => ({ chargeQuota: jest.fn() }));

const mockSearch = searchMapboxPlaces as jest.MockedFunction<typeof searchMapboxPlaces>;
const mockCharge = chargeQuota as jest.MockedFunction<typeof chargeQuota>;

function req(data: unknown, overrides: Partial<CallableRequest<unknown>> = {}): CallableRequest<unknown> {
  return { data, auth: { uid: 'test-uid' }, ...overrides } as unknown as CallableRequest<unknown>;
}

function candidate(overrides: Partial<GeoCandidate> = {}): GeoCandidate {
  return {
    name: 'Camden',
    lat: 44.2098,
    lon: -69.0648,
    context: 'Maine, United States',
    region: 'ME',
    featureType: 'place',
    canBeStop: true,
    canBeActivity: false,
    ...overrides,
  };
}

describe('searchStops', () => {
  beforeEach(() => {
    mockSearch.mockReset();
    mockSearch.mockResolvedValue([]);
    mockCharge.mockReset();
    mockCharge.mockResolvedValue(undefined);
  });

  describe('authentication', () => {
    test('rejects an unauthenticated request before calling Mapbox', async () => {
      await expect(searchStops.run(req({ query: 'camden' }, { auth: undefined }))).rejects.toMatchObject({
        code: 'unauthenticated',
      });
      expect(mockSearch).not.toHaveBeenCalled();
    });
  });

  describe('input validation', () => {
    test('rejects a missing query', async () => {
      await expect(searchStops.run(req({}))).rejects.toMatchObject({ code: 'invalid-argument' });
      expect(mockSearch).not.toHaveBeenCalled();
    });

    // The same backstop reasoning as resolveQuery: a client-side minimum is a UX
    // affordance, not a spend control, because anything holding an auth token can call
    // this directly.
    test('rejects a query shorter than three characters', async () => {
      await expect(searchStops.run(req({ query: 'ca' }))).rejects.toMatchObject({
        code: 'invalid-argument',
      });
      expect(mockSearch).not.toHaveBeenCalled();
    });

    test('measures the minimum after trimming, so whitespace cannot pad a query into range', async () => {
      await expect(searchStops.run(req({ query: '  c  ' }))).rejects.toMatchObject({
        code: 'invalid-argument',
      });
      expect(mockSearch).not.toHaveBeenCalled();
    });

    test('passes the trimmed query to the provider', async () => {
      await searchStops.run(req({ query: '  camden  ' }));

      expect(mockSearch).toHaveBeenCalledWith(expect.objectContaining({ query: 'camden' }));
    });
  });

  describe('the proximity anchor', () => {
    test('passes a supplied anchor through to bias results toward the trip', async () => {
      await searchStops.run(req({ query: 'camden', near: { lat: 43.6591, lon: -70.2568 } }));

      expect(mockSearch).toHaveBeenCalledWith(
        expect.objectContaining({ lat: 43.6591, lon: -70.2568 }),
      );
    });

    // The onboarding wizard's first stop. Unlike resolveQuery, whose every entry point
    // carries a stop, this callable is legitimately called before a trip exists — so a
    // missing anchor is a normal request, not a caller bug.
    test('an unanchored search is allowed, not rejected', async () => {
      mockSearch.mockResolvedValue([candidate()]);

      const result = await searchStops.run(req({ query: 'camden' }));

      expect(result.results).toHaveLength(1);
      expect(mockSearch).toHaveBeenCalledWith(
        expect.objectContaining({ lat: undefined, lon: undefined }),
      );
    });

    test('a malformed anchor is dropped rather than rejecting the search', async () => {
      await searchStops.run(req({ query: 'camden', near: { lat: 'north', lon: -70.2568 } }));

      expect(mockSearch).toHaveBeenCalledWith(
        expect.objectContaining({ lat: undefined, lon: undefined }),
      );
    });
  });

  // The regression that a unit test could not have caught on its own, and a live call did:
  // Mapbox ranks its whole catalogue together, so an unfiltered "portland" returned Portland
  // Parish, JAMAICA (a region) and nothing else, and "portland" with country=us returned an
  // airport, a leather shop and a Japanese garden. Filtering for canBeStop afterwards threw
  // the entire page away and the wizard showed "couldn't find that city" for the single most
  // obvious query it will ever receive.
  describe('the type filter', () => {
    test('asks Mapbox only for feature types that can actually be a stop', async () => {
      await searchStops.run(req({ query: 'portland' }));

      expect(mockSearch).toHaveBeenCalledWith(
        expect.objectContaining({ types: STOP_FEATURE_TYPES }),
      );
    });

    // Asking for one set and keeping another is how the bug happened. They are the same
    // constant now, and this fails if anyone reintroduces a second list.
    test('the types it asks for are exactly the ones it keeps', async () => {
      await searchStops.run(req({ query: 'portland' }));

      const [{ types }] = mockSearch.mock.calls[0] as [{ types: readonly string[] }];
      const stopish = { name: 'X', lat: 1, lon: 2, canBeActivity: false, canBeStop: true };
      types.forEach(featureType => {
        // Every requested type must survive the callable's own canBeStop filter.
        mockSearch.mockResolvedValue([{ ...stopish, featureType }]);
      });
      expect([...types].sort()).toEqual(['city', 'locality', 'place']);
    });
  });

  describe('results', () => {
    test('maps a town into the shape a Stop is built from', async () => {
      mockSearch.mockResolvedValue([candidate()]);

      const result = await searchStops.run(req({ query: 'camden' }));

      expect(result.results).toEqual([
        {
          name: 'Camden',
          region: 'ME',
          lat: 44.2098,
          lon: -69.0648,
          context: 'Maine, United States',
        },
      ]);
    });

    // A trailhead is somewhere you go, not somewhere you sleep. Offering one as a stop
    // would produce a stop with no lodging and dates that mean nothing.
    test('drops anything that cannot be a stop', async () => {
      mockSearch.mockResolvedValue([
        candidate({ name: 'Camden Hills State Park', featureType: 'poi', canBeStop: false, canBeActivity: true }),
        candidate(),
      ]);

      const result = await searchStops.run(req({ query: 'camden' }));

      expect(result.results.map(r => r.name)).toEqual(['Camden']);
    });

    test('preserves Mapbox rank order', async () => {
      mockSearch.mockResolvedValue([
        candidate({ name: 'Portland', region: 'ME' }),
        candidate({ name: 'Portland', region: 'OR' }),
      ]);

      const result = await searchStops.run(req({ query: 'portland' }));

      expect(result.results.map(r => r.region)).toEqual(['ME', 'OR']);
    });

    test('carries the free straight-line distance through when the provider supplies one', async () => {
      mockSearch.mockResolvedValue([candidate({ distanceMetres: 84000 })]);

      const result = await searchStops.run(req({ query: 'camden', near: { lat: 43.6591, lon: -70.2568 } }));

      expect(result.results[0].distanceMetres).toBe(84000);
    });

    // "Nothing by that name" and "the lookup failed" are different states in the UI — one
    // is a spelling prompt, the other a retry — so they must not collapse into each other.
    test('finding nothing is an empty list, not an error', async () => {
      mockSearch.mockResolvedValue([]);

      await expect(searchStops.run(req({ query: 'asdkjfh' }))).resolves.toEqual({ results: [] });
    });

    test('a result list that is entirely non-stops is also just empty', async () => {
      mockSearch.mockResolvedValue([candidate({ featureType: 'poi', canBeStop: false })]);

      await expect(searchStops.run(req({ query: 'camden hills' }))).resolves.toEqual({ results: [] });
    });
  });

  describe('provider failure', () => {
    test('a thrown provider error becomes internal, never an empty result set', async () => {
      mockSearch.mockRejectedValue(new Error('Mapbox request failed with status 503'));

      await expect(searchStops.run(req({ query: 'camden' }))).rejects.toMatchObject({ code: 'internal' });
      await expect(searchStops.run(req({ query: 'camden' }))).rejects.toBeInstanceOf(HttpsError);
    });

    // The provider's own message can carry the access token in a URL. Only the log gets it.
    test('does not leak the provider message to the caller', async () => {
      mockSearch.mockRejectedValue(new Error('failed: access_token=pk.secret'));

      await expect(searchStops.run(req({ query: 'camden' }))).rejects.not.toMatchObject({
        message: expect.stringContaining('pk.secret'),
      });
    });
  });

  describe('quota', () => {
    test('charges one unit before calling Mapbox', async () => {
      await searchStops.run(req({ query: 'camden' }));

      expect(mockCharge).toHaveBeenCalledWith('test-uid', 'searchStops', 1);
    });

    test('a query too short to search costs no quota', async () => {
      await expect(searchStops.run(req({ query: 'ca' }))).rejects.toMatchObject({
        code: 'invalid-argument',
      });
      expect(mockCharge).not.toHaveBeenCalled();
    });

    test('a refused charge means Mapbox is never called', async () => {
      mockCharge.mockRejectedValue(new HttpsError('resource-exhausted', 'over quota'));

      await expect(searchStops.run(req({ query: 'camden' }))).rejects.toMatchObject({
        code: 'resource-exhausted',
      });
      expect(mockSearch).not.toHaveBeenCalled();
    });
  });
});
