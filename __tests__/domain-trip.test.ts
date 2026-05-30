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
} from '@/src/domain/trip';
import type { ItineraryDay, Stop } from '@/src/types';

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
    color: '#2C5880', order: 0,
  },
  {
    id: 'stop-b', tripId: 't1', city: 'Bar Harbor', region: 'ME', emoji: '⛵',
    lat: 44.3876, lon: -68.2039,
    dates: { start: '2026-07-12', end: '2026-07-15' },
    color: '#2F6B47', order: 1,
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
