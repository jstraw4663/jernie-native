import { buildBatchCommit } from '@/src/domain/batchCommit';
import type { Candidate } from '@/src/domain/candidate';
import type { ItineraryDay } from '@/src/types';

let counter = 0;
const fakeId = () => `id-${++counter}`;
beforeEach(() => { counter = 0; });

const STOP = 'stop-bar-harbor';
const DAY = '2026-09-27';

function itineraryWithDay(items: ItineraryDay['items'] = []): Record<string, ItineraryDay[]> {
  return { [STOP]: [{ id: 'day-4', stopId: STOP, dateIso: DAY, items }] };
}

function candidate(overrides: Partial<Candidate> = {}): Candidate {
  return {
    id: 'cand-1',
    type: 'eat',
    typeConfidence: 'guessed',
    identity: { name: "Thurston's Lobster Pound", subtitle: 'Seafood', icon: 'fork-knife' },
    fields: [],
    commit: {
      target: 'booking',
      booking: {
        stopId: STOP, type: 'restaurant',
        restaurantName: "Thurston's Lobster Pound", date: DAY,
      },
      item: { stopId: STOP, dateIso: DAY, label: "Thurston's Lobster Pound", category: 'restaurant' },
    },
    ...overrides,
  };
}

function build(candidates: Candidate[], itinerary = itineraryWithDay()) {
  return buildBatchCommit({ tripId: 'trip-1', candidates, itinerary, generateId: fakeId });
}

describe('buildBatchCommit — one candidate', () => {
  test('writes the booking and an itinerary item that references it', () => {
    const { updates } = build([candidate()]);

    const bookingPath = Object.keys(updates).find(p => p.includes('/bookings/'))!;
    const bookingId = bookingPath.split('/').pop();

    expect(updates[bookingPath]).toMatchObject({
      type: 'restaurant',
      restaurantName: "Thurston's Lobster Pound",
      tripId: 'trip-1',
    });

    const items = updates[`trips/trip-1/itinerary/${STOP}/day-4/items`] as ItineraryDay['items'];
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ type: 'booking', bookingId, order: 0 });
  });

  test('writes a place and an item that references it', () => {
    const { updates } = build([candidate({
      type: 'do',
      commit: {
        target: 'place',
        place: {
          stopId: STOP, name: 'Cadillac Mountain', category: 'activity',
          must: false, source: 'community', addedBy: 'uid-jeremy',
          lat: 44.3517, lon: -68.2253,
        },
        item: { stopId: STOP, dateIso: DAY, label: 'Cadillac Mountain', category: 'activity' },
      },
    })]);

    const placePath = Object.keys(updates).find(p => p.includes('/places/'))!;
    const placeId = placePath.split('/').pop();

    expect(updates[placePath]).toMatchObject({ name: 'Cadillac Mountain', tripId: 'trip-1' });

    const items = updates[`trips/trip-1/itinerary/${STOP}/day-4/items`] as ItineraryDay['items'];
    expect(items[0]).toMatchObject({ type: 'place', placeId });
  });

  test('a custom candidate writes only an itinerary item', () => {
    const { updates } = build([candidate({
      commit: {
        target: 'custom',
        item: { stopId: STOP, dateIso: DAY, label: 'Grandmas kayak place', category: 'activity' },
      },
    })]);

    expect(Object.keys(updates)).toEqual([`trips/trip-1/itinerary/${STOP}/day-4/items`]);

    const items = updates[`trips/trip-1/itinerary/${STOP}/day-4/items`] as ItineraryDay['items'];
    expect(items[0]).toMatchObject({ type: 'custom', label: 'Grandmas kayak place' });
    expect(items[0]).not.toHaveProperty('bookingId');
  });

  test('appends after whatever the day already held', () => {
    const existing = [{ id: 'i0', type: 'custom' as const, label: 'Breakfast', order: 0 }];
    const { updates } = build([candidate()], itineraryWithDay(existing));

    const items = updates[`trips/trip-1/itinerary/${STOP}/day-4/items`] as ItineraryDay['items'];
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ id: 'i0' });
    expect(items[1]).toMatchObject({ order: 1 });
  });
});

// "Add 3 items writes once and offers one undo, not three toasts."
describe('buildBatchCommit — a tray of several', () => {
  test('two items on the same day accumulate into ONE items write', () => {
    const flight = candidate({
      type: 'flight',
      commit: {
        target: 'custom',
        item: { stopId: STOP, dateIso: DAY, label: 'Delta 2214', category: 'flight' },
      },
    });

    const { updates } = build([flight, candidate()]);

    const itemPaths = Object.keys(updates).filter(p => p.endsWith('/items'));
    expect(itemPaths).toHaveLength(1);

    const items = updates[itemPaths[0]] as ItineraryDay['items'];
    expect(items.map(i => i.label)).toEqual(['Delta 2214', "Thurston's Lobster Pound"]);
    expect(items.map(i => i.order)).toEqual([0, 1]);
  });

  test('items on different days write to their own days', () => {
    const itinerary: Record<string, ItineraryDay[]> = {
      [STOP]: [
        { id: 'day-4', stopId: STOP, dateIso: DAY, items: [] },
        { id: 'day-5', stopId: STOP, dateIso: '2026-09-28', items: [] },
      ],
    };

    const nextDay = candidate({
      commit: {
        target: 'custom',
        item: { stopId: STOP, dateIso: '2026-09-28', label: 'Sunrise', category: 'activity' },
      },
    });

    const { updates } = build([candidate(), nextDay], itinerary);

    expect(Object.keys(updates).filter(p => p.endsWith('/items')).sort()).toEqual([
      `trips/trip-1/itinerary/${STOP}/day-4/items`,
      `trips/trip-1/itinerary/${STOP}/day-5/items`,
    ]);
  });

  test('creates the day row when the target date has none', () => {
    const { updates } = build([candidate()], { [STOP]: [] });

    const dayPath = Object.keys(updates).find(p => p.includes('/itinerary/') && !p.endsWith('/items'))!;
    expect(updates[dayPath]).toMatchObject({ stopId: STOP, dateIso: DAY });
    expect((updates[dayPath] as ItineraryDay).items).toHaveLength(1);
  });

  test('an empty tray writes nothing', () => {
    expect(build([]).updates).toEqual({});
  });
});

describe('buildBatchCommit — undo', () => {
  test('the inverse removes every node the batch created', () => {
    const { updates, inverse } = build([candidate()]);

    const bookingPath = Object.keys(updates).find(p => p.includes('/bookings/'))!;
    expect(inverse[bookingPath]).toBeNull();
  });

  test('the inverse restores the items array exactly as it was', () => {
    const existing = [{ id: 'i0', type: 'custom' as const, label: 'Breakfast', order: 0 }];
    const { inverse } = build([candidate()], itineraryWithDay(existing));

    expect(inverse[`trips/trip-1/itinerary/${STOP}/day-4/items`]).toEqual(existing);
  });

  test('the inverse removes a day row the batch had to create', () => {
    const { updates, inverse } = build([candidate()], { [STOP]: [] });

    const dayPath = Object.keys(updates).find(p => p.includes('/itinerary/') && !p.endsWith('/items'))!;
    expect(inverse[dayPath]).toBeNull();
  });

  test('the inverse touches exactly the paths the batch wrote', () => {
    const { updates, inverse } = build([candidate()]);

    expect(Object.keys(inverse).sort()).toEqual(Object.keys(updates).sort());
  });
});
