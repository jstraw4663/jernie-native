import {
  buildAgenda, formatClock, groupByDay, groupByRole, groupByStop, minutesOf, UNTIMED,
  type AgendaInput,
} from '@/src/domain/agenda';
import type { Booking, ItineraryDay, ItineraryItem, Place } from '@/src/types';

const STOPS = [
  { id: 'stop-a', city: 'Portland' },
  { id: 'stop-b', city: 'Bar Harbor' },
];

const BOOKINGS: Booking[] = [
  {
    id: 'f1', tripId: 't', stopId: 'stop-a', type: 'flight', confirmationCode: 'ABC123',
    legs: [{
      flightNumber: '2412', airline: 'Delta', origin: 'BOS', destination: 'PWM',
      departureDate: '2026-05-22', departureTime: '7:15 AM', arrivalTime: '8:22 AM',
    }],
  },
  {
    id: 'h1', tripId: 't', stopId: 'stop-a', type: 'hotel', hotelName: 'The Press Hotel',
    checkIn: '2026-05-22', checkOut: '2026-05-24', confirmationCode: 'PH99',
  },
  {
    id: 'r1', tripId: 't', stopId: 'stop-a', type: 'rental', company: 'Hertz', carType: 'midsize SUV',
    pickupDate: '2026-05-24', pickupTime: '9:00 AM', dropoffDate: '2026-05-27',
    pickupLocation: 'Portland', dropoffLocation: 'Bar Harbor',
  },
];

function day(stopId: string, dateIso: string, items: Partial<ItineraryItem>[]): ItineraryDay {
  return {
    id: `${stopId}-${dateIso}`,
    stopId,
    dateIso,
    items: items.map((i, n) => ({ id: `${dateIso}-${n}`, type: 'custom', order: n, ...i }) as ItineraryItem),
  };
}

const PLACE: Place = {
  id: 'p1', tripId: 't', stopId: 'stop-b', name: 'Jordan Pond House', category: 'restaurant',
  must: true, source: 'curator', addedBy: 'u', curatorNote: 'Popovers on the lawn',
};

const build = (over: Partial<AgendaInput> = {}) => buildAgenda({
  stops: STOPS, bookings: BOOKINGS, itinerary: {}, places: [], enrichment: {}, ...over,
});

describe('formatClock', () => {
  test('accepts every spelling the app writes and returns a fixed-width 24h string', () => {
    expect(formatClock('7:15 AM')).toBe('07:15');
    expect(formatClock('7:30 PM')).toBe('19:30');
    expect(formatClock('12:00 AM')).toBe('00:00');
    expect(formatClock('12:30 PM')).toBe('12:30');
    expect(formatClock('19:30')).toBe('19:30');
    expect(formatClock('07:15')).toBe('07:15');
  });

  test('anything unparseable is no time at all, never a wrong one', () => {
    expect(formatClock(undefined)).toBeUndefined();
    expect(formatClock('')).toBeUndefined();
    expect(formatClock('sometime')).toBeUndefined();
    expect(formatClock('25:00')).toBeUndefined();
    expect(formatClock('7:99')).toBeUndefined();
  });

  test('untimed sorts last within its day', () => {
    expect(minutesOf('7:15 AM')).toBe(435);
    expect(minutesOf(undefined)).toBe(UNTIMED);
    expect(minutesOf('nonsense')).toBe(UNTIMED);
  });
});

