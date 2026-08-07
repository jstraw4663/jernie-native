import {
  parseBookingsFromSnapshot,
  parseItineraryFromSnapshot,
  parsePlacesFromSnapshot,
  buildBookingRemovalUpdates,
  buildStopRemovalUpdates,
  type CascadeCollections,
} from '@/src/domain/cascade';
import type { Booking, ItineraryDay, Place, RentalBooking } from '@/src/types';

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

// ── parsePlacesFromSnapshot ──────────────────────────────────────────────────

describe('parsePlacesFromSnapshot', () => {
  test('null/undefined snapshot value returns an empty array', () => {
    expect(parsePlacesFromSnapshot(null)).toEqual([]);
    expect(parsePlacesFromSnapshot(undefined)).toEqual([]);
  });

  test('converts a keyed record into an array of places', () => {
    const raw = {
      'place-a': { tripId: 't1', stopId: 's1', name: 'Eventide', category: 'restaurant', must: true, source: 'curator', addedBy: 'uid-1' },
    };
    const result = parsePlacesFromSnapshot(raw);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 'place-a', name: 'Eventide' });
  });

  test('derives id from the RTDB key when the record has no embedded id', () => {
    const raw = { 'key-1': { tripId: 't1', stopId: 's1', name: 'Portland Head Light', category: 'sight', must: false, source: 'curator', addedBy: 'uid-1' } };
    const result = parsePlacesFromSnapshot(raw);
    expect(result[0].id).toBe('key-1');
  });

  test('prefers an embedded id over the RTDB key when present', () => {
    const raw = { 'key-1': { id: 'embedded-id', tripId: 't1', stopId: 's1', name: 'Portland Head Light', category: 'sight', must: false, source: 'curator', addedBy: 'uid-1' } };
    const result = parsePlacesFromSnapshot(raw);
    expect(result[0].id).toBe('embedded-id');
  });

  test('parses multiple places from the snapshot', () => {
    const raw = {
      'a': { tripId: 't1', stopId: 's1', name: 'Eventide', category: 'restaurant', must: true, source: 'curator', addedBy: 'uid-1' },
      'b': { tripId: 't1', stopId: 's1', name: 'Portland Head Light', category: 'sight', must: false, source: 'curator', addedBy: 'uid-1' },
    };
    const result = parsePlacesFromSnapshot(raw);
    expect(result).toHaveLength(2);
    expect(result.map(p => p.id).sort()).toEqual(['a', 'b']);
  });
});

// ── buildStopRemovalUpdates ──────────────────────────────────────────────────

