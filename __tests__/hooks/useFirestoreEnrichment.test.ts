jest.mock('@/src/lib/firestoreBatchGet', () => ({ getDocsByIds: jest.fn() }));
jest.mock('@/src/lib/enrichmentClient', () => ({ enrichPlaces: jest.fn() }));

import { renderHook, waitFor } from '@testing-library/react-native';
import { useFirestoreEnrichment } from '@/src/hooks/useFirestoreEnrichment';
import { getDocsByIds } from '@/src/lib/firestoreBatchGet';
import { enrichPlaces } from '@/src/lib/enrichmentClient';
import { canonicalPlaceKey } from '@/src/domain/placeEnrichment';
import type { Place } from '@/src/types';

const mockGetDocsByIds = getDocsByIds as jest.Mock;
const mockEnrichPlaces = enrichPlaces as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

// Flushes any already-scheduled microtasks/macrotasks (e.g. the settled-but-not-yet-
// merged tail of a Promise.allSettled chain) so assertions after it see the final state.
async function flush() {
  await new Promise(resolve => setTimeout(resolve, 0));
}

const PLACE_WITH_COORDS: Place = {
  id: 'place-1', tripId: 't1', stopId: 's1', name: 'Eventide',
  category: 'restaurant', must: true, source: 'curator', addedBy: 'u1',
  lat: 43.6591, lon: -70.2568,
};
const PLACE_NO_COORDS: Place = {
  id: 'place-2', tripId: 't1', stopId: 's1', name: 'Beehive Trail',
  category: 'hike', must: true, source: 'curator', addedBy: 'u1',
};
const EVENTIDE_KEY = canonicalPlaceKey(PLACE_WITH_COORDS.name, PLACE_WITH_COORDS.lat!, PLACE_WITH_COORDS.lon!);

