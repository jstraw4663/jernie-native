jest.mock('@react-native-firebase/database');
jest.mock('@/src/lib/firebase', () => ({
  getAuthedUser: () => Promise.resolve({ uid: 'test-uid' }),
  database: require('@react-native-firebase/database').default,
}));

import { mockRef, mockOnce, mockSet, mockUpdate } from '@react-native-firebase/database';
import { addPlace, updatePlace, removePlace, type NewPlace } from '@/src/lib/placeWrites';

beforeEach(() => {
  jest.clearAllMocks();
  (mockSet as jest.Mock).mockResolvedValue(undefined);
  (mockUpdate as jest.Mock).mockResolvedValue(undefined);
  (mockOnce as jest.Mock).mockResolvedValue({ val: () => null });
});

const BASE: NewPlace = {
  stopId: 'stop-bar-harbor',
  name: "Thurston's Lobster Pound",
  category: 'restaurant',
  must: false,
  source: 'community',
  addedBy: 'test-uid',
  lat: 44.2397,
  lon: -68.3531,
};

// ── addPlace ─────────────────────────────────────────────────────────────────

describe('addPlace', () => {
  test('writes a complete Place to trips/{tripId}/places/{newId} and resolves to that id', async () => {
    const placeId = await addPlace('trip-1', BASE);

    expect(typeof placeId).toBe('string');
    expect(placeId.length).toBeGreaterThan(0);
    expect(mockRef).toHaveBeenCalledWith(`trips/trip-1/places/${placeId}`);
    expect((mockSet as jest.Mock).mock.calls[0][0]).toEqual({
      ...BASE,
      id: placeId,
      tripId: 'trip-1',
    });
  });

  test('strips undefined optional fields rather than writing them', async () => {
    await addPlace('trip-1', { ...BASE, curatorNote: undefined, rating: undefined });

    const written = (mockSet as jest.Mock).mock.calls[0][0];
    expect('curatorNote' in written).toBe(false);
    expect('rating' in written).toBe(false);
  });

  // The three fields the design's "Do" card needs and Place has never had:
  // "Starts · Duration · Permit · Meet at".
  test('persists the duration, permit and meeting point a "Do" candidate carries', async () => {
    await addPlace('trip-1', {
      ...BASE,
      category: 'activity',
      name: 'Cadillac Mountain sunrise',
      duration: '2h',
      permit: 'Required',
      meetAt: 'Jordan Pond boathouse',
    });

    expect((mockSet as jest.Mock).mock.calls[0][0]).toMatchObject({
      duration: '2h',
      permit: 'Required',
      meetAt: 'Jordan Pond boathouse',
    });
  });

  // Coordinates are the canonical enrichment-cache key, so a place written without them
  // can never be enriched. NewPlace makes them required where Place leaves them optional.
  test('always writes coordinates', async () => {
    await addPlace('trip-1', BASE);

    expect((mockSet as jest.Mock).mock.calls[0][0]).toMatchObject({
      lat: 44.2397,
      lon: -68.3531,
    });
  });
});

// ── updatePlace ──────────────────────────────────────────────────────────────

describe('updatePlace', () => {
  test('patches the place node with undefined keys stripped', async () => {
    await updatePlace('trip-1', 'p1', { must: true, curatorNote: undefined });

    expect(mockRef).toHaveBeenCalledWith('trips/trip-1/places/p1');
    expect((mockUpdate as jest.Mock).mock.calls[0][0]).toEqual({ must: true });
  });
});

// ── removePlace ──────────────────────────────────────────────────────────────

describe('removePlace', () => {
  test('removes the place and any itinerary item referencing it, in one root update', async () => {
    (mockOnce as jest.Mock).mockResolvedValue({
      val: () => ({
        'stop-bar-harbor': {
          'day-1': {
            stopId: 'stop-bar-harbor',
            dateIso: '2026-07-10',
            items: [
              { id: 'i1', type: 'place', placeId: 'p1', order: 0 },
              { id: 'i2', type: 'custom', label: 'Walk the shore path', order: 1 },
            ],
          },
        },
      }),
    });

    await removePlace('trip-1', 'p1');

    const updates = (mockUpdate as jest.Mock).mock.calls[0][0];
    expect(updates['trips/trip-1/places/p1']).toBeNull();
    expect(updates['trips/trip-1/itinerary/stop-bar-harbor/day-1/items']).toEqual([
      { id: 'i2', type: 'custom', label: 'Walk the shore path', order: 1 },
    ]);
  });

  test('removes a place nothing references without touching the itinerary', async () => {
    (mockOnce as jest.Mock).mockResolvedValue({ val: () => null });

    await removePlace('trip-1', 'p1');

    const updates = (mockUpdate as jest.Mock).mock.calls[0][0];
    expect(Object.keys(updates)).toEqual(['trips/trip-1/places/p1']);
  });
});
