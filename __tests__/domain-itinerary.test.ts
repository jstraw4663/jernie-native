import {
  buildCustomItineraryItem, itineraryMoveForDrop, moveItineraryItemBetweenDays,
  reorderItineraryItems,
} from '@/src/domain/itinerary';
import type { ItineraryItem } from '@/src/types';

describe('buildCustomItineraryItem', () => {
  test('order is 0 for an empty day', () => {
    const item = buildCustomItineraryItem({ label: 'Sleep in' }, [], 'item-1');
    expect(item.order).toBe(0);
  });

  test('order is max(existing order) + 1 for a non-empty day', () => {
    const existing: ItineraryItem[] = [
      { id: 'a', type: 'custom', label: 'A', order: 0 },
      { id: 'b', type: 'custom', label: 'B', order: 3 },
    ];
    const item = buildCustomItineraryItem({ label: 'Sleep in' }, existing, 'item-1');
    expect(item.order).toBe(4);
  });

  test('order calc is gap-tolerant (does not just use existingItems.length)', () => {
    const existing: ItineraryItem[] = [
      { id: 'a', type: 'custom', label: 'A', order: 0 },
      { id: 'b', type: 'custom', label: 'B', order: 10 },
    ];
    const item = buildCustomItineraryItem({ label: 'Sleep in' }, existing, 'item-1');
    expect(item.order).toBe(11);
  });

  test('always sets type: custom', () => {
    const item = buildCustomItineraryItem({ label: 'Sleep in' }, [], 'item-1');
    expect(item.type).toBe('custom');
  });

  test('always sets the supplied id and label', () => {
    const item = buildCustomItineraryItem({ label: 'Nap time' }, [], 'item-42');
    expect(item.id).toBe('item-42');
    expect(item.label).toBe('Nap time');
  });

  test('omitted optional fields (time/category/notes) are absent from the built item, not just undefined', () => {
    const item = buildCustomItineraryItem({ label: 'Sleep in' }, [], 'item-1');
    expect('time' in item).toBe(false);
    expect('category' in item).toBe(false);
    expect('notes' in item).toBe(false);
  });

  test('provided optional fields (time/category/notes) are present and carried through', () => {
    const item = buildCustomItineraryItem(
      { label: 'Museum', time: '10:00', category: 'sight', notes: 'bring student ID' },
      [],
      'item-1',
    );
    expect(item.time).toBe('10:00');
    expect(item.category).toBe('sight');
    expect(item.notes).toBe('bring student ID');
  });
});

describe('reorderItineraryItems', () => {
  const a: ItineraryItem = { id: 'a', type: 'custom', label: 'A', time: 'morning', order: 0 };
  const b: ItineraryItem = { id: 'b', type: 'custom', label: 'B', time: '2:00 PM', order: 4 };
  const c: ItineraryItem = { id: 'c', type: 'custom', label: 'C', order: 9 };

  test('moves within the canonical stored order and normalizes every order value', () => {
    expect(reorderItineraryItems([c, a, b], { itemId: 'a', toIndex: 2 })).toEqual([
      { ...b, order: 0 },
      { ...c, order: 1 },
      { ...a, order: 2 },
    ]);
  });

  test('can move into another time band without mutating the source item', () => {
    const original = [a, b, c];
    const result = reorderItineraryItems(original, {
      itemId: 'a', toIndex: 1, time: 'afternoon',
    });

    expect(result.map(item => item.id)).toEqual(['b', 'a', 'c']);
    expect(result[1]).toMatchObject({ id: 'a', time: 'afternoon', order: 1 });
    expect(a).toMatchObject({ time: 'morning', order: 0 });
    expect(original).toEqual([a, b, c]);
  });

  test('null time explicitly moves an item to Unscheduled and removes the stored field', () => {
    const [result] = reorderItineraryItems([a], { itemId: 'a', toIndex: 0, time: null });
    expect('time' in result).toBe(false);
  });

  test('clamps out-of-range drop indexes', () => {
    expect(reorderItineraryItems([a, b, c], { itemId: 'c', toIndex: -20 }).map(item => item.id))
      .toEqual(['c', 'a', 'b']);
    expect(reorderItineraryItems([a, b, c], { itemId: 'a', toIndex: 20 }).map(item => item.id))
      .toEqual(['b', 'c', 'a']);
  });

  test('rejects a stale item id instead of silently rewriting the day', () => {
    expect(() => reorderItineraryItems([a, b], { itemId: 'missing', toIndex: 0 }))
      .toThrow('Itinerary item no longer exists');
  });
});

