// Tests for the Task 9 one-time PWA import transform. Two groups:
//   1. Unit tests against small hand-built fixtures for each transform function.
//   2. An end-to-end pass of `buildImportPayload` against the REAL bundled snapshot of
//      `~/jernie/public/trip.json` (`scripts/pwaTripSnapshot.json`) — this is the "dry
//      run" the task's safety boundary calls for: exercise the real data through the
//      real transform, assert on the output, never touch Firebase.
// A separate small group at the bottom exercises `runPwaImport`'s I/O wiring against a
// mocked `@react-native-firebase/database` (never the real one).
//
// The mocks below are hoisted above every import in this file (babel-plugin-jest-hoist),
// same convention as __tests__/hooks/useJoinTrip.test.ts — required because
// `scripts/importPwaTrip.ts` (imported below, for the last describe block) pulls in
// `@/src/lib/firebase`, which wraps the native-only `@react-native-firebase/*` packages
// that cannot load for real inside Jest's Node environment.
jest.mock('@react-native-firebase/database');
jest.mock('@/src/lib/firebase', () => ({
  authReady: Promise.resolve({ uid: 'jeremy-uid' }),
  auth: jest.fn(() => ({ currentUser: { uid: 'jeremy-uid' } })),
  database: require('@react-native-firebase/database').default,
}));

import realPwaData from '@/scripts/pwaTripSnapshot.json';
import { runPwaImport } from '@/scripts/importPwaTrip';
import {
  parsePwaFlightDate,
  splitRoute,
  deriveCompanyFromLabel,
  deriveRegion,
  transformTrip,
  transformStops,
  transformBookings,
  transformPlaces,
  transformItinerary,
  transformGroups,
  buildImportPayload,
  NEW_TRIP_ID,
  type PwaData,
  type PwaStop,
  type PwaBooking,
  type PwaPlace,
  type PwaGroup,
  type PwaItineraryDay,
  type PwaItineraryItem,
} from '@/scripts/importPwaTrip.transform';
import type { FlightBooking, HotelBooking, RentalBooking } from '@/src/types';

const OPTS = { uid: 'jeremy-uid', now: 1_780_000_000_000, inviteToken: 'test-token-abc' };

// ── small parsing helpers ─────────────────────────────────────────────────────

test('parsePwaFlightDate converts "May 22 2026" to ISO', () => {
  expect(parsePwaFlightDate('May 22 2026')).toBe('2026-05-22');
});

test('parsePwaFlightDate pads single-digit days', () => {
  expect(parsePwaFlightDate('Jun 5 2026')).toBe('2026-06-05');
});

test('parsePwaFlightDate throws on unrecognized format', () => {
  expect(() => parsePwaFlightDate('2026-05-22')).toThrow();
});

test('splitRoute splits on the unicode arrow and trims', () => {
  expect(splitRoute('CLT → BWI')).toEqual({ origin: 'CLT', destination: 'BWI' });
});

test('splitRoute throws on malformed route', () => {
  expect(() => splitRoute('CLT-BWI')).toThrow();
});

test('deriveCompanyFromLabel takes the segment after the last em dash', () => {
  expect(deriveCompanyFromLabel('Rental Car — Avis')).toBe('Avis');
  expect(deriveCompanyFromLabel('Rental Car Drop-Off — Avis at BGR')).toBe('Avis at BGR');
});

test('deriveRegion extracts a ", XX" suffix', () => {
  expect(deriveRegion('Portland, ME')).toBe('ME');
});

test('deriveRegion falls back to ME when no state suffix is present', () => {
  expect(deriveRegion('Southwest Harbor')).toBe('ME');
});

// ── transformTrip ─────────────────────────────────────────────────────────────

test('transformTrip joins pill tuples into single strings and sets owner/token/pack', () => {
  const trip = transformTrip(
    { id: 'maine-2026', name: 'Maine Coast', pills: [['🦞', 'Seafood-focused'], ['🏔️', 'Acadia hiking']] },
    OPTS,
  );
  expect(trip.id).toBe('maine-2026');
  expect(trip.name).toBe('Maine Coast');
  expect(trip.pills).toEqual(['🦞 Seafood-focused', '🏔️ Acadia hiking']);
  expect(trip.ownerUid).toBe('jeremy-uid');
  expect(trip.createdAt).toBe(OPTS.now);
  expect(trip.inviteToken).toBe('test-token-abc');
  expect(trip.colorPack.id).toBe('coastal');
  expect(trip.setupIntent).toEqual({ flights: true, stays: true, car: true, restaurants: true });
});

