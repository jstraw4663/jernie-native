import { deriveCoverage, gapsForStop, gapsOfKind, type CoverageInput } from '@/src/domain/gaps';
import type { Booking, ItineraryDay, ItineraryItem, Stop } from '@/src/types';

// The canvas's own trip, so the strings these assert are the strings the design writes:
// Portland 22–24, Bar Harbor 24–27, Southwest Harbor 27–29. Seven nights.
const PORTLAND  = { id: 'stop-a', city: 'Portland',          dates: { start: '2026-05-22', end: '2026-05-24' } };
const BAR_HBR   = { id: 'stop-b', city: 'Bar Harbor',        dates: { start: '2026-05-24', end: '2026-05-27' } };
const SW_HBR    = { id: 'stop-c', city: 'Southwest Harbor',  dates: { start: '2026-05-27', end: '2026-05-29' } };
const STOPS: Pick<Stop, 'id' | 'city' | 'dates'>[] = [PORTLAND, BAR_HBR, SW_HBR];

let seq = 0;
const hotel = (stopId: string, checkIn: string, checkOut: string): Booking => ({
  id: `h${seq++}`, tripId: 't', stopId, type: 'hotel', hotelName: 'A bed', checkIn, checkOut,
});
const rental = (stopId: string, pickupDate: string, dropoffDate: string): Booking => ({
  id: `r${seq++}`, tripId: 't', stopId, type: 'rental', company: 'Hertz',
  pickupDate, dropoffDate, pickupLocation: 'PWM', dropoffLocation: 'PWM',
});
const flight = (stopId: string, departureDate: string): Booking => ({
  id: `f${seq++}`, tripId: 't', stopId, type: 'flight',
  legs: [{
    flightNumber: '2412', airline: 'Delta', origin: 'BOS', destination: 'PWM',
    departureDate, departureTime: '07:15', arrivalTime: '08:22',
  }],
});
const table = (stopId: string, date: string): Booking => ({
  id: `t${seq++}`, tripId: 't', stopId, type: 'restaurant', restaurantName: 'Duckfat', date,
});

function days(stopId: string, entries: Record<string, Partial<ItineraryItem>[]>): ItineraryDay[] {
  return Object.entries(entries).map(([dateIso, items], d) => ({
    id: `${stopId}-${d}`,
    stopId,
    dateIso,
    items: items.map((i, n) => ({ id: `${stopId}-${d}-${n}`, type: 'custom', order: n, ...i }) as ItineraryItem),
  }));
}

const derive = (over: Partial<CoverageInput> = {}) =>
  deriveCoverage({ stops: STOPS, bookings: [], ...over });

// Every stop covered, so the "no gaps" assertions below are about the rule and not about
// an empty fixture.
const FULLY_BOOKED: Booking[] = [
  hotel('stop-a', '2026-05-22', '2026-05-24'),
  hotel('stop-b', '2026-05-24', '2026-05-27'),
  hotel('stop-c', '2026-05-27', '2026-05-29'),
  rental('stop-a', '2026-05-22', '2026-05-29'),
];

describe('deriveCoverage — nights and the departure-date convention', () => {
  test('a stop is `end − start` nights: May 22 – 24 is two', () => {
    const { stops, nights } = derive();
    expect(stops.map(s => s.nights)).toEqual([2, 3, 2]);
    expect(nights).toBe(7);
  });

  test('a hotel covers [checkIn, checkOut) — the checkout morning is not a night', () => {
    const { stops } = derive({ bookings: [hotel('stop-a', '2026-05-22', '2026-05-24')] });
    expect(stops[0]).toMatchObject({ nights: 2, nightsCovered: 2, stay: 'covered' });
  });

  test('a day trip generates nothing of either kind', () => {
    const { stops, gaps } = deriveCoverage({
      stops: [{ id: 'd', city: 'Freeport', dates: { start: '2026-05-23', end: '2026-05-23' } }],
      bookings: [],
    });
    expect(stops[0]).toMatchObject({ nights: 0, stay: 'covered', transport: 'covered' });
    expect(gaps).toEqual([]);
  });

  test('nothing booked at all is every gap, and no throw', () => {
    const { gaps, nightsCovered, stopsWithStay, stopsWithTransport } = derive();
    expect(nightsCovered).toBe(0);
    expect(stopsWithStay).toBe(0);
    expect(stopsWithTransport).toBe(0);
    expect(gaps).toHaveLength(6);   // three stops × two kinds
  });

  test('a fully booked trip has no gaps', () => {
    const { gaps, nightsCovered, stopsWithStay, stopsWithTransport } = derive({ bookings: FULLY_BOOKED });
    expect(gaps).toEqual([]);
    expect(nightsCovered).toBe(7);
    expect(stopsWithStay).toBe(3);
    expect(stopsWithTransport).toBe(3);
  });
});

