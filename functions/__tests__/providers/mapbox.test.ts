import { searchMapboxPlaces } from '../../src/providers/mapbox';

jest.mock('../../src/secrets', () => ({
  MAPBOX_ACCESS_TOKEN: { value: jest.fn(() => 'sk.test-mapbox-token') },
}));

const mockFetch = jest.fn();
(global as unknown as { fetch: typeof fetch }).fetch = mockFetch as unknown as typeof fetch;

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as Response;
}

// Mapbox returns GeoJSON: coordinates are [longitude, latitude], the opposite order from
// Foursquare's `ll=lat,lon`. Getting this backwards puts Camden, Maine in Antarctica, so
// it is pinned by its own test below.
// VERIFIED against a real Search Box forward response (2026-08-26), not invented. Note
// `place_formatted` is the context WITHOUT the name ("Maine, United States"), which makes
// it a clean subtitle under a "Camden" title rather than a repetition of it.
const CAMDEN_TOWN = {
  type: 'Feature',
  geometry: { coordinates: [-69.064864, 44.209794], type: 'Point' },
  properties: {
    name: 'Camden',
    mapbox_id: 'dXJuOm1ieHBsYzpBdFVJN0E',
    feature_type: 'place',
    place_formatted: 'Maine, United States',
    context: {
      country: { name: 'United States', country_code: 'US' },
      region: { name: 'Maine', region_code: 'ME', region_code_full: 'US-ME' },
      district: { name: 'Knox County' },
    },
    coordinates: { latitude: 44.209794, longitude: -69.064864 },
    bbox: [-69.165435, 44.183293, -69.008567, 44.259548],
    maki: 'marker',
    distance: 113397,
  },
};

// Constructed by analogy — the town above is the verified sample; a POI response has not
// been observed directly, so the poi branch is documented as unconfirmed in the adapter.
const CAMDEN_PARK = {
  type: 'Feature',
  geometry: { coordinates: [-69.0503, 44.2334], type: 'Point' },
  properties: {
    name: 'Camden Hills State Park',
    feature_type: 'poi',
    place_formatted: 'Camden, Maine, United States',
    coordinates: { latitude: 44.2334, longitude: -69.0503 },
  },
};