describe('buildAgenda', () => {
  test('every booking becomes a row, whether or not it is on the itinerary', () => {
    // This is the whole reason Agenda exists — home is day-by-day and cannot show these.
    // Ordered: the stay heads its check-in day, then the flight at 07:15, then the 24th.
    expect(build().map(e => e.source)).toEqual([
      { kind: 'booking', bookingId: 'h1' },
      { kind: 'booking', bookingId: 'f1' },
      { kind: 'booking', bookingId: 'r1' },
    ]);
  });

  test('a booking referenced from the itinerary appears once', () => {
    const entries = build({
      itinerary: { 'stop-a': [day('stop-a', '2026-05-22', [{ type: 'booking', bookingId: 'h1' }])] },
    });
    expect(entries.filter(e => e.source.kind === 'booking')).toHaveLength(3);
  });

  test('an item pointing at a booking that is not visible falls through rather than vanishing', () => {
    const entries = build({
      bookings: [],
      itinerary: { 'stop-a': [day('stop-a', '2026-05-22', [{ type: 'booking', bookingId: 'gone', label: 'Something' }])] },
    });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ title: 'Something', source: { kind: 'custom' } });
  });

  test('roles come from the taxonomy, not from BookingType', () => {
    expect(build().map(e => e.role)).toEqual(['sleep', 'move', 'move']);
    expect(build().map(e => e.category)).toEqual(['stay', 'flight', 'car']);
  });

  test('a flight leads with its route and the mono column is 24h', () => {
    const flight = build()[1];
    expect(flight.title).toBe('BOS → PWM · Delta 2412');
    expect(flight.dayLabel).toBe('FRI 22');
    expect(flight.timeLabel).toBe('07:15');
    expect(flight.sub).toBe('Portland · confirmed');
  });

  test('a stay leads with its range and its nights, and sorts to the top of its day', () => {
    const stay = build()[0];
    expect(stay.dayLabel).toBe('22–24');
    expect(stay.timeLabel).toBe('2 nts');
    expect(stay.minutes).toBe(0);
  });

  test('a rental shows where it goes, which is the fact that matters', () => {
    expect(build()[2]).toMatchObject({ title: 'Hertz · midsize SUV', sub: 'Portland → Bar Harbor' });
  });

  test('a booking with no confirmation code says so plainly', () => {
    const [only] = build({
      bookings: [{ ...BOOKINGS[1], confirmationCode: undefined }],
    });
    expect(only.sub).toBe('Portland · booked');
  });

  test('a place item takes its name and note from the place, and is not booked', () => {
    const entries = build({
      bookings: [],
      places: [PLACE],
      itinerary: { 'stop-b': [day('stop-b', '2026-05-25', [{ type: 'place', placeId: 'p1', time: '12:30 PM' }])] },
    });
    expect(entries[0]).toMatchObject({
      title: 'Jordan Pond House',
      sub: 'Popovers on the lawn',
      category: 'food',
      role: 'eat',
      booked: false,
      timeLabel: '12:30',
      source: { kind: 'place', placeId: 'p1' },
    });
  });

  test('sorts by date, then time, with untimed last', () => {
    const entries = build({
      bookings: [],
      itinerary: { 'stop-a': [day('stop-a', '2026-05-22', [
        { label: 'Whenever' },
        { label: 'Evening', time: '7:00 PM' },
        { label: 'Morning', time: '9:00 AM' },
      ])] },
    });
    expect(entries.map(e => e.title)).toEqual(['Morning', 'Evening', 'Whenever']);
  });

  test('exactly one entry is the next thing happening today', () => {
    const entries = build({ now: { todayIso: '2026-05-24', minutes: 8 * 60 } });
    expect(entries.filter(e => e.next).map(e => e.source)).toEqual([{ kind: 'booking', bookingId: 'r1' }]);
  });

  test('nothing is next when the clock is not supplied', () => {
    expect(build().some(e => e.next)).toBe(false);
  });
});

describe('lenses', () => {
  test('by role returns all four groups in order, empty ones included', () => {
    const groups = groupByRole(build());
    expect(groups.map(g => g.role)).toEqual(['move', 'sleep', 'eat', 'do']);
    expect(groups.map(g => g.entries.length)).toEqual([2, 1, 0, 0]);
  });

  test('by day collapses consecutive entries onto one date', () => {
    expect(groupByDay(build()).map(d => [d.dateIso, d.entries.length])).toEqual([
      ['2026-05-22', 2],
      ['2026-05-24', 1],
    ]);
  });

  test('by stop follows the caller\'s stop order', () => {
    expect(groupByStop(build(), STOPS).map(g => [g.stopId, g.entries.length])).toEqual([
      ['stop-a', 3],
      ['stop-b', 0],
    ]);
  });
});