// ── transformStops ────────────────────────────────────────────────────────────

const STOP_FIXTURES: PwaStop[] = [
  { id: 'portland', city: 'Portland, ME', emoji: '🦞', lat: 43.6591, lon: -70.2568, weather_start: '2026-05-22', weather_end: '2026-05-24' },
  { id: 'barharbor', city: 'Bar Harbor, ME', emoji: '🏔️', lat: 44.3876, lon: -68.2039, weather_start: '2026-05-24', weather_end: '2026-05-27' },
  { id: 'swh', city: 'Southwest Harbor', emoji: '⚓', lat: 44.279, lon: -68.3259, weather_start: '2026-05-27', weather_end: '2026-05-29' },
];

test('transformStops assigns order by array position and derives dates from weather_start/end', () => {
  const stops = transformStops(STOP_FIXTURES);
  expect(stops.portland.order).toBe(0);
  expect(stops.barharbor.order).toBe(1);
  expect(stops.swh.order).toBe(2);
  expect(stops.portland.dates).toEqual({ start: '2026-05-22', end: '2026-05-24' });
  expect(stops.portland.region).toBe('ME');
  expect(stops.swh.region).toBe('ME'); // fallback, no ", XX" in "Southwest Harbor"
  expect(stops.portland.tripId).toBe(NEW_TRIP_ID);
  // no `color` field ever
  expect((stops.portland as unknown as Record<string, unknown>).color).toBeUndefined();
});

// ── transformBookings ─────────────────────────────────────────────────────────

const STOPS_FOR_BOOKINGS = transformStops(STOP_FIXTURES);

test('flight booking: renames nothing (type already "flight"), builds legs field-by-field', () => {
  const pwaBooking: PwaBooking = {
    id: 'book-flights-jj',
    stop_id: 'portland',
    type: 'flight',
    group_ids: ['group-j'],
    label: 'Outbound Flights',
    addr: null,
    confirmation: null,
    flights: [
      { num: 'WN 351', airline: 'Southwest', route: 'CLT → BWI', dep: '8:20 AM', arr: '9:50 AM', date: 'May 22 2026' },
      { num: 'WN 2365', airline: 'Southwest', route: 'BWI → PWM', dep: '10:40 AM', arr: '12:10 PM', date: 'May 22 2026' },
    ],
  };
  const { bookings } = transformBookings([pwaBooking], STOPS_FOR_BOOKINGS);
  const flight = bookings['book-flights-jj'] as FlightBooking;
  expect(flight.type).toBe('flight');
  expect(flight.legs).toHaveLength(2);
  expect(flight.legs[0]).toEqual({
    flightNumber: 'WN 351',
    airline: 'Southwest',
    origin: 'CLT',
    destination: 'BWI',
    departureDate: '2026-05-22',
    departureTime: '8:20 AM',
    arrivalTime: '9:50 AM',
  });
  expect(flight.groupIds).toEqual(['group-j']);
  expect(flight.confirmationCode).toBeUndefined();
});

test('accommodation booking renames to "hotel" and derives checkIn/checkOut from the parent stop', () => {
  const pwaBooking: PwaBooking = {
    id: 'book-hotel-jj',
    stop_id: 'portland',
    type: 'accommodation',
    group_ids: ['group-j'],
    label: 'Courtyard Downtown/Waterfront',
    addr: '321 Commercial St, Portland, ME 04101',
    confirmation: null,
    flights: null,
  };
  const { bookings } = transformBookings([pwaBooking], STOPS_FOR_BOOKINGS);
  const hotel = bookings['book-hotel-jj'] as HotelBooking;
  expect(hotel.type).toBe('hotel');
  expect(hotel.hotelName).toBe('Courtyard Downtown/Waterfront');
  expect(hotel.checkIn).toBe('2026-05-22');
  expect(hotel.checkOut).toBe('2026-05-24');
  expect(hotel.address).toBe('321 Commercial St, Portland, ME 04101');
});