describe('deriveCoverage — stay gaps', () => {
  test('the canvas case, string for string', () => {
    const coverage = derive({
      bookings: [
        hotel('stop-a', '2026-05-22', '2026-05-24'),
        hotel('stop-b', '2026-05-24', '2026-05-27'),
        rental('stop-a', '2026-05-22', '2026-05-29'),
      ],
    });
    expect(gapsOfKind(coverage, 'stay')).toEqual([
      expect.objectContaining({
        kind: 'stay',
        stopId: 'stop-c',
        from: '2026-05-27',
        to: '2026-05-29',
        nights: 2,
        title: 'Nowhere to sleep in Southwest Harbor',
        sub: 'May 27 – 29 · 2 nights unbooked',
      }),
    ]);
  });

  test('one night reads as one night', () => {
    const { gaps } = derive({
      bookings: [hotel('stop-b', '2026-05-24', '2026-05-26'), rental('stop-a', '2026-05-22', '2026-05-29')],
      stops: [BAR_HBR],
    });
    expect(gaps[0].sub).toBe('May 26 – 27 · 1 night unbooked');
  });

  test('a partly covered stop is `partial`, and the gap names only the uncovered run', () => {
    const { stops, gaps } = derive({
      bookings: [hotel('stop-b', '2026-05-24', '2026-05-26')],
      stops: [BAR_HBR],
    });
    expect(stops[0]).toMatchObject({ nights: 3, nightsCovered: 2, stay: 'partial' });
    const stay = gaps.filter(g => g.kind === 'stay');
    expect(stay).toHaveLength(1);
    expect(stay[0]).toMatchObject({ from: '2026-05-26', to: '2026-05-27', nights: 1 });
  });

  test('two holes in one stop are two gaps, not one range spanning the booked night', () => {
    const stop = { id: 's', city: 'Camden', dates: { start: '2026-05-01', end: '2026-05-05' } };
    const { gaps } = derive({ stops: [stop], bookings: [hotel('s', '2026-05-02', '2026-05-03')] });
    const stay = gaps.filter(g => g.kind === 'stay');
    expect(stay.map(g => [g.from, g.to])).toEqual([
      ['2026-05-01', '2026-05-02'],
      ['2026-05-03', '2026-05-05'],
    ]);
  });

  test('a hotel spanning the changeover covers the next stop\'s first night, despite its stopId', () => {
    // Tagged to Portland, but in on the 22nd and out on the 25th — the 24th is Bar Harbor's
    // first night and it genuinely has a bed. Asking dates rather than stopId is the point.
    const { stops } = derive({ bookings: [hotel('stop-a', '2026-05-22', '2026-05-25')] });
    expect(stops[0]).toMatchObject({ stay: 'covered' });
    expect(stops[1]).toMatchObject({ nightsCovered: 1, stay: 'partial' });
  });

  test('a `sleep` itinerary item covers the night, so staying with friends is not a gap', () => {
    const { stops, gaps } = derive({
      stops: [SW_HBR],
      itinerary: { 'stop-c': days('stop-c', {
        '2026-05-27': [{ label: 'Sarah\'s spare room', category: 'stay' }],
        '2026-05-28': [{ label: 'Sarah\'s spare room', category: 'stay' }],
      }) },
    });
    expect(stops[0]).toMatchObject({ nightsCovered: 2, stay: 'covered' });
    expect(gaps.filter(g => g.kind === 'stay')).toEqual([]);
  });

  test('an itinerary item that only references an already-counted booking adds no bed', () => {
    const b = hotel('stop-c', '2026-05-27', '2026-05-28');
    const { stops } = derive({
      stops: [SW_HBR],
      bookings: [b],
      itinerary: { 'stop-c': days('stop-c', {
        '2026-05-28': [{ type: 'booking', bookingId: b.id, category: 'stay' }],
      }) },
    });
    expect(stops[0]).toMatchObject({ nightsCovered: 1, stay: 'partial' });
  });
});

