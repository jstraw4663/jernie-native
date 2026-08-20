// Mock devTime to avoid MMKV in tests
jest.mock('@/src/utils/devTime', () => ({
  getDevNow: () => new Date(),
}));

import {
  parseFlightDate,
  formatCountdown,
  getAutoExpandDayIndex,
  getFlightPhase,
  getRentalPhase,
  getActiveStopId,
  getStopColor,
} from '@/src/domain/trip';
import type { ItineraryDay, Stop, Trip } from '@/src/types';

// parseFlightDate
test('parseFlightDate handles ISO string', () => {
  const d = parseFlightDate('2026-05-26T14:30:00');
  expect(d).not.toBeNull();
  expect(d!.getHours()).toBe(14);
});

test('parseFlightDate handles "YYYY-MM-DD H:MM AM" format (Safari-safe)', () => {
  const d = parseFlightDate('2026-05-26 6:00 AM');
  expect(d).not.toBeNull();
  expect(d!.getHours()).toBe(6);
  expect(d!.getMinutes()).toBe(0);
});

test('parseFlightDate handles PM correctly', () => {
  const d = parseFlightDate('2026-05-26 6:30 PM');
  expect(d).not.toBeNull();
  expect(d!.getHours()).toBe(18);
});

test('parseFlightDate returns null for invalid input', () => {
  expect(parseFlightDate('')).toBeNull();
  expect(parseFlightDate('not-a-date')).toBeNull();
});

// formatCountdown
test('formatCountdown: < 1 min', () => {
  expect(formatCountdown(0)).toBe('< 1m');
  expect(formatCountdown(-1000)).toBe('< 1m');
});

test('formatCountdown: minutes only', () => {
  expect(formatCountdown(45 * 60_000)).toBe('45m');
});

test('formatCountdown: hours and minutes', () => {
  expect(formatCountdown((2 * 60 + 15) * 60_000)).toBe('2h 15m');
});

test('formatCountdown: exact hours', () => {
  expect(formatCountdown(3 * 60 * 60_000)).toBe('3h');
});

// getAutoExpandDayIndex
const makeDays = (isos: string[]): ItineraryDay[] =>
  isos.map((dateIso, i) => ({ id: `d${i}`, stopId: 's1', dateIso, items: [] }));

test('getAutoExpandDayIndex: pre-trip returns 0', () => {
  const days = makeDays(['2026-06-01', '2026-06-02', '2026-06-03']);
  expect(getAutoExpandDayIndex(days, new Date('2026-05-29'))).toBe(0);
});

test('getAutoExpandDayIndex: post-trip returns -1', () => {
  const days = makeDays(['2026-05-22', '2026-05-23', '2026-05-24']);
  expect(getAutoExpandDayIndex(days, new Date('2026-05-29'))).toBe(-1);
});

test('getAutoExpandDayIndex: during trip returns matching day index', () => {
  const days = makeDays(['2026-05-26', '2026-05-27', '2026-05-28']);
  expect(getAutoExpandDayIndex(days, new Date('2026-05-27'))).toBe(1);
});

// getFlightPhase
test('getFlightPhase: pre when > 24h before departure', () => {
  const now = new Date('2026-05-25T10:00:00');
  expect(getFlightPhase('2026-05-27T08:00:00', '2026-05-27T11:00:00', now)).toBe('pre');
});

test('getFlightPhase: window when within 24h', () => {
  const now = new Date('2026-05-26T10:00:00');
  expect(getFlightPhase('2026-05-27T08:00:00', '2026-05-27T11:00:00', now)).toBe('window');
});

test('getFlightPhase: completed when > 2h after arrival', () => {
  const now = new Date('2026-05-27T14:00:00');
  expect(getFlightPhase('2026-05-27T08:00:00', '2026-05-27T11:00:00', now)).toBe('completed');
});

// getRentalPhase
test('getRentalPhase: pre when today < pickup', () => {
  expect(getRentalPhase('2026-05-27', '2026-05-29', new Date('2026-05-26'))).toBe('pre');
});

test('getRentalPhase: active when between pickup and dropoff', () => {
  expect(getRentalPhase('2026-05-26', '2026-05-29', new Date('2026-05-27'))).toBe('active');
});

test('getRentalPhase: return-day when today === dropoff', () => {
  expect(getRentalPhase('2026-05-26', '2026-05-29', new Date('2026-05-29'))).toBe('return-day');
});

