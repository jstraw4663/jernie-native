import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { resolveQuery } from '../src/resolveQuery';
import { searchFoursquarePlaces } from '../src/providers/foursquare';
import { chargeQuota } from '../src/quota';

jest.mock('../src/secrets', () => ({
  FOURSQUARE_API_KEY: { value: jest.fn(() => 'test-fsq-key') },
}));

jest.mock('../src/providers/foursquare', () => ({
  searchFoursquarePlaces: jest.fn(),
}));

jest.mock('../src/quota', () => ({ chargeQuota: jest.fn() }));

const mockSearch = searchFoursquarePlaces as jest.MockedFunction<typeof searchFoursquarePlaces>;
const mockCharge = chargeQuota as jest.MockedFunction<typeof chargeQuota>;

const BAR_HARBOR = { stopLat: 44.3876, stopLon: -68.2039 };

function req(data: unknown, overrides: Partial<CallableRequest<unknown>> = {}): CallableRequest<unknown> {
  return { data, auth: { uid: 'test-uid' }, ...overrides } as unknown as CallableRequest<unknown>;
}

const THURSTONS = {
  fsq_id: 'fsq-thurstons',
  name: "Thurston's Lobster Pound",
  lat: 44.2397,
  lon: -68.3531,
  address: '9 Thurston Rd, Bernard, ME 04612',
  category: 'Seafood Restaurant',
};