describe('searchMapboxPlaces', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  test('queries Search Box forward with the access token', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ features: [] }));

    await searchMapboxPlaces({ query: 'camden', lat: 43.6591, lon: -70.2568 });

    const [url] = mockFetch.mock.calls[0] as [string];
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe('https://api.mapbox.com/search/searchbox/v1/forward');
    expect(parsed.searchParams.get('q')).toBe('camden');
    expect(parsed.searchParams.get('access_token')).toBe('sk.test-mapbox-token');
  });

  // Mapbox takes proximity as lon,lat. Foursquare takes ll as lat,lon. One of these two
  // adapters is always going to look wrong to whoever read the other one last.
  test('biases results toward the trip with proximity in Mapbox\'s lon,lat order', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ features: [] }));

    await searchMapboxPlaces({ query: 'camden', lat: 43.6591, lon: -70.2568 });

    const [url] = mockFetch.mock.calls[0] as [string];
    expect(new URL(url).searchParams.get('proximity')).toBe('-70.2568,43.6591');
  });

  // The onboarding wizard's FIRST stop has nothing to anchor to — there is no trip yet.
  // Mapbox treats proximity as optional and simply drops the distance bias without it, so
  // the anchor is optional here rather than the caller having to invent one. Sending a
  // placeholder (0,0, or the user's device location) would silently bias every first-stop
  // search toward the Gulf of Guinea or toward home, neither of which is what was asked.
  test('omits proximity entirely when there is nothing to anchor to', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ features: [] }));

    await searchMapboxPlaces({ query: 'camden' });

    const [url] = mockFetch.mock.calls[0] as [string];
    expect(new URL(url).searchParams.has('proximity')).toBe(false);
  });

  test('omits proximity when only one half of the anchor is supplied', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ features: [] }));

    await searchMapboxPlaces({ query: 'camden', lat: 43.6591 });

    const [url] = mockFetch.mock.calls[0] as [string];
    expect(new URL(url).searchParams.has('proximity')).toBe(false);
  });

  test('maps a town into a stop candidate', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ features: [CAMDEN_TOWN] }));

    const [camden] = await searchMapboxPlaces({ query: 'camden', lat: 43.6591, lon: -70.2568 });

    expect(camden).toMatchObject({
      name: 'Camden',
      lat: 44.209794,
      lon: -69.064864,
      canBeStop: true,
      canBeActivity: false,
    });
  });

  // "A place that could be either says so, and offers both."
  test('marks a POI as an activity rather than a stop', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ features: [CAMDEN_PARK] }));

    const [park] = await searchMapboxPlaces({ query: 'camden', lat: 43.6591, lon: -70.2568 });

    expect(park).toMatchObject({
      name: 'Camden Hills State Park',
      canBeStop: false,
      canBeActivity: true,
    });
  });

  test.each([
    ['place', true],
    ['locality', true],
    ['city', true],
    ['region', false],
    ['address', false],
    ['street', false],
  ])('feature_type %s → canBeStop %s', async (featureType, expected) => {
    mockFetch.mockResolvedValue(jsonResponse({
      features: [{ ...CAMDEN_TOWN, properties: { ...CAMDEN_TOWN.properties, feature_type: featureType } }],
    }));

    const [result] = await searchMapboxPlaces({ query: 'camden', lat: 43.6591, lon: -70.2568 });

    expect(result.canBeStop).toBe(expected);
  });

  test('keeps the formatted place name for the subtitle line', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ features: [CAMDEN_TOWN] }));

    const [camden] = await searchMapboxPlaces({ query: 'camden', lat: 43.6591, lon: -70.2568 });

    expect(camden.context).toBe('Maine, United States');
  });

  // Stop.region is a short code ("ME"), matching what the Google geocode this replaced
  // from Google's short_name. Pulling it here is what lets a Mapbox result be turned
  // straight into a Stop without a second lookup.
  test('extracts the short region code a Stop needs', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ features: [CAMDEN_TOWN] }));

    const [camden] = await searchMapboxPlaces({ query: 'camden', lat: 43.6591, lon: -70.2568 });

    expect(camden.region).toBe('ME');
  });

  test('has no region when the response carries no context for it', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ features: [CAMDEN_PARK] }));

    const [park] = await searchMapboxPlaces({ query: 'camden', lat: 43.6591, lon: -70.2568 });

    expect(park.region).toBeUndefined();
  });

  // Mapbox returns straight-line metres from the proximity anchor for free. Not a drive
  // time, but enough to sort or to say "far from your stop" without a routing call.
  test('keeps the free straight-line distance from the proximity anchor', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ features: [CAMDEN_TOWN] }));

    const [camden] = await searchMapboxPlaces({ query: 'camden', lat: 43.6591, lon: -70.2568 });

    expect(camden.distanceMetres).toBe(113397);
  });

  test('returns every feature, in Mapbox\'s rank order', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ features: [CAMDEN_TOWN, CAMDEN_PARK] }));

    const results = await searchMapboxPlaces({ query: 'camden', lat: 43.6591, lon: -70.2568 });

    expect(results.map(r => r.name)).toEqual(['Camden', 'Camden Hills State Park']);
  });

  test('falls back to geometry coordinates when properties omit them', async () => {
    mockFetch.mockResolvedValue(jsonResponse({
      features: [{ properties: { name: 'Camden', feature_type: 'place' }, geometry: { coordinates: [-69.0648, 44.2098] } }],
    }));

    const [camden] = await searchMapboxPlaces({ query: 'camden', lat: 43.6591, lon: -70.2568 });

    expect(camden).toMatchObject({ lat: 44.2098, lon: -69.0648 });
  });

  test('drops a feature with no usable coordinates', async () => {
    mockFetch.mockResolvedValue(jsonResponse({
      features: [CAMDEN_TOWN, { properties: { name: 'Nowhere', feature_type: 'place' } }],
    }));

    const results = await searchMapboxPlaces({ query: 'camden', lat: 43.6591, lon: -70.2568 });

    expect(results.map(r => r.name)).toEqual(['Camden']);
  });

  test('no matches is an empty list, not an error', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ features: [] }));

    await expect(
      searchMapboxPlaces({ query: 'zzzzzz', lat: 43.6591, lon: -70.2568 }),
    ).resolves.toEqual([]);
  });

  test('throws on a non-2xx response', async () => {
    mockFetch.mockResolvedValue(jsonResponse({}, false, 401));

    await expect(
      searchMapboxPlaces({ query: 'camden', lat: 43.6591, lon: -70.2568 }),
    ).rejects.toThrow('401');
  });

  test('throws when the network call itself fails', async () => {
    mockFetch.mockRejectedValue(new Error('socket hang up'));

    await expect(
      searchMapboxPlaces({ query: 'camden', lat: 43.6591, lon: -70.2568 }),
    ).rejects.toThrow('socket hang up');
  });
});