test('transportation booking renames to "rental", merges the linked dropoff booking, and remaps its id', () => {
  const pickup: PwaBooking = {
    id: 'book-portland-car',
    stop_id: 'portland',
    type: 'transportation',
    group_ids: null,
    label: 'Rental Car — Avis',
    addr: '1001 Westbrook St, Portland, ME 04102',
    confirmation: '08749981US2',
    flights: null,
    lines: ['Full-Size SUV', 'Pickup: PWM', 'Drop-off: BGR'],
    pickup_date: '2026-05-22',
    pickup_time: null,
    return_date: '2026-05-29',
    return_time: null,
  };
  const dropoff: PwaBooking = {
    id: 'book-swh-car-dropoff',
    stop_id: 'swh',
    type: 'transportation',
    group_ids: null,
    label: 'Rental Car Drop-Off — Avis at BGR',
    addr: '299 Godfrey Blvd, Bangor, ME 04401',
    confirmation: null,
    flights: null,
    linked_booking_id: 'book-portland-car',
  };
  const { bookings, bookingIdRemap } = transformBookings([pickup, dropoff], STOPS_FOR_BOOKINGS);

  // Only one rental booking exists — the dropoff was merged in, not kept standalone.
  expect(Object.keys(bookings)).toEqual(['book-portland-car']);
  const rental = bookings['book-portland-car'] as RentalBooking;
  expect(rental.type).toBe('rental');
  expect(rental.company).toBe('Avis');
  expect(rental.carType).toBe('Full-Size SUV');
  expect(rental.pickupDate).toBe('2026-05-22');
  expect(rental.dropoffDate).toBe('2026-05-29');
  expect(rental.pickupLocation).toBe('1001 Westbrook St, Portland, ME 04102');
  expect(rental.dropoffLocation).toBe('299 Godfrey Blvd, Bangor, ME 04401');
  expect(rental.confirmationCode).toBe('08749981US2');
  // stopId is the pickup stop; dropoffStopId is the dropoff's own stop_id from the source —
  // NOT a guess, read directly off the linked booking (it's "swh", not "barharbor").
  expect(rental.stopId).toBe('portland');
  expect(rental.dropoffStopId).toBe('swh');

  // Any itinerary item referencing the dropped dropoff booking id must be remapped.
  expect(bookingIdRemap['book-swh-car-dropoff']).toBe('book-portland-car');
});

// ── transformPlaces ───────────────────────────────────────────────────────────

test('transformPlaces maps source→curator/community, carries hand-curated fields, and falls back photoUrl to photos[0]', () => {
  const pwaPlaces: PwaPlace[] = [
    {
      id: 'place-1', stop_id: 'portland', category: 'restaurant', subcategory: 'seafood',
      name: 'Eventide', emoji: '🦞', note: 'great oysters', must: true, rating: 4.7,
      source: 'guide', price: '$$$', difficulty: null, duration: null, distance: null, photo_url: null,
    },
    {
      id: 'place-2', stop_id: 'barharbor', category: 'hike', subcategory: 'trail',
      name: 'Beehive Trail', emoji: '🧗', note: 'iron rungs', must: true, rating: null,
      source: 'guide', price: null, difficulty: 'strenuous', duration: '2–3 hrs', distance: '1.6 miles',
      photo_url: null, photos: ['https://example.com/photo1.jpg', 'https://example.com/photo2.jpg'],
      addr: 'Sand Beach Parking Area',
    },
    {
      id: 'place-3', stop_id: 'portland', category: 'community-suggestion-from-stacy', subcategory: undefined,
      name: 'Luke’s Lobster', emoji: '🦞', note: null, must: true, rating: 4.5, source: 'community',
      price: '$$', difficulty: null, duration: null, distance: null, photo_url: null,
    } as unknown as PwaPlace, // placeholder — replaced below with a real 'community' source case
  ];
  // Fix place-3 to use a real source value (typo above was intentional to prove unmapped values throw — see next test)
  pwaPlaces[2] = { ...pwaPlaces[2], category: 'restaurant', source: 'community' };

  const places = transformPlaces(pwaPlaces, OPTS);
  expect(places['place-1'].source).toBe('curator'); // guide → curator
  expect(places['place-1'].curatorNote).toBe('great oysters');
  expect(places['place-1'].addedBy).toBe('jeremy-uid');
  expect(places['place-1'].addr).toBeUndefined(); // non-hike place: no addr in source, none carried

  expect(places['place-2'].photoUrl).toBe('https://example.com/photo1.jpg'); // fallback to photos[0]
  expect(places['place-2'].addr).toBe('Sand Beach Parking Area');
  expect(places['place-2'].difficulty).toBe('strenuous');

  expect(places['place-3'].source).toBe('community');
});

