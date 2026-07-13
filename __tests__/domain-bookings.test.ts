import { isTodayBooking, getBookingDisplay, getFlightEndpoints, bookingBelongsToStop } from '@/src/domain/bookings';
import type { Booking, FlightBooking, HotelBooking, RentalBooking, RestaurantBooking } from '@/src/types';

// ── isTodayBooking ───────────────────────────────────────────────────────────

const testFlightBooking: FlightBooking = {
  id: 'flight-1',
  tripId: 'trip-1',
  stopId: 'stop-1',
  type: 'flight',
  legs: [
    {
      airline: 'JetBlue',
      flightNumber: 'B6 274',
      origin: 'BOS',
      destination: 'PWM',
      departureDate: '2026-07-10',
      departureTime: '7:15 AM',
      arrivalTime: '8:22 AM',
    },
  ],
  confirmationCode: 'JBLMNE',
};

const testFlightBookingMultiLeg: FlightBooking = {
  id: 'flight-multi',
  tripId: 'trip-1',
  stopId: 'stop-1',
  type: 'flight',
  legs: [
    {
      airline: 'JetBlue',
      flightNumber: 'B6 274',
      origin: 'BOS',
      destination: 'CLT',
      departureDate: '2026-07-10',
      departureTime: '7:15 AM',
      arrivalTime: '8:22 AM',
    },
    {
      airline: 'JetBlue',
      flightNumber: 'B6 275',
      origin: 'CLT',
      destination: 'PWM',
      departureDate: '2026-07-10',
      departureTime: '10:00 AM',
      arrivalTime: '12:15 PM',
    },
  ],
  confirmationCode: 'JBLMNE',
};

const testHotelBooking: HotelBooking = {
  id: 'hotel-1',
  tripId: 'trip-1',
  stopId: 'stop-1',
  type: 'hotel',
  hotelName: 'Press Hotel',
  checkIn: '2026-07-10',
  checkOut: '2026-07-12',
  confirmationCode: 'PHR2026',
};

const testRentalBooking: RentalBooking = {
  id: 'rental-1',
  tripId: 'trip-1',
  stopId: 'stop-1',
  type: 'rental',
  company: 'Enterprise',
  carType: 'Compact SUV',
  pickupDate: '2026-07-10',
  pickupTime: '9:00 AM',
  dropoffDate: '2026-07-15',
  dropoffTime: '4:00 PM',
  pickupLocation: 'Portland Jetport',
  dropoffLocation: 'Trenton, ME',
};

const testRestaurantBooking: RestaurantBooking = {
  id: 'restaurant-1',
  tripId: 'trip-1',
  stopId: 'stop-1',
  type: 'restaurant',
  restaurantName: 'Eventide Oyster Co.',
  date: '2026-07-10',
  time: '7:30 PM',
  partySize: 2,
};

// ── isTodayBooking: FlightBooking ────────────────────────────────────────────

test('isTodayBooking: flight returns true when departure date matches today', () => {
  expect(isTodayBooking(testFlightBooking, '2026-07-10')).toBe(true);
});

test('isTodayBooking: flight returns false when departure date is before today', () => {
  expect(isTodayBooking(testFlightBooking, '2026-07-11')).toBe(false);
});

test('isTodayBooking: flight with multi-leg returns true when any leg departs today', () => {
  expect(isTodayBooking(testFlightBookingMultiLeg, '2026-07-10')).toBe(true);
});

// ── isTodayBooking: HotelBooking ─────────────────────────────────────────────

test('isTodayBooking: hotel returns true on check-in date', () => {
  expect(isTodayBooking(testHotelBooking, '2026-07-10')).toBe(true);
});

test('isTodayBooking: hotel returns true during stay', () => {
  expect(isTodayBooking(testHotelBooking, '2026-07-11')).toBe(true);
});

test('isTodayBooking: hotel returns true on check-out date', () => {
  expect(isTodayBooking(testHotelBooking, '2026-07-12')).toBe(true);
});

test('isTodayBooking: hotel returns false before check-in', () => {
  expect(isTodayBooking(testHotelBooking, '2026-07-09')).toBe(false);
});

test('isTodayBooking: hotel returns false after check-out', () => {
  expect(isTodayBooking(testHotelBooking, '2026-07-13')).toBe(false);
});

// ── isTodayBooking: RentalBooking ────────────────────────────────────────────

