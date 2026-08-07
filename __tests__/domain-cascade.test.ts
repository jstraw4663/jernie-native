import {
  parseBookingsFromSnapshot,
  parseItineraryFromSnapshot,
  buildBookingRemovalUpdates,
} from '@/src/domain/cascade';
import type { Booking, ItineraryDay } from '@/src/types';

// ── parseBookingsFromSnapshot ────────────────────────────────────────────────

describe('parseBookingsFromSnapshot', () => {
  test('null/undefined snapshot value returns an empty array', () => {
    expect(parseBookingsFromSnapshot(null)).toEqual([]);
    expect(parseBookingsFromSnapshot(undefined)).toEqual([]);
  });

  test('converts a keyed record into an array of bookings', () => {
    const raw = {
      'booking-a': { tripId: 't1', stopId: 's1', type: 'hotel', hotelName: 'Press Hotel', checkIn: '2026-07-10', checkOut: '2026-07-12' },
    };
    const result = parseBookingsFromSnapshot(raw);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 'booking-a', hotelName: 'Press Hotel' });
  });

  test('derives id from the RTDB key when the record has no embedded id', () => {
    const raw = { 'key-1': { tripId: 't1', stopId: 's1', type: 'restaurant', restaurantName: 'Eventide', date: '2026-07-10' } };
    const result = parseBookingsFromSnapshot(raw);
    expect(result[0].id).toBe('key-1');
  });

  test('prefers an embedded id over the RTDB key when present', () => {
    const raw = { 'key-1': { id: 'embedded-id', tripId: 't1', stopId: 's1', type: 'restaurant', restaurantName: 'Eventide', date: '2026-07-10' } };
    const result = parseBookingsFromSnapshot(raw);
    expect(result[0].id).toBe('embedded-id');
  });

  test('parses multiple bookings from the snapshot', () => {
    const raw = {
      'a': { tripId: 't1', stopId: 's1', type: 'restaurant', restaurantName: 'Eventide', date: '2026-07-10' },
      'b': { tripId: 't1', stopId: 's1', type: 'hotel', hotelName: 'Press Hotel', checkIn: '2026-07-10', checkOut: '2026-07-12' },
    };
    const result = parseBookingsFromSnapshot(raw);
    expect(result).toHaveLength(2);
    expect(result.map(b => b.id).sort()).toEqual(['a', 'b']);
  });
});

// ── parseItineraryFromSnapshot ───────────────────────────────────────────────

describe('parseItineraryFromSnapshot', () => {
  test('null/undefined snapshot value returns an empty object', () => {
    expect(parseItineraryFromSnapshot(null)).toEqual({});
    expect(parseItineraryFromSnapshot(undefined)).toEqual({});
  });

  test('converts nested stopId -> dayKey -> day records into stopId -> ItineraryDay[]', () => {
    const raw = {
      'stop-a': {
        'day-1': { stopId: 'stop-a', dateIso: '2026-07-10', items: [] },
      },
    };
    const result = parseItineraryFromSnapshot(raw);
    expect(result['stop-a']).toHaveLength(1);
    expect(result['stop-a'][0]).toMatchObject({ id: 'day-1', dateIso: '2026-07-10', items: [] });
  });

  test('derives day id from the RTDB key when missing, prefers embedded id when present', () => {
    const raw = {
      'stop-a': {
        'key-1': { stopId: 'stop-a', dateIso: '2026-07-10', items: [] },
        'key-2': { id: 'embedded-day', stopId: 'stop-a', dateIso: '2026-07-11', items: [] },
      },
    };
    const result = parseItineraryFromSnapshot(raw);
    const byId = Object.fromEntries(result['stop-a'].map(d => [d.dateIso, d.id]));
    expect(byId['2026-07-10']).toBe('key-1');
    expect(byId['2026-07-11']).toBe('embedded-day');
  });

  test('handles multiple stops, each with multiple days', () => {
    const raw = {
      'stop-a': { 'day-1': { stopId: 'stop-a', dateIso: '2026-07-10', items: [] } },
      'stop-b': {
        'day-2': { stopId: 'stop-b', dateIso: '2026-07-11', items: [] },
        'day-3': { stopId: 'stop-b', dateIso: '2026-07-12', items: [] },
      },
    };
    const result = parseItineraryFromSnapshot(raw);
    expect(Object.keys(result).sort()).toEqual(['stop-a', 'stop-b']);
    expect(result['stop-a']).toHaveLength(1);
    expect(result['stop-b']).toHaveLength(2);
  });
});

// ── buildBookingRemovalUpdates ───────────────────────────────────────────────

