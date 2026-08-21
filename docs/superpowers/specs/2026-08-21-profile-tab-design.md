# Profile Tab — Design

> Design doc. Sprint 7, following `2026-08-20-auth-durability-design.md`.
> Implements the Profile tab from section 10 of
> `../../../../jernie/docs/superpowers/specs/2026-05-29-jernie-native-migration-design.md`,
> narrowing it where that spec assumed features that were later deferred (noted inline).

## Problem

The Profile tab is half-built. It was never designed — it accreted during the auth sprint as
the only screen with somewhere to put an account block, and today it is a 288-line centre-stacked
column of an invite button, an account section, a trip-name form and a `__DEV__` trip switcher,
captioned `Settings · Traveler rail · Admin — Plan 6`.

Meanwhile a set of capabilities is fully built and reaches no UI at all:

| Built | Where | Surfaced |
|---|---|---|
| Cache freshness | `useTripData` writes `cachedAt` into MMKV | No — dropped from the returned state |
| Pending write count | `ConnectivityContext.pendingWriteCount` | No |
| Cache age formatting | `utils/cacheAge.ts` | No |
| Dev clock override | `utils/devTime.ts` reads `jernie_debug_now` | No — MMKV must be edited by hand |
| Build provenance | `version.ts` `getBuildLabel()` | `__DEV__` only |
| Bug report shape | `types.ts` `BugReport` | No — nothing writes it |
| Member list | `TripContext.members`, live | No |

The tab that should expose all of it is the one that doesn't. This is also the screen a
TestFlight tester reaches for when something is wrong — and it currently offers them no way
to say so and no way to tell us which build they are on.

## Decisions

Locked with Jeremy during brainstorming:

| Decision | Choice | Consequence |
|---|---|---|
| Settings rows | **Real rows only** | Notifications / Default map app / Privacy are not rendered at all, not even disabled. No dead rows. |
| Admin panel | **All of it except the API call console** | The console needs request instrumentation that does not exist; cache status + queue inspector cover the actual debugging need. |
| Feedback sheet | **In scope**, rules bundled | One reviewed `firebase deploy --only database` carries both `bug_reports` and the long-pending `deletedAt` rule. |
| Presence dots | **Dropped** | Needs an `.info/connected` subsystem. The rail shows role instead. |
| Avatar | **Initials circles** | Upload is Phase 2 (#7, per-traveler profiles). |

### Why these three rows are omitted rather than stubbed

The migration spec's settings card lists Edit profile · Notifications · Default map app ·
Privacy. Three of the four have nothing behind them today:

- **Notifications** — push is Phase 2 (#5). There is no notification to toggle.
- **Default map app** — nothing in the app opens a map. Entity-sheet quick actions
  (navigate / call / website) are an unbuilt Phase 1 item; until they exist, the preference
  has no consumer and would be write-only config.
- **Privacy** — needs a hosted policy page. An App Store submission concern, not a beta one.

A greyed-out row is a promise with a date attached. Each comes back with its feature.

## Architecture

### Layout

```
[ProfileHeader]      title · trip badge pill (active stop colour) · chevron -> My Trips
─────────────────────────────────────────
[YouCard]            initials avatar · displayName (inline edit) · role · plan badge
[TravelerRail]       horizontal initials circles -> MemberSheet
─────────────────────────────────────────
[SettingsCard]       grouped rows: account, trip name, invite, delete trip
─────────────────────────────────────────
[CacheCard]          badge rows: trip data · enrichment · pending writes
─────────────────────────────────────────
[VersionRow]         build label -> FeedbackSheet
─────────────────────────────────────────
[AdminPanel]         hidden; 5 taps on the Profile tab icon; slides in from right
```

Components live in `src/features/jernie/profile/`, mirroring the existing
`src/features/jernie/explore/` convention — `jernie` is the app namespace in this tree, not
the tab name.

### `src/domain/profile.ts`

Every branch on this screen is a pure function first, so the screen stays a composition and
the logic is tested without a renderer. Follows the existing `src/domain/*` convention: no
Firebase imports, no React.

```ts
getInitials(name: string): string
getMemberRole(members: TripMember[], uid: string | null): TripMemberRole | null
getPlanBadge(plan: string | undefined): { label: string; tone: 'muted' | 'accent' }
getCacheStatus(input: CacheStatusInput): { state: 'live' | 'cached' | 'stale'; label: string }
registerTap(prev: TapState, now: number, windowMs?: number): TapState
isUnlocked(state: TapState, threshold?: number): boolean
```

`getPlanBadge` reads what `userProfile.ts` actually writes — `'anonymous'` before linking,
`'free'` after. **This contradicts section 9 of the migration spec**, which says the tier is
hardcoded to `'pro'` for Phase 1. That was written before the auth sprint chose the anonymous
lifecycle marker; the code is the authority.

`registerTap` / `isUnlocked` make the 5-tap admin unlock a pure state machine, so the gesture
is covered by unit tests instead of device fiddling.

### Cache freshness

`useTripData` already stamps `cachedAt` into its MMKV snapshot but does not return it, so
nothing downstream can distinguish a two-minute-old cache from a three-day-old one. It gains
`cachedAt: number | null` on `TripDataState`, and `TripContextValue` re-exports it.

`getCacheStatus` maps `(fromCache, status, cachedAt)` onto three states: **live** (listening
to RTDB), **cached** (showing the MMKV snapshot, age under a day), **stale** (cached and
older). The existing `formatCacheAge` supplies the age string.

The same pass fixes `OfflineBanner`, which renders `"Showing saved trip · Tap to retry"` and
omits the pending write count the Phase 1 checklist asks for.

### Feedback

`bug_reports/{reportId}` at the RTDB root, written through a new `src/lib/feedbackWrites.ts`
using `getAuthedUser()` like every other write module.

Rules are **create-only, with no client read**:

```json
"bug_reports": {
  ".read": false,
  "$reportId": {
    ".write": "auth != null && !data.exists() && newData.child('author').val() === auth.uid",
    ".validate": "..."
  }
}
```

There is no admin role in `database.rules.json` to grant a read to, and inventing one to
support an in-app bug list is a bigger change than the feature justifies. Reports are read in
the Firebase console.

`BugReport` in `types.ts` carries an `order: number` field inherited from the PWA's Bugs tab,
which sorted reports in-app. With no in-app read, `order` is dead on arrival — it becomes
optional rather than being written as a meaningless value.

### Admin panel

Unlocked by five taps on the Profile tab icon within a window, via `listeners={{ tabPress }}`
on the Profile `Tabs.Screen`. Slides in from the right on a Reanimated `translateX`, matching
`HeroLayer`'s existing `withSpring` usage.

Four cards:

1. **Build** — the full `getBuildInfo()` object, not just the label.
2. **Firestore cache** — one row per session key via `refreshScheduler`, with an invalidate
   button. `refreshScheduler` currently exports only `shouldReadFirestore` / `markRead` /
   `invalidate`, so its timestamps are unreadable; it gains `getLastRead(sessionKey)`.
3. **Write queue** — `getQueue()` rendered live through its own `subscribe()`, with a manual
   `flush()`.
4. **Time warp** (`__DEV__` only) — the first UI for `devTime.ts`. Sets and clears
   `jernie_debug_now`, so the phase-aware CTA cards and hero can be exercised without waiting
   for real dates.

The migration spec's fifth card, a filterable realtime API call console, is deferred. It needs
an instrumentation layer wrapping `enrichmentClient` and `geocodeClient` that does not exist,
and cards 2 and 3 already answer the question it was meant to answer.

### What moves unchanged

`profile.tsx`'s four auth handlers — `handleSignIn`, `handleShareInvite`, `handleSignOut`,
`handleDeleteAccount` — move into the new composition verbatim. Their four-branch `LinkOutcome`
handling, their two independent error slots, and the early return that prevents sharing a stale
invite link after a collision adopt are each a bug fix with a commit behind it (`0c8dace`,
`c99ce90`, `cf00082`). This sprint re-lays-out the screen; it does not revisit auth behaviour.

## Error handling

The two-error-slot split stays: `accountError` renders under the account rows, `tripError`
under the trip rows. A third slot is added for the feedback sheet, local to it.

Writes that can fail and what the user sees:

| Write | Failure | Shown |
|---|---|---|
| `updateDisplayName` | offline / rules | Inline under the You card; name reverts |
| `submitFeedback` | offline / validate | Inline in the sheet; sheet stays open with input intact |
| `updateTrip` (name) | existing | Existing `tripError` behaviour, unchanged |

`updateDisplayName` writes to `users/{uid}`, which is already self-writable — no rule change.

## Testing

`domain-profile.test.ts` carries the bulk of the coverage, since the bulk of the logic is
pure: initials from empty / single / multi-word names, role lookup with a null uid, plan badge
across `undefined` / `'anonymous'` / `'free'`, cache status across the live / cached / stale
boundaries, and the tap reducer including taps that fall outside the window.

`feedbackWrites.test.ts` covers the write path against the existing jest database mock.

Component tests via `@testing-library/react-native`, matching the existing suites' style.

On-device verification is where the rules deploy is actually proven — trip delete and restore
fail today against live RTDB and no test catches it, because the rule is correct in the file
and merely absent from the server.

## Out of scope

Member removal (needs a rules change; logged in `known-issues.md` as a pre-launch blocker) ·
presence · avatar upload · push notification settings · default map app · privacy policy ·
the API call console · the Agenda tab.