// ── Directions ───────────────────────────────────────────────────────────────

import { fetchMapboxRoute } from '../../src/providers/mapbox';

// Portland → Bar Harbor, the design's own worked example: "178 mi · 3h 20m".
const PORTLAND = { lat: 43.6591, lon: -70.2568 };
const BAR_HARBOR = { lat: 44.3876, lon: -68.2039 };
const ROUTE_OK = { code: 'Ok', routes: [{ duration: 12_000, distance: 286_000 }] };

describe('fetchMapboxRoute', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  test('asks Directions for the two points in lon,lat order', async () => {
    mockFetch.mockResolvedValue(jsonResponse(ROUTE_OK));

    await fetchMapboxRoute({ from: PORTLAND, to: BAR_HARBOR });

    const [url] = mockFetch.mock.calls[0] as [string];
    expect(new URL(url).pathname).toBe(
      '/directions/v5/mapbox/driving/-70.2568,43.6591;-68.2039,44.3876',
    );
  });

  // The non-traffic profile is a deliberate choice, not an oversight: a traffic-aware ETA
  // is a pricier SKU AND is uncacheable, and "leave by 18:20" works fine off a static
  // duration. Static drive times are what make a permanent route cache possible at all.
  test('uses the static driving profile, never driving-traffic', async () => {
    mockFetch.mockResolvedValue(jsonResponse(ROUTE_OK));

    await fetchMapboxRoute({ from: PORTLAND, to: BAR_HARBOR });

    const [url] = mockFetch.mock.calls[0] as [string];
    expect(new URL(url).pathname).not.toContain('driving-traffic');
  });

  // Route geometry is the part of a Directions response most clearly "Mapbox Data".
  // Asking for overview=false means we never receive it, let alone store it — the storage
  // question is then only about our own derived integers.
  test('never requests route geometry', async () => {
    mockFetch.mockResolvedValue(jsonResponse(ROUTE_OK));

    await fetchMapboxRoute({ from: PORTLAND, to: BAR_HARBOR });

    const [url] = mockFetch.mock.calls[0] as [string];
    expect(new URL(url).searchParams.get('overview')).toBe('false');
  });

  test('converts seconds and metres into the minutes and miles the card shows', async () => {
    mockFetch.mockResolvedValue(jsonResponse(ROUTE_OK));

    const route = await fetchMapboxRoute({ from: PORTLAND, to: BAR_HARBOR });

    expect(route).toEqual({ minutes: 200, miles: 177.7 });
  });

  test('returns null when Mapbox finds no route between the two points', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ code: 'NoRoute', routes: [] }));

    await expect(fetchMapboxRoute({ from: PORTLAND, to: BAR_HARBOR })).resolves.toBeNull();
  });

  test('returns null for an Ok response with no routes in it', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ code: 'Ok', routes: [] }));

    await expect(fetchMapboxRoute({ from: PORTLAND, to: BAR_HARBOR })).resolves.toBeNull();
  });

  test('throws on a non-2xx response rather than reporting no route', async () => {
    mockFetch.mockResolvedValue(jsonResponse({}, false, 401));

    await expect(fetchMapboxRoute({ from: PORTLAND, to: BAR_HARBOR })).rejects.toThrow('401');
  });

  test('throws when the network call itself fails', async () => {
    mockFetch.mockRejectedValue(new Error('socket hang up'));

    await expect(fetchMapboxRoute({ from: PORTLAND, to: BAR_HARBOR })).rejects.toThrow('socket hang up');
  });
});
