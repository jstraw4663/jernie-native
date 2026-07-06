# Jernie Native — Multi-Trip / Multi-User Data Model Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps within each task should follow superpowers:test-driven-development.

## Context

Jernie Native's data model today is a direct, mostly-unmodified port of the retired PWA's single-trip schema: `TripContext` holds exactly one `Trip`, routing hardcodes `dev-trip-001`, and the `TripMember`/`UserProfile`/`memberHandles` types that were meant to support sharing exist only as dead code — no invite flow, no membership records, no RTDB rules enforcement beyond an always-true-for-any-authed-user check. This is being rebuilt to support real multi-trip, real multi-user membership with an invite-join flow enforced by RTDB rules, and two features the PWA validated conceptually but never shipped: sub-party visibility ("guys' hike day") and cross-stop rental car support (pickup ≠ dropoff city). The eventual onboarding wizard will write into this foundation; wizard UI is out of scope here.

The retired PWA's `~/jernie/public/trip.json` holds a real, finished trip (Maine Coast, May 22–29 2026) that gets imported once this schema lands (Task 9) — the type design accounts for what that data actually contains (multi-leg flights, richer curated place fields), described in each relevant task below.

## Global Constraints

- Every task's definition of done: `npx jest` green, **and no *new* `npx tsc --noEmit` errors introduced** (not fully-clean tsc — see baseline note below). `jest-expo`'s babel-jest transform does not type-check — `tsc` is a required companion gate on every task, not just at the end.
- **Known pre-existing baseline `tsc` errors (out of scope, do not fix, do not let them block a task):** 6 errors in `src/features/jernie/sheets/` — `EntityDetailSheet.tsx` (`restDisplacementThreshold` not in `SpringConfig`), `FlightSheet.tsx`/`HikeSheet.tsx`/`HotelSheet.tsx`/`RestaurantSheet.tsx` (`scrollEventThrottle` prop type mismatch on `BottomSheetScrollView`), `SheetHero.tsx` (imports a `stopHeroGradient` export from `src/utils/colors` that doesn't exist on this branch — it exists only in unrelated uncommitted WIP on `feat/stop-pages`). These predate this plan and are being fixed separately on `feat/stop-pages`; run `npx tsc --noEmit` before starting each task to reconfirm the count/content of pre-existing errors hasn't silently changed, and only treat *new* errors beyond this known set as failures.
- Work happens in the `.worktrees/feat-data-model-foundation` worktree, branch `feat/data-model-foundation` off `dev` (which was fast-forwarded to `feat/stop-pages`'s tip before this work began, so it now includes the full Jernie tab + entity-detail-sheets implementation). Never commit to `main`/`master` directly (project rule). `npm test` must pass before any eventual PR to `dev`.
- Never commit `.env`, `google-services.json`, or `GoogleService-Info.plist`.
- Filtering/scoping logic stays centralized in `TripContext`/hooks, not scattered into leaf presentational components — matches the existing codebase pattern.
- `Stop.color` is never stored — always derived live from `trip.colorPack` + `stop.order`.
- Cross-stop rentals are a **single** `RentalBooking` record with an optional `dropoffStopId` — not two linked records. Do not duplicate booking fields across records.
- `groupIds?: string[] | null` semantics everywhere they appear (on `BookingBase` and `ItineraryItem`): `undefined`/`null`/empty array = visible to the whole trip party; non-empty array = visible only to members of at least one listed group. **Trip organizers always bypass group filtering** — they must see every booking/itinerary item regardless of their own group membership.
- No Cloud Functions exist yet for this project — the invite-join flow must work via RTDB security rules alone.

---

## Task 1: Types + RTDB schema + security rules + Stop-color derivation

**Files:** `src/types.ts`, `database.rules.json`, `src/design/tripPacks.ts`, `src/domain/trip.ts`, `src/hooks/useTripData.ts`, `src/contexts/TripContext.tsx` (type import only), `src/features/jernie/HeroLayer.tsx`, `src/features/jernie/StopsStrip.tsx`, `app/(trips)/[tripId]/(tabs)/jernie.tsx` (type import only), `__tests__/domain-trip.test.ts`, `__tests__/hooks/useTripData.test.ts`, `firebase.json`.

This is the largest and highest-risk task in the plan — it must be fully correct before any later task builds on it.

### 1a. Type changes in `src/types.ts`

- **Remove** `Stop.color`. Add a new exported type: `export type StopWithColor = Stop & { color: string };` — this is the only place a resolved color should ever live on a stop-shaped object, and it's produced only by the data layer (1d below), never persisted.
- Introduce a shared booking base and rewrite the union:
  ```ts
  export interface BookingBase {
    id: string;
    tripId: string;
    stopId: string;
    type: BookingType;
    groupIds?: string[] | null;
  }
  ```
  `FlightBooking extends BookingBase` — replace its current flat fields with:
  ```ts
  export interface FlightLeg {
    flightNumber: string;
    airline: string;
    origin: string;       // IATA
    destination: string;  // IATA
    departureDate: string;
    departureTime: string;
    arrivalTime: string;
  }
  export interface FlightBooking extends BookingBase {
    type: 'flight';
    legs: FlightLeg[];
    confirmationCode?: string;
  }
  ```
  (Real data has connecting flights — e.g. CLT→BWI→PWM as 2 legs in one booking — so `legs` must be an array, never a single flat leg.)
  `HotelBooking extends BookingBase` — same fields as today (`hotelName, checkIn, checkOut, roomType?, confirmationCode?, address?`), just now extending the base instead of repeating `id/tripId/stopId/type`.
  `RentalBooking extends BookingBase` — same fields as today, **plus** `dropoffStopId?: string` (present only when dropoff city ≠ pickup city; `stopId` is always the pickup stop).
  `RestaurantBooking extends BookingBase` — same fields as today.
  `export type Booking = FlightBooking | HotelBooking | RentalBooking | RestaurantBooking;` (unchanged union shape, new members).
- `ItineraryItem` gains `groupIds?: string[] | null` (same semantics as `BookingBase.groupIds`). `ItineraryDay` is unchanged — group-scoping applies only to individual items, not whole days.
- `Place` gains optional hand-curated fields (not API-fetched — these are yours, so they live directly on the RTDB-backed type, not the Firestore enrichment path): `rating?: number, price?: string, difficulty?: string, duration?: string, distance?: string, photoUrl?: string, subcategory?: string, emoji?: string`.
- New:
  ```ts
  export interface Group {
    id: string;
    tripId: string;
    name: string;
    memberUids: string[];
    createdBy: string;   // uid
    createdAt: number;
  }
  ```
- New (replaces the current dead `TripMember`, keep the same shape — it was already correct, just unused):
  ```ts
  export interface TripMember {
    uid: string;
    handle: string;   // denormalized at join time — avoids reading another user's private users/{uid} profile to render a member list
    role: TripMemberRole;
    joinedAt: number;
  }
  ```
- `UserProfile.trips` changes from `Record<string, true>` to:
  ```ts
  trips: Record<string, { role: TripMemberRole; joinedAt: number }>;
  ```
  This is a denormalized read index only — the authoritative role always lives at `trips/{tripId}/members/{uid}.role`.
- Do **not** add `groupIds` to `Place` — Explore/Place hooks aren't touched by this plan.

### 1b. RTDB schema (`database.rules.json` + implicit path tree)

New paths under `trips/{tripId}/`: `members/{uid}` (`TripMember`), `groups/{groupId}` (`Group`), `joinProofs/{uid}` (write-once string, rules-only, never read by app code). New top-level path: `inviteTokens/{token}: string` (value = tripId — top-level so a bare token resolves to a trip without already knowing the tripId). New path: `users/{uid}/trips/{tripId}: {role, joinedAt}`. Delete `memberHandles` (the current dead sketch in rules) in favor of `members/{uid}`.

Replace `database.rules.json` with:

```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "$uid === auth.uid",
        ".write": "$uid === auth.uid"
      }
    },
    "inviteTokens": {
      "$token": {
        ".read": "auth != null",
        ".write": "auth != null && root.child('trips/' + newData.val() + '/ownerUid').val() === auth.uid",
        ".validate": "newData.isString()"
      }
    },
    "trips": {
      "$tripId": {
        ".read": "auth != null && (root.child('trips/' + $tripId + '/ownerUid').val() === auth.uid || root.child('trips/' + $tripId + '/members/' + auth.uid).exists())",
        ".write": "auth != null && (root.child('trips/' + $tripId + '/ownerUid').val() === auth.uid || root.child('trips/' + $tripId + '/members/' + auth.uid).exists() || !data.exists())",

        "members": {
          "$uid": {
            ".write": "auth != null && $uid === auth.uid && !data.exists() && root.child('trips/' + $tripId + '/joinProofs/' + auth.uid).val() === root.child('trips/' + $tripId + '/inviteToken').val()",
            ".validate": "newData.hasChildren(['uid', 'handle', 'role', 'joinedAt']) && newData.child('uid').val() === auth.uid && newData.child('role').val() === 'traveler'"
          }
        },

        "joinProofs": {
          "$uid": {
            ".write": "auth != null && $uid === auth.uid && !data.exists() && root.child('trips/' + $tripId + '/members/' + auth.uid).exists()",
            ".validate": "newData.isString() && newData.val() === root.child('trips/' + $tripId + '/inviteToken').val()"
          }
        },

        "groups": {
          "$groupId": {
            ".write": "auth != null && (data.child('createdBy').val() === auth.uid || (data.exists() && root.child('trips/' + $tripId + '/members/' + auth.uid + '/role').val() === 'organizer') || (!data.exists() && newData.child('createdBy').val() === auth.uid))"
          }
        }
      }
    }
  }
}
```

Mechanism explanation (for your own understanding, not something to re-derive): Firebase evaluates `.write`/`.validate` rules against the state *after* a whole multi-path `update()` completes. So a client joining a trip performs **one atomic update** writing `trips/{tripId}/members/{uid}`, `trips/{tripId}/joinProofs/{uid}`, and `users/{uid}/trips/{tripId}` together — `members/{uid}`'s rule requires `joinProofs/{uid}` (in that same update) to equal the trip's real `inviteToken`, and `joinProofs/{uid}`'s rule requires `members/{uid}` to already exist (in that same update). Neither path is writable alone, so a wrong token or a partial write rejects the entire multi-path update atomically — no orphaned partial state, no token-guessing oracle. `members/{uid}.validate` forces `role: 'traveler'` on self-join. Trip creation (owner's own first `members/{ownerUid}` write) is covered by the parent trip rule's `!data.exists()` branch. `groups/{groupId}` write is restricted to the group's creator or a trip organizer — not the blanket "any member" rule the rest of the subtree uses.

### 1c. Verify the rules empirically — do this now, not later

1. Check whether `firebase.json` already has an `emulators` block (it currently only has `database`/`firestore` rules paths) — add a minimal one for the database emulator.
2. Run `firebase emulators:start --only database --project jernie-native-dev` (Firebase CLI is on PATH per prior exploration).
3. Using the emulator's REST API (`curl` against `http://localhost:<port>/...json?auth=<fake-token>` or the RTDB emulator's debug endpoints — whichever is faster to script) or a tiny throwaway Node script, exercise this test matrix and confirm each outcome:
   - Owner writes a new trip (`!data.exists()` branch) → succeeds; a second, different uid cannot read it yet.
   - Second uid performs the atomic 3-path update with the **correct** `inviteToken` → succeeds; `members/{uid}`, `joinProofs/{uid}`, `users/{uid}/trips/{tripId}` all present; the trip is now readable by that uid.
   - A third uid attempts the same update with an **incorrect** token on a fresh trip → the entire update is rejected; confirm **neither** `members/{uid}` nor `joinProofs/{uid}` exists afterward (the crux atomicity check).
   - A uid not a member of a trip cannot read another user's `users/{otherUid}`.
   - A non-creator, non-organizer trip member cannot write to an existing `groups/{groupId}` created by someone else; the creator can; an organizer (who didn't create it) can.
4. If any case fails, fix the rules here before proceeding — Tasks 3–4 build hooks on top of this.

### 1d. Stop-color derivation

- `src/design/tripPacks.ts`: widen `resolveStopColor`'s signature from `pack: TripColorPack` to `pack: Pick<TripColorPack, 'stopColors'>` — pure widening (required because `Trip.colorPack` is a `TripColorPackRef`, which lacks `name`/`description`); confirm via grep that this is truly the only call site before and after.
- `src/domain/trip.ts`: add `export function getStopColor(stop: Pick<Stop, 'order'>, trip: Pick<Trip, 'colorPack'>): string { return resolveStopColor(trip.colorPack, stop.order); }` — the first real caller of `resolveStopColor`.
- `src/hooks/useTripData.ts`: after `normalizeTripSnapshot` builds `trip` and raw `stops`, map raw stops through `getStopColor` to produce `stops: StopWithColor[]`. Update `TripDataState`/`CachedSnapshot` types accordingly.
- `src/contexts/TripContext.tsx`: update the `stops` field type in `TripContextValue` from `Stop[]` to `StopWithColor[]` (no logic change here — full membership/group wiring is Task 4).
- `src/features/jernie/HeroLayer.tsx`, `src/features/jernie/StopsStrip.tsx`, `app/(trips)/[tripId]/(tabs)/jernie.tsx`: change the `Stop` type import/prop type to `StopWithColor` wherever a stop object that's expected to carry `.color` flows through (these already read `.color` at runtime — this is a type-only fix to keep `tsc` clean, not a logic change).

### 1e. Tests

- `__tests__/domain-trip.test.ts`: remove `color` from any test `Stop` fixtures; add test cases for `getStopColor` (correct color for a given order, and correct cycling behavior when `order >= stopColors.length`).
- `__tests__/hooks/useTripData.test.ts`: remove `color` from the raw RTDB fixture input, assert the returned `stops` have `.color` derived correctly rather than passed through.

**Definition of done:** no new `npx tsc --noEmit` errors beyond the known baseline set, `npx jest` green, and the manual rules test matrix (1c) passed and reported in your commit/report.

---

## Task 2: Domain layer additions

**Files:** new `src/domain/bookings.ts`, new `src/domain/groups.ts`, new `__tests__/domain-bookings.test.ts`, new `__tests__/domain-groups.test.ts`.

No other files are touched by this task — nothing consumes these modules yet (wiring happens in Tasks 4 and 6).

### `src/domain/bookings.ts`

Extract the two functions currently duplicated inline in `src/features/jernie/CTACardZone.tsx` (`isTodayBooking` and `bookingInfo`) — re-read the file to get their exact current logic, since `FlightBooking` now has `legs` instead of flat fields and any logic reading `booking.departureDate`/`departureTime` etc. for a flight must be updated to read from `legs[0]`/`legs[legs.length-1]` as appropriate — e.g. "is this booking relevant today" should check across all legs, not just one):

