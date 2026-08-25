import {
  buildItineraryTimeline, timelineTime, TIMELINE_BANDS, type ItineraryTimelineInput,
} from '@/src/domain/itineraryTimeline';
import type { Booking, ItineraryDay, ItineraryItem, Place, Stop } from '@/src/types';

const STOPS: Pick<Stop, 'id' | 'city' | 'dates' | 'order'>[] = [
  { id: 'stop-a', city: 'Portland', dates: { start: '2026-05-22', end: '2026-05-24' }, order: 0 },
  { id: 'stop-b', city: 'Bar Harbor', dates: { start: '2026-05-24', end: '2026-05-27' }, order: 1 },
];

const HOTEL_A: Booking = {
  id: 'hotel-a', tripId: 'trip-1', stopId: 'stop-a', type: 'hotel',
  hotelName: 'The Press Hotel', checkIn: '2026-05-22', checkOut: '2026-05-24',
  confirmationCode: 'PRESS-42',
};

const HOTEL_B: Booking = {
  id: 'hotel-b', tripId: 'trip-1', stopId: 'stop-b', type: 'hotel',
  hotelName: 'Bar Harbor Inn', checkIn: '2026-05-24', checkOut: '2026-05-27',
};

function item(id: string, over: Partial<ItineraryItem> = {}): ItineraryItem {
  return { id, type: 'custom', label: id, order: 0, ...over };
}

function day(stopId: string, dateIso: string, items: ItineraryItem[]): ItineraryDay {
  return { id: `${stopId}-${dateIso}`, stopId, dateIso, items };
}

function build(over: Partial<ItineraryTimelineInput> = {}) {
  return buildItineraryTimeline({
    stops: STOPS,
    bookings: [],
    itinerary: {},
    places: [],
    enrichment: {},
    ...over,
  });
}

describe('timeline time contract', () => {
  test('declares the completed design’s five bands in order', () => {
    expect(TIMELINE_BANDS).toEqual([
      { key: 'early', label: 'Early', span: '5–9 AM' },
      { key: 'morning', label: 'Morning', span: '9 – 12' },
      { key: 'afternoon', label: 'Afternoon', span: '12 – 5' },
      { key: 'evening', label: 'Evening', span: '5 – 9 PM' },
      { key: 'late', label: 'Late', span: '9 PM +' },
    ]);
  });

  test.each([
    ['6:40 AM', 'early'],
    ['9:00 AM', 'morning'],
    ['12:00 PM', 'afternoon'],
    ['5:00 PM', 'evening'],
    ['11:00 PM', 'late'],
    ['2:00 AM', 'late'],
  ])('%s is a hard time in %s', (raw, band) => {
    expect(timelineTime(raw)).toMatchObject({ precision: 'hard', band, label: raw });
  });

  test.each([
    ['sunrise', 'early'],
    ['mid-morning', 'morning'],
    ['afternoon', 'afternoon'],
    ['sunset', 'evening'],
    ['late night', 'late'],
  ])('%s remains a loose label in %s', (raw, band) => {
    expect(timelineTime(raw)).toMatchObject({ precision: 'loose', band, label: raw });
  });

  test('missing and unrecognized strings are honest unscheduled values', () => {
    expect(timelineTime()).toMatchObject({ precision: 'unscheduled', label: 'Unscheduled' });
    expect(timelineTime().band).toBeUndefined();
    expect(timelineTime('after the rain')).toMatchObject({
      precision: 'unscheduled', label: 'after the rain',
    });
    expect(timelineTime('after the rain').band).toBeUndefined();
  });
});

describe('buildItineraryTimeline chronology', () => {
  test('fills every inclusive stop date, even when a day has no stored record', () => {
    expect(build().days.map(d => d.dateIso)).toEqual([
      '2026-05-22', '2026-05-23', '2026-05-24', '2026-05-25', '2026-05-26', '2026-05-27',
    ]);
    expect(build().days.every(d => d.bands.length === 5)).toBe(true);
  });

  test('a stop handoff date appears once with two ordered segments and one transition', () => {
    const model = build({
      itinerary: {
        'stop-a': [day('stop-a', '2026-05-24', [item('coffee')])],
        'stop-b': [day('stop-b', '2026-05-24', [item('check-in')])],
      },
    });
    const handoff = model.days.find(d => d.dateIso === '2026-05-24')!;

    expect(model.days.filter(d => d.dateIso === '2026-05-24')).toHaveLength(1);
    expect(handoff.segments.map(s => s.stopId)).toEqual(['stop-a', 'stop-b']);
    expect(handoff.transition).toEqual({
      fromStopId: 'stop-a', fromCity: 'Portland',
      toStopId: 'stop-b', toCity: 'Bar Harbor',
    });
    expect(handoff.count).toBe(2);
  });

  test('travel outside the stop range extends the visible chronology without inventing a stop segment', () => {
    const flight: Booking = {
      id: 'flight-1', tripId: 'trip-1', stopId: 'stop-a', type: 'flight',
      legs: [{
        flightNumber: '1712', airline: 'United', origin: 'SFO', destination: 'BOS',
        departureDate: '2026-05-21', departureTime: '10:40 PM', arrivalTime: '6:55 AM',
      }],
      confirmationCode: 'UA-1',
    };
    const first = build({ bookings: [flight] }).days[0];
    expect(first.dateIso).toBe('2026-05-21');
    expect(first.segments).toEqual([]);
    expect(first.bands.find(b => b.key === 'late')?.entries[0]).toMatchObject({
      title: 'SFO → BOS', secured: true, confirmed: true,
    });
  });
});

