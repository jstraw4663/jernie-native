import { searchFoursquarePlaces } from '../../src/providers/foursquare';

jest.mock('../../src/secrets', () => ({
  FOURSQUARE_API_KEY: { value: jest.fn(() => 'test-fsq-key') },
}));

const mockFetch = jest.fn();
(global as unknown as { fetch: typeof fetch }).fetch = mockFetch as unknown as typeof fetch;

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as Response;
}

const THURSTONS = {
  fsq_place_id: 'fsq-thurstons',
  name: "Thurston's Lobster Pound",
  latitude: 44.2397,
  longitude: -68.3531,
  location: { formatted_address: '9 Thurston Rd, Bernard, ME 04612' },
  categories: [{ name: 'Seafood Restaurant' }],
};

const FAR_AWAY = {
  fsq_place_id: 'fsq-far',
  name: "Thurston's Other Place",
  latitude: 44.9,          // ~70km from the search anchor
  longitude: -68.9,
  location: { formatted_address: 'Somewhere else, ME' },
  categories: [{ name: 'Diner' }],
};

// The search adapter is a different contract from fetchFoursquareMatch, deliberately:
// matching VERIFIES a place we already have coordinates for; searching RANKS places we
// don't. Sharing one function would mean one of the two behaving wrongly.
describe('searchFoursquarePlaces', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  test('queries /places/search anchored on the stop', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ results: [THURSTONS] }));

    await searchFoursquarePlaces({ query: 'thurston', lat: 44.3876, lon: -68.2039 });

    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe('https://places-api.foursquare.com/places/search');
    expect(parsed.searchParams.get('query')).toBe('thurston');
    expect(parsed.searchParams.get('ll')).toBe('44.3876,-68.2039');
  });

  test('searches at stop scale, not the matcher\'s address-slop scale', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ results: [] }));

    await searchFoursquarePlaces({ query: 'thurston', lat: 44.3876, lon: -68.2039 });

    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    // The matcher uses 400m to absorb geocoding slop around a KNOWN place. A search box
    // has to reach the whole area a traveller would drive to from their stop.
    expect(Number(new URL(url).searchParams.get('radius'))).toBeGreaterThanOrEqual(10_000);
  });

  // THE billing guard. Foursquare charges hours/rating/price/stats at Premium tier, above
  // Pro. Hours are opportunistic — read from place_enrichment if already cached — so the
  // search path must never request them. If this assertion is ever relaxed, the search
  // box starts billing at Premium on every keystroke burst.
  test('requests Pro fields only, never Premium ones', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ results: [] }));

    await searchFoursquarePlaces({ query: 'thurston', lat: 44.3876, lon: -68.2039 });

    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    const fields = new URL(url).searchParams.get('fields') ?? '';

    expect(fields).toContain('fsq_place_id');
    expect(fields).toContain('name');
    expect(fields).toContain('latitude');
    expect(fields).toContain('longitude');
    expect(fields).toContain('categories');

    expect(fields).not.toContain('hours');
    expect(fields).not.toContain('rating');
    expect(fields).not.toContain('price');
    expect(fields).not.toContain('stats');
  });

  test('sends the pinned API version and bearer auth', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ results: [] }));

    await searchFoursquarePlaces({ query: 'thurston', lat: 44.3876, lon: -68.2039 });

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer test-fsq-key');
    expect(headers['X-Places-Api-Version']).toBe('2025-06-17');
  });

  test('maps every result, keeping provider rank order', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ results: [THURSTONS, FAR_AWAY] }));

    const results = await searchFoursquarePlaces({ query: 'thurston', lat: 44.3876, lon: -68.2039 });

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      fsq_id: 'fsq-thurstons',
      name: "Thurston's Lobster Pound",
      lat: 44.2397,
      lon: -68.3531,
      address: '9 Thurston Rd, Bernard, ME 04612',
      category: 'Seafood Restaurant',
    });
    expect(results[1].name).toBe("Thurston's Other Place");
  });

  // The matcher rejects candidates beyond 200m because it is verifying an identity. A
  // search must not — the whole point is to surface places the user has no coordinates for.
  test('does not reject distant results the way the matcher does', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ results: [FAR_AWAY] }));

    const results = await searchFoursquarePlaces({ query: 'thurston', lat: 44.3876, lon: -68.2039 });

    expect(results).toHaveLength(1);
  });

  test('drops results with unusable coordinates rather than emitting NaN', async () => {
    mockFetch.mockResolvedValue(jsonResponse({
      results: [THURSTONS, { fsq_place_id: 'broken', name: 'No Coords' }],
    }));

    const results = await searchFoursquarePlaces({ query: 'thurston', lat: 44.3876, lon: -68.2039 });

    expect(results.map(r => r.fsq_id)).toEqual(['fsq-thurstons']);
  });

  test('a successful response with no matches is an empty list, not an error', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ results: [] }));

    await expect(
      searchFoursquarePlaces({ query: 'grandmas kayak place', lat: 44.3876, lon: -68.2039 }),
    ).resolves.toEqual([]);
  });

  test('a missing results array is also an empty list', async () => {
    mockFetch.mockResolvedValue(jsonResponse({}));

    await expect(
      searchFoursquarePlaces({ query: 'thurston', lat: 44.3876, lon: -68.2039 }),
    ).resolves.toEqual([]);
  });

  // Same contract as the matcher: a failed call is never conflated with "no matches",
  // because the caller renders those two states completely differently.
  test('throws on a non-2xx response', async () => {
    mockFetch.mockResolvedValue(jsonResponse({}, false, 429));

    await expect(
      searchFoursquarePlaces({ query: 'thurston', lat: 44.3876, lon: -68.2039 }),
    ).rejects.toThrow('429');
  });

  test('throws when the network call itself fails', async () => {
    mockFetch.mockRejectedValue(new Error('socket hang up'));

    await expect(
      searchFoursquarePlaces({ query: 'thurston', lat: 44.3876, lon: -68.2039 }),
    ).rejects.toThrow('socket hang up');
  });

  test('honours a caller-supplied limit', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ results: [] }));

    await searchFoursquarePlaces({ query: 'thurston', lat: 44.3876, lon: -68.2039, limit: 3 });

    expect(new URL((mockFetch.mock.calls[0] as [string, RequestInit])[0]).searchParams.get('limit')).toBe('3');
  });
});