describe('deriveCoverage — transport gaps', () => {
  test('a rental covers every stop its window reaches', () => {
    const { stops } = derive({ bookings: [rental('stop-a', '2026-05-22', '2026-05-26')] });
    expect(stops.map(s => s.transport)).toEqual(['covered', 'covered', 'none']);
  });

  test('the canvas case: the car drops off before you arrive', () => {
    const { gaps } = derive({ bookings: [...FULLY_BOOKED.slice(0, 3), rental('stop-a', '2026-05-22', '2026-05-26')] });
    expect(gaps).toEqual([
      expect.objectContaining({
        kind: 'transport',
        stopId: 'stop-c',
        title: 'No transport in Southwest Harbor',
        sub: 'May 27 – 29 · the car drops off before you arrive',
      }),
    ]);
  });

  test('a car picked up later explains itself that way instead', () => {
    const { gaps } = derive({ stops: [PORTLAND], bookings: [rental('stop-b', '2026-05-25', '2026-05-29')] });
    expect(gaps.find(g => g.kind === 'transport')?.sub)
      .toBe('May 22 – 24 · the car is picked up after you leave');
  });

  test('with no transport anywhere, the sub says exactly that', () => {
    const { gaps } = derive({ stops: [PORTLAND] });
    expect(gaps.find(g => g.kind === 'transport')?.sub)
      .toBe('May 22 – 24 · nothing booked to get around');
  });

  test('a flight covers the stop it departs in', () => {
    const { stops } = derive({ stops: [PORTLAND], bookings: [flight('stop-a', '2026-05-22')] });
    expect(stops[0].transport).toBe('covered');
  });

  test('a `move` itinerary item covers the stop, so driving your own car is not a gap', () => {
    const { stops } = derive({
      stops: [SW_HBR],
      itinerary: { 'stop-c': days('stop-c', {
        '2026-05-27': [{ label: 'Drive down from Bar Harbor', category: 'transport' }],
      }) },
    });
    expect(stops[0].transport).toBe('covered');
  });

  test('a table and a hike are preferences — neither covers nor gaps', () => {
    const { stops, gaps } = derive({
      stops: [PORTLAND],
      bookings: [hotel('stop-a', '2026-05-22', '2026-05-24'), table('stop-a', '2026-05-22')],
      itinerary: { 'stop-a': days('stop-a', { '2026-05-23': [{ label: 'Acadia', category: 'hike' }] }) },
    });
    expect(stops[0]).toMatchObject({ stay: 'covered', transport: 'none' });
    expect(gaps.map(g => g.kind)).toEqual(['transport']);
  });

  test('transport is measured over the nights, not the days — a car returned on the morning you leave still counted', () => {
    // Picked up the 22nd, dropped the morning of the 24th: it was with you both nights.
    const { stops } = derive({ stops: [PORTLAND], bookings: [rental('stop-a', '2026-05-22', '2026-05-24')] });
    expect(stops[0].transport).toBe('covered');
  });
});

describe('gap ordering and selectors', () => {
  test('gaps come out chronologically by stop, stay before transport within one', () => {
    const { gaps } = derive();
    expect(gaps.map(g => `${g.stopId}:${g.kind}`)).toEqual([
      'stop-a:stay', 'stop-a:transport',
      'stop-b:stay', 'stop-b:transport',
      'stop-c:stay', 'stop-c:transport',
    ]);
  });

  test('ids are stable and unique, so a list can key on them', () => {
    const { gaps } = derive();
    expect(new Set(gaps.map(g => g.id)).size).toBe(gaps.length);
    expect(derive().gaps.map(g => g.id)).toEqual(gaps.map(g => g.id));
  });

  test('selectors slice by stop and by kind', () => {
    const coverage = derive();
    expect(gapsForStop(coverage, 'stop-b').map(g => g.kind)).toEqual(['stay', 'transport']);
    expect(gapsOfKind(coverage, 'transport')).toHaveLength(3);
  });
});