test('isTodayBooking: rental returns true on pickup date', () => {
  expect(isTodayBooking(testRentalBooking, '2026-07-10')).toBe(true);
});

test('isTodayBooking: rental returns true during rental period', () => {
  expect(isTodayBooking(testRentalBooking, '2026-07-12')).toBe(true);
});

test('isTodayBooking: rental returns true on dropoff date', () => {
  expect(isTodayBooking(testRentalBooking, '2026-07-15')).toBe(true);
});

test('isTodayBooking: rental returns false before pickup', () => {
  expect(isTodayBooking(testRentalBooking, '2026-07-09')).toBe(false);
});

test('isTodayBooking: rental returns false after dropoff', () => {
  expect(isTodayBooking(testRentalBooking, '2026-07-16')).toBe(false);
});

// ── isTodayBooking: RestaurantBooking ────────────────────────────────────────

test('isTodayBooking: restaurant returns true on reservation date', () => {
  expect(isTodayBooking(testRestaurantBooking, '2026-07-10')).toBe(true);
});

test('isTodayBooking: restaurant returns false on other dates', () => {
  expect(isTodayBooking(testRestaurantBooking, '2026-07-11')).toBe(false);
  expect(isTodayBooking(testRestaurantBooking, '2026-07-09')).toBe(false);
});

// ── getBookingDisplay ────────────────────────────────────────────────────────

test('getBookingDisplay: flight returns correct structure', () => {
  const display = getBookingDisplay(testFlightBooking, '2026-07-10');
  expect(display).toHaveProperty('emoji');
  expect(display).toHaveProperty('label');
  expect(display).toHaveProperty('meta');
  expect(display.emoji).toBe('✈️');
});

test('getBookingDisplay: flight label includes airline and flight number', () => {
  const display = getBookingDisplay(testFlightBooking, '2026-07-10');
  expect(display.label).toContain('JetBlue');
  expect(display.label).toContain('B6 274');
});

test('getBookingDisplay: flight meta includes origin and destination', () => {
  const display = getBookingDisplay(testFlightBooking, '2026-07-10');
  expect(display.meta).toContain('BOS');
  expect(display.meta).toContain('PWM');
});

test('getBookingDisplay: flight meta includes times', () => {
  const display = getBookingDisplay(testFlightBooking, '2026-07-10');
  expect(display.meta).toContain('7:15 AM');
  expect(display.meta).toContain('8:22 AM');
});

test('getBookingDisplay: multi-leg flight shows first and last leg', () => {
  const display = getBookingDisplay(testFlightBookingMultiLeg, '2026-07-10');
  // First leg origin and last leg destination
  expect(display.meta).toContain('BOS');
  expect(display.meta).toContain('PWM');
  // Times from first and last leg
  expect(display.meta).toContain('7:15 AM');
  expect(display.meta).toContain('12:15 PM');
});

test('getBookingDisplay: hotel returns correct structure', () => {
  const display = getBookingDisplay(testHotelBooking, '2026-07-10');
  expect(display.emoji).toBe('🏨');
  expect(display).toHaveProperty('label');
  expect(display).toHaveProperty('meta');
});

test('getBookingDisplay: hotel label is hotel name', () => {
  const display = getBookingDisplay(testHotelBooking, '2026-07-10');
  expect(display.label).toContain('Press Hotel');
});

test('getBookingDisplay: hotel meta includes check-in and check-out dates', () => {
  const display = getBookingDisplay(testHotelBooking, '2026-07-10');
  expect(display.meta).toContain('2026-07-10');
  expect(display.meta).toContain('2026-07-12');
});

test('getBookingDisplay: rental returns correct structure', () => {
  const display = getBookingDisplay(testRentalBooking, '2026-07-10');
  expect(display.emoji).toBe('🚗');
  expect(display).toHaveProperty('label');
  expect(display).toHaveProperty('meta');
});

test('getBookingDisplay: rental label includes company and car type', () => {
  const display = getBookingDisplay(testRentalBooking, '2026-07-10');
  expect(display.label).toContain('Enterprise');
  expect(display.label).toContain('Compact SUV');
});

test('getBookingDisplay: rental meta includes pickup and dropoff dates', () => {
  const display = getBookingDisplay(testRentalBooking, '2026-07-10');
  expect(display.meta).toContain('2026-07-10');
  expect(display.meta).toContain('2026-07-15');
});