describe('buildStopRemovalUpdates', () => {
  const emptyData: CascadeCollections = { bookings: [], itinerary: {}, places: [] };

  test('always includes the stop-null and itinerary-subtree-null deletion keys', () => {
    const updates = buildStopRemovalUpdates('trip-1', 'stop-remove', emptyData);
    expect(updates['trips/trip-1/stops/stop-remove']).toBeNull();
    expect(updates['trips/trip-1/itinerary/stop-remove']).toBeNull();
  });

  test('empty bookings/itinerary/places collections does not throw and returns just the two base deletion keys', () => {
    const updates = buildStopRemovalUpdates('trip-1', 'stop-remove', emptyData);
    expect(Object.keys(updates).sort()).toEqual([
      'trips/trip-1/itinerary/stop-remove',
      'trips/trip-1/stops/stop-remove',
    ]);
  });

  test('only bookings whose stopId matches the removed stop get null-ed; other bookings are left untouched (no key at all)', () => {
    const bookingAtStop: Booking = {
      id: 'booking-1', tripId: 't1', stopId: 'stop-remove', type: 'restaurant', restaurantName: 'Eventide', date: '2026-07-10',
    };
    const bookingElsewhere: Booking = {
      id: 'booking-2', tripId: 't1', stopId: 'stop-b', type: 'restaurant', restaurantName: 'Fore Street', date: '2026-07-11',
    };
    const data: CascadeCollections = { bookings: [bookingAtStop, bookingElsewhere], itinerary: {}, places: [] };

    const updates = buildStopRemovalUpdates('trip-1', 'stop-remove', data);

    expect(updates['trips/trip-1/bookings/booking-1']).toBeNull();
    expect('trips/trip-1/bookings/booking-2' in updates).toBe(false);
  });

  test('a rental whose stopId points elsewhere but dropoffStopId matches the removed stop is NOT deleted — only stopId (pickup) triggers deletion', () => {
    const rentalPickedUpHere: RentalBooking = {
      id: 'booking-r1', tripId: 't1', stopId: 'stop-remove', type: 'rental', company: 'Enterprise',
      pickupDate: '2026-07-10', dropoffDate: '2026-07-15', pickupLocation: 'Portland Jetport', dropoffLocation: 'Bar Harbor',
      dropoffStopId: 'stop-b',
    };
    const rentalDroppedOffHere: RentalBooking = {
      id: 'booking-r2', tripId: 't1', stopId: 'stop-b', type: 'rental', company: 'Hertz',
      pickupDate: '2026-07-09', dropoffDate: '2026-07-14', pickupLocation: 'Bangor', dropoffLocation: 'Portland Jetport',
      dropoffStopId: 'stop-remove',
    };
    const data: CascadeCollections = { bookings: [rentalPickedUpHere, rentalDroppedOffHere], itinerary: {}, places: [] };

    const updates = buildStopRemovalUpdates('trip-1', 'stop-remove', data);

    expect(updates['trips/trip-1/bookings/booking-r1']).toBeNull();
    expect('trips/trip-1/bookings/booking-r2' in updates).toBe(false);
  });

  test('only places whose stopId matches the removed stop get null-ed; other places are left untouched (no key at all)', () => {
    const placeAtStop: Place = {
      id: 'place-1', tripId: 't1', stopId: 'stop-remove', name: 'Duckfat', category: 'restaurant', must: true, source: 'curator', addedBy: 'uid-1',
    };
    const placeElsewhere: Place = {
      id: 'place-2', tripId: 't1', stopId: 'stop-b', name: 'Cadillac Mountain', category: 'hike', must: true, source: 'curator', addedBy: 'uid-1',
    };
    const data: CascadeCollections = { bookings: [], itinerary: {}, places: [placeAtStop, placeElsewhere] };

    const updates = buildStopRemovalUpdates('trip-1', 'stop-remove', data);

    expect(updates['trips/trip-1/places/place-1']).toBeNull();
    expect('trips/trip-1/places/place-2' in updates).toBe(false);
  });

  test('orphan cleanup fires in a SURVIVING stop day for an item referencing a just-deleted booking id', () => {
    const bookingAtStop: Booking = {
      id: 'booking-1', tripId: 't1', stopId: 'stop-remove', type: 'restaurant', restaurantName: 'Eventide', date: '2026-07-10',
    };
    const matchingItem = { id: 'item-1', type: 'booking' as const, bookingId: 'booking-1', order: 0 };
    const otherItem = { id: 'item-2', type: 'custom' as const, label: 'Sleep in', order: 1 };
    const data: CascadeCollections = {
      bookings: [bookingAtStop],
      itinerary: {
        'stop-b': [{ id: 'day-1', stopId: 'stop-b', dateIso: '2026-07-11', items: [matchingItem, otherItem] }],
      },
      places: [],
    };

    const updates = buildStopRemovalUpdates('trip-1', 'stop-remove', data);

    expect(updates['trips/trip-1/itinerary/stop-b/day-1/items']).toEqual([otherItem]);
  });

  test('orphan cleanup fires in a SURVIVING stop day for an item referencing a just-deleted place id', () => {
    const placeAtStop: Place = {
      id: 'place-1', tripId: 't1', stopId: 'stop-remove', name: 'Duckfat', category: 'restaurant', must: true, source: 'curator', addedBy: 'uid-1',
    };
    const matchingItem = { id: 'item-1', type: 'place' as const, placeId: 'place-1', order: 0 };
    const otherItem = { id: 'item-2', type: 'custom' as const, label: 'Sleep in', order: 1 };
    const data: CascadeCollections = {
      bookings: [],
      itinerary: {
        'stop-b': [{ id: 'day-1', stopId: 'stop-b', dateIso: '2026-07-11', items: [matchingItem, otherItem] }],
      },
      places: [placeAtStop],
    };

    const updates = buildStopRemovalUpdates('trip-1', 'stop-remove', data);

    expect(updates['trips/trip-1/itinerary/stop-b/day-1/items']).toEqual([otherItem]);
  });

  test('a day with no orphaned refs gets no update key at all', () => {
    const untouchedItem = { id: 'item-1', type: 'custom' as const, label: 'Sleep in', order: 0 };
    const data: CascadeCollections = {
      bookings: [],
      itinerary: {
        'stop-b': [{ id: 'day-1', stopId: 'stop-b', dateIso: '2026-07-11', items: [untouchedItem] }],
      },
      places: [],
    };

    const updates = buildStopRemovalUpdates('trip-1', 'stop-remove', data);

    expect('trips/trip-1/itinerary/stop-b/day-1/items' in updates).toBe(false);
  });

  test('does not emit per-day item keys for the removed stops own itinerary subtree (already wiped wholesale by the base key)', () => {
    const bookingAtStop: Booking = {
      id: 'booking-1', tripId: 't1', stopId: 'stop-remove', type: 'restaurant', restaurantName: 'Eventide', date: '2026-07-10',
    };
    const itemInRemovedStop = { id: 'item-1', type: 'booking' as const, bookingId: 'booking-1', order: 0 };
    const data: CascadeCollections = {
      bookings: [bookingAtStop],
      itinerary: {
        'stop-remove': [{ id: 'day-1', stopId: 'stop-remove', dateIso: '2026-07-10', items: [itemInRemovedStop] }],
      },
      places: [],
    };

    const updates = buildStopRemovalUpdates('trip-1', 'stop-remove', data);

    expect('trips/trip-1/itinerary/stop-remove/day-1/items' in updates).toBe(false);
    // the whole subtree is still nulled via the base key
    expect(updates['trips/trip-1/itinerary/stop-remove']).toBeNull();
  });

  test('realistic multi-stop/multi-booking/multi-place fixture: exact update-object shape', () => {
    const rentalHere: RentalBooking = {
      id: 'booking-r1', tripId: 't1', stopId: 'stop-remove', type: 'rental', company: 'Enterprise',
      pickupDate: '2026-07-10', dropoffDate: '2026-07-15', pickupLocation: 'Portland Jetport', dropoffLocation: 'Bar Harbor',
      dropoffStopId: 'stop-b',
    };
    const restaurantElsewhere: Booking = {
      id: 'booking-x', tripId: 't1', stopId: 'stop-b', type: 'restaurant', restaurantName: 'Fore Street', date: '2026-07-11',
    };
    const placeHere: Place = {
      id: 'place-1', tripId: 't1', stopId: 'stop-remove', name: 'Duckfat', category: 'restaurant', must: true, source: 'curator', addedBy: 'uid-1',
    };
    const placeElsewhere: Place = {
      id: 'place-2', tripId: 't1', stopId: 'stop-b', name: 'Cadillac Mountain', category: 'hike', must: true, source: 'curator', addedBy: 'uid-1',
    };

    // stop-b: dropoff item for the rental (references the deleted booking) + an untouched custom item
    const dropoffItem = { id: 'item-1', type: 'booking' as const, bookingId: 'booking-r1', order: 0 };
    const keepItem = { id: 'item-2', type: 'custom' as const, label: 'Explore downtown', order: 1 };

    const data: CascadeCollections = {
      bookings: [rentalHere, restaurantElsewhere],
      itinerary: {
        'stop-remove': [{ id: 'day-0', stopId: 'stop-remove', dateIso: '2026-07-10', items: [{ id: 'item-0', type: 'booking' as const, bookingId: 'booking-r1', order: 0 }] }],
        'stop-b': [{ id: 'day-1', stopId: 'stop-b', dateIso: '2026-07-11', items: [dropoffItem, keepItem] }],
      },
      places: [placeHere, placeElsewhere],
    };

    const updates = buildStopRemovalUpdates('trip-1', 'stop-remove', data);

    expect(updates).toEqual({
      'trips/trip-1/stops/stop-remove': null,
      'trips/trip-1/itinerary/stop-remove': null,
      'trips/trip-1/bookings/booking-r1': null,
      'trips/trip-1/places/place-1': null,
      'trips/trip-1/itinerary/stop-b/day-1/items': [keepItem],
    });
  });
});
