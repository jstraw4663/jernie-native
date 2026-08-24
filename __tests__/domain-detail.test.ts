// The detail sheet's model and layout, which is where the behaviour the five deleted
// per-type sheet tests asserted now lives.
//
// Those tests rendered `PlaceSheet`, `HikeSheet`, `RestaurantSheet`, `RentalSheet` and
// `SheetHero` and read strings out of the tree. Session 6 replaced all five with one shell
// over a block library, so their subjects no longer exist — but their assertions do, and
// they are better here: "omits rows for absent optional fields", "hides sections entirely
// when neither Place nor enrichment has the data", "shows real stats instead of mock ones"
// are all statements about `buildDetailModel`, not about pixels.
import { blocksFor, BLOCK_ORDER } from '@/src/features/jernie/sheets/detail/layout';
import { buildDetailModel, detailRole } from '@/src/features/jernie/sheets/detail/model';
import type { DetailPayload } from '@/src/features/jernie/sheets/detail/types';
import type {
  FlightBooking, HotelBooking, Place, PlaceEnrichment, RentalBooking, RestaurantBooking, Stop,
} from '@/src/types';

const STOP: Pick<Stop, 'id' | 'city' | 'dates'> = {
  id: 'stop-b', city: 'Bar Harbor, ME', dates: { start: '2026-05-24', end: '2026-05-27' },
};

const RESTAURANT: Place = {
  id: 'place-1', tripId: 'trip-1', stopId: 'stop-b', name: 'Eventide Oyster Co.',
  category: 'restaurant', must: true, source: 'curator', addedBy: 'uid-1',
  curatorNote: 'Brown butter lobster roll is unmissable.', rating: 4.7, price: '$$$',
  subcategory: 'seafood',
};

const SIGHT_NO_EXTRAS: Place = {
  id: 'place-2', tripId: 'trip-1', stopId: 'stop-b', name: 'Portland Head Light',
  category: 'sight', must: false, source: 'curator', addedBy: 'uid-1',
};

const HIKE: Place = {
  id: 'place-3', tripId: 'trip-1', stopId: 'stop-b', name: 'Beehive Trail',
  category: 'hike', must: true, source: 'curator', addedBy: 'uid-1',
  difficulty: 'Strenuous', distance: '1.5 mi',
};

const HOTEL: HotelBooking = {
  id: 'b-hotel', tripId: 'trip-1', stopId: 'stop-b', type: 'hotel',
  hotelName: 'Bar Harbor Grand', checkIn: '2026-05-24', checkOut: '2026-05-27',
  confirmationCode: 'BHG-9912',
};

const FLIGHT: FlightBooking = {
  id: 'b-flight', tripId: 'trip-1', stopId: 'stop-b', type: 'flight',
  legs: [
    { flightNumber: 'AA5299', airline: 'American', origin: 'BGR', destination: 'CLT',
      departureDate: '2026-05-29', departureTime: '06:05', arrivalTime: '09:48' },
    { flightNumber: 'AA1180', airline: 'American', origin: 'CLT', destination: 'AUS',
      departureDate: '2026-05-29', departureTime: '11:20', arrivalTime: '13:05' },
  ],
};

const RENTAL: RentalBooking = {
  id: 'b-rental', tripId: 'trip-1', stopId: 'stop-b', type: 'rental',
  company: 'Enterprise', carType: 'Compact SUV',
  pickupDate: '2026-05-22', pickupLocation: 'Portland Jetport',
  dropoffDate: '2026-05-27', dropoffLocation: 'Bangor Airport',
};

const RESERVATION: RestaurantBooking = {
  id: 'b-res', tripId: 'trip-1', stopId: 'stop-b', type: 'restaurant',
  restaurantName: 'Havana', date: '2026-05-25', time: '7:30 PM', partySize: 4,
};

function place(p: Place, extra: Partial<DetailPayload> = {}) {
  return buildDetailModel({ subject: { kind: 'place', place: p }, stop: STOP, ...extra });
}
function booking(b: DetailPayload['subject'] extends never ? never : HotelBooking | FlightBooking | RentalBooking | RestaurantBooking, extra: Partial<DetailPayload> = {}) {
  return buildDetailModel({ subject: { kind: 'booking', booking: b }, stop: STOP, ...extra });
}

// ── The layout table ─────────────────────────────────────────────────────────