test('transformPlaces maps attraction/bar/shop source categories to "other"', () => {
  const make = (category: string): PwaPlace => ({
    id: `place-${category}`, stop_id: 'portland', category, name: 'X', must: false,
    rating: null, source: 'guide', photo_url: null,
  });
  const places = transformPlaces([make('attraction'), make('bar'), make('shop')], OPTS);
  expect(places['place-attraction'].category).toBe('other');
  expect(places['place-bar'].category).toBe('other');
  expect(places['place-shop'].category).toBe('other');
});

test('transformPlaces throws on a truly unmapped category', () => {
  const bad: PwaPlace = { id: 'place-x', stop_id: 'portland', category: 'nonsense', name: 'X', must: false, rating: null, source: 'guide', photo_url: null };
  expect(() => transformPlaces([bad], OPTS)).toThrow(/Unmapped place category/);
});

// ── transformItinerary ────────────────────────────────────────────────────────

const DAYS: PwaItineraryDay[] = [{ id: 'day-1', stop_id: 'portland', date_iso: '2026-05-22' }];

test('itinerary item type is derived from booking_id/place_id/neither, and text maps to label', () => {
  const items: PwaItineraryItem[] = [
    { id: 'item-1', day_id: 'day-1', text: 'Pick up rental', category: 'travel', booking_id: 'book-a', place_id: null, locked: true, time: '12:10 PM' },
    { id: 'item-2', day_id: 'day-1', text: 'Portland Head Light', category: 'sight', booking_id: null, place_id: 'place-a' },
    { id: 'item-3', day_id: 'day-1', text: 'Sleep in', category: 'leisure', booking_id: null, place_id: null },
  ];
  const itinerary = transformItinerary(DAYS, items, {});
  const day = itinerary.portland['day-1'];
  expect(day.items.map(i => i.id)).toEqual(['item-1', 'item-2', 'item-3']);
  expect(day.items[0]).toMatchObject({ type: 'booking', bookingId: 'book-a', label: 'Pick up rental', category: 'transport', locked: true, order: 0 });
  expect(day.items[1]).toMatchObject({ type: 'place', placeId: 'place-a', label: 'Portland Head Light', category: 'sight', order: 1 });
  expect(day.items[2]).toMatchObject({ type: 'custom', label: 'Sleep in', category: 'other', order: 2 });
  expect(day.items[2].placeId).toBeUndefined();
  expect(day.items[2].bookingId).toBeUndefined();
  expect(day.items[2].locked).toBeUndefined();
});

test('itinerary items remap a merged-away booking id via bookingIdRemap', () => {
  const items: PwaItineraryItem[] = [
    { id: 'item-1', day_id: 'day-1', text: 'Drop off rental', category: 'travel', booking_id: 'book-swh-car-dropoff', place_id: null },
  ];
  const itinerary = transformItinerary(DAYS, items, { 'book-swh-car-dropoff': 'book-portland-car' });
  expect(itinerary.portland['day-1'].items[0].bookingId).toBe('book-portland-car');
});

test('itinerary "lodging" category maps to "other" (no direct equivalent in the new type)', () => {
  const items: PwaItineraryItem[] = [
    { id: 'item-1', day_id: 'day-1', text: 'Check in', category: 'lodging', booking_id: 'book-hotel', place_id: null },
  ];
  const itinerary = transformItinerary(DAYS, items, {});
  expect(itinerary.portland['day-1'].items[0].category).toBe('other');
});

test('hand-applied override: item-barharbor-3-1 (Beehive Trail) is tagged groupIds: ["group-j"], others are untouched', () => {
  const items: PwaItineraryItem[] = [
    {
      id: 'item-barharbor-3-1', day_id: 'day-1', time: 'Early Morning',
      text: 'Beehive Trail — Jeremy & Jennie only... Stacy/Justin/Ford: Jordan Pond Loop instead.',
      category: 'hike', booking_id: null, place_id: 'place-barharbor-a-01',
    },
    { id: 'item-other', day_id: 'day-1', text: 'Jordan Pond House popovers', category: 'restaurant', booking_id: null, place_id: 'place-jp-popovers' },
  ];
  const itinerary = transformItinerary(DAYS, items, {});
  const day = itinerary.portland['day-1'];
  expect(day.items[0].id).toBe('item-barharbor-3-1');
  expect(day.items[0].groupIds).toEqual(['group-j']);
  // Every other item is unaffected — no groupIds field materializes for anything else.
  expect(day.items[1].id).toBe('item-other');
  expect(day.items[1].groupIds).toBeUndefined();
});

