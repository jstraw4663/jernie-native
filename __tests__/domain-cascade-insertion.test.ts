import {
  planStopInsertion,
  countAffectedBookings,
  type RouteStop,
  type StopDateShift,
} from '@/src/domain/cascade';
import type { Booking, ItineraryDay } from '@/src/types';

// The design's §03 worked example, verbatim:
//   1 Portland    21 – 24 Sep · 3 nights
//   2 Camden      ← dropped here, 2 nights
//   3 Bar Harbor  24 – 29 Sep · 5 nights
//   4 Lubec       29 Sep – 1 Oct · 2 nights
const ROUTE: RouteStop[] = [
  { id: 'portland',  dates: { start: '2026-09-21', end: '2026-09-24' } },
  { id: 'barHarbor', dates: { start: '2026-09-24', end: '2026-09-29' } },
  { id: 'lubec',     dates: { start: '2026-09-29', end: '2026-10-01' } },
];

describe('planStopInsertion', () => {
  test('derives the new stop\'s dates from the stop it follows', () => {
    // "Dates, from its neighbours — Arrive 24 Sep, Leave 26 Sep, Nights 2"
    expect(planStopInsertion(ROUTE, 1, 2).dates).toEqual({
      start: '2026-09-24',
      end: '2026-09-26',
    });
  });

  test('"push everything later" shifts every following stop by the new nights', () => {
    // "Bar Harbor and Lubec keep their nights. Trip ends 3 Oct instead of 1 Oct."
    const { pushLater } = planStopInsertion(ROUTE, 1, 2);

    expect(pushLater).toEqual([
      {
        stopId: 'barHarbor',
        from: { start: '2026-09-24', end: '2026-09-29' },
        to:   { start: '2026-09-26', end: '2026-10-01' },
      },
      {
        stopId: 'lubec',
        from: { start: '2026-09-29', end: '2026-10-01' },
        to:   { start: '2026-10-01', end: '2026-10-03' },
      },
    ]);
  });

  test('"take them from the next stop" moves only that stop\'s start', () => {
    // "Trip still ends 1 Oct. Bar Harbor drops to 3 nights."
    const { borrowFromNext } = planStopInsertion(ROUTE, 1, 2);

    expect(borrowFromNext).toEqual([
      {
        stopId: 'barHarbor',
        from: { start: '2026-09-24', end: '2026-09-29' },
        to:   { start: '2026-09-26', end: '2026-09-29' },
      },
    ]);
  });

  test('borrowing is unavailable when it would leave the next stop with no nights', () => {
    // Bar Harbor has 5 nights; asking for all 5 would zero it out.
    expect(planStopInsertion(ROUTE, 1, 5).borrowFromNext).toEqual([]);
  });

  test('borrowing is still available when it leaves the next stop one night', () => {
    expect(planStopInsertion(ROUTE, 1, 4).borrowFromNext).toHaveLength(1);
  });

  test('appending to the end of the route shifts nothing', () => {
    const plan = planStopInsertion(ROUTE, ROUTE.length, 2);

    expect(plan.dates).toEqual({ start: '2026-10-01', end: '2026-10-03' });
    expect(plan.pushLater).toEqual([]);
    expect(plan.borrowFromNext).toEqual([]);
  });

  test('inserting before the first stop back-dates the arrival', () => {
    const plan = planStopInsertion(ROUTE, 0, 2);

    expect(plan.dates).toEqual({ start: '2026-09-19', end: '2026-09-21' });
  });

  test('a route with no stops yields no dates to derive from', () => {
    expect(planStopInsertion([], 0, 2).dates).toBeNull();
  });
});

