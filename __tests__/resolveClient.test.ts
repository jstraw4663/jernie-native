jest.mock('@react-native-firebase/functions');

import { mockHttpsCallable, mockHttpsCallableRun } from '@react-native-firebase/functions';
import { resolveQuery, MIN_QUERY_LENGTH } from '@/src/lib/resolveClient';
import { resolveCacheKey, getCachedResolve, clearResolveCache } from '@/src/lib/resolveCache';

const CONTEXT = {
  stopId: 'stop-bar-harbor',
  dayIso: '2026-09-27',
  addedBy: 'uid-jeremy',
  stopLat: 44.3876,
  stopLon: -68.2039,
};

const THURSTONS = {
  name: "Thurston's Lobster Pound",
  lat: 44.2397,
  lon: -68.3531,
  address: '9 Thurston Rd, Bernard, ME 04612',
  category: 'Seafood Restaurant',
  fsq_id: 'fsq-thurstons',
};

beforeEach(() => {
  jest.clearAllMocks();
  clearResolveCache();
  (mockHttpsCallableRun as jest.Mock).mockResolvedValue({
    data: { resolvedType: 'eat', typeConfidence: 'guessed', results: [THURSTONS] },
  });
});

describe('resolveQuery', () => {
  test('invokes the callable with the query and the stop to anchor on', async () => {
    await resolveQuery('thurston', null, CONTEXT);

    expect(mockHttpsCallable).toHaveBeenCalledWith('resolveQuery');
    expect(mockHttpsCallableRun).toHaveBeenCalledWith({
      query: 'thurston',
      typeHint: null,
      context: { stopLat: 44.3876, stopLon: -68.2039 },
    });
  });

  test('passes a tapped type through as the hint', async () => {
    await resolveQuery('thurston', 'stay', CONTEXT);

    expect(mockHttpsCallableRun).toHaveBeenCalledWith(
      expect.objectContaining({ typeHint: 'stay' }),
    );
  });

  test('returns the type the server settled on', async () => {
    const result = await resolveQuery('thurston', null, CONTEXT);

    expect(result).toMatchObject({ resolvedType: 'eat', typeConfidence: 'guessed' });
  });

  test('turns each provider result into a finished candidate', async () => {
    const { candidates } = await resolveQuery('thurston', null, CONTEXT);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      type: 'eat',
      identity: { name: "Thurston's Lobster Pound" },
      commit: {
        target: 'booking',
        booking: { type: 'restaurant', restaurantName: "Thurston's Lobster Pound", date: '2026-09-27' },
      },
    });
  });

  test('gives every candidate its own id', async () => {
    (mockHttpsCallableRun as jest.Mock).mockResolvedValue({
      data: {
        resolvedType: 'eat',
        typeConfidence: 'guessed',
        results: [THURSTONS, { ...THURSTONS, name: 'Another Pound', fsq_id: 'fsq-other' }],
      },
    });

    const { candidates } = await resolveQuery('thurston', null, CONTEXT);

    expect(candidates).toHaveLength(2);
    expect(candidates[0].id).not.toBe(candidates[1].id);
  });

  // "A miss is not a dead end — it is the same screen with empty fields." So an empty
  // result set still produces exactly one candidate, carrying the user's own words.
  test('an empty result set still yields one card, keeping the user\'s words', async () => {
    (mockHttpsCallableRun as jest.Mock).mockResolvedValue({
      data: { resolvedType: 'do', typeConfidence: 'fallback', results: [] },
    });

    const { candidates } = await resolveQuery('grandmas kayak place', null, CONTEXT);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      type: 'do',
      typeConfidence: 'fallback',
      identity: { name: 'grandmas kayak place' },
      commit: { target: 'custom', item: { label: 'grandmas kayak place' } },
    });
  });

  test('the fallback card shows its own type\'s field table', async () => {
    (mockHttpsCallableRun as jest.Mock).mockResolvedValue({
      data: { resolvedType: 'flight', typeConfidence: 'fallback', results: [] },
    });

    const { candidates } = await resolveQuery('DL 2214', null, CONTEXT);

    expect(candidates[0].fields.map(f => f.label)).toEqual([
      'Departs', 'Arrives', 'Seat', 'Confirmation',
    ]);
  });

  // Matches enrichmentClient and stopSearchClient: the caller decides how to present a
  // failed lookup, which is a retry rather than the manual card.
  test('a callable failure propagates to the caller', async () => {
    (mockHttpsCallableRun as jest.Mock).mockRejectedValue(new Error('internal'));

    await expect(resolveQuery('thurston', null, CONTEXT)).rejects.toThrow('internal');
  });
});