describe('row truth', () => {
  test('a placed booking wins over synthetic events and carries the reservation identity', () => {
    const placed = item('hotel-item', {
      type: 'booking', bookingId: 'hotel-b', label: 'Check in', time: '3:00 PM',
    });
    const model = build({
      bookings: [HOTEL_B],
      itinerary: { 'stop-b': [day('stop-b', '2026-05-24', [placed])] },
    });
    const entries = model.days.flatMap(d => [...d.bands.flatMap(b => b.entries), ...d.unscheduled]);

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      source: { kind: 'booking', bookingId: 'hotel-b', itemId: 'hotel-item', event: 'placed' },
      secured: true,
      requiresMoveConfirmation: true,
      confirmed: false,
    });
  });

  test('unplaced hotels and rentals get both lifecycle events', () => {
    const rental: Booking = {
      id: 'rental-1', tripId: 'trip-1', stopId: 'stop-a', dropoffStopId: 'stop-b', type: 'rental',
      company: 'Hertz', pickupDate: '2026-05-22', pickupTime: '9:00 AM',
      dropoffDate: '2026-05-27', dropoffTime: '10:00 AM',
      pickupLocation: 'PWM', dropoffLocation: 'BHB',
    };
    const entries = build({ bookings: [HOTEL_A, rental] }).days
      .flatMap(d => [...d.bands.flatMap(b => b.entries), ...d.unscheduled]);

    expect(entries.map(e => e.source)).toEqual(expect.arrayContaining([
      { kind: 'booking', bookingId: 'hotel-a', event: 'checkin' },
      { kind: 'booking', bookingId: 'hotel-a', event: 'checkout' },
      { kind: 'booking', bookingId: 'rental-1', event: 'pickup' },
      { kind: 'booking', bookingId: 'rental-1', event: 'dropoff' },
    ]));
  });

  test('a place uses real place data and the existing photo seam', () => {
    const place: Place = {
      id: 'place-1', tripId: 'trip-1', stopId: 'stop-a', name: 'Eventide',
      category: 'restaurant', must: true, source: 'curator', addedBy: 'uid-1',
      subcategory: 'seafood', photoUrl: 'https://example.test/eventide.jpg',
    };
    const model = build({
      places: [place],
      itinerary: {
        'stop-a': [day('stop-a', '2026-05-22', [
          item('place-item', { type: 'place', placeId: 'place-1', time: '7:00 PM' }),
        ])],
      },
    });
    const row = model.days[0].bands.find(b => b.key === 'evening')!.entries[0];
    expect(row).toMatchObject({
      title: 'Eventide', meta: 'seafood', category: 'food',
      photo: 'https://example.test/eventide.jpg',
      source: { kind: 'place', placeId: 'place-1', itemId: 'place-item' },
    });
  });

  test('navigation eligibility comes only from a source address field', () => {
    const addressedPlace: Place = {
      id: 'trail', tripId: 'trip-1', stopId: 'stop-a', name: 'Ocean Path',
      category: 'hike', must: true, source: 'curator', addedBy: 'uid-1', addr: 'Park Loop Rd',
    };
    const custom = item('custom', { notes: 'Meet outside 119 Exchange St' });
    const model = build({
      places: [addressedPlace],
      itinerary: {
        'stop-a': [day('stop-a', '2026-05-22', [
          item('trail-item', { type: 'place', placeId: 'trail', time: '9:00 AM' }),
          custom,
        ])],
      },
    });
    const entries = model.days[0].bands.flatMap(band => band.entries).concat(model.days[0].unscheduled);
    expect(entries.find(entry => entry.source.kind === 'place')?.address).toBe('Park Loop Rd');
    expect(entries.find(entry => entry.source.kind === 'custom')?.address).toBeUndefined();
  });

  test('hotel and rental records expose their event-specific locations; flights do not', () => {
    const hotel = { ...HOTEL_A, address: '119 Exchange St' } as Booking;
    const rental: Booking = {
      id: 'rental-addressed', tripId: 'trip-1', stopId: 'stop-a', dropoffStopId: 'stop-b', type: 'rental',
      company: 'Hertz', pickupDate: '2026-05-22', dropoffDate: '2026-05-27',
      pickupLocation: 'PWM Airport', dropoffLocation: 'BHB Airport',
    };
    const flight: Booking = {
      id: 'flight-no-address', tripId: 'trip-1', stopId: 'stop-a', type: 'flight',
      legs: [{ flightNumber: '1', airline: 'Jernie Air', origin: 'PWM', destination: 'BOS', departureDate: '2026-05-22', departureTime: '8:00 AM', arrivalTime: '9:00 AM' }],
    };
    const entries = build({ bookings: [hotel, rental, flight] }).days
      .flatMap(d => [...d.bands.flatMap(b => b.entries), ...d.unscheduled]);

    expect(entries.find(entry => entry.source.kind === 'booking' && entry.source.bookingId === 'hotel-a')?.address).toBe('119 Exchange St');
    expect(entries.find(entry => entry.source.kind === 'booking' && entry.source.event === 'pickup')?.address).toBe('PWM Airport');
    expect(entries.find(entry => entry.source.kind === 'booking' && entry.source.event === 'dropoff')?.address).toBe('BHB Airport');
    expect(entries.find(entry => entry.source.kind === 'booking' && entry.source.bookingId === 'flight-no-address')?.address).toBeUndefined();
  });

  test('locked custom plans require move confirmation; ordinary loose plans do not', () => {
    const model = build({
      itinerary: {
        'stop-a': [day('stop-a', '2026-05-22', [
          item('locked', { time: 'morning', locked: true, order: 0 }),
          item('loose', { time: 'afternoon', order: 1 }),
        ])],
      },
    });
    const entries = model.days[0].bands.flatMap(b => b.entries);
    expect(entries.find(e => e.title === 'locked')).toMatchObject({ requiresMoveConfirmation: true });
    expect(entries.find(e => e.title === 'loose')).toMatchObject({ requiresMoveConfirmation: false });
  });
});

