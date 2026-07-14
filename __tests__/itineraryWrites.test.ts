jest.mock('@react-native-firebase/database');
jest.mock('@/src/lib/firebase', () => ({
  database: require('@react-native-firebase/database').default,
}));

import { mockRef, mockSet } from '@react-native-firebase/database';
import { addPlaceToItinerary } from '@/src/lib/itineraryWrites';
import type { Place, ItineraryDay, ItineraryItem } from '@/src/types';

beforeEach(() => {
  jest.clearAllMocks();
  (mockSet as jest.Mock).mockResolvedValue(undefined);
});

const place: Place = {
  id: 'place-1', tripId: 'trip-1', stopId: 'stop-a', name: 'Eventide',
  category: 'restaurant', must: true, source: 'curator', addedBy: 'uid-1',
};

describe('addPlaceToItinerary', () => {
  test('writes to trips/{tripId}/itinerary/{stopId}/{dayId}/items at the correct path', async () => {
    const day: ItineraryDay = { id: 'day-1', stopId: 'stop-a', dateIso: '2026-07-10', items: [] };
    await addPlaceToItinerary('trip-1', place, day);
    expect(mockRef).toHaveBeenCalledWith('trips/trip-1/itinerary/stop-a/day-1/items');
  });

  test('appends the new item to any existing items rather than overwriting them', async () => {
    const existing: ItineraryItem = { id: 'existing-1', type: 'custom', label: 'Sleep in', order: 0 };
    const day: ItineraryDay = { id: 'day-1', stopId: 'stop-a', dateIso: '2026-07-10', items: [existing] };
    await addPlaceToItinerary('trip-1', place, day);

    const writtenValue = (mockSet as jest.Mock).mock.calls[0][0];
    expect(writtenValue).toHaveLength(2);
    expect(writtenValue[0]).toBe(existing);
    expect(writtenValue[1]).toMatchObject({ placeId: 'place-1', type: 'place', order: 1 });
  });

  test('propagates a write failure rather than swallowing it', async () => {
    (mockSet as jest.Mock).mockRejectedValue(new Error('permission-denied'));
    const day: ItineraryDay = { id: 'day-1', stopId: 'stop-a', dateIso: '2026-07-10', items: [] };
    await expect(addPlaceToItinerary('trip-1', place, day)).rejects.toThrow('permission-denied');
  });
});