describe('block layout', () => {
  test('every role has an order, and the spec\'s four are all present', () => {
    expect(Object.keys(BLOCK_ORDER).sort()).toEqual(['do', 'eat', 'move', 'sleep']);
  });

  test('a booking gets a Booking block even on a role whose list has none', () => {
    // `eat`'s list is the canvas's Restaurant — a place. A reservation is not one.
    expect(BLOCK_ORDER.eat).not.toContain('booking');
    expect(blocksFor('eat', { kind: 'booking', booking: RESERVATION })[0]).toBe('booking');
  });

  test('a place does not gain one', () => {
    expect(blocksFor('eat', { kind: 'place', place: RESTAURANT })).toEqual(BLOCK_ORDER.eat);
  });

  test('Travel keeps the canvas order — Booking, Timeline, Confirmation', () => {
    const order = blocksFor('move', { kind: 'booking', booking: FLIGHT });
    expect(order.indexOf('booking')).toBeLessThan(order.indexOf('timeline'));
    expect(order.indexOf('timeline')).toBeLessThan(order.indexOf('confirmation'));
  });

  test('the role is the type — a bar and a restaurant land on the same list', () => {
    expect(detailRole({ subject: { kind: 'place', place: RESTAURANT } })).toBe('eat');
    expect(detailRole({ subject: { kind: 'place', place: { ...RESTAURANT, category: 'bar' } } })).toBe('eat');
    expect(detailRole({ subject: { kind: 'place', place: HIKE } })).toBe('do');
    expect(detailRole({ subject: { kind: 'booking', booking: HOTEL } })).toBe('sleep');
    expect(detailRole({ subject: { kind: 'booking', booking: FLIGHT } })).toBe('move');
    expect(detailRole({ subject: { kind: 'booking', booking: RENTAL } })).toBe('move');
  });
});

// ── Places ───────────────────────────────────────────────────────────────────

describe('a place', () => {
  test('shows its own name, note and figures', () => {
    const m = place(RESTAURANT);
    expect(m.title).toBe('Eventide Oyster Co.');
    expect(m.description).toBe('Brown butter lobster roll is unmissable.');
    expect(m.sub).toBe('seafood · $$$ · Bar Harbor, ME');
    expect(m.stats).toEqual([
      { value: '4.7', label: 'Rating' },
      { value: '$$$', label: 'Price' },
    ]);
  });

  test('leaves every unsourced block undefined rather than filling it', () => {
    const m = place(SIGHT_NO_EXTRAS);
    expect(m.stats).toBeUndefined();
    expect(m.description).toBeUndefined();
    expect(m.hours).toBeUndefined();
    expect(m.reviews).toBeUndefined();
    expect(m.tags).toBeUndefined();
    // …but the blocks are still declared, so they light up the day data arrives.
    expect(m.blocks).toContain('conditions');
  });

  test('a hike carries its curated stats and its difficulty', () => {
    const m = place(HIKE);
    expect(m.difficulty).toBe('Strenuous');
    expect(m.stats).toEqual([{ value: '1.5 mi', label: 'Distance' }]);
    expect(m.blocks[0]).toBe('difficulty');
  });

  test('the location block names the stop and its dates', () => {
    expect(place(RESTAURANT).location).toEqual({
      title: 'Inside Bar Harbor, ME',
      sub: 'Your stop, May 24 – 27',
      address: undefined,
    });
  });

  test('with no stop, location falls back to the address or disappears', () => {
    const withAddr = buildDetailModel({ subject: { kind: 'place', place: { ...HIKE, addr: 'Park Loop Rd' } } });
    expect(withAddr.location).toEqual({ title: 'Park Loop Rd', address: 'Park Loop Rd' });
    expect(buildDetailModel({ subject: { kind: 'place', place: HIKE } }).location).toBeUndefined();
  });

  test('nearby lists other places at the same stop, never the subject', () => {
    const m = place(RESTAURANT, { places: [RESTAURANT, SIGHT_NO_EXTRAS, HIKE] });
    expect(m.nearby?.map(n => n.id)).toEqual(['place-3', 'place-2']);   // must-visit first
  });

  test('nearby ignores places at other stops, and disappears when there are none', () => {
    const elsewhere = { ...SIGHT_NO_EXTRAS, id: 'place-9', stopId: 'stop-a' };
    expect(place(RESTAURANT, { places: [RESTAURANT, elsewhere] }).nearby).toBeUndefined();
  });

  test('enrichment fills hours, reviews and the review count', () => {
    const e: PlaceEnrichment = {
      name: 'Eventide Oyster Co.', lat: 43.66, lon: -70.25, address: '86 Middle St',
      hours: ['Mon–Fri 11–9', 'Sat 11–10'], rating: 4.5, ratingCount: 1240,
      photos: [], cached_at: 0, place_id_locked: true,
      reviews: [{ author: 'Meg L.', rating: 5, text: 'Incredible.', time: 0 }],
    };
    const located: Place = { ...RESTAURANT, lat: 43.66, lon: -70.25, rating: undefined };
    // Keyed canonically, so build the map the way the app does.
    const { canonicalPlaceKey } = require('@/src/domain/placeEnrichment');
    const m = place(located, { enrichment: { [canonicalPlaceKey(located.name, 43.66, -70.25)]: e } });

    expect(m.hours).toEqual(['Mon–Fri 11–9', 'Sat 11–10']);
    expect(m.reviews).toHaveLength(1);
    expect(m.stats?.[0]).toEqual({ value: '4.5', label: '1.2k reviews' });
    expect(m.location?.address).toBe('86 Middle St');
  });
});

