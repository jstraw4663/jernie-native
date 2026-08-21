// Pure scheduling for the "save your trip" nudge. `now` is always injected so the 21-day
// branch is testable without waiting 21 days.

export type NudgeLevel = 'none' | 'gentle' | 'firm';

// What shouldShowNudge can actually emit — 'none' collapses to null there, so the card
// never has to render a level that means "do not render".
export type DueNudgeLevel = Exclude<NudgeLevel, 'none'>;

const DAY = 24 * 60 * 60 * 1000;
const GENTLE_AFTER = 7 * DAY;
const FIRM_AFTER = 21 * DAY;

export function nudgeLevel(anonCreatedAt: number, now: number): NudgeLevel {
  const age = now - anonCreatedAt;
  if (age >= FIRM_AFTER) return 'firm';
  if (age >= GENTLE_AFTER) return 'gentle';
  return 'none';
}

// Dismiss snoozes rather than kills — a permanently dismissible nudge converts nobody.
export function snoozeMsFor(level: NudgeLevel): number {
  return level === 'firm' ? 3 * DAY : 7 * DAY;
}

export function shouldShowNudge(p: {
  status: string;
  anonCreatedAt: number | null;
  snoozedUntil: number | null;
  now: number;
}): DueNudgeLevel | null {
  if (p.status !== 'anonymous') return null;
  if (p.anonCreatedAt === null) return null;
  if (p.snoozedUntil !== null && p.now < p.snoozedUntil) return null;
  const level = nudgeLevel(p.anonCreatedAt, p.now);
  return level === 'none' ? null : level;
}