describe('useFirestoreEnrichment', () => {
  test('looks up all places with coordinates in a single batched read, keyed by canonical key', async () => {
    mockGetDocsByIds.mockResolvedValue({
      [EVENTIDE_KEY]: { name: 'Eventide', rating: 4.7, address: '', photos: [], cached_at: 1, place_id_locked: true },
    });
    const { result } = renderHook(() => useFirestoreEnrichment([PLACE_WITH_COORDS]));

    await waitFor(() => expect(Object.keys(result.current)).toHaveLength(1));
    expect(mockGetDocsByIds).toHaveBeenCalledWith('place_enrichment', [EVENTIDE_KEY]);
    expect(result.current[EVENTIDE_KEY].name).toBe('Eventide');
    // A cache hit — no miss, so no live-enrichment call.
    expect(mockEnrichPlaces).not.toHaveBeenCalled();
  });

  test('skips places with no known coordinates entirely — never queried, never in the result', async () => {
    const { result } = renderHook(() => useFirestoreEnrichment([PLACE_NO_COORDS]));
    expect(mockGetDocsByIds).not.toHaveBeenCalled();
    expect(result.current).toEqual({});
  });

  test('does nothing when there are no places with coordinates', () => {
    const { result } = renderHook(() => useFirestoreEnrichment([]));
    expect(mockGetDocsByIds).not.toHaveBeenCalled();
    expect(result.current).toEqual({});
  });

  test('starts as an empty map before the read resolves', () => {
    mockGetDocsByIds.mockReturnValue(new Promise(() => {})); // never resolves
    const { result } = renderHook(() => useFirestoreEnrichment([PLACE_WITH_COORDS]));
    expect(result.current).toEqual({});
  });

  test('dedupes identical canonical keys into a single batched-read call', async () => {
    mockGetDocsByIds.mockResolvedValue({
      [EVENTIDE_KEY]: { name: 'Eventide', address: '', photos: [], cached_at: 1, place_id_locked: true },
    });
    const duplicate = { ...PLACE_WITH_COORDS, id: 'place-1-dup' };
    const { result } = renderHook(() => useFirestoreEnrichment([PLACE_WITH_COORDS, duplicate]));
    await waitFor(() => expect(Object.keys(result.current)).toHaveLength(1));
    expect(mockGetDocsByIds).toHaveBeenCalledTimes(1);
    expect(mockGetDocsByIds).toHaveBeenCalledWith('place_enrichment', [EVENTIDE_KEY]);
  });

  test('a read failure is swallowed — resolves to an empty map, does not throw, never calls enrichPlaces', async () => {
    mockGetDocsByIds.mockRejectedValue(new Error('permission-denied'));
    const { result } = renderHook(() => useFirestoreEnrichment([PLACE_WITH_COORDS]));
    await waitFor(() => expect(mockGetDocsByIds).toHaveBeenCalled());
    await flush();
    expect(result.current).toEqual({});
    expect(mockEnrichPlaces).not.toHaveBeenCalled();
  });

  test('a doc with fsq_not_found: true counts as present, not a miss — enrichPlaces is never called for it', async () => {
    mockGetDocsByIds.mockResolvedValue({
      [EVENTIDE_KEY]: { name: 'Eventide', address: '', photos: [], cached_at: 1, place_id_locked: true, fsq_not_found: true },
    });
    const { result } = renderHook(() => useFirestoreEnrichment([PLACE_WITH_COORDS]));

    await waitFor(() => expect(Object.keys(result.current)).toHaveLength(1));
    expect(result.current[EVENTIDE_KEY].fsq_not_found).toBe(true);
    await flush();
    expect(mockEnrichPlaces).not.toHaveBeenCalled();
  });

  test('a cache miss triggers exactly one enrichPlaces call with the right payload, merged into the returned map', async () => {
    mockGetDocsByIds.mockResolvedValue({});
    mockEnrichPlaces.mockResolvedValue({
      [EVENTIDE_KEY]: { name: 'Eventide', address: '86 Middle St', rating: 4.7, photos: [], cached_at: 2, place_id_locked: true },
    });
    const { result } = renderHook(() => useFirestoreEnrichment([PLACE_WITH_COORDS]));

    await waitFor(() => expect(mockEnrichPlaces).toHaveBeenCalledTimes(1));
    expect(mockEnrichPlaces).toHaveBeenCalledWith([
      { canonicalKey: EVENTIDE_KEY, name: 'Eventide', lat: 43.6591, lon: -70.2568, fsq_id: undefined },
    ]);

    await waitFor(() => expect(result.current[EVENTIDE_KEY]?.rating).toBe(4.7));
  });

  test('passes an existing fsq_id from the curated Place through to the enrichPlaces request', async () => {
    mockGetDocsByIds.mockResolvedValue({});
    mockEnrichPlaces.mockResolvedValue({});
    const placeWithFsqId: Place = { ...PLACE_WITH_COORDS, id: 'place-3', fsq_id: 'fsq-abc123' };

    renderHook(() => useFirestoreEnrichment([placeWithFsqId]));

    await waitFor(() => expect(mockEnrichPlaces).toHaveBeenCalledTimes(1));
    expect(mockEnrichPlaces).toHaveBeenCalledWith([
      expect.objectContaining({ fsq_id: 'fsq-abc123' }),
    ]);
  });

  test('a failed callable leaves the map unchanged rather than throwing', async () => {
    mockGetDocsByIds.mockResolvedValue({});
    mockEnrichPlaces.mockRejectedValue(new Error('unavailable'));
    const { result } = renderHook(() => useFirestoreEnrichment([PLACE_WITH_COORDS]));

    await waitFor(() => expect(mockEnrichPlaces).toHaveBeenCalledTimes(1));
    await flush();
    expect(result.current).toEqual({});
  });

  test('re-render that adds a new place only fires enrichPlaces for the newly missing key, not one whose call is still in flight', async () => {
    mockGetDocsByIds.mockResolvedValue({});
    // The first call for Eventide is left genuinely pending (not yet settled) — this is
    // what should suppress a duplicate concurrent dispatch, not a permanent record that
    // it was ever attempted (see the dedicated in-flight-vs-permanent regression test).
    let resolveFirstCall!: (value: Record<string, unknown>) => void;
    const firstCallPromise = new Promise<Record<string, unknown>>(resolve => { resolveFirstCall = resolve; });
    mockEnrichPlaces.mockImplementationOnce(() => firstCallPromise).mockResolvedValue({});

    const { rerender } = renderHook(
      ({ places }: { places: Place[] }) => useFirestoreEnrichment(places),
      { initialProps: { places: [PLACE_WITH_COORDS] } },
    );

    await waitFor(() => expect(mockEnrichPlaces).toHaveBeenCalledTimes(1));
    expect(mockEnrichPlaces).toHaveBeenCalledWith([expect.objectContaining({ canonicalKey: EVENTIDE_KEY })]);

    const newPlace: Place = {
      id: 'place-4', tripId: 't1', stopId: 's1', name: 'Duckfat',
      category: 'restaurant', must: false, source: 'curator', addedBy: 'u1',
      lat: 43.66, lon: -70.25,
    };
    const duckfatKey = canonicalPlaceKey(newPlace.name, newPlace.lat!, newPlace.lon!);

    rerender({ places: [PLACE_WITH_COORDS, newPlace] });

    await waitFor(() => expect(mockEnrichPlaces).toHaveBeenCalledTimes(2));
    const secondCallPayload = mockEnrichPlaces.mock.calls[1][0];
    expect(secondCallPayload).toHaveLength(1);
    expect(secondCallPayload[0].canonicalKey).toBe(duckfatKey);

    resolveFirstCall({}); // let the still-pending first call settle so it doesn't leak into later tests
    await flush();
  });

  test('re-render with the exact same places never re-fires the batched read or the callable', async () => {
    mockGetDocsByIds.mockResolvedValue({});
    mockEnrichPlaces.mockResolvedValue({});
    const { rerender } = renderHook(
      ({ places }: { places: Place[] }) => useFirestoreEnrichment(places),
      { initialProps: { places: [PLACE_WITH_COORDS] } },
    );

    await waitFor(() => expect(mockEnrichPlaces).toHaveBeenCalledTimes(1));

    rerender({ places: [PLACE_WITH_COORDS] });
    await flush();

    expect(mockGetDocsByIds).toHaveBeenCalledTimes(1);
    expect(mockEnrichPlaces).toHaveBeenCalledTimes(1);
  });

  test('splits a miss list larger than the callable batch cap (30) into multiple enrichPlaces calls', async () => {
    const manyPlaces: Place[] = Array.from({ length: 35 }, (_, i) => ({
      id: `place-many-${i}`, tripId: 't1', stopId: 's1', name: `Place ${i}`,
      category: 'restaurant' as const, must: false, source: 'curator' as const, addedBy: 'u1',
      lat: 40 + i * 0.001, lon: -70 - i * 0.001,
    }));
    mockGetDocsByIds.mockResolvedValue({});
    mockEnrichPlaces.mockResolvedValue({});

    renderHook(() => useFirestoreEnrichment(manyPlaces));

    await waitFor(() => expect(mockEnrichPlaces).toHaveBeenCalledTimes(2));
    const [firstBatch, secondBatch] = mockEnrichPlaces.mock.calls.map(call => call[0]);
    expect(firstBatch.length).toBeLessThanOrEqual(30);
    expect(secondBatch.length).toBeLessThanOrEqual(30);
    expect(firstBatch.length + secondBatch.length).toBe(35);
  });

  test('one chunk rejecting does not prevent another chunk\'s successful results from being merged', async () => {
    // 35 missing places forces 2 chunks (cap is 30): chunk 1 = places 0-29, chunk 2 =
    // places 30-34. Regression test for chunk isolation via Promise.allSettled — a
    // rejected chunk must not throw out of the hook, and must not discard the other
    // chunk's results.
    const manyPlaces: Place[] = Array.from({ length: 35 }, (_, i) => ({
      id: `place-chunk-${i}`, tripId: 't1', stopId: 's1', name: `Chunk Place ${i}`,
      category: 'restaurant' as const, must: false, source: 'curator' as const, addedBy: 'u1',
      lat: 40 + i * 0.001, lon: -70 - i * 0.001,
    }));
    const keysByPlace = manyPlaces.map(p => canonicalPlaceKey(p.name, p.lat!, p.lon!));

    mockGetDocsByIds.mockResolvedValue({});
    mockEnrichPlaces
      .mockRejectedValueOnce(new Error('foursquare unavailable'))
      .mockImplementationOnce(async (batch: { canonicalKey: string; name: string }[]) => {
        const result: Record<string, unknown> = {};
        batch.forEach(p => {
          result[p.canonicalKey] = {
            name: p.name, address: '', rating: 4.2, photos: [], cached_at: 3, place_id_locked: true,
          };
        });
        return result;
      });

    const { result } = renderHook(() => useFirestoreEnrichment(manyPlaces));

    await waitFor(() => expect(mockEnrichPlaces).toHaveBeenCalledTimes(2));
    await flush();

    // The rejected first chunk's places are simply absent — not thrown, not present.
    expect(result.current[keysByPlace[0]]).toBeUndefined();
    expect(result.current[keysByPlace[29]]).toBeUndefined();
    // The resolved second chunk's places DO make it into the final merged map.
    expect(result.current[keysByPlace[30]]?.rating).toBe(4.2);
    expect(result.current[keysByPlace[34]]?.rating).toBe(4.2);
  });

  // The quota's client half. Everything above deliberately keeps a failed key retryable —
  // a dropped connection or a cold-start timeout should not strand a place for the
  // session. `resource-exhausted` is the one failure where that is wrong: the answer is
  // already known and stays "no" until the window rolls, so re-firing on every effect run
  // spends a Cloud Function invocation and a Firestore transaction purely to be refused
  // again. See functions/src/quota.ts and src/domain/callableError.ts.
  describe('over quota', () => {
    const quotaError = () =>
      Object.assign(new Error('Daily quota exceeded.'), { code: 'resource-exhausted' });

    test('a refused key is not retried on a later effect run', async () => {
      mockGetDocsByIds.mockResolvedValue({});
      mockEnrichPlaces.mockRejectedValue(quotaError());

      const { rerender } = renderHook(
        ({ places }: { places: Place[] }) => useFirestoreEnrichment(places),
        { initialProps: { places: [PLACE_WITH_COORDS] } },
      );

      await waitFor(() => expect(mockEnrichPlaces).toHaveBeenCalledTimes(1));
      await flush();

      const newPlace: Place = {
        id: 'place-quota', tripId: 't1', stopId: 's1', name: 'Duckfat',
        category: 'restaurant', must: false, source: 'curator', addedBy: 'u1',
        lat: 43.66, lon: -70.25,
      };
      rerender({ places: [PLACE_WITH_COORDS, newPlace] });
      await flush();

      // The second run may still ask about the newly-arrived place — what it must not do
      // is ask about the key it was already refused.
      const askedAgain = mockEnrichPlaces.mock.calls
        .slice(1)
        .flatMap(([batch]: [{ canonicalKey: string }[]]) => batch.map(p => p.canonicalKey));
      expect(askedAgain).not.toContain(EVENTIDE_KEY);
    });

    // Narrow on purpose. Latching on a transient failure would be a worse bug than the
    // one it fixes: the place stays un-enriched for the whole mount over a blip.
    test('a plain failure is still retried', async () => {
      mockGetDocsByIds.mockResolvedValue({});
      mockEnrichPlaces.mockRejectedValue(new Error('Network request failed'));

      const { rerender } = renderHook(
        ({ places }: { places: Place[] }) => useFirestoreEnrichment(places),
        { initialProps: { places: [PLACE_WITH_COORDS] } },
      );

      await waitFor(() => expect(mockEnrichPlaces).toHaveBeenCalledTimes(1));
      await flush();

      const newPlace: Place = {
        id: 'place-transient', tripId: 't1', stopId: 's1', name: 'Duckfat',
        category: 'restaurant', must: false, source: 'curator', addedBy: 'u1',
        lat: 43.66, lon: -70.25,
      };
      rerender({ places: [PLACE_WITH_COORDS, newPlace] });
      await flush();

      const askedAgain = mockEnrichPlaces.mock.calls
        .slice(1)
        .flatMap(([batch]: [{ canonicalKey: string }[]]) => batch.map(p => p.canonicalKey));
      expect(askedAgain).toContain(EVENTIDE_KEY);
    });

    // The refusal is charged against the whole batch, not the one place that tripped it,
    // so every key in that chunk is equally known-refused.
    test('every key in the refused batch is latched, not just the first', async () => {
      const second: Place = {
        id: 'place-b', tripId: 't1', stopId: 's1', name: 'Fore Street',
        category: 'restaurant', must: false, source: 'curator', addedBy: 'u1',
        lat: 43.657, lon: -70.252,
      };
      const secondKey = canonicalPlaceKey(second.name, second.lat!, second.lon!);

      mockGetDocsByIds.mockResolvedValue({});
      mockEnrichPlaces.mockRejectedValue(quotaError());

      const { rerender } = renderHook(
        ({ places }: { places: Place[] }) => useFirestoreEnrichment(places),
        { initialProps: { places: [PLACE_WITH_COORDS, second] } },
      );

      await waitFor(() => expect(mockEnrichPlaces).toHaveBeenCalledTimes(1));
      await flush();

      const third: Place = {
        id: 'place-c', tripId: 't1', stopId: 's1', name: 'Duckfat',
        category: 'restaurant', must: false, source: 'curator', addedBy: 'u1',
        lat: 43.66, lon: -70.25,
      };
      rerender({ places: [PLACE_WITH_COORDS, second, third] });
      await flush();

      const askedAgain = mockEnrichPlaces.mock.calls
        .slice(1)
        .flatMap(([batch]: [{ canonicalKey: string }[]]) => batch.map(p => p.canonicalKey));
      expect(askedAgain).not.toContain(EVENTIDE_KEY);
      expect(askedAgain).not.toContain(secondKey);
    });
  });

  test('a key whose in-flight call gets discarded by cancellation is retried (not permanently lost) on the next effect run that still finds it missing', async () => {
    // Reproduces the race: A is a miss and its enrichPlaces call is dispatched but slow
    // to resolve. Before it resolves, `places` changes (B arrives), which cancels the
    // first effect closure. The read for the second effect run still finds A missing.
    // A's original (now-cancelled) call eventually resolves successfully, but that
    // result must be discarded per the existing cancellation guard — the correct
    // behavior is for the *second* effect run to notice A is free again (its call
    // settled) and dispatch a fresh enrichPlaces call for it, which is what ultimately
    // populates the map. Permanently marking A as "attempted" (the bug) would instead
    // exclude it from every future miss computation, losing it for the rest of the
    // mount's life.
    let resolveFirstCall!: (value: Record<string, unknown>) => void;
    const firstCallPromise = new Promise<Record<string, unknown>>(resolve => {
      resolveFirstCall = resolve;
    });
    let resolveSecondRead!: (value: Record<string, unknown>) => void;
    const secondReadPromise = new Promise<Record<string, unknown>>(resolve => {
      resolveSecondRead = resolve;
    });

    mockGetDocsByIds.mockResolvedValueOnce({}); // effect 1's read: A missing
    mockEnrichPlaces
      .mockImplementationOnce(() => firstCallPromise) // effect 1's call for A: controlled
      .mockImplementation(async (batch: { canonicalKey: string; name: string }[]) => {
        // Any later call resolves for real, keyed by whatever it was actually asked for.
        const out: Record<string, unknown> = {};
        batch.forEach(p => {
          out[p.canonicalKey] = {
            name: p.name, address: 'resolved', rating: 4.7, photos: [], cached_at: 2, place_id_locked: true,
          };
        });
        return out;
      });

    const { rerender, result } = renderHook(
      ({ places }: { places: Place[] }) => useFirestoreEnrichment(places),
      { initialProps: { places: [PLACE_WITH_COORDS] } },
    );

    await waitFor(() => expect(mockEnrichPlaces).toHaveBeenCalledTimes(1));
    expect(mockEnrichPlaces.mock.calls[0][0]).toEqual([
      expect.objectContaining({ canonicalKey: EVENTIDE_KEY }),
    ]);

    // effect 2's read is controlled so it only resolves once we say so, after the
    // first call has already settled and freed up A's in-flight slot.
    mockGetDocsByIds.mockImplementationOnce(() => secondReadPromise);

    const newPlace: Place = {
      id: 'place-4', tripId: 't1', stopId: 's1', name: 'Duckfat',
      category: 'restaurant', must: false, source: 'curator', addedBy: 'u1',
      lat: 43.66, lon: -70.25,
    };
    rerender({ places: [PLACE_WITH_COORDS, newPlace] });

    // Resolve the original (now-cancelled) call for A with data that should be
    // discarded — if it ever leaked into the map, rating would read 999, not 4.7.
    resolveFirstCall({ [EVENTIDE_KEY]: { name: 'Eventide', address: 'stale', rating: 999, photos: [], cached_at: 1, place_id_locked: true } });
    await flush();

    // Effect 2's read still finds both places missing (the Firestore write from the
    // discarded call, if any, hasn't been reflected here) — this is the moment that
    // exposes the bug: A must be eligible for a fresh miss-check now that its prior
    // call has settled.
    resolveSecondRead({});

    await waitFor(() => expect(result.current[EVENTIDE_KEY]?.rating).toBe(4.7));
    // Never picked up the stale, discarded value from the cancelled first call.
    expect(result.current[EVENTIDE_KEY]?.address).toBe('resolved');
  });
});
