// Pure logic behind the Profile tab. Everything the screen branches on lives here so the
// screen stays a composition and the branches are testable without a renderer.
// Convention matches the rest of src/domain: no Firebase, no React, clocks injected.

import { formatCacheAge } from '@/src/utils/cacheAge';
import type { TripMember, TripMemberRole } from '@/src/types';

// ─── Initials ────────────────────────────────────────────────────────────────

/**
 * 1–2 initials from a handle or display name, for the avatar circles.
 *
 * Returns '' for an empty name rather than a '?' placeholder — the fallback glyph is a
 * display decision and belongs to Avatar, so there is exactly one of it.
 */
export function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  // First + LAST, not the first two: the last word is the family name, and it is what
  // distinguishes two people who share a first name.
  const picked = words.length === 1 ? [words[0]] : [words[0], words[words.length - 1]];
  // Array.from, not charAt — handles are user-supplied and an emoji's surrogate pair
  // sliced in half renders as a replacement box.
  return picked.map(w => Array.from(w)[0].toUpperCase()).join('');
}

// ─── Membership ──────────────────────────────────────────────────────────────

export function getMemberRole(members: TripMember[], uid: string | null): TripMemberRole | null {
  // The uid === null guard is not redundant with the find: a member record missing its uid
  // would otherwise match a null caller and hand back somebody else's role.
  if (uid === null) return null;
  return members.find(m => m.uid === uid)?.role ?? null;
}

// ─── Plan badge ──────────────────────────────────────────────────────────────

export type BadgeTone = 'muted' | 'accent';
export interface PlanBadge {
  label: string;
  tone: BadgeTone;
}

const GUEST_BADGE: PlanBadge = { label: 'Guest', tone: 'muted' };

// Keyed on what src/lib/userProfile.ts actually writes: 'anonymous' from ensureAnonProfile,
// 'free' from writeLinkedProfile. Section 9 of the migration spec says the tier is hardcoded
// to 'pro' for Phase 1 — that predates the auth sprint, and the code is the authority.
const KNOWN_PLANS: Record<string, PlanBadge> = {
  anonymous: GUEST_BADGE,
  free: { label: 'Free', tone: 'accent' },
};

export function getPlanBadge(plan: string | undefined): PlanBadge {
  if (!plan) return GUEST_BADGE;
  const known = KNOWN_PLANS[plan];
  if (known) return known;
  // Forward compatibility over a Guest fallback: when a paid tier ships, its holder sees
  // its name even if nobody remembers to update this map. Falling back would downgrade them.
  return { label: plan.charAt(0).toUpperCase() + plan.slice(1), tone: 'accent' };
}

// ─── Cache freshness ─────────────────────────────────────────────────────────

export type CacheState = 'live' | 'connecting' | 'cached' | 'stale';

export interface CacheStatusInput {
  fromCache: boolean;
  status: 'loading' | 'ready' | 'error';
  cachedAt: number | null;
  now: number;
}

export interface CacheStatus {
  state: CacheState;
  label: string;
}

const STALE_AFTER = 24 * 60 * 60 * 1000;

export function getCacheStatus({ fromCache, status, cachedAt, now }: CacheStatusInput): CacheStatus {
  // fromCache outranks status deliberately. A cache hit leaves status on 'loading' while the
  // live read runs, and in that window the user is looking at saved data — calling it
  // "connecting" would misdescribe what is actually on screen.
  if (fromCache) {
    // A snapshot written before cachedAt was surfaced has no timestamp. Unknown age is
    // treated as the worse case, not the better one.
    if (cachedAt === null) return { state: 'stale', label: 'Saved copy' };
    const state: CacheState = now - cachedAt >= STALE_AFTER ? 'stale' : 'cached';
    return { state, label: `Saved copy · ${formatCacheAge(cachedAt, now)}` };
  }
  if (status === 'error') return { state: 'stale', label: 'Unavailable' };
  if (status === 'loading') return { state: 'connecting', label: 'Connecting…' };
  return { state: 'live', label: 'Live' };
}

// ─── Admin unlock tap gesture ────────────────────────────────────────────────

export interface TapState {
  count: number;
  lastAt: number;
}

export const NO_TAPS: TapState = { count: 0, lastAt: 0 };

const TAP_WINDOW_MS = 1500;
const UNLOCK_TAPS = 5;

/** Pure reducer, so the 5-tap unlock is covered by unit tests rather than device fiddling. */
export function registerTap(prev: TapState, now: number, windowMs: number = TAP_WINDOW_MS): TapState {
  const continuing = prev.count > 0 && now - prev.lastAt <= windowMs;
  // Restart at 1, not 0: resetting to 0 would swallow the tap that broke the window, so a
  // slow first tap followed by five fast ones would need six taps in total.
  return { count: continuing ? prev.count + 1 : 1, lastAt: now };
}

export function isUnlocked(state: TapState, threshold: number = UNLOCK_TAPS): boolean {
  return state.count >= threshold;
}
