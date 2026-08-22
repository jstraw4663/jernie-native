# Profile Tab — Implementation Plan

> Spec: `../specs/2026-08-21-profile-tab-design.md`
> Branch: `feat/profile-tab` (from `dev`)
> Baseline at start: 84 suites / 873 tests green; `tsc --noEmit` at exactly 8 pre-existing
> errors, all `@gorhom/bottom-sheet` typing in `src/features/jernie/sheets/`.

Execution is one fresh subagent per task, with review between tasks. Each subagent gets the
spec plus its task section.

---

## Task 0 — Rules: `bug_reports`, `deletedAt` drift coverage, deploy

**Why first:** trip delete/restore is broken against live RTDB today. The `deletedAt` rule has
been correct in `database.rules.json` since the CRUD sprint but was never deployed, and no test
catches it because the file is right and only the server is wrong. The feedback sheet needs a
node that does not exist yet, so both rule changes ship in one reviewed deploy rather than two.

**Changes:**

1. `database.rules.json` — add a root-level `bug_reports` node:

   ```json
   "bug_reports": {
     ".read": false,
     "$reportId": {
       ".write": "auth != null && !data.exists() && newData.child('author').val() === auth.uid",
       ".validate": "newData.hasChildren(['id','tripId','title','priority','author','createdAt']) && newData.child('title').isString() && newData.child('title').val().length > 0 && newData.child('title').val().length <= 200 && newData.child('author').val() === auth.uid && newData.child('priority').isString()"
     }
   }
   ```

   Create-only (`!data.exists()`), author must be the caller, no client read.

2. `__tests__/databaseRules.test.ts` — add `'deletedAt'` to `OWNER_ONLY_COLLECTIONS`. It
   carries the same owner-only expression as `name`/`pills`/`colorPack`/`setupIntent` but is
   currently exempt from the drift check.

3. Extend the same test file with coverage of the new node: create-only, author binding,
   `.read` false.

**Gate:** show Jeremy the full `database.rules.json` diff and get an explicit yes before
running `firebase deploy --only database`. This is a live-infrastructure change to the only
server-side backstop the app has — no Cloud Functions guard writes.

**Verify on device:** delete a trip -> it appears under Recently Deleted on My Trips ->
restore it. Fails today; must pass after.

---

## Task 1 — `src/domain/profile.ts` (TDD)

Pure functions, no Firebase, no React. Write `__tests__/domain-profile.test.ts` first.

```ts
export function getInitials(name: string): string
export function getMemberRole(members: TripMember[], uid: string | null): TripMemberRole | null
export function getPlanBadge(plan: string | undefined): { label: string; tone: 'muted' | 'accent' }

export interface CacheStatusInput {
  fromCache: boolean;
  status: 'loading' | 'ready' | 'error';
  cachedAt: number | null;
  now: number;
}
export function getCacheStatus(input: CacheStatusInput): { state: 'live' | 'cached' | 'stale'; label: string }

export interface TapState { count: number; lastAt: number }
export function registerTap(prev: TapState, now: number, windowMs?: number): TapState
export function isUnlocked(state: TapState, threshold?: number): boolean
```

**Cases the tests must cover:**

- `getInitials`: `''`, `'Jeremy'`, `'Jeremy Straw'`, `'  spaced  out  '`, a single emoji,
  a name with three or more words (take first + last, not first two).
- `getMemberRole`: uid present, uid absent from members, `uid === null`.
- `getPlanBadge`: `undefined`, `'anonymous'`, `'free'`, and an unrecognised value.
  Reads what `src/lib/userProfile.ts` writes — **not** the `'pro'` the migration spec assumes.
- `getCacheStatus`: `fromCache: false` -> live; `fromCache: true` with a recent `cachedAt` ->
  cached; `fromCache: true` with `cachedAt` older than 24h -> stale; `cachedAt: null` ->
  cached with an unknown-age label (never crash on the null). Delegates the age string to
  `formatCacheAge` from `src/utils/cacheAge.ts` — do not reimplement it.
  Note `formatCacheAge` calls `Date.now()` internally, so `now` is threaded for the
  state boundary only.