```ts
export function isTodayBooking(b: Booking, todayIso: string): boolean { /* ... */ }

export interface BookingDisplay { emoji: string; label: string; meta: string }
export function getBookingDisplay(b: Booking, todayIso: string): BookingDisplay { /* renamed from bookingInfo */ }
```

Do not add any `linkedBookingId`/`resolveLinkedBooking` helper — that was an earlier two-record rental design that was rejected; cross-stop rentals are a single record with `dropoffStopId`, requiring no cross-record lookup at all.

### `src/domain/groups.ts`

```ts
export function filterVisibleToUser<T extends { groupIds?: string[] | null }>(
  items: T[],
  uid: string | null,
  groups: Group[],
  isOrganizer: boolean,
): T[] {
  if (isOrganizer) return items;
  if (!uid) return items.filter(i => !i.groupIds || i.groupIds.length === 0);
  const myGroupIds = new Set(groups.filter(g => g.memberUids.includes(uid)).map(g => g.id));
  return items.filter(i => !i.groupIds || i.groupIds.length === 0 || i.groupIds.some(id => myGroupIds.has(id)));
}
```

Generic over both `Booking` and `ItineraryItem`. Organizers bypass filtering entirely regardless of their own group membership (Global Constraints).

### Tests

`__tests__/domain-bookings.test.ts`: cover `isTodayBooking` and `getBookingDisplay` for all 4 booking types, including a multi-leg `FlightBooking`. `__tests__/domain-groups.test.ts`: cover — no `groupIds` (always visible), `groupIds` matching one of the user's groups (visible), `groupIds` matching none (hidden), organizer sees everything regardless, `uid: null` with `groupIds` set (hidden).