describe('context and current state', () => {
  test('stay context follows half-open hotel nights and identifies the last night', () => {
    const model = build({ bookings: [HOTEL_A] });
    expect(model.days.find(d => d.dateIso === '2026-05-22')?.stay).toMatchObject({
      name: 'The Press Hotel', detail: '2 nights · booked', confirmed: true,
    });
    expect(model.days.find(d => d.dateIso === '2026-05-23')?.stay?.detail).toBe('last night here');
    expect(model.days.find(d => d.dateIso === '2026-05-24')?.stay).toBeUndefined();
  });

  test('an unconfirmed incoming stay marks its day as warning', () => {
    const day24 = build({ bookings: [HOTEL_B] }).days.find(d => d.dateIso === '2026-05-24')!;
    expect(day24.stay).toMatchObject({ name: 'Bar Harbor Inn', confirmed: false, detail: 'not yet confirmed' });
    expect(day24.warning).toBe(true);
  });

  test('hard times become past, loose times stay honest, and exactly one row is next', () => {
    const model = build({
      now: { todayIso: '2026-05-24', minutes: 13 * 60 },
      itinerary: {
        'stop-a': [day('stop-a', '2026-05-24', [item('past', { time: '11:00 AM' })])],
        'stop-b': [day('stop-b', '2026-05-24', [
          item('loose', { time: 'afternoon', order: 0 }),
          item('later', { time: '3:30 PM', order: 1 }),
        ])],
      },
    });
    const entries = model.days.find(d => d.dateIso === '2026-05-24')!.bands.flatMap(b => b.entries);

    expect(entries.find(e => e.title === 'past')?.past).toBe(true);
    expect(entries.find(e => e.title === 'loose')?.past).toBe(false);
    expect(entries.filter(e => e.next).map(e => e.title)).toEqual(['loose']);
    expect(model.todayIndex).toBeGreaterThanOrEqual(0);
  });

  test('empty prompts are limited to today and tomorrow', () => {
    const model = build({ now: { todayIso: '2026-05-23', minutes: 12 * 60 } });
    expect(model.days.find(d => d.dateIso === '2026-05-22')?.bands.some(b => b.showEmptyPrompt)).toBe(false);
    expect(model.days.find(d => d.dateIso === '2026-05-23')?.bands.every(b => b.showEmptyPrompt)).toBe(true);
    expect(model.days.find(d => d.dateIso === '2026-05-24')?.bands.every(b => b.showEmptyPrompt)).toBe(true);
    expect(model.days.find(d => d.dateIso === '2026-05-25')?.bands.some(b => b.showEmptyPrompt)).toBe(false);
  });
});