test('getRentalPhase: returned when today > dropoff', () => {
  expect(getRentalPhase('2026-05-26', '2026-05-29', new Date('2026-05-30'))).toBe('returned');
});

// getActiveStopId
const TEST_STOPS: Stop[] = [
  {
    id: 'stop-a', tripId: 't1', city: 'Portland', region: 'ME', emoji: '🦞',
    lat: 43.6615, lon: -70.2553,
    dates: { start: '2026-07-10', end: '2026-07-12' },
    order: 0,
  },
  {
    id: 'stop-b', tripId: 't1', city: 'Bar Harbor', region: 'ME', emoji: '⛵',
    lat: 44.3876, lon: -68.2039,
    dates: { start: '2026-07-12', end: '2026-07-15' },
    order: 1,
  },
];

test('getActiveStopId: returns first stop when pre-trip', () => {
  expect(getActiveStopId(TEST_STOPS, new Date('2026-06-01T12:00:00'))).toBe('stop-a');
});

test('getActiveStopId: returns matching stop during trip (first stop)', () => {
  expect(getActiveStopId(TEST_STOPS, new Date('2026-07-10T12:00:00'))).toBe('stop-a');
});

test('getActiveStopId: returns matching stop during trip (second stop)', () => {
  expect(getActiveStopId(TEST_STOPS, new Date('2026-07-12T12:00:00'))).toBe('stop-b');
});

test('getActiveStopId: returns last stop post-trip', () => {
  expect(getActiveStopId(TEST_STOPS, new Date('2026-07-20T12:00:00'))).toBe('stop-b');
});

test('getActiveStopId: returns null for empty stops array', () => {
  expect(getActiveStopId([], new Date())).toBeNull();
});

// getStopColor
const TEST_TRIP: Pick<Trip, 'colorPack'> = {
  colorPack: {
    id: 'coastal',
    stopColors: ['#2C5880', '#1E7B8C', '#2F6B47'],
    heroGradient: ['#0D2B3E', '#2C5880'],
  },
};

test('getStopColor: returns the color at the stop\'s order', () => {
  expect(getStopColor({ order: 0 }, TEST_TRIP)).toBe('#2C5880');
  expect(getStopColor({ order: 1 }, TEST_TRIP)).toBe('#1E7B8C');
  expect(getStopColor({ order: 2 }, TEST_TRIP)).toBe('#2F6B47');
});

test('getStopColor: cycles when order >= stopColors.length', () => {
  expect(getStopColor({ order: 3 }, TEST_TRIP)).toBe('#2C5880');  // 3 % 3 === 0
  expect(getStopColor({ order: 4 }, TEST_TRIP)).toBe('#1E7B8C');  // 4 % 3 === 1
  expect(getStopColor({ order: 5 }, TEST_TRIP)).toBe('#2F6B47');  // 5 % 3 === 2
});

// compareStopsChronologically
import { compareStopsChronologically } from '@/src/domain/trip';

describe('compareStopsChronologically', () => {
  const stop = (start: string, end: string, order: number) => ({ dates: { start, end }, order });

  it('sorts by start date regardless of creation order', () => {
    const stops = [
      stop('2026-03-12', '2026-03-14', 0), // Charlotte, entered 1st
      stop('2026-03-16', '2026-03-18', 1), // Charleston, entered 2nd
      stop('2026-03-14', '2026-03-16', 2), // Columbia, entered 3rd
    ];
    const sorted = [...stops].sort(compareStopsChronologically);
    expect(sorted.map(s => s.dates.start)).toEqual(['2026-03-12', '2026-03-14', '2026-03-16']);
  });

  it('breaks a same-start tie with the earlier end date', () => {
    const a = stop('2026-03-12', '2026-03-13', 5);
    const b = stop('2026-03-12', '2026-03-20', 1);
    expect([b, a].sort(compareStopsChronologically)).toEqual([a, b]);
  });

  it('falls back to creation order when dates are identical', () => {
    const first  = stop('2026-03-12', '2026-03-14', 1);
    const second = stop('2026-03-12', '2026-03-14', 7);
    expect([second, first].sort(compareStopsChronologically)).toEqual([first, second]);
  });

  it('returns 0 for fully identical stops', () => {
    expect(compareStopsChronologically(stop('2026-03-12', '2026-03-14', 3), stop('2026-03-12', '2026-03-14', 3))).toBe(0);
  });
});
