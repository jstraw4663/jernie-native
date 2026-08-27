import { addDaysISO, formatDateRange, formatDayLabel } from '@/src/utils/dates';

// addDaysISO exists specifically to avoid the UTC-midnight trap: `new Date('2026-08-10')`
// parses as UTC midnight, which reads as 9 August anywhere west of Greenwich. These tests
// pin the behaviour that motivated it, now that the stop-insertion planner depends on it
// too.
describe('addDaysISO', () => {
  test('advances a date within the same month', () => {
    expect(addDaysISO('2026-09-24', 2)).toBe('2026-09-26');
  });

  test('advances across a month boundary', () => {
    expect(addDaysISO('2026-09-29', 2)).toBe('2026-10-01');
  });

  test('advances across a year boundary', () => {
    expect(addDaysISO('2026-12-31', 1)).toBe('2027-01-01');
  });

  test('goes backwards for a negative delta', () => {
    expect(addDaysISO('2026-10-01', -2)).toBe('2026-09-29');
  });

  test('handles a leap day', () => {
    expect(addDaysISO('2028-02-28', 1)).toBe('2028-02-29');
  });

  test('returns the same date for a delta of zero', () => {
    expect(addDaysISO('2026-09-24', 0)).toBe('2026-09-24');
  });

  test('pads single-digit months and days', () => {
    expect(addDaysISO('2026-01-08', 1)).toBe('2026-01-09');
  });
});

describe('formatDateRange', () => {
  // Spaced, matching the cross-month form below. Session 5 (1d6ccb7) made the two agree
  // deliberately — the design writes the range spaced wherever it appears in prose — and
  // this assertion was pinned to the older unspaced output before that landed.
  test('collapses a same-month range', () => {
    expect(formatDateRange('2026-07-10', '2026-07-12')).toBe('Jul 10 – 12');
  });

  test('spells out both months when the range crosses one', () => {
    expect(formatDateRange('2026-06-29', '2026-07-02')).toBe('Jun 29 – Jul 2');
  });
});

describe('formatDayLabel', () => {
  test('renders weekday, month and day', () => {
    expect(formatDayLabel('2026-07-10')).toBe('Fri, Jul 10');
  });
});
