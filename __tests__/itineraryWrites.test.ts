jest.mock('@react-native-firebase/database');
jest.mock('@/src/lib/firebase', () => ({
  getAuthedUser: () => Promise.resolve({ uid: 'test-uid' }),
  database: require('@react-native-firebase/database').default,
}));

import { mockRef, mockSet } from '@react-native-firebase/database';
import {
  addPlaceToItinerary,
  addCustomItineraryItem,
  updateItineraryItem,
  removeItineraryItem,
} from '@/src/lib/itineraryWrites';
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

describe('addCustomItineraryItem', () => {
  test('writes to trips/{tripId}/itinerary/{stopId}/{dayId}/items at the correct path', async () => {
    const day: ItineraryDay = { id: 'day-1', stopId: 'stop-a', dateIso: '2026-07-10', items: [] };
    await addCustomItineraryItem('trip-1', day, { label: 'Sleep in' });
    expect(mockRef).toHaveBeenCalledWith('trips/trip-1/itinerary/stop-a/day-1/items');
  });

  test('appends the new custom item to any existing items rather than overwriting them', async () => {
    const existing: ItineraryItem = { id: 'existing-1', type: 'custom', label: 'Sleep in', order: 0 };
    const day: ItineraryDay = { id: 'day-1', stopId: 'stop-a', dateIso: '2026-07-10', items: [existing] };
    await addCustomItineraryItem('trip-1', day, { label: 'Museum visit', time: '10:00' });

    const writtenValue = (mockSet as jest.Mock).mock.calls[0][0];
    expect(writtenValue).toHaveLength(2);
    expect(writtenValue[0]).toBe(existing);
    expect(writtenValue[1]).toMatchObject({ type: 'custom', label: 'Museum visit', time: '10:00', order: 1 });
  });

  test('propagates a write failure rather than swallowing it', async () => {
    (mockSet as jest.Mock).mockRejectedValue(new Error('permission-denied'));
    const day: ItineraryDay = { id: 'day-1', stopId: 'stop-a', dateIso: '2026-07-10', items: [] };
    await expect(addCustomItineraryItem('trip-1', day, { label: 'Sleep in' })).rejects.toThrow('permission-denied');
  });
});

describe('updateItineraryItem', () => {
  test('writes to trips/{tripId}/itinerary/{stopId}/{dayId}/items at the correct path', async () => {
    const target: ItineraryItem = { id: 'item-1', type: 'custom', label: 'Sleep in', order: 0 };
    const day: ItineraryDay = { id: 'day-1', stopId: 'stop-a', dateIso: '2026-07-10', items: [target] };
    await updateItineraryItem('trip-1', day, 'item-1', { label: 'Sleep in late' });
    expect(mockRef).toHaveBeenCalledWith('trips/trip-1/itinerary/stop-a/day-1/items');
  });

  test('patches only the matching item by id, leaving other items untouched, and writes the full array back', async () => {
    const target: ItineraryItem = { id: 'item-1', type: 'place', placeId: 'place-1', label: 'Eventide', order: 0 };
    const other: ItineraryItem = { id: 'item-2', type: 'custom', label: 'Sleep in', order: 1 };
    const day: ItineraryDay = { id: 'day-1', stopId: 'stop-a', dateIso: '2026-07-10', items: [target, other] };

    await updateItineraryItem('trip-1', day, 'item-1', { time: '19:00', notes: 'reservation for 4' });

    const writtenValue = (mockSet as jest.Mock).mock.calls[0][0];
    expect(writtenValue).toHaveLength(2);
    expect(writtenValue[0]).toEqual({ ...target, time: '19:00', notes: 'reservation for 4' });
    expect(writtenValue[1]).toBe(other);
  });

  test('strips undefined-valued patch fields rather than writing them as undefined', async () => {
    const target: ItineraryItem = { id: 'item-1', type: 'custom', label: 'Sleep in', time: '09:00', order: 0 };
    const day: ItineraryDay = { id: 'day-1', stopId: 'stop-a', dateIso: '2026-07-10', items: [target] };

    await updateItineraryItem('trip-1', day, 'item-1', { time: undefined, notes: 'new note' });

    const writtenValue = (mockSet as jest.Mock).mock.calls[0][0];
    // undefined in the patch must not overwrite the existing `time` with `undefined`
    expect(writtenValue[0].time).toBe('09:00');
    expect(writtenValue[0].notes).toBe('new note');
  });

  test('propagates a write failure rather than swallowing it', async () => {
    (mockSet as jest.Mock).mockRejectedValue(new Error('permission-denied'));
    const target: ItineraryItem = { id: 'item-1', type: 'custom', label: 'Sleep in', order: 0 };
    const day: ItineraryDay = { id: 'day-1', stopId: 'stop-a', dateIso: '2026-07-10', items: [target] };
    await expect(updateItineraryItem('trip-1', day, 'item-1', { label: 'x' })).rejects.toThrow('permission-denied');
  });
});

describe('removeItineraryItem', () => {
  test('writes to trips/{tripId}/itinerary/{stopId}/{dayId}/items at the correct path', async () => {
    const target: ItineraryItem = { id: 'item-1', type: 'custom', label: 'Sleep in', order: 0 };
    const day: ItineraryDay = { id: 'day-1', stopId: 'stop-a', dateIso: '2026-07-10', items: [target] };
    await removeItineraryItem('trip-1', day, 'item-1');
    expect(mockRef).toHaveBeenCalledWith('trips/trip-1/itinerary/stop-a/day-1/items');
  });

  test('filters the matching item out and writes the full remaining array back', async () => {
    const target: ItineraryItem = { id: 'item-1', type: 'custom', label: 'Sleep in', order: 0 };
    const other: ItineraryItem = { id: 'item-2', type: 'booking', bookingId: 'b-1', label: 'Flight', order: 1 };
    const day: ItineraryDay = { id: 'day-1', stopId: 'stop-a', dateIso: '2026-07-10', items: [target, other] };

    await removeItineraryItem('trip-1', day, 'item-1');

    const writtenValue = (mockSet as jest.Mock).mock.calls[0][0];
    expect(writtenValue).toHaveLength(1);
    expect(writtenValue[0]).toBe(other);
  });

  test('is a no-op-safe write (writes the same full array back) if the id is not found', async () => {
    const other: ItineraryItem = { id: 'item-2', type: 'custom', label: 'Sleep in', order: 0 };
    const day: ItineraryDay = { id: 'day-1', stopId: 'stop-a', dateIso: '2026-07-10', items: [other] };

    await removeItineraryItem('trip-1', day, 'does-not-exist');

    const writtenValue = (mockSet as jest.Mock).mock.calls[0][0];
    expect(writtenValue).toEqual([other]);
  });

  test('propagates a write failure rather than swallowing it', async () => {
    (mockSet as jest.Mock).mockRejectedValue(new Error('permission-denied'));
    const target: ItineraryItem = { id: 'item-1', type: 'custom', label: 'Sleep in', order: 0 };
    const day: ItineraryDay = { id: 'day-1', stopId: 'stop-a', dateIso: '2026-07-10', items: [target] };
    await expect(removeItineraryItem('trip-1', day, 'item-1')).rejects.toThrow('permission-denied');
  });
});
