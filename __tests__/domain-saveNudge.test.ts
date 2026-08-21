import { nudgeLevel, snoozeMsFor, shouldShowNudge } from '@/src/domain/saveNudge';

const DAY = 24 * 60 * 60 * 1000;
const T0 = 1_700_000_000_000;

describe('nudgeLevel', () => {
  it('stays silent for the first six days', () => {
    expect(nudgeLevel(T0, T0)).toBe('none');
    expect(nudgeLevel(T0, T0 + 6 * DAY)).toBe('none');
  });
  it('goes gentle at seven days', () => {
    expect(nudgeLevel(T0, T0 + 7 * DAY)).toBe('gentle');
    expect(nudgeLevel(T0, T0 + 20 * DAY)).toBe('gentle');
  });
  it('goes firm at twenty-one days and stays there', () => {
    expect(nudgeLevel(T0, T0 + 21 * DAY)).toBe('firm');
    expect(nudgeLevel(T0, T0 + 400 * DAY)).toBe('firm');
  });
});

describe('snoozeMsFor', () => {
  it('snoozes a gentle nudge for a week and a firm one for three days', () => {
    expect(snoozeMsFor('gentle')).toBe(7 * DAY);
    expect(snoozeMsFor('firm')).toBe(3 * DAY);
  });
});

describe('shouldShowNudge', () => {
  const base = { status: 'anonymous', anonCreatedAt: T0, snoozedUntil: null, now: T0 + 10 * DAY };

  it('shows a gentle nudge to a due anonymous user', () => {
    expect(shouldShowNudge(base)).toBe('gentle');
  });
  it('never shows to an authenticated user', () => {
    expect(shouldShowNudge({ ...base, status: 'authenticated' })).toBeNull();
  });
  it('never shows while auth state is still loading', () => {
    expect(shouldShowNudge({ ...base, status: 'loading' })).toBeNull();
  });
  it('stays hidden before the seven-day mark', () => {
    expect(shouldShowNudge({ ...base, now: T0 + 3 * DAY })).toBeNull();
  });
  it('stays hidden while snoozed', () => {
    expect(shouldShowNudge({ ...base, snoozedUntil: T0 + 12 * DAY })).toBeNull();
  });
  // Snooze expires — dismissing hides the card, it does not kill it.
  it('returns once the snooze lapses', () => {
    expect(shouldShowNudge({ ...base, snoozedUntil: T0 + 9 * DAY })).toBe('gentle');
  });
  it('handles a missing anonCreatedAt by staying silent', () => {
    expect(shouldShowNudge({ ...base, anonCreatedAt: null })).toBeNull();
  });
});