describe('moveItineraryItemBetweenDays', () => {
  test('removes from the source, inserts at the destination anchor, and normalizes both days', () => {
    const source = [
      { id: 'coffee', type: 'custom', label: 'Coffee', time: 'morning', order: 4 },
      { id: 'walk', type: 'custom', label: 'Walk', order: 8 },
    ] as ItineraryItem[];
    const destination = [
      { id: 'museum', type: 'custom', label: 'Museum', time: 'afternoon', order: 3 },
      { id: 'dinner', type: 'custom', label: 'Dinner', time: 'evening', order: 7 },
    ] as ItineraryItem[];

    const result = moveItineraryItemBetweenDays(source, destination, {
      itemId: 'coffee', targetItemId: 'dinner', afterTarget: false, time: 'evening',
    });

    expect(result.sourceItems).toEqual([{ ...source[1], order: 0 }]);
    expect(result.destinationItems).toEqual([
      { ...destination[0], order: 0 },
      { ...source[0], time: 'evening', order: 1 },
      { ...destination[1], order: 2 },
    ]);
    expect(source).toHaveLength(2);
    expect(destination).toHaveLength(2);
  });

  test('uses band ordering for an empty destination band and can make the item unscheduled', () => {
    const source = [
      { id: 'coffee', type: 'custom', label: 'Coffee', time: 'morning', order: 0 },
    ] as ItineraryItem[];
    const destination = [
      { id: 'museum', type: 'custom', label: 'Museum', time: 'afternoon', order: 0 },
    ] as ItineraryItem[];

    const result = moveItineraryItemBetweenDays(source, destination, {
      itemId: 'coffee', afterTarget: false, time: null,
    });

    expect(result.sourceItems).toEqual([]);
    expect(result.destinationItems).toEqual([
      { ...destination[0], order: 0 },
      { id: 'coffee', type: 'custom', label: 'Coffee', order: 1 },
    ]);
  });
});

describe('itineraryMoveForDrop', () => {
  const items: ItineraryItem[] = [
    { id: 'breakfast', type: 'custom', label: 'Breakfast', time: '8:00 AM', order: 0 },
    { id: 'museum', type: 'custom', label: 'Museum', time: '10:00 AM', order: 1 },
    { id: 'dinner', type: 'custom', label: 'Dinner', time: '6:00 PM', order: 2 },
  ];

  test('anchors before a real target in the canonical persisted array', () => {
    expect(itineraryMoveForDrop(items, {
      itemId: 'dinner', targetItemId: 'museum', afterTarget: false, time: '10:00 AM',
    })).toEqual({ itemId: 'dinner', toIndex: 1, time: '10:00 AM' });
  });

  test('anchors after a target after first removing the dragged item', () => {
    expect(itineraryMoveForDrop(items, {
      itemId: 'breakfast', targetItemId: 'dinner', afterTarget: true, time: '6:00 PM',
    })).toEqual({ itemId: 'breakfast', toIndex: 2, time: '6:00 PM' });
  });

  test('places an empty-band drop using timeline band ordering', () => {
    expect(itineraryMoveForDrop(items, {
      itemId: 'breakfast', afterTarget: false, time: 'afternoon',
    })).toEqual({ itemId: 'breakfast', toIndex: 1, time: 'afternoon' });
  });

  test('puts an Unscheduled empty-band drop after timed plans', () => {
    expect(itineraryMoveForDrop(items, {
      itemId: 'museum', afterTarget: false, time: null,
    })).toEqual({ itemId: 'museum', toIndex: 2, time: null });
  });
});