- `registerTap`/`isUnlocked`: five taps inside the window unlocks; a gap longer than the
  window resets the count to 1 rather than 0; the reducer never mutates `prev`.

---

## Task 2 — Surface `cachedAt`; pending count in the offline banner

`src/hooks/useTripData.ts` writes `cachedAt` into the MMKV snapshot (line ~98) and drops it
from the returned state.

- Add `cachedAt: number | null` to `TripDataState`. Populate from the cached snapshot on the
  cache-hit path, and set it on each successful live write of the snapshot.
- Add `cachedAt` to `TripContextValue` in `src/contexts/TripContext.tsx` and pass it through.
- `OfflineBanner` (same file, line ~46) currently renders only
  `"Showing saved trip · Tap to retry"`. Read `pendingWriteCount` from
  `ConnectivityContext` and append it when non-zero — the Phase 1 checklist item is
  "OfflineBanner **+ pending write count**".

Existing `useTripData` tests must stay green; add coverage for `cachedAt` round-tripping
through the cache path.

---

## Task 3 — `src/lib/userProfile.ts`: `updateDisplayName`

Add next to `writeLinkedProfile`, following its `.update()` patch style and its direct-path
convention (the jest database mock's `ref()` returns only `{ once, on, off, set, update }`, so
`.child()` chaining is untestable):

```ts
export async function updateDisplayName(uid: string, displayName: string): Promise<void>
```

Trims; rejects empty. `users/{uid}` is already self-writable
(`database.rules.json` -> `users.$uid.".write"`), so no rule change.

Extend `__tests__/userProfile.test.ts`.

---

## Task 4 — `src/features/jernie/profile/` presentation components

New directory, mirroring `src/features/jernie/explore/`. Each component is presentational and
takes its data as props — the screen wires context in Task 7.