test('getBookingDisplay: restaurant returns correct structure', () => {
  const display = getBookingDisplay(testRestaurantBooking, '2026-07-10');
  expect(display.emoji).toBe('🍽️');
  expect(display).toHaveProperty('label');
  expect(display).toHaveProperty('meta');
});

test('getBookingDisplay: restaurant label is restaurant name', () => {
  const display = getBookingDisplay(testRestaurantBooking, '2026-07-10');
  expect(display.label).toContain('Eventide Oyster Co.');
});

test('getBookingDisplay: restaurant meta includes date and time', () => {
  const display = getBookingDisplay(testRestaurantBooking, '2026-07-10');
  expect(display.meta).toContain('2026-07-10');
  expect(display.meta).toContain('7:30 PM');
});

// ── getFlightEndpoints ───────────────────────────────────────────────────────

test('getFlightEndpoints: single-leg flight returns that leg as both first and last', () => {
  const { firstLeg, lastLeg } = getFlightEndpoints(testFlightBooking);
  expect(firstLeg.origin).toBe('BOS');
  expect(lastLeg.destination).toBe('PWM');
});

test('getFlightEndpoints: multi-leg flight returns first and last legs', () => {
  const { firstLeg, lastLeg } = getFlightEndpoints(testFlightBookingMultiLeg);
  expect(firstLeg.origin).toBe('BOS');
  expect(firstLeg.destination).toBe('CLT');
  expect(lastLeg.origin).toBe('CLT');
  expect(lastLeg.destination).toBe('PWM');
});

test('getFlightEndpoints: empty legs array falls back to placeholder legs instead of crashing', () => {
  const emptyLegsBooking: FlightBooking = { ...testFlightBooking, legs: [] };
  const { firstLeg, lastLeg } = getFlightEndpoints(emptyLegsBooking);
  expect(firstLeg).toBeDefined();
  expect(lastLeg).toBeDefined();
  expect(firstLeg.origin).toBe('—');
  expect(lastLeg.destination).toBe('—');
});

test('getFlightEndpoints: missing legs property (stale/legacy data) falls back without throwing', () => {
  // Simulates real stale data from before `legs` existed on FlightBooking — the type
  // says `legs` is required, but a legacy record read from RTDB/cache can genuinely
  // lack it at runtime. `b.legs[0]` on `undefined` would throw before `??` could help.
  const { legs, ...legacyBookingWithoutLegs } = testFlightBooking;
  const { firstLeg, lastLeg } = getFlightEndpoints(legacyBookingWithoutLegs as unknown as FlightBooking);
  expect(firstLeg).toBeDefined();
  expect(lastLeg).toBeDefined();
  expect(firstLeg.origin).toBe('—');
  expect(lastLeg.destination).toBe('—');
});

// ── bookingBelongsToStop ─────────────────────────────────────────────────────

const testRentalBookingCrossStop: RentalBooking = {
  ...testRentalBooking,
  id: 'rental-cross-stop',
  stopId: 'stop-1',
  dropoffStopId: 'stop-2',
};

test('bookingBelongsToStop: matches on stopId for a same-stop booking', () => {
  expect(bookingBelongsToStop(testHotelBooking, 'stop-1')).toBe(true);
});

test('bookingBelongsToStop: does not match an unrelated stop', () => {
  expect(bookingBelongsToStop(testHotelBooking, 'stop-2')).toBe(false);
});

test('bookingBelongsToStop: cross-stop rental matches its pickup stopId', () => {
  expect(bookingBelongsToStop(testRentalBookingCrossStop, 'stop-1')).toBe(true);
});

test('bookingBelongsToStop: cross-stop rental also matches its dropoffStopId', () => {
  expect(bookingBelongsToStop(testRentalBookingCrossStop, 'stop-2')).toBe(true);
});

test('bookingBelongsToStop: cross-stop rental does not match an unrelated stop', () => {
  expect(bookingBelongsToStop(testRentalBookingCrossStop, 'stop-3')).toBe(false);
});

test('bookingBelongsToStop: non-rental booking type ignores dropoffStopId-shaped matches', () => {
  // A flight never has dropoffStopId, so only its own stopId should match.
  expect(bookingBelongsToStop(testFlightBooking, testFlightBooking.stopId)).toBe(true);
  expect(bookingBelongsToStop(testFlightBooking, 'stop-2')).toBe(false);
});