// ── Bookings ─────────────────────────────────────────────────────────────────

describe('a booking', () => {
  test('a stay counts its nights and carries a typographic hero', () => {
    const m = booking(HOTEL);
    expect(m.hero).toEqual({
      kind: 'type', badge: 'Confirmed', badgeTone: 'accent',
      lead: 'May 24 – 27', sub: '3 nights',
    });
    expect(m.stats).toEqual([
      { value: '3', label: 'Nights' },
      { value: 'May 24', label: 'Check in' },
      { value: 'May 27', label: 'Check out' },
    ]);
    expect(m.booking).toEqual([{ label: 'Confirmation', value: 'BHG-9912', tone: 'mono' }]);
  });

  test('an unconfirmed booking says Booked, not Confirmed — status by what we know', () => {
    const m = booking({ ...HOTEL, confirmationCode: undefined });
    expect(m.hero).toMatchObject({ badge: 'Booked', badgeTone: 'neutral' });
    // No code, so the row drops rather than rendering an empty value — and with nothing
    // else on a HotelBooking, the whole Booking block goes with it.
    expect(m.booking).toBeUndefined();
  });

  test('a flight times each leg and counts the connection', () => {
    const m = booking(FLIGHT);
    expect(m.hero).toMatchObject({ lead: 'BGR → AUS', sub: '06:05 → 13:05' });
    expect(m.title).toBe('American AA5299');
    expect(m.timeline).toEqual([
      { lead: '06:05', title: 'BGR → CLT', sub: 'American AA5299 · arrives 09:48' },
      { lead: '11:20', title: 'CLT → AUS', sub: 'American AA1180 · arrives 13:05' },
    ]);
    expect(m.booking).toContainEqual({ label: 'Stops', value: '1 stop', tone: undefined });
  });

  test('a single-leg flight says Non-stop', () => {
    const m = booking({ ...FLIGHT, legs: [FLIGHT.legs[0]] });
    expect(m.booking).toContainEqual({ label: 'Stops', value: 'Non-stop', tone: undefined });
  });

  test('a rental times its pick-up and drop-off, which are days apart', () => {
    const m = booking(RENTAL);
    expect(m.timeline).toEqual([
      { lead: 'May 22', title: 'Pick up',  sub: 'Portland Jetport' },
      { lead: 'May 27', title: 'Drop off', sub: 'Bangor Airport' },
    ]);
    expect(m.location?.address).toBe('Portland Jetport');
  });

  test('Travel puts the code in its own block; everything else puts it in Booking', () => {
    expect(booking({ ...RENTAL, confirmationCode: 'ENT-4' }).confirmation)
      .toEqual([{ label: 'Confirmation', value: 'ENT-4', tone: 'mono' }]);
    expect(booking(HOTEL).confirmation).toBeUndefined();
    expect(booking(HOTEL).booking).toContainEqual({ label: 'Confirmation', value: 'BHG-9912', tone: 'mono' });
  });

  test('a reservation is not a restaurant — it renders its own booking rows', () => {
    const m = booking(RESERVATION);
    expect(m.title).toBe('Havana');
    expect(m.blocks[0]).toBe('booking');
    expect(m.booking).toEqual([
      { label: 'Date',  value: 'Mon, May 25', tone: undefined },
      { label: 'Time',  value: '7:30 PM', tone: 'mono' },
      { label: 'Party', value: '4', tone: undefined },
    ]);
    // Every place block on `eat`'s list stays dormant.
    expect(m.stats).toBeUndefined();
    expect(m.reviews).toBeUndefined();
  });
});

// ── The footer ───────────────────────────────────────────────────────────────

describe('the footer action', () => {
  const noop = () => {};

  test('offers Add for a place that is not on a day', () => {
    expect(place(RESTAURANT, { onAdd: noop }).footer).toMatchObject({ label: 'Add to itinerary', icon: 'plus' });
  });

  test('offers View for one that is', () => {
    expect(place(RESTAURANT, { isAdded: true, onViewItinerary: noop }).footer)
      .toMatchObject({ label: 'View in itinerary', icon: 'check' });
  });

  test('offers Edit for a booking', () => {
    expect(booking(HOTEL, { onEdit: noop }).footer).toMatchObject({ label: 'Edit booking', icon: 'pencil' });
  });

  test('disappears entirely when there is nothing for it to do', () => {
    expect(place(RESTAURANT).footer).toBeUndefined();
    expect(booking(HOTEL).footer).toBeUndefined();
  });
});
