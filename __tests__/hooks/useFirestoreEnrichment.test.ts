jest.mock('@react-native-firebase/firestore');
jest.mock('@/src/lib/firebase', () => ({
  firestore: require('@react-native-firebase/firestore').default,
}));

import { renderHook, waitFor } from '@testing-library/react-native';
import { useFirestoreEnrichment } from '@/src/hooks/useFirestoreEnrichment';
import type { Place } from '@/src/types';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { mockCollection, mockDoc, mockGet } = jest.requireMock('@react-native-firebase/firestore');

beforeEach(() => {
  jest.clearAllMocks();
});

function docSnap(id: string, exists: boolean, data?: unknown) {
  return { id, exists: () => exists, data: () => data };
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

describe('useFirestoreEnrichment', () => {
  test('looks up each place with coordinates by its canonical key, under the flat place_enrichment collection', async () => {
    mockGet.mockResolvedValue(docSnap('eventide_43.6591_-70.2568', true, { name: 'Eventide', rating: 4.7, photos: [], cached_at: 1, place_id_locked: true }));
    const { result } = renderHook(() => useFirestoreEnrichment([PLACE_WITH_COORDS]));

    await waitFor(() => expect(Object.keys(result.current)).toHaveLength(1));
    expect(mockCollection).toHaveBeenCalledWith('place_enrichment');
    expect(mockDoc).toHaveBeenCalledWith('eventide_43.6591_-70.2568');
    expect(result.current['eventide_43.6591_-70.2568'].name).toBe('Eventide');
  });

  test('skips places with no known coordinates entirely — never queried, never in the result', async () => {
    const { result } = renderHook(() => useFirestoreEnrichment([PLACE_NO_COORDS]));
    expect(mockDoc).not.toHaveBeenCalled();
    expect(result.current).toEqual({});
  });

  test('a lookup miss (doc does not exist) is simply absent from the result, not an error', async () => {
    mockGet.mockResolvedValue(docSnap('eventide_43.6591_-70.2568', false));
    const { result } = renderHook(() => useFirestoreEnrichment([PLACE_WITH_COORDS]));
    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    expect(result.current).toEqual({});
  });

  test('starts as an empty map before the read resolves', () => {
    mockGet.mockReturnValue(new Promise(() => {})); // never resolves
    const { result } = renderHook(() => useFirestoreEnrichment([PLACE_WITH_COORDS]));
    expect(result.current).toEqual({});
  });

  test('a read failure is swallowed — resolves to an empty map, does not throw', async () => {
    mockGet.mockRejectedValue(new Error('permission-denied'));
    const { result } = renderHook(() => useFirestoreEnrichment([PLACE_WITH_COORDS]));
    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    expect(result.current).toEqual({});
  });

  test('does nothing when there are no places with coordinates', () => {
    const { result } = renderHook(() => useFirestoreEnrichment([]));
    expect(mockCollection).not.toHaveBeenCalled();
    expect(result.current).toEqual({});
  });

  test('dedupes identical canonical keys into a single lookup', async () => {
    mockGet.mockResolvedValue(docSnap('eventide_43.6591_-70.2568', true, { name: 'Eventide', photos: [], cached_at: 1, place_id_locked: true }));
    const duplicate = { ...PLACE_WITH_COORDS, id: 'place-1-dup' };
    const { result } = renderHook(() => useFirestoreEnrichment([PLACE_WITH_COORDS, duplicate]));
    await waitFor(() => expect(Object.keys(result.current)).toHaveLength(1));
    expect(mockDoc).toHaveBeenCalledTimes(1);
  });
});