// ── Not calling the API when we don't have to ────────────────────────────────

describe('resolveQuery — call avoidance', () => {
  test('does not call the API for a query too short to mean anything', async () => {
    const { candidates } = await resolveQuery('th', null, CONTEXT);

    expect(mockHttpsCallableRun).not.toHaveBeenCalled();
    // The one case that yields no card: the user is still typing, so there is
    // nothing to show yet — not even a "nothing found".
    expect(candidates).toEqual([]);
  });

  test('calls once the query is long enough', async () => {
    await resolveQuery('thu', null, CONTEXT);

    expect(mockHttpsCallableRun).toHaveBeenCalled();
    expect('thu'.length).toBe(MIN_QUERY_LENGTH);
  });

  test('a repeated query is served from the session cache, not the API', async () => {
    await resolveQuery('thurston', null, CONTEXT);
    await resolveQuery('thurston', null, CONTEXT);

    expect(mockHttpsCallableRun).toHaveBeenCalledTimes(1);
  });

  test('backspacing and retyping the same query costs nothing', async () => {
    await resolveQuery('thurston', null, CONTEXT);
    await resolveQuery('thursto', null, CONTEXT);
    await resolveQuery('thurston', null, CONTEXT);

    // Two distinct queries, two calls — the third repeats the first.
    expect(mockHttpsCallableRun).toHaveBeenCalledTimes(2);
  });

  test('a different stop is looked up again', async () => {
    await resolveQuery('thurston', null, CONTEXT);
    await resolveQuery('thurston', null, { ...CONTEXT, stopLat: 43.6591, stopLon: -70.2568 });

    expect(mockHttpsCallableRun).toHaveBeenCalledTimes(2);
  });

  // Candidate ids are tray-local. Replaying cached ids would let the same place enter
  // the tray twice under one id, so removing one would remove both.
  test('a cache hit still produces freshly-identified candidates', async () => {
    const first = await resolveQuery('thurston', null, CONTEXT);
    const second = await resolveQuery('thurston', null, CONTEXT);

    expect(second.candidates[0].identity.name).toBe(first.candidates[0].identity.name);
    expect(second.candidates[0].id).not.toBe(first.candidates[0].id);
  });

  test('caches the response, keyed the way resolveCache keys it', async () => {
    await resolveQuery('thurston', null, CONTEXT);

    const key = resolveCacheKey('thurston', null, CONTEXT.stopLat, CONTEXT.stopLon);
    expect(getCachedResolve(key)).toMatchObject({ resolvedType: 'eat' });
  });

  test('a failed lookup is not cached', async () => {
    (mockHttpsCallableRun as jest.Mock).mockRejectedValueOnce(new Error('internal'));
    await expect(resolveQuery('thurston', null, CONTEXT)).rejects.toThrow();

    (mockHttpsCallableRun as jest.Mock).mockResolvedValue({
      data: { resolvedType: 'eat', typeConfidence: 'guessed', results: [THURSTONS] },
    });
    await resolveQuery('thurston', null, CONTEXT);

    expect(mockHttpsCallableRun).toHaveBeenCalledTimes(2);
  });
});
