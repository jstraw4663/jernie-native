jest.mock('@react-native-firebase/database');
jest.mock('@/src/lib/firebase', () => ({
  getAuthedUser: () => Promise.resolve({ uid: 'test-uid' }),
  database: require('@react-native-firebase/database').default,
}));

import {
  mockKeepSynced, mockOnce, mockRef, mockSet, mockTransaction,
} from '@react-native-firebase/database';
import {
  addPlaceToItinerary,
  addCustomItineraryItem,
  updateItineraryItem,
  removeItineraryItem,
  removeItineraryItemById,
  moveItineraryItemBetweenDays,
  reorderItineraryDayItems,
} from '@/src/lib/itineraryWrites';
import type { Place, ItineraryDay, ItineraryItem } from '@/src/types';

beforeEach(() => {
  jest.clearAllMocks();
  (mockSet as jest.Mock).mockResolvedValue(undefined);
  (mockOnce as jest.Mock).mockResolvedValue({ val: () => null });
  (mockTransaction as jest.Mock).mockReset();
  (mockKeepSynced as jest.Mock).mockResolvedValue(undefined);
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

describe('removeItineraryItemById', () => {
  const target: ItineraryItem = { id: 'item-1', type: 'custom', label: 'Sleep in', order: 0 };
  const other: ItineraryItem = { id: 'item-2', type: 'custom', label: 'Museum', order: 1 };

  /** Mirrors RTDB: resolve with the transform's result, or an abort when it returns undefined. */
  function runTransaction(serverValue: unknown) {
    (mockTransaction as jest.Mock).mockImplementation(
      async (update: (raw: unknown) => unknown) => {
        const value = update(serverValue);
        return { committed: value !== undefined, snapshot: { val: () => value } };
      },
    );
  }

  test('removes from the latest server array at delayed-commit time', async () => {
    (mockOnce as jest.Mock).mockResolvedValue({ val: () => [target, other] });
    runTransaction([target, other]);

    await removeItineraryItemById('trip-1', 'stop-a', 'day-1', 'item-1');

    expect(mockRef).toHaveBeenCalledWith('trips/trip-1/itinerary/stop-a/day-1/items');
    expect(mockKeepSynced).toHaveBeenNthCalledWith(1, true);
    expect(mockKeepSynced).toHaveBeenLastCalledWith(false);
    const update = (mockTransaction as jest.Mock).mock.calls[0][0];
    expect(update([target, other])).toEqual([other]);
  });

  test('never writes a UI copy of the day — the transform runs on the server value', async () => {
    (mockOnce as jest.Mock).mockResolvedValue({ val: () => [target, other] });
    runTransaction([target, other]);

    await removeItineraryItemById('trip-1', 'stop-a', 'day-1', 'item-1');

    // The row a companion added between the warm-up read and the commit survives.
    const added: ItineraryItem = { id: 'item-3', type: 'custom', label: 'Ferry', order: 2 };
    const update = (mockTransaction as jest.Mock).mock.calls[0][0];
    expect(update([target, other, added])).toEqual([other, added]);
    expect(mockSet).not.toHaveBeenCalled();
  });

  test('is idempotent when another client already removed the item', async () => {
    (mockOnce as jest.Mock).mockResolvedValue({ val: () => [other] });

    await removeItineraryItemById('trip-1', 'stop-a', 'day-1', 'item-1');

    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockSet).not.toHaveBeenCalled();
  });

  test('aborts rather than resurrecting a day deleted mid-transaction', async () => {
    (mockOnce as jest.Mock).mockResolvedValue({ val: () => [target, other] });
    runTransaction([target, other]);

    await removeItineraryItemById('trip-1', 'stop-a', 'day-1', 'item-1');

    const update = (mockTransaction as jest.Mock).mock.calls[0][0];
    expect(update(null)).toBeUndefined();
    expect(update([other])).toBeUndefined();
  });

  test('propagates transaction failures', async () => {
    (mockOnce as jest.Mock).mockResolvedValue({ val: () => [target, other] });
    (mockTransaction as jest.Mock).mockRejectedValue(new Error('database/network-error'));

    await expect(removeItineraryItemById('trip-1', 'stop-a', 'day-1', 'item-1'))
      .rejects.toThrow('database/network-error');
  });

  test('preserves other rows from Firebase object-shaped arrays', async () => {
    (mockOnce as jest.Mock).mockResolvedValue({
      val: () => ({ 0: target, 2: other }),
    });
    runTransaction({ 0: target, 2: other });

    await removeItineraryItemById('trip-1', 'stop-a', 'day-1', 'item-1');

    const update = (mockTransaction as jest.Mock).mock.calls[0][0];
    expect(update({ 0: target, 2: other })).toEqual([other]);
  });
});

describe('reorderItineraryDayItems', () => {
  const a: ItineraryItem = { id: 'a', type: 'custom', label: 'A', time: 'morning', order: 0 };
  const b: ItineraryItem = { id: 'b', type: 'custom', label: 'B', order: 1 };
  const c: ItineraryItem = { id: 'c', type: 'custom', label: 'C', order: 2 };

  test('authenticates, warms the latest day, and atomically applies the pure move', async () => {
    (mockOnce as jest.Mock).mockResolvedValue({ val: () => [a, b, c] });
    (mockTransaction as jest.Mock).mockImplementation(async (update: (raw: unknown) => unknown) => {
      const value = update([a, { ...b, notes: 'updated elsewhere' }, c]);
      return { committed: value !== undefined, snapshot: { val: () => value } };
    });

    await reorderItineraryDayItems('trip-1', 'stop-a', 'day-1', {
      itemId: 'a', toIndex: 2, time: 'afternoon',
    });

    expect(mockRef).toHaveBeenCalledWith('trips/trip-1/itinerary/stop-a/day-1/items');
    const update = (mockTransaction as jest.Mock).mock.calls[0][0];
    expect(update([a, { ...b, notes: 'updated elsewhere' }, c])).toEqual([
      { ...b, notes: 'updated elsewhere', order: 0 },
      { ...c, order: 1 },
      { ...a, time: 'afternoon', order: 2 },
    ]);
  });

  test('rejects before starting a transaction when the item is already gone', async () => {
    (mockOnce as jest.Mock).mockResolvedValue({ val: () => [b, c] });

    await expect(reorderItineraryDayItems('trip-1', 'stop-a', 'day-1', {
      itemId: 'a', toIndex: 1,
    })).rejects.toThrow('Itinerary item no longer exists');
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  test('aborts rather than resurrecting an item removed during the transaction', async () => {
    (mockOnce as jest.Mock)
      .mockResolvedValueOnce({ val: () => [a, b] })
      .mockResolvedValueOnce({ val: () => [b] });
    (mockTransaction as jest.Mock).mockImplementation(async (update: (raw: unknown) => unknown) => ({
      committed: update([b]) !== undefined,
    }));

    await expect(reorderItineraryDayItems('trip-1', 'stop-a', 'day-1', {
      itemId: 'a', toIndex: 1,
    })).rejects.toMatchObject({ reason: 'item-missing' });
  });

  test('retries a null-cache abort after confirming the item still exists', async () => {
    (mockOnce as jest.Mock).mockResolvedValue({ val: () => [a, b, c] });
    (mockTransaction as jest.Mock)
      .mockResolvedValueOnce({ committed: false, snapshot: { val: () => null } })
      .mockImplementationOnce(async (update: (raw: unknown) => unknown) => {
        const value = update([a, b, c]);
        return { committed: value !== undefined, snapshot: { val: () => value } };
      });

    await reorderItineraryDayItems('trip-1', 'stop-a', 'day-1', {
      itemId: 'a', toIndex: 2, time: 'afternoon',
    });

    expect(mockTransaction).toHaveBeenCalledTimes(2);
    expect(mockOnce).toHaveBeenCalledTimes(2);
  });

  test('classifies repeated cache aborts without claiming another device changed the item', async () => {
    (mockOnce as jest.Mock).mockResolvedValue({ val: () => [a, b] });
    (mockTransaction as jest.Mock).mockResolvedValue({
      committed: false, snapshot: { val: () => null },
    });

    await expect(reorderItineraryDayItems('trip-1', 'stop-a', 'day-1', {
      itemId: 'a', toIndex: 1,
    })).rejects.toMatchObject({ reason: 'not-committed' });
    expect(mockTransaction).toHaveBeenCalledTimes(2);
  });

  test('propagates transaction failures', async () => {
    (mockOnce as jest.Mock).mockResolvedValue({ val: () => [a, b] });
    (mockTransaction as jest.Mock).mockRejectedValue(new Error('database/network-error'));

    await expect(reorderItineraryDayItems('trip-1', 'stop-a', 'day-1', {
      itemId: 'a', toIndex: 1,
    })).rejects.toThrow('database/network-error');
  });
});

describe('moveItineraryItemBetweenDays', () => {
  const coffee: ItineraryItem = {
    id: 'coffee', type: 'custom', label: 'Coffee', time: 'morning', order: 0,
  };
  const museum: ItineraryItem = {
    id: 'museum', type: 'custom', label: 'Museum', time: 'afternoon', order: 0,
  };
  const root = {
    'stop-a': {
      'day-1': { id: 'day-1', stopId: 'stop-a', dateIso: '2026-08-10', items: [coffee] },
    },
    'stop-b': {
      'day-2': { id: 'day-2', stopId: 'stop-b', dateIso: '2026-08-11', items: [museum] },
    },
  };

  test('atomically removes from one stop/day and inserts into another', async () => {
    (mockOnce as jest.Mock).mockResolvedValue({ val: () => root });
    (mockTransaction as jest.Mock).mockImplementation(async (update: (raw: unknown) => unknown) => {
      const value = update(root);
      return { committed: value !== undefined, snapshot: { val: () => value } };
    });

    await moveItineraryItemBetweenDays(
      'trip-1',
      { stopId: 'stop-a', dayId: 'day-1' },
      { stopId: 'stop-b', dayId: 'day-2' },
      { itemId: 'coffee', targetItemId: 'museum', afterTarget: true, time: 'afternoon' },
    );

    expect(mockRef).toHaveBeenCalledWith('trips/trip-1/itinerary');
    const update = (mockTransaction as jest.Mock).mock.calls[0][0];
    const result = update(root);
    expect(result['stop-a']['day-1'].items).toEqual([]);
    expect(result['stop-b']['day-2'].items).toEqual([
      { ...museum, order: 0 },
      { ...coffee, time: 'afternoon', order: 1 },
    ]);
    expect(root['stop-a']['day-1'].items).toEqual([coffee]);
  });

  test('aborts safely when the destination day was removed', async () => {
    const missingDestination = { 'stop-a': root['stop-a'] };
    (mockOnce as jest.Mock).mockResolvedValue({ val: () => missingDestination });

    await expect(moveItineraryItemBetweenDays(
      'trip-1',
      { stopId: 'stop-a', dayId: 'day-1' },
      { stopId: 'stop-b', dayId: 'day-2' },
      { itemId: 'coffee', afterTarget: false },
    )).rejects.toMatchObject({ reason: 'destination-missing' });
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  test('never recreates an item removed during the cross-day transaction', async () => {
    const removed = {
      ...root,
      'stop-a': { 'day-1': { ...root['stop-a']['day-1'], items: [] } },
    };
    (mockOnce as jest.Mock)
      .mockResolvedValueOnce({ val: () => root })
      .mockResolvedValueOnce({ val: () => removed });
    (mockTransaction as jest.Mock).mockImplementation(async (update: (raw: unknown) => unknown) => ({
      committed: update(removed) !== undefined,
    }));

    await expect(moveItineraryItemBetweenDays(
      'trip-1',
      { stopId: 'stop-a', dayId: 'day-1' },
      { stopId: 'stop-b', dayId: 'day-2' },
      { itemId: 'coffee', afterTarget: false },
    )).rejects.toMatchObject({ reason: 'item-missing' });
  });
});
