import {
  getInitials,
  getMemberRole,
  getPlanBadge,
  getCacheStatus,
  registerTap,
  isUnlocked,
  NO_TAPS,
} from '@/src/domain/profile';
import type { TripMember } from '@/src/types';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const T0 = 1_700_000_000_000;

describe('getInitials', () => {
  it('takes the first letter of a single-word name', () => {
    expect(getInitials('Jeremy')).toBe('J');
  });

  it('takes first and last initials of a two-word name', () => {
    expect(getInitials('Jeremy Straw')).toBe('JS');
  });

  it('takes first and LAST for three or more words, not the first two', () => {
    // "Mary Jane Watson" is MW, not MJ — the last word is the family name and is what
    // distinguishes two people who share a first name.
    expect(getInitials('Mary Jane Watson')).toBe('MW');
  });

  it('uppercases regardless of input case', () => {
    expect(getInitials('jeremy straw')).toBe('JS');
  });

  it('ignores surrounding and repeated whitespace', () => {
    expect(getInitials('   spaced    out   ')).toBe('SO');
  });

  it('returns empty for an empty or whitespace-only name', () => {
    // Empty rather than a '?' placeholder — the fallback glyph is a display decision and
    // lives in the Avatar component, so there is exactly one of it.
    expect(getInitials('')).toBe('');
    expect(getInitials('    ')).toBe('');
  });

  it('keeps an emoji whole instead of splitting its surrogate pair', () => {
    // charAt(0) on an astral-plane character yields half a surrogate pair and renders as
    // a replacement box. Handles are user-supplied, so this is reachable.
    expect(getInitials('🦊')).toBe('🦊');
    expect(getInitials('🦊 Fox')).toBe('🦊F');
  });
});

describe('getMemberRole', () => {
  const members: TripMember[] = [
    { uid: 'owner-1', handle: 'Jeremy', role: 'organizer', joinedAt: T0 },
    { uid: 'friend-1', handle: 'Sam', role: 'traveler', joinedAt: T0 },
  ];

  it('finds the role for a uid in the member list', () => {
    expect(getMemberRole(members, 'owner-1')).toBe('organizer');
    expect(getMemberRole(members, 'friend-1')).toBe('traveler');
  });

  it('returns null for a uid that is not a member', () => {
    expect(getMemberRole(members, 'stranger')).toBeNull();
  });

  it('returns null for a null uid rather than matching an undefined member', () => {
    // currentUid is null during the window after sign-out and before the anonymous
    // re-sign-in resolves; a loose === would match nothing here anyway, but a member
    // record with a missing uid would have matched.
    expect(getMemberRole(members, null)).toBeNull();
    expect(getMemberRole([{ uid: undefined as unknown as string, handle: 'x', role: 'traveler', joinedAt: T0 }], null)).toBeNull();
  });

  it('returns null for an empty member list', () => {
    expect(getMemberRole([], 'owner-1')).toBeNull();
  });
});

describe('getPlanBadge', () => {
  it('labels the anonymous lifecycle marker as a guest', () => {
    // 'anonymous' and 'free' are what src/lib/userProfile.ts actually writes. Section 9 of
    // the migration spec says the tier is hardcoded to 'pro' for Phase 1 — that predates the
    // auth sprint and the code is the authority.
    expect(getPlanBadge('anonymous')).toEqual({ label: 'Guest', tone: 'muted' });
  });

  it('labels a linked account as free', () => {
    expect(getPlanBadge('free')).toEqual({ label: 'Free', tone: 'accent' });
  });

  it('treats a missing plan as a guest', () => {
    // users/{uid} exists without a plan field only between account creation and
    // ensureAnonProfile's stamp. Claiming a paid tier there would be worse than under-claiming.
    expect(getPlanBadge(undefined)).toEqual({ label: 'Guest', tone: 'muted' });
    expect(getPlanBadge('')).toEqual({ label: 'Guest', tone: 'muted' });
  });

  it('capitalizes an unrecognized plan rather than falling back to Guest', () => {
    // Forward compatibility: when a 'pro' tier ships, a pro user sees "Pro" even if nobody
    // remembers to update this map. Falling back to Guest would silently downgrade them.
    expect(getPlanBadge('pro')).toEqual({ label: 'Pro', tone: 'accent' });
  });
});

