import { buildCustomItineraryItem } from '@/src/domain/itinerary';
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