// "— 2 booked items move day." The number that makes the cost concrete.
describe('countAffectedBookings', () => {
  const SHIFTS: StopDateShift[] = [
    {
      stopId: 'barHarbor',
      from: { start: '2026-09-24', end: '2026-09-29' },
      to:   { start: '2026-09-26', end: '2026-10-01' },
    },
  ];

  const itinerary: Record<string, ItineraryDay[]> = {
    barHarbor: [
      {
        id: 'day-1',
        stopId: 'barHarbor',
        dateIso: '2026-09-24',
        items: [
          { id: 'i1', type: 'booking', bookingId: 'b-hotel', order: 0 },
          { id: 'i2', type: 'custom', label: 'Walk the shore path', order: 1 },
        ],
      },
      {
        id: 'day-2',
        stopId: 'barHarbor',
        dateIso: '2026-09-25',
        items: [{ id: 'i3', type: 'booking', bookingId: 'b-dinner', order: 0 }],
      },
    ],
    lubec: [
      {
        id: 'day-9',
        stopId: 'lubec',
        dateIso: '2026-09-29',
        items: [{ id: 'i9', type: 'booking', bookingId: 'b-other', order: 0 }],
      },
    ],
  };

  const bookings: Booking[] = [];

  test('counts booking-backed items sitting in a shifted stop', () => {
    expect(countAffectedBookings(SHIFTS, bookings, itinerary)).toBe(2);
  });

  test('ignores items in stops that are not shifting', () => {
    // b-other lives in Lubec, which no shift touches.
    const count = countAffectedBookings(SHIFTS, bookings, itinerary);
    expect(count).toBe(2);
  });

  test('does not count custom or place items — only booked ones move a reservation', () => {
    const customOnly: Record<string, ItineraryDay[]> = {
      barHarbor: [
        {
          id: 'day-1',
          stopId: 'barHarbor',
          dateIso: '2026-09-24',
          items: [
            { id: 'i1', type: 'custom', label: 'Walk', order: 0 },
            { id: 'i2', type: 'place', placeId: 'p1', order: 1 },
          ],
        },
      ],
    };

    expect(countAffectedBookings(SHIFTS, bookings, customOnly)).toBe(0);
  });

  test('no shifts means nothing moves', () => {
    expect(countAffectedBookings([], bookings, itinerary)).toBe(0);
  });
});

// The two shift kinds are not the same operation, and the count has to tell them apart:
//   push-later  moves BOTH ends → the stop translates, so every item changes day
//   borrow      moves only the START → the stop truncates, so only items that fall off
//               the front change day; everything from the new start onward stays put
describe('countAffectedBookings — truncation vs translation', () => {
  const itinerary: Record<string, ItineraryDay[]> = {
    barHarbor: [
      {
        id: 'day-1', stopId: 'barHarbor', dateIso: '2026-09-24',
        items: [{ id: 'i1', type: 'booking', bookingId: 'b-early', order: 0 }],
      },
      {
        id: 'day-4', stopId: 'barHarbor', dateIso: '2026-09-27',
        items: [{ id: 'i4', type: 'booking', bookingId: 'b-late', order: 0 }],
      },
    ],
  };

  test('borrowing only moves items that fall off the front of the stop', () => {
    const borrow: StopDateShift[] = [{
      stopId: 'barHarbor',
      from: { start: '2026-09-24', end: '2026-09-29' },
      to:   { start: '2026-09-26', end: '2026-09-29' },   // end unchanged → truncation
    }];

    // 24 Sep falls outside the new window and moves; 27 Sep is untouched.
    expect(countAffectedBookings(borrow, [], itinerary)).toBe(1);
  });

  test('pushing later moves every item in the stop', () => {
    const push: StopDateShift[] = [{
      stopId: 'barHarbor',
      from: { start: '2026-09-24', end: '2026-09-29' },
      to:   { start: '2026-09-26', end: '2026-10-01' },   // both ends moved → translation
    }];

    expect(countAffectedBookings(push, [], itinerary)).toBe(2);
  });

  test('a booking with no itinerary item still counts when its stop shifts', () => {
    // addBooking writes only trips/{id}/bookings/{id} — it never creates an itinerary
    // item — so a hotel can be anchored to a stop with nothing referencing it. Its
    // check-in/check-out dates move all the same.
    const standalone: Booking[] = [
      {
        id: 'b-standalone', tripId: 't1', stopId: 'barHarbor', type: 'hotel',
        hotelName: 'Bluenose Inn', checkIn: '2026-09-24', checkOut: '2026-09-29',
      },
    ];

    const push: StopDateShift[] = [{
      stopId: 'barHarbor',
      from: { start: '2026-09-24', end: '2026-09-29' },
      to:   { start: '2026-09-26', end: '2026-10-01' },
    }];

    // 2 booking-backed items + 1 unreferenced booking, counted once each.
    expect(countAffectedBookings(push, standalone, itinerary)).toBe(3);
  });

  test('a booking already counted through its itinerary item is not counted twice', () => {
    const referenced: Booking[] = [
      {
        id: 'b-early', tripId: 't1', stopId: 'barHarbor', type: 'hotel',
        hotelName: 'Bluenose Inn', checkIn: '2026-09-24', checkOut: '2026-09-29',
      },
    ];

    const push: StopDateShift[] = [{
      stopId: 'barHarbor',
      from: { start: '2026-09-24', end: '2026-09-29' },
      to:   { start: '2026-09-26', end: '2026-10-01' },
    }];

    expect(countAffectedBookings(push, referenced, itinerary)).toBe(2);
  });
});