describe('getCacheStatus', () => {
  const live = { fromCache: false, status: 'ready' as const, cachedAt: null, now: T0 };

  it('reports live when reading straight from RTDB', () => {
    expect(getCacheStatus(live)).toEqual({ state: 'live', label: 'Live' });
  });

  it('reports connecting while the first read is still in flight', () => {
    expect(getCacheStatus({ ...live, status: 'loading' }).state).toBe('connecting');
  });

  it('reports unavailable on a read error with no cache to fall back to', () => {
    expect(getCacheStatus({ ...live, status: 'error' })).toEqual({ state: 'stale', label: 'Unavailable' });
  });

  it('reports a recent snapshot as cached, with its age', () => {
    const result = getCacheStatus({ fromCache: true, status: 'loading', cachedAt: T0 - 5 * 60_000, now: T0 });
    expect(result.state).toBe('cached');
    expect(result.label).toBe('Saved copy · 5m ago');
  });

  it('stays cached right up to the 24-hour boundary and goes stale on it', () => {
    const justUnder = getCacheStatus({ fromCache: true, status: 'loading', cachedAt: T0 - (DAY - 1), now: T0 });
    const exactly = getCacheStatus({ fromCache: true, status: 'loading', cachedAt: T0 - DAY, now: T0 });
    expect(justUnder.state).toBe('cached');
    expect(exactly.state).toBe('stale');
  });

  it('reports a snapshot of unknown age as stale without crashing on the null', () => {
    // Snapshots written before cachedAt was surfaced have no timestamp. Unknown age is
    // treated as the worse case, not the better one.
    expect(getCacheStatus({ fromCache: true, status: 'loading', cachedAt: null, now: T0 }))
      .toEqual({ state: 'stale', label: 'Saved copy' });
  });

  it('prefers the cache verdict over the status when both are present', () => {
    // A cache hit sets status 'loading' while the live read runs. The user is looking at
    // saved data in that window, and saying "connecting" would misdescribe what is on screen.
    expect(getCacheStatus({ fromCache: true, status: 'loading', cachedAt: T0 - HOUR, now: T0 }).state).toBe('cached');
  });
});

describe('registerTap / isUnlocked', () => {
  it('counts consecutive taps inside the window', () => {
    let state = registerTap(NO_TAPS, T0);
    expect(state.count).toBe(1);
    state = registerTap(state, T0 + 200);
    expect(state.count).toBe(2);
  });

  it('unlocks on the fifth tap, not the fourth', () => {
    let state = NO_TAPS;
    for (let i = 0; i < 4; i++) state = registerTap(state, T0 + i * 200);
    expect(isUnlocked(state)).toBe(false);
    state = registerTap(state, T0 + 4 * 200);
    expect(isUnlocked(state)).toBe(true);
  });

  it('restarts the count at 1 after a gap, not at 0', () => {
    // Resetting to 0 would swallow the tap that broke the window, so a slow first tap
    // followed by five fast ones would need six taps total.
    let state = NO_TAPS;
    for (let i = 0; i < 3; i++) state = registerTap(state, T0 + i * 200);
    const afterGap = registerTap(state, T0 + 5_000);
    expect(afterGap.count).toBe(1);
  });

  it('treats a tap exactly on the window boundary as still inside it', () => {
    const first = registerTap(NO_TAPS, T0);
    expect(registerTap(first, T0 + 1500).count).toBe(2);
    expect(registerTap(first, T0 + 1501).count).toBe(1);
  });

  it('never mutates the state it is given', () => {
    const first = registerTap(NO_TAPS, T0);
    const snapshot = { ...first };
    registerTap(first, T0 + 100);
    expect(first).toEqual(snapshot);
    expect(NO_TAPS).toEqual({ count: 0, lastAt: 0 });
  });

  it('honours a custom window and threshold', () => {
    const first = registerTap(NO_TAPS, T0, 100);
    expect(registerTap(first, T0 + 150, 100).count).toBe(1);
    expect(isUnlocked({ count: 3, lastAt: T0 }, 3)).toBe(true);
  });
});