**Definition of done:** no new tsc errors, `npx jest` green including the two new suites.

---

## Task 3: Hooks layer additions

**Files:** new `src/hooks/useTripMembers.ts`, new `src/hooks/useTripGroups.ts`, new `src/hooks/useUserTrips.ts`, new `src/hooks/useJoinTrip.ts`, `__mocks__/@react-native-firebase/database.ts`, new test files for each hook.

### Mock extension (do this first — later hooks and tests in this task depend on it)

`__mocks__/@react-native-firebase/database.ts` currently mocks `ref/once/on/off/set` but not `update`. Add a mocked `update` (e.g. `jest.fn().mockResolvedValue(undefined)`) to the returned ref/database object, following the existing mock's structure exactly (read the file first to match its pattern).

### `src/hooks/useTripMembers.ts`

`useTripMembers(tripId: string): { members: TripMember[]; status: 'loading'|'ready'|'error' }` — live `.on('value')` listener at `trips/{tripId}/members`, same keyed-object-to-array normalization pattern as `useTripData.ts` (RTDB key injected as `uid` if absent — though `uid` should always be present since it's written explicitly). Clean up the listener with `.off()` on unmount, matching `useTripConfirms.ts`'s pattern (read that file for the exact idiom used in this codebase).

### `src/hooks/useTripGroups.ts`

`useTripGroups(tripId: string): { groups: Group[]; status: 'loading'|'ready'|'error' }` — same pattern, at `trips/{tripId}/groups`.

### `src/hooks/useUserTrips.ts`

`useUserTrips(): { trips: Array<{ tripId: string; role: TripMemberRole; joinedAt: number }>; status: 'loading'|'ready'|'error' }` — awaits `authReady` (from `src/lib/firebase.ts`), then live `.on('value')` at `users/{uid}/trips` where `uid = auth().currentUser?.uid`. This is the hook that will power the trip list in `app/index.tsx`/`app/(home)/index.tsx` (Task 7).

### `src/hooks/useJoinTrip.ts`

`useJoinTrip(): { joinTrip: (token: string) => Promise<{ tripId: string }>; status: 'idle'|'joining'|'success'|'error'; error: Error | null }`. Implementation: await `authReady` → `.once('value')` on `inviteTokens/{token}` to resolve `tripId` (throw if not found) → build the payload object for a single atomic `database().ref().update({...})` touching exactly three paths: `trips/{tripId}/members/{uid}` (`{uid, handle, role: 'traveler', joinedAt: Date.now()}` — `handle` can be a placeholder like the user's current `displayName` from auth, or `'Traveler'` if unavailable — note in your report which you chose), `trips/{tripId}/joinProofs/{uid}` (the token string itself), `users/{uid}/trips/{tripId}` (`{role: 'traveler', joinedAt}`) → call `.update()` → return `{tripId}`.

### Tests

One test file per hook, following the existing `useTripConfirms.test.ts` pattern (read it first): capture the `.on`/`.once`/`.update` callbacks the mock records, assert the exact paths passed and the resulting normalized shape / resolved promise. `useJoinTrip`'s test should cover: successful join builds the correct 3-path update payload; token-not-found path rejects before attempting any write.

**Definition of done:** no new tsc errors, `npx jest` green including all new hook test suites.

---

## Task 4: `TripContext` integration

**Files:** `src/contexts/TripContext.tsx`, new `__tests__/contexts/TripContext.test.tsx` (create the `__tests__/contexts/` directory if it doesn't exist).

Wire `useTripMembers(tripId)` and `useTripGroups(tripId)` into `TripProvider`. Add `currentUid` (from `auth().currentUser?.uid`, may be `null` transiently). Determine `isOrganizer` by checking whether `members` contains an entry for `currentUid` with `role === 'organizer'`. Apply `filterVisibleToUser` (from Task 2) to `bookings` and to every `ItineraryDay.items` array in `itinerary`, passing `currentUid`, `groups`, and `isOrganizer`.

Extend `TripContextValue`:
```ts
export interface TripContextValue {
  trip: Trip;
  stops: StopWithColor[];
  bookings: Booking[];        // already visibility-filtered for currentUid
  itinerary: Record<string, ItineraryDay[]>;  // items already visibility-filtered
  members: TripMember[];
  groups: Group[];
  currentUid: string | null;
  confirms: Record<string, boolean>;
  setConfirm: (itemId: string, confirmed: boolean) => void;
  fromCache: boolean;
  status: 'loading' | 'ready' | 'error';
  refetch: () => void;
}
```

Loading/error gating stays keyed on `tripData.status` only (unchanged from today) — members/groups resolve asynchronously; group-scoped items simply appear once the live `groups` listener settles (fail-closed by default per `filterVisibleToUser`, an acceptable brief transient — do not add extra loading states to engineer this away).

### Tests

`__tests__/contexts/TripContext.test.tsx`: render `TripProvider` with mocked `useTripData`/`useTripConfirms`/`useTripMembers`/`useTripGroups` (mock the hook modules directly, following whatever mocking convention this codebase already uses for hooks in component tests — check an existing component test for the pattern) and assert: (1) a booking/item with no `groupIds` is visible regardless of membership; (2) a group-scoped item is hidden for a `currentUid` not in that group; (3) visible for a `currentUid` in that group; (4) visible for any `currentUid` when that user's `members` entry has `role: 'organizer'`, even if not in the group.

**Definition of done:** no new tsc errors, `npx jest` green.

---

## Task 5: Fixture / seed data updates

**Files:** `src/lib/devSeed.ts`, `src/fixtures/devTrip.ts`.

### `src/lib/devSeed.ts` (`maybeSeedDevData`)

- Remove `color` from the two seeded `stops` objects.
- Change the current single `database().ref('trips/dev-trip-001').set(tripData)` call to one atomic multi-path `database().ref().update({...})` covering: `trips/dev-trip-001` (the trip data, minus per-stop `color`), `users/{uid}/trips/dev-trip-001` (`{role: 'organizer', joinedAt}`), and `inviteTokens/abc123` (value: `'dev-trip-001'`).
- Add `trips/dev-trip-001/members/{uid}: {uid, handle: 'Jeremy', role: 'organizer', joinedAt}` to the same update payload.
- Add one sample group: `trips/dev-trip-001/groups/group-guys-hike: {id: 'group-guys-hike', tripId: 'dev-trip-001', name: "Guys' hike day", memberUids: [uid], createdBy: uid, createdAt}`, and tag one existing itinerary item (the Acadia hike item — locate it by searching for "Acadia" or "hike" in the current seed data) with `groupIds: ['group-guys-hike']`.
- Give the existing rental car booking a `dropoffStopId` different from its `stopId` (e.g. pickup at Portland, dropoff at Bar Harbor) to exercise the cross-stop case end-to-end; remove any flat flight fields on the flight booking in favor of a `legs: [...]` array (can be a single-element array if the seeded flight has no layover — just needs to conform to the new type).
- Bump `SEED_KEY` (find its current value in the file) so every dev install re-seeds under the new schema on next launch — this is the migration mechanism for dev/fixture data, since `jernie-native-dev` currently holds only this deterministic fixture (no real testers yet), making this a clean cutover with no compat shim needed.

### `src/fixtures/devTrip.ts`

Mirror the same shape changes (drop `color`, add `dropoffStopId` to the rental fixture, convert the flight fixture to `legs`, add `DEV_MEMBERS`/`DEV_GROUPS` exports) for consistency — note in your report whether this file has any importers anywhere in the app (verify via grep before assuming it's dead code).

**Definition of done:** no new tsc errors, `npx jest` green. Manually confirm (can be deferred to Task 8's on-device smoke test, note this in your report) that a fresh dev install re-seeds without error.

---

## Task 6: Component rewiring

**Files:** `src/features/jernie/CTACardZone.tsx`, `src/features/jernie/components/TravelCard.tsx`, `app/(trips)/[tripId]/(tabs)/jernie.tsx`, `src/features/jernie/StopSection.tsx` (verification only), `src/features/jernie/sheets/FlightSheet.tsx`.

- `CTACardZone.tsx`: delete the local `isTodayBooking`/`bookingInfo` functions; import `isTodayBooking`/`getBookingDisplay` from `src/domain/bookings.ts` (Task 2) instead. No behavior change beyond what Task 2's `legs`-aware rewrite of that logic already produces.
- `TravelCard.tsx`: (1) the rental car variant gains a small badge — compare the stop it's being rendered under (passed in via its existing props — check how `stopId`/stop context currently reaches this component) against `booking.stopId` vs `booking.dropoffStopId` to show "Pickup here" or "Drop-off here" when relevant; (2) the flight variant changes from reading flat fields to iterating `booking.legs` (render each leg as a row, e.g. "CLT → BWI · 8:20 AM → 9:50 AM" per leg); (3) wherever curated `Place` fields are already rendered (if at all — check current usage), thread through the new optional fields (`rating`, `price`, etc.) if there's an existing natural slot for them; if there's no current UI surface for `Place` cards in this component, skip this sub-item and note it in your report.
- `app/(trips)/[tripId]/(tabs)/jernie.tsx`: change the `bookingsByStop` memo from `bookings.filter(b => b.stopId === s.id)` to also include rentals whose `dropoffStopId === s.id`: `bookings.filter(b => b.stopId === s.id || (b.type === 'rental' && b.dropoffStopId === s.id))`.
- `src/features/jernie/sheets/FlightSheet.tsx`: this file exists and currently destructures flat `FlightBooking` fields (`booking.origin`, `booking.departureTime`, `booking.arrivalTime`, etc.) — update it to iterate `booking.legs` instead (render each leg's route/times; the hero summary can show the first leg's origin and the last leg's destination as the overall route). This file has known pre-existing baseline tsc errors unrelated to this task (see Global Constraints) — do not attempt to fix those while you're in this file; only touch the flat-field-to-`legs` change.
- Re-verify (don't just take the plan's word for it) that `src/features/jernie/StopSection.tsx` truly needs no changes — it should only be threading `stop`/`bookings`/`days` through without touching booking-type-specific fields.

**Definition of done:** no new tsc errors beyond the known baseline set, `npx jest` green.

---

## Task 7: Routing rewiring

**Files:** `app/index.tsx`, `app/(home)/index.tsx`.

Depends on Task 5 (dev fixture must have valid membership/index data for the zero-trips fallback to work).

- `app/index.tsx`: replace the hardcoded `DEV_TRIP_ID` redirect with `useUserTrips()`-driven routing: 0 trips → in `__DEV__`, redirect to the seeded dev trip (`/(trips)/dev-trip-001/(tabs)/jernie`); outside `__DEV__` with 0 trips, redirect to `/onboarding/step-1`. 1 trip → redirect directly to `/(trips)/{tripId}/(tabs)/jernie`. 2+ trips → redirect to `(home)`.
- `app/(home)/index.tsx`: replace the current `__DEV__`-only stub redirect with a real (visually minimal — no onboarding/trip-switcher chrome, that's out of scope) list of the user's trips from `useUserTrips()`, each row navigating to `/(trips)/{tripId}/(tabs)/jernie`.

**Definition of done:** no new tsc errors, `npx jest` green.

---

## Task 8: Final full-flow smoke test

No new production files — this task runs and reports verification, and fixes anything it finds broken (small fixes only; if something requires substantial rework, stop and report `BLOCKED` rather than silently expanding scope).

1. Run the complete suite: `npx tsc --noEmit` (confirm error count/content matches only the known pre-existing baseline set) and `npx jest` across the whole repo.
2. On-device or simulator smoke test (use whatever this project's `/run` skill or documented dev workflow provides — check `CLAUDE.md`'s "Running locally" section): fresh install/reload → auth + seed → `app/index.tsx` routes correctly for the single-trip case (and, if testable without a second device, reason through the `__DEV__` zero-trips fallback) → Jernie tab renders Portland/Bar Harbor with their correct colorPack-derived colors (visual proof nothing regressed to a gray/fallback color) → the cross-stop rental shows correctly on both the pickup day and the dropoff day (via `dropoffStopId`) → the group-scoped Acadia hike itinerary item is visible for the dev owner (a group member and the organizer).
3. Report exactly what was checked and the result of each check — do not report success without having actually run the app.

**Definition of done:** all automated suites green (with only known baseline tsc errors), on-device smoke test performed and reported in detail.

---

## Task 9: One-time PWA data import

**Files:** new `scripts/importPwaTrip.ts` (or `.js` if the project has no existing `ts-node`/`tsx` runner configured for one-off scripts — check `package.json` first and match whatever pattern already exists for any similar admin/seed scripts).

This is a standalone script run once against the real `jernie-native-dev` Firebase project (not a test, not part of the app bundle) that reads `~/jernie/public/trip.json` and writes a real trip into the new schema.

Read `~/jernie/public/trip.json` first to confirm its exact current shape before writing the transform (it may have changed since this plan was written). Transform:

- `trip` → `Trip`: `id` stays `'maine-2026'`, `name`/`pills` carry over (PWA `pills` is an array of `[emoji, label]` tuples — join each into a single string, e.g. `"🦞 Seafood-focused"`), `ownerUid` = your real signed-in anon uid (obtain via the same `authReady`/`auth()` pattern used elsewhere — this script needs to run with real auth, so either run it from within a debug screen in the app, or use the Firebase Admin SDK with a service account if running as a pure Node script; choose whichever is simpler given what's already set up in this repo and note your choice in the report), `createdAt` = now, `inviteToken` = a freshly generated random token (use a real random generator, not a low-entropy literal like the dev fixture's `'abc123'`), `colorPack`/`setupIntent` = pick sensible defaults (e.g. the `'coastal'` pack given this is a Maine coast trip, `setupIntent` all `true` since it's already fully booked). Drop `title`/`tagline`/`status`/`invites`/`member_handles` (no equivalent field, or superseded by `TripMember`/`Group` records).
- `stops` → `Stop[]`: carry over `id, city, dates, emoji, lat, lon`, derive `region` if not present in source, assign `order` by array position. Drop `summary`/`weather_start`/`weather_end`/`status` (no equivalent). No `color` field (derived, never stored).
- `bookings` → `Booking[]`: rename `type: 'transportation' → 'rental'`, `'accommodation' → 'hotel'`. Map `group_ids → groupIds`. For the flight booking(s), map the `flights[]` array into `legs: FlightLeg[]` (field-by-field: `num→flightNumber, airline, route split on '→' into origin/destination, dep→departureTime, arr→arrivalTime, date→departureDate`). For the Portland-pickup/Bangor-dropoff rental, set `stopId` to the Portland stop and `dropoffStopId` to the Bar Harbor (or whichever stop covers Bangor-area logistics) stop — confirm the correct stop mapping by reading the actual `pickup_airport`/`dropoff_airport` values in the source data.
- `places` → `Place[]`: map directly onto the expanded `Place` type from Task 1 (`rating, price, difficulty, duration, distance, photo_url→photoUrl, subcategory, emoji` all carry over), `source: 'guide'` → map to whatever `Place.source` enum value fits ('curator' most likely — confirm against the Task 1 type), `addedBy` = your uid.
- `itinerary_days`/`itinerary_items` → `ItineraryDay`/`ItineraryItem`: map `text → label`, `booking_id → bookingId`, `place_id → placeId`, carry `category`/`locked`/`time`/`order` (derive `order` from array position within each day if not explicit). Drop `book_now`/`tide_url`/`addr_label`/`addr`/`alert` (PWA-only UI hints with no equivalent field in the new model).
- `groups` → `Group[]`: carry `id, name`; set `memberUids: [yourUid]` only for the group you (Jeremy) actually belong to based on the source `members` array (e.g. "Jeremy & Jennie" → `[yourUid]`, since Jennie hasn't joined yet); the other group's `memberUids` starts empty. `createdBy` = your uid, `createdAt` = now.
- **Explicitly skip** `alerts` and `packing_lists` — no equivalent schema exists yet (deferred per plan Context); do not invent a schema for them in this script.

Write everything via one atomic `update()` under `trips/maine-2026`, plus `trips/maine-2026/members/{yourUid}` (`role: 'organizer'`) and `users/{yourUid}/trips/maine-2026` (`role: 'organizer'`).

Verify using the same manual approach as Task 8, pointed at this real trip instead of the dev fixture — load it in the app, confirm stops/bookings/itinerary/places render, confirm the cross-stop rental and the group-scoped item behave correctly.

**Definition of done:** script runs successfully against `jernie-native-dev`, the real Maine trip loads correctly in the app, verification checklist reported in detail.

---

## Verification (whole plan)

- **Automated, every task**: `npx jest` + no new `npx tsc --noEmit` errors beyond the known baseline set.
- **RTDB rules, manual, Task 1 (not deferred)**: full test matrix in 1c, run against the Firebase emulator.
- **On-device smoke test, Task 8**: full flow on the dev fixture.
- **Real-data smoke test, Task 9**: full flow on the imported Maine trip.