// ── transformGroups ───────────────────────────────────────────────────────────

test('transformGroups sets memberUids to [uid] only for the group Jeremy is actually in', () => {
  const pwaGroups: PwaGroup[] = [
    { id: 'group-j', name: 'Jeremy & Jennie', members: ['Jeremy', 'Jennie'] },
    { id: 'group-s', name: 'Stacy, Justin & Ford', members: ['Stacy', 'Justin', 'Ford'] },
  ];
  const groups = transformGroups(pwaGroups, OPTS);
  expect(groups['group-j'].memberUids).toEqual(['jeremy-uid']);
  expect(groups['group-s'].memberUids).toEqual([]);
  expect(groups['group-j'].createdBy).toBe('jeremy-uid');
  expect(groups['group-j'].createdAt).toBe(OPTS.now);
});

// ── End-to-end dry run against the REAL bundled snapshot ─────────────────────

describe('buildImportPayload against the real ~/jernie/public/trip.json snapshot', () => {
  const payload = buildImportPayload(realPwaData as unknown as PwaData, OPTS);
  const tripWrite = payload.tripWrite as any;

  test('produces exactly one trip at the expected id', () => {
    expect(payload.tripId).toBe('maine-2026');
    expect(tripWrite.id).toBe('maine-2026');
    expect(tripWrite.ownerUid).toBe('jeremy-uid');
  });

  test('carries all 3 stops, ordered, with derived ISO dates', () => {
    const stopIds = Object.keys(tripWrite.stops);
    expect(stopIds.sort()).toEqual(['barharbor', 'portland', 'swh']);
    expect(tripWrite.stops.portland.order).toBe(0);
    expect(tripWrite.stops.barharbor.order).toBe(1);
    expect(tripWrite.stops.swh.order).toBe(2);
    expect(tripWrite.stops.portland.dates).toEqual({ start: '2026-05-22', end: '2026-05-24' });
  });

  test('merges the rental pickup/dropoff into a single booking, dropping the dropoff id', () => {
    expect(tripWrite.bookings['book-portland-car']).toBeDefined();
    expect(tripWrite.bookings['book-swh-car-dropoff']).toBeUndefined();
    const rental = tripWrite.bookings['book-portland-car'];
    expect(rental.type).toBe('rental');
    expect(rental.stopId).toBe('portland');
    expect(rental.dropoffStopId).toBe('swh');
  });

  test('renames accommodation→hotel and transportation→rental everywhere; flight stays flight', () => {
    const types = new Set(Object.values(tripWrite.bookings).map((b: any) => b.type));
    expect(types).toEqual(new Set(['flight', 'hotel', 'rental']));
  });

  test('builds 2-leg and 1-leg flight bookings correctly', () => {
    const outbound = tripWrite.bookings['book-portland-flights-jj'];
    expect(outbound.legs).toHaveLength(2);
    expect(outbound.legs[0].origin).toBe('CLT');
    expect(outbound.legs[1].destination).toBe('PWM');
    const returnFlight = tripWrite.bookings['book-swh-flights-jj'];
    expect(returnFlight.legs).toHaveLength(1);
    expect(returnFlight.legs[0].departureDate).toBe('2026-05-29');
  });

  test('carries all 54 places with valid categories and sources', () => {
    expect(Object.keys(tripWrite.places)).toHaveLength(54);
    for (const place of Object.values(tripWrite.places) as any[]) {
      expect(['restaurant', 'activity', 'sight', 'hike', 'flight', 'other']).toContain(place.category);
      expect(['curator', 'community']).toContain(place.source);
      expect(place.addedBy).toBe('jeremy-uid');
    }
  });

  test('carries all 9 itinerary days and all 52 items, grouped under the right stop', () => {
    const dayCount = Object.values(tripWrite.itinerary).reduce(
      (sum: number, days: any) => sum + Object.keys(days).length, 0,
    );
    expect(dayCount).toBe(9);
    const itemCount = Object.values(tripWrite.itinerary).reduce(
      (sum: number, days: any) => sum + Object.values(days).reduce(
        (s: number, d: any) => s + d.items.length, 0,
      ), 0,
    );
    expect(itemCount).toBe(52);
    expect(Object.keys(tripWrite.itinerary.portland)).toContain('day-portland-1');
  });

  test('hand-applied override tags only item-barharbor-3-1 with groupIds: ["group-j"]', () => {
    const allItems: any[] = Object.values(tripWrite.itinerary).flatMap(
      (days: any) => Object.values(days).flatMap((d: any) => d.items),
    );
    const beehiveItem = allItems.find((i) => i.id === 'item-barharbor-3-1');
    expect(beehiveItem).toBeDefined();
    expect(beehiveItem.placeId).toBe('place-barharbor-a-01');
    expect(beehiveItem.groupIds).toEqual(['group-j']);

    // No other itinerary item picked up a groupIds field from this override.
    const othersWithGroupIds = allItems.filter((i) => i.id !== 'item-barharbor-3-1' && i.groupIds !== undefined);
    expect(othersWithGroupIds).toEqual([]);
  });

  test('carries both groups with correct memberUids split', () => {
    expect(tripWrite.groups['group-j'].memberUids).toEqual(['jeremy-uid']);
    expect(tripWrite.groups['group-s'].memberUids).toEqual([]);
  });

  test('joins pills into 3 single strings', () => {
    expect(tripWrite.pills).toEqual(['🦞 Seafood-focused', '🏔️ Acadia hiking', '🛏️ Boutique stays']);
  });

  test('the whole payload round-trips through JSON with zero `undefined` values (RTDB would reject them)', () => {
    // JSON.stringify silently drops undefined-valued keys, so compare key counts before/after
    // to make sure nothing snuck an `undefined` into a required-looking spot.
    const assertNoUndefined = (value: unknown, path: string) => {
      if (value === undefined) throw new Error(`undefined value at ${path}`);
      if (Array.isArray(value)) {
        value.forEach((v, i) => assertNoUndefined(v, `${path}[${i}]`));
      } else if (value !== null && typeof value === 'object') {
        for (const [k, v] of Object.entries(value)) assertNoUndefined(v, `${path}.${k}`);
      }
    };
    expect(() => assertNoUndefined(tripWrite, 'tripWrite')).not.toThrow();
    expect(() => assertNoUndefined(payload.step2Update, 'step2Update')).not.toThrow();

    // Round-trip should also produce identical (deep) content — proves nothing relied on a
    // non-JSON-safe value (e.g. a Date object, a function) anywhere in the payload.
    const roundTripped = JSON.parse(JSON.stringify(tripWrite));
    expect(roundTripped).toEqual(tripWrite);
  });

  test('step2Update bundles exactly the 3 prescribed paths', () => {
    expect(Object.keys(payload.step2Update).sort()).toEqual([
      'inviteTokens/test-token-abc',
      'trips/maine-2026/members/jeremy-uid',
      'users/jeremy-uid/trips/maine-2026',
    ]);
    expect(payload.step2Update['trips/maine-2026/members/jeremy-uid']).toMatchObject({
      uid: 'jeremy-uid', role: 'organizer', handle: 'Jeremy',
    });
    expect(payload.step2Update['inviteTokens/test-token-abc']).toBe('maine-2026');
  });
});