describe('buildBookingRemovalUpdates', () => {
  test('includes the booking-null deletion key', () => {
    const updates = buildBookingRemovalUpdates('trip-1', 'booking-1', {});
    expect(updates['trips/trip-1/bookings/booking-1']).toBeNull();
  });

  test('no-itinerary-refs case: returns just the single deletion key', () => {
    const updates = buildBookingRemovalUpdates('trip-1', 'booking-1', {});
    expect(Object.keys(updates)).toEqual(['trips/trip-1/bookings/booking-1']);
  });

  test('no-itinerary-refs case with days present but none referencing the booking: still just the single deletion key', () => {
    const itinerary: Record<string, ItineraryDay[]> = {
      'stop-a': [
        { id: 'day-1', stopId: 'stop-a', dateIso: '2026-07-10', items: [{ id: 'item-1', type: 'place', placeId: 'p1', order: 0 }] },
      ],
    };
    const updates = buildBookingRemovalUpdates('trip-1', 'booking-1', itinerary);
    expect(Object.keys(updates)).toEqual(['trips/trip-1/bookings/booking-1']);
  });

  test('rewrites only the day containing a matching item, filtering that item out', () => {
    const matchingItem = { id: 'item-1', type: 'booking' as const, bookingId: 'booking-1', order: 0 };
    const otherItem = { id: 'item-2', type: 'custom' as const, label: 'Sleep in', order: 1 };
    const itinerary: Record<string, ItineraryDay[]> = {
      'stop-a': [
        { id: 'day-1', stopId: 'stop-a', dateIso: '2026-07-10', items: [matchingItem, otherItem] },
      ],
    };
    const updates = buildBookingRemovalUpdates('trip-1', 'booking-1', itinerary);
    const key = 'trips/trip-1/itinerary/stop-a/day-1/items';
    expect(updates[key]).toEqual([otherItem]);
  });

  test('leaves non-matching days completely untouched — no update key emitted for an untouched day', () => {
    const matchingItem = { id: 'item-1', type: 'booking' as const, bookingId: 'booking-1', order: 0 };
    const untouchedItem = { id: 'item-2', type: 'custom' as const, label: 'Sleep in', order: 0 };
    const itinerary: Record<string, ItineraryDay[]> = {
      'stop-a': [
        { id: 'day-1', stopId: 'stop-a', dateIso: '2026-07-10', items: [matchingItem] },
        { id: 'day-2', stopId: 'stop-a', dateIso: '2026-07-11', items: [untouchedItem] },
      ],
    };
    const updates = buildBookingRemovalUpdates('trip-1', 'booking-1', itinerary);
    expect(updates).toHaveProperty('trips/trip-1/itinerary/stop-a/day-1/items');
    expect(updates).not.toHaveProperty('trips/trip-1/itinerary/stop-a/day-2/items');
  });

  test('scans across multiple stops, not just the first one', () => {
    const matchInStopA = { id: 'item-1', type: 'booking' as const, bookingId: 'booking-1', order: 0 };
    const matchInStopB = { id: 'item-2', type: 'booking' as const, bookingId: 'booking-1', order: 0 };
    const untouchedInStopC = { id: 'item-3', type: 'custom' as const, label: 'x', order: 0 };
    const itinerary: Record<string, ItineraryDay[]> = {
      'stop-a': [{ id: 'day-1', stopId: 'stop-a', dateIso: '2026-07-10', items: [matchInStopA] }],
      'stop-b': [{ id: 'day-2', stopId: 'stop-b', dateIso: '2026-07-11', items: [matchInStopB] }],
      'stop-c': [{ id: 'day-3', stopId: 'stop-c', dateIso: '2026-07-12', items: [untouchedInStopC] }],
    };
    const updates = buildBookingRemovalUpdates('trip-1', 'booking-1', itinerary);
    expect(Object.keys(updates).sort()).toEqual([
      'trips/trip-1/bookings/booking-1',
      'trips/trip-1/itinerary/stop-a/day-1/items',
      'trips/trip-1/itinerary/stop-b/day-2/items',
    ].sort());
    expect(updates['trips/trip-1/itinerary/stop-a/day-1/items']).toEqual([]);
    expect(updates['trips/trip-1/itinerary/stop-b/day-2/items']).toEqual([]);
    expect(updates).not.toHaveProperty('trips/trip-1/itinerary/stop-c/day-3/items');
  });

  test('removes only the matching item, preserving order/position of remaining items in that day', () => {
    const before = { id: 'item-1', type: 'custom' as const, label: 'Before', order: 0 };
    const matching = { id: 'item-2', type: 'booking' as const, bookingId: 'booking-1', order: 1 };
    const after = { id: 'item-3', type: 'custom' as const, label: 'After', order: 2 };
    const itinerary: Record<string, ItineraryDay[]> = {
      'stop-a': [{ id: 'day-1', stopId: 'stop-a', dateIso: '2026-07-10', items: [before, matching, after] }],
    };
    const updates = buildBookingRemovalUpdates('trip-1', 'booking-1', itinerary);
    expect(updates['trips/trip-1/itinerary/stop-a/day-1/items']).toEqual([before, after]);
  });
});