describe('resolveQuery', () => {
  beforeEach(() => {
    mockSearch.mockReset();
    mockSearch.mockResolvedValue([]);
    mockCharge.mockReset();
    mockCharge.mockResolvedValue(undefined);
  });

  describe('guards', () => {
    test('rejects an unauthenticated call — it spends real API credit', async () => {
      await expect(
        resolveQuery.run(req({ query: 'thurston', typeHint: null, context: BAR_HARBOR }, { auth: undefined })),
      ).rejects.toMatchObject({ code: 'unauthenticated' });
    });

    test('rejects a missing query', async () => {
      await expect(
        resolveQuery.run(req({ typeHint: null, context: BAR_HARBOR })),
      ).rejects.toMatchObject({ code: 'invalid-argument' });
    });

    test('rejects a blank query', async () => {
      await expect(
        resolveQuery.run(req({ query: '   ', typeHint: null, context: BAR_HARBOR })),
      ).rejects.toMatchObject({ code: 'invalid-argument' });
    });

    // The client gates at three characters too, but a client-side guard is not a
    // spend control — anything holding a valid auth token can call this directly.
    test('rejects a query too short to be worth a billed lookup', async () => {
      await expect(
        resolveQuery.run(req({ query: 'th', typeHint: null, context: BAR_HARBOR })),
      ).rejects.toMatchObject({ code: 'invalid-argument' });
    });

    test('accepts a query at exactly the minimum length', async () => {
      await expect(
        resolveQuery.run(req({ query: 'thu', typeHint: null, context: BAR_HARBOR })),
      ).resolves.toBeDefined();
    });

    test('measures length after trimming, so padding does not buy a lookup', async () => {
      await expect(
        resolveQuery.run(req({ query: '  t  ', typeHint: null, context: BAR_HARBOR })),
      ).rejects.toMatchObject({ code: 'invalid-argument' });
    });

    test('rejects a call with no stop to anchor the search on', async () => {
      await expect(
        resolveQuery.run(req({ query: 'thurston', typeHint: null, context: {} })),
      ).rejects.toMatchObject({ code: 'invalid-argument' });
    });
  });

  describe('place lookup', () => {
    test('searches Foursquare anchored on the stop and returns what it found', async () => {
      mockSearch.mockResolvedValue([THURSTONS]);

      const result = await resolveQuery.run(
        req({ query: 'thurston', typeHint: null, context: BAR_HARBOR }),
      );

      expect(mockSearch).toHaveBeenCalledWith({
        query: 'thurston',
        lat: 44.3876,
        lon: -68.2039,
      });
      expect(result.results).toEqual([THURSTONS]);
    });

    test('reads the type off the top result and says it guessed', async () => {
      mockSearch.mockResolvedValue([THURSTONS]);

      const result = await resolveQuery.run(
        req({ query: 'thurston', typeHint: null, context: BAR_HARBOR }),
      );

      expect(result).toMatchObject({ resolvedType: 'eat', typeConfidence: 'guessed' });
    });

    test('a type the user tapped overrides the provider category', async () => {
      mockSearch.mockResolvedValue([THURSTONS]);

      const result = await resolveQuery.run(
        req({ query: 'thurston', typeHint: 'do', context: BAR_HARBOR }),
      );

      expect(result).toMatchObject({ resolvedType: 'do', typeConfidence: 'explicit' });
    });

    test('trims the query before searching', async () => {
      await resolveQuery.run(req({ query: '  thurston  ', typeHint: null, context: BAR_HARBOR }));

      expect(mockSearch).toHaveBeenCalledWith(expect.objectContaining({ query: 'thurston' }));
    });
  });

  describe('nothing found', () => {
    test('returns an empty list and guesses the type from the user\'s own words', async () => {
      mockSearch.mockResolvedValue([]);

      const result = await resolveQuery.run(
        req({ query: 'grandmas kayak place', typeHint: null, context: BAR_HARBOR }),
      );

      expect(result).toEqual({
        resolvedType: 'do',
        typeConfidence: 'fallback',
        results: [],
      });
    });

    test('a provider failure is an error, never a silent "no matches"', async () => {
      // The sheet renders these two completely differently — a retry vs. the manual card —
      // so collapsing them would show "nothing found" for what is actually an outage.
      mockSearch.mockRejectedValue(new Error('Foursquare request failed with status 500'));

      await expect(
        resolveQuery.run(req({ query: 'thurston', typeHint: null, context: BAR_HARBOR })),
      ).rejects.toMatchObject({ code: 'internal' });
    });
  });

  describe('types with no provider in v1', () => {
    test('an explicit flight never calls the place provider', async () => {
      const result = await resolveQuery.run(
        req({ query: 'DL 2214', typeHint: 'flight', context: BAR_HARBOR }),
      );

      expect(mockSearch).not.toHaveBeenCalled();
      expect(result).toEqual({ resolvedType: 'flight', typeConfidence: 'explicit', results: [] });
    });

    test('a typed flight number is recognised without a lookup', async () => {
      const result = await resolveQuery.run(
        req({ query: 'DL 2214', typeHint: null, context: BAR_HARBOR }),
      );

      expect(mockSearch).not.toHaveBeenCalled();
      expect(result).toMatchObject({ resolvedType: 'flight', typeConfidence: 'fallback' });
    });

    test('an explicit drive never calls the place provider', async () => {
      const result = await resolveQuery.run(
        req({ query: 'portland to bar harbor', typeHint: 'drive', context: BAR_HARBOR }),
      );

      expect(mockSearch).not.toHaveBeenCalled();
      expect(result).toMatchObject({ resolvedType: 'drive', typeConfidence: 'explicit' });
    });
  });

  describe('quota', () => {
    test('charges one unit before searching Foursquare', async () => {
      await resolveQuery.run(req({ query: 'thurston', typeHint: null, context: BAR_HARBOR }));

      expect(mockCharge).toHaveBeenCalledWith('test-uid', 'resolveQuery', 1);
    });

    // The short-circuit paths reach no provider, so they spend nothing and must not be
    // metered — otherwise typing a flight number would eat a place-search budget.
    test('a recognised flight number costs no quota', async () => {
      await resolveQuery.run(req({ query: 'DL 2214', typeHint: null, context: BAR_HARBOR }));

      expect(mockCharge).not.toHaveBeenCalled();
    });

    test('a type with no provider costs no quota', async () => {
      await resolveQuery.run(req({ query: 'anything', typeHint: 'flight', context: BAR_HARBOR }));

      expect(mockCharge).not.toHaveBeenCalled();
    });

    test('a refused charge means Foursquare is never called', async () => {
      mockCharge.mockRejectedValue(new HttpsError('resource-exhausted', 'over quota'));

      await expect(
        resolveQuery.run(req({ query: 'thurston', typeHint: null, context: BAR_HARBOR })),
      ).rejects.toMatchObject({ code: 'resource-exhausted' });
      expect(mockSearch).not.toHaveBeenCalled();
    });
  });
});