- **`ProfileHeader.tsx`** — title, trip badge pill tinted with the active stop's colour,
  chevron. The chevron is the real trip switcher (Key Decisions Log: "Trip switcher location:
  Chevron in Jernie/Agenda/Profile headers") and replaces the `__DEV__`-only "Switch trip
  (dev)" button. Keep `router.replace`, not `push`, so the trip's `TripProvider` and its live
  RTDB listeners unmount rather than stacking.
- **`YouCard.tsx`** — initials avatar, displayName with inline edit, role label, plan badge.
  Uses `getInitials` / `getMemberRole` / `getPlanBadge`. Local error slot; on failure the name
  reverts.
- **`TravelerRail.tsx`** — horizontal `ScrollView` of initials circles from `members`.
  Role-tinted, no presence dot. `onSelect(member)` prop.
- **`SettingsRow.tsx`** — the grouped-row primitive: icon square, label, optional sublabel,
  right slot (chevron, value text, or a control). Variants for default and destructive.
- **`SettingsCard.tsx`** — rounded container that groups rows with hairline separators and
  an optional section title.
- **`CacheCard.tsx`** — badge rows for trip data (`getCacheStatus`), enrichment, and pending
  writes. Props only.
- **`VersionRow.tsx`** — `getBuildLabel()` from `src/version.ts`, shown in **all** builds
  (currently `__DEV__`-gated) because testers need to report which build they are on. Tapping
  it opens the feedback sheet.

---

## Task 5 — `MemberSheet` and `FeedbackSheet`

Both in `src/features/jernie/sheets/`, following the existing `useImperativeHandle` +
`present()` / `dismiss()` ref pattern (`EntityDetailSheet.tsx`, `BookingFormSheet.tsx`),
including `SheetContext` increment/decrement so `StopNavigator` drag gestures stay suppressed
while open, and the shared `renderBackdrop` treatment.

- **`MemberSheet.tsx`** — handle, role, joined date, and the groups they belong to (from
  `TripContext.groups`). Read-only. There is no member-removal path; adding one needs a rules
  change and is logged in `docs/superpowers/known-issues.md` as a pre-launch blocker.

- **`FeedbackSheet.tsx`** — title (required, max 200 chars to match `.validate`), body
  (optional), priority selector. On submit, calls `submitFeedback` and dismisses; on failure,
  shows an inline error and **keeps the sheet open with the input intact**.

- **`src/lib/feedbackWrites.ts`** — new write module:

  ```ts
  export interface NewBugReport { tripId: string; title: string; body?: string; priority: BugPriority }
  export async function submitFeedback(input: NewBugReport): Promise<void>
  ```

  Uses `getAuthedUser()` from `src/lib/firebase.ts` (like every other write module), `newId()`
  from `src/utils/id.ts`, and `stripUndefined` from `src/utils/stripUndefined.ts` so an omitted
  `body` is not sent as `undefined`.

- **`src/types.ts`** — make `BugReport.order` optional. It is inherited from the PWA's Bugs
  tab, which sorted reports in-app; with no in-app read it is dead on arrival, and writing a
  meaningless value is worse than omitting the field.

`__tests__/feedbackWrites.test.ts` against the existing jest database mock.

---

## Task 6 — Admin panel

- **`src/lib/refreshScheduler.ts`** — add `getLastRead(sessionKey: string): number | null`.
  The module stores MMKV timestamps but exports no way to read them.

- **`app/(trips)/[tripId]/(tabs)/_layout.tsx`** — `listeners={{ tabPress }}` on the Profile
  `Tabs.Screen`, feeding Task 1's `registerTap` / `isUnlocked`. Unlock state lifts into a small
  context or module signal so the panel (rendered by the Profile screen) can read it; follow
  the module-level one-shot pattern already used by `src/navigation.ts` if a context is
  overkill.

- **`src/features/jernie/profile/AdminPanel.tsx`** — slides in from the right on a Reanimated
  `translateX`, matching `HeroLayer.tsx`'s existing `withSpring` usage. Four cards:

  1. **Build** — full `getBuildInfo()`, not just the label.
  2. **Firestore cache** — one row per session key with age via `getLastRead` + `formatCacheAge`,
     and a per-row invalidate button.
  3. **Write queue** — `getQueue()` rendered live through `subscribe()`, with a manual `flush()`.
  4. **Time warp** (`__DEV__` only) — set / clear `jernie_debug_now` in the `jernie-dev` MMKV
     instance that `src/utils/devTime.ts` reads. First UI for `getDevNow()`.

The migration spec's filterable API call console is deferred — it needs request instrumentation
around `enrichmentClient` / `geocodeClient` that does not exist, and cards 2 and 3 answer the
question it was meant to answer.

---

## Task 7 — Assemble `profile.tsx`

Rewrite `app/(trips)/[tripId]/(tabs)/profile.tsx` as composition over Tasks 4–6 inside a
`ScrollView`.

**Move unchanged:** `handleSignIn`, `handleShareInvite`, `handleSignOut`, `handleDeleteAccount`.
Their four-branch `LinkOutcome` handling, their two independent error slots, the `isOwner`
derivation from `useAuth()`'s reactive `user` rather than `auth().currentUser`, and the early
return that stops a stale invite link being shared after a collision adopt are each a bug fix
with a commit behind it (`0c8dace`, `c99ce90`, `cf00082`, `1a96cfd`). This is a re-layout, not
a rewrite of auth behaviour. Keep every existing `testID`.

Drop the `Settings · Traveler rail · Admin — Plan 6` caption.

Component tests via `@testing-library/react-native`: signed-out vs signed-in rendering, the
owner-only rows hidden for a non-owner, and the invite gate still demanding sign-in.

---

## Verification

```bash
npx jest                # no regressions from 84 suites / 873 tests
npx tsc --noEmit        # must hold at exactly 8 errors
```

Any 9th tsc error is new and belongs to this sprint.

**On device** (`npx expo start`, iPhone over Tailscale):

1. Trip delete -> Recently Deleted -> restore. *Task 0's regression; fails today.*
2. Feedback sheet -> submit -> the report appears under `bug_reports` in the Firebase console.
3. Edit display name -> force-quit -> reopen -> persisted.
4. Airplane mode -> offline banner shows a pending write count -> back online -> queue drains.
5. Five taps on the Profile tab icon -> panel opens -> set a time warp date -> the Jernie tab's
   CTA card switches phase.
6. Signed out and signed in: You card, plan badge and settings rows differ by auth status, and
   the invite gate still demands sign-in.