// ── runPwaImport I/O wiring (mocked Firebase — never the real project) ───────

describe('runPwaImport (mocked @react-native-firebase/database — no real Firebase touched)', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { mockRef, mockOnce, mockSet, mockUpdate } = jest.requireMock('@react-native-firebase/database');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('refuses to run if trips/maine-2026 already exists', async () => {
    (mockOnce as jest.Mock).mockResolvedValue({ exists: () => true });
    await expect(runPwaImport()).rejects.toThrow(/already exists/);
    expect(mockSet).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  test('writes step 1 (set) before step 2 (update), and only after step 1 resolves', async () => {
    (mockOnce as jest.Mock).mockResolvedValue({ exists: () => false });
    let resolveSet!: () => void;
    (mockSet as jest.Mock).mockReturnValue(new Promise<void>((res) => { resolveSet = res; }));
    (mockUpdate as jest.Mock).mockResolvedValue(undefined);

    const runPromise = runPwaImport();
    await new Promise((r) => setTimeout(r, 0));

    expect(mockSet).toHaveBeenCalledTimes(1);
    expect(mockUpdate).not.toHaveBeenCalled(); // step 2 must not fire before step 1 resolves

    resolveSet();
    const result = await runPromise;

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockRef).toHaveBeenCalledWith('trips/maine-2026');
    expect(result.tripId).toBe('maine-2026');
    expect(typeof result.inviteToken).toBe('string');
    expect(result.inviteToken.length).toBeGreaterThan(10);
  });
});
