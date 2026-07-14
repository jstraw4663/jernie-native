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

  test('re-render that adds a new place only fires enrichPlaces for the newly missing key, not ones already attempted', async () => {
    mockGetDocsByIds.mockResolvedValue({});
    mockEnrichPlaces.mockResolvedValue({});
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
});
