# Phase 2 — CRUD UI + Chronological Stop Ordering

**Status:** Approved design, ready for implementation planning
**Date:** 2026-08-07
**Branch:** `feat/crud-ui`

## Context

Phase 1 (merged to `dev`, commits `aa10306..f51bdd4`) built the pure business-logic CRUD layer — `useBooking`, `useEditStop`, `addCustomItineraryItem`, cascade-delete helpers. None of it is reachable from the app: nothing in `app/` or `src/features/` imports those hooks. The app looks and behaves exactly as it did before Phase 1.

This phase makes it functional. The user must be able to add, edit, and delete stops, bookings (flight/hotel/rental/restaurant), itinerary items, and trips.

It also fixes an ordering defect found in use: stops display in creation order, not date order. Entering Charlotte (12th–14th), then Charleston (16th–18th), then Columbia (14th–16th) shows them in that entry sequence rather than chronologically.

Design target remains the mockups at `docs/ux/jernie-tab-native-mockup.html` and `docs/ux/jernie-onboarding-design-guide.html`.

## Confirmed decisions

| Decision | Choice |
|---|---|
| Trip deletion | Soft-delete via a `deletedAt` marker + restore path. A future scheduled cleanup job (out of scope) hard-deletes abandoned trips. |
| Stop colors | Stay fixed to the stop. Sorting changes display order only; `stop.order` (the color index) is never recomputed. |
| Remove UX | A "Remove" button at the bottom of each entity's edit sheet, guarded by a native `Alert.alert` confirm. One pattern everywhere. |
| Add-booking entry | Four type-specific entry points, not one generic sheet with a type-picker. |
| Custom-item day selection | Reuse a day-picker sub-sheet (This stop / All stops), not "always today". |
| Edit surface | A separate form sheet per entity (the `AddStopSheet` pattern), not an edit mode inside the read-only detail sheets. |

## Current-state findings (verified against the code, not assumed)

These correct assumptions made during brainstorming and shape the work:

- **`normalizeTripSnapshot` (`src/hooks/useTripData.ts:52`) sorts stops by `.order`**, which `useAddStop` assigns as `max(order) + 1` — pure insertion sequence. `getStopColor` (`src/domain/trip.ts:12`) independently uses `.order` as a palette index via `resolveStopColor(pack, order)`. The two uses are not coupled in code, so display order can change without touching colors.
- **Every stop consumer trusts the array `useTripData` returns.** `StopsStrip` iterates it directly; `getActiveStopId` scans it positionally. No component re-sorts. A fix at the normalize layer propagates everywhere.
- **`HeroLayer` has no menu/edit affordance.** The `···` icon exists only in the HTML mockup. It must be built.
- **`CTACardZone`'s four setup rows are plain `View`s** (`CTACardZone.tsx:58-75`) — not pressable at all. The `QuickActionButton`s at lines 141-142 ("Add restaurant", "Log activity") accept no `onPress` prop.
- **No day-picker UI exists.** The Explore tab's add-to-itinerary flow calls `getDefaultDayForStop` (`src/domain/explore.ts:177`) and silently auto-picks a day (`explore.tsx:83-86`). The mockup's This stop / All stops picker has never been built.
- **`RestaurantSheet` does not exist** (deleted in an earlier refactor); restaurant bookings fall back to the generic `PlaceSheet`, which shows only a name. **`RentalCard` accepts no `onPress`.**
- **RTDB rules:** `stops`/`bookings`/`itinerary`/`places` already allow owner-or-member writes. `name`/`pills`/`colorPack`/`setupIntent` already allow owner-only writes. A new `deletedAt` field has **no rule** and would be rejected — it needs one added.

## 1. Chronological stop ordering

Change the sort in `normalizeTripSnapshot` from `.order` to date order:

```ts
.sort((a, b) =>
  a.dates.start.localeCompare(b.dates.start) ||
  a.dates.end.localeCompare(b.dates.end) ||
  a.order - b.order,
)
```

Dates are `YYYY-MM-DD`, so lexicographic comparison is chronological. Tiebreaks: same start date → earlier end first; fully identical dates → creation order, keeping the sort total and stable.

The `.map(stop => ({ ...stop, color: getStopColor(stop, trip) }))` that follows is unchanged — colors still derive from `.order`, so a stop keeps its color for the life of the trip regardless of where it lands in the display sequence.

Extract the comparator as `compareStopsChronologically(a, b)` in `src/domain/trip.ts` so it is unit-testable independently of RTDB normalization.

`useAddStop` keeps appending `order: max + 1`. `order` becomes purely a color key and creation-sequence tiebreak; it is no longer the display order.

## 2. Trip edit, soft-delete, restore

**Schema:** add `deletedAt?: number | null` to `Trip` in `src/types.ts`.

**RTDB rules** (`database.rules.json`): add a `deletedAt` node beside the existing `name`/`pills` entries, owner-only, matching their exact shape:

```json
"deletedAt": { ".write": "auth != null && root.child('trips/' + $tripId + '/ownerUid').val() === auth.uid" }
```

**New `src/lib/tripWrites.ts`:**
- `updateTrip(tripId, patch: { name?: string; pills?: string[] })` — `.update()` with `stripUndefined`.
- `archiveTrip(tripId)` — sets `deletedAt: Date.now()`.
- `restoreTrip(tripId)` — sets `deletedAt: null`.

**New `src/hooks/useTripAdmin.ts`** — thin pass-through, matching `useBooking`/`useEditStop`.

**`useUserTrips` extension:** it currently returns only `{tripId, role, joinedAt}`, which is why My Trips renders raw trip IDs as titles. Extend it to fetch each trip's `name` and `deletedAt` (a read per trip id; the list is small). Add `name: string` and `deletedAt: number | null` to `UserTripEntry`.

**`app/(home)/index.tsx`:** render `entry.name` instead of `entry.tripId`. Partition the list — active trips in the main list, `deletedAt`-set trips in a collapsed "Recently Deleted" section with a Restore button per row.

**Entry point:** a "Trip settings" block in the Profile tab (`app/(trips)/[tripId]/(tabs)/profile.tsx`, which already carries a Settings placeholder), rendered only when `trip.ownerUid === auth().currentUser?.uid`. Contains an edit-name/pills form and a "Delete trip" action. On successful delete, `router.replace('/(home)')` — the trip's own screen must not remain mounted.

## 3. Stop edit + delete

**`StopForm` (`src/features/jernie/StopForm.tsx`)** gains an optional `initialValues?: ResolvedStop` prop (the existing exported type already carries city/region/lat/lon/dates — exactly the edit-mode seed). When present, city and dates initialize pre-filled and `geocodeStatus` starts as `'success'` with `resolvedFor` set to that city, so an unedited city does not force re-resolution while editing the city text still invalidates it through the existing staleness check. Absent, behavior is exactly as today.

**`AddStopSheet`** gains `editingStop?: StopWithColor`. When set: pass `initialValues`, submit through `useEditStop().updateStop` instead of `useAddStop().addStop`, use "Save changes" as the submit label, and render a "Remove stop" button below the form. Rename the file/component to `StopFormSheet` — it now serves both modes, and the old name would mislead.

**Entry point:** an edit affordance on the hero for the active stop. `HeroLayer` gains an `onEditStop?: () => void` prop rendering a `···` button (per the mockup's `icon-btn`); `jernie.tsx` wires it to present `StopFormSheet` with `editingStop` set to the active stop.

Removal cascades (bookings, itinerary subtree, places for that stop) — already built and tested in Phase 1's `removeStop`.

## 4. Booking add / edit / delete

**New `src/features/jernie/BookingForm.tsx`** — one form component parameterized by `type: BookingType`, rendering that type's fields:

| Type | Fields |
|---|---|
| flight | per-leg: airline, flight number, origin/destination IATA, departure date, departure/arrival time; add/remove leg; confirmation code |
| hotel | hotel name, check-in, check-out, room type, confirmation code, address |
| rental | company, car type, pickup date/time, dropoff date/time, pickup/dropoff location, confirmation code |
| restaurant | restaurant name, date, time, party size, confirmation code |

Same contract as `StopForm`: presentation + local validation only, no RTDB or sheet awareness, `onSubmit(booking) => Promise<void>`, inline error on rejection. Optional fields left blank submit as omitted keys (Phase 1's `addBooking` runs input through `stripUndefined`, so blanks are safe).

Flight legs are the one non-trivial case — `FlightBooking.legs` is an array and real trips have connections. The form supports adding and removing legs, minimum one.

**New `src/features/jernie/sheets/BookingFormSheet.tsx`** — wraps `BookingForm` in a `BottomSheetModal`, following `AddStopSheet`'s structure exactly (imperative `present()`/`dismiss()` ref, `SheetContext` counter participation, `BottomSheetScrollView` with `keyboardShouldPersistTaps`). Props: `{ type, stopId, editingBooking?, onSaved }`. Add mode calls `useBooking().addBooking`; edit mode calls `updateBooking` and shows "Remove booking".

**Entry points:**
1. `CTACardZone`'s four setup rows become pressable, each opening `BookingFormSheet` for its type. Requires threading an `onAddBooking(type)` callback down from `jernie.tsx`.
2. `CTACardZone`'s "Add restaurant" quick action gets the same handler; "Log activity" wires to the custom-item flow (§5).
3. Each `TravelCard` group in `StopSection` gets a trailing "+" affordance for that type, mirroring `StopsStrip`'s add-stop pill — the path to a second hotel once the setup card is dismissed.
4. Tapping an existing card opens its detail sheet, which gains an "Edit" action opening `BookingFormSheet` pre-filled.

**Detail-sheet gaps to close:** build `RestaurantSheet` (real `RestaurantBooking` fields: name, date, time, party size, confirmation code) and register it in `EntityDetailSheet`'s payload-kind router; add `onPress` to `RentalCard` and a rental detail sheet. `HotelSheet`/`FlightSheet` keep their mock enrichment display untouched — edit forms only ever write real schema fields.

## 5. Itinerary items

**New `src/features/jernie/sheets/DayPickerSheet.tsx`** — the mockup's day picker, built for the first time. Scope toggle (This stop / All stops), days grouped by stop with section headers when scoped to all, past days dimmed and non-interactive, today badged. Returns the chosen `ItineraryDay`.

Used by:
- the custom-item flow (§ below),
- the Explore tab's add-place flow, replacing the silent `getDefaultDayForStop` auto-pick (`explore.tsx:83-86`). `getDefaultDayForStop` remains as the picker's initial selection.

**New `src/features/jernie/sheets/CustomItemSheet.tsx`** — form for label, optional time, optional category, optional notes; day chosen via `DayPickerSheet`. Add mode calls `addCustomItineraryItem`; edit mode calls `updateItineraryItem` and shows "Remove item". Entry point: `CTACardZone`'s "Log activity" quick action.

**Tapping an itinerary row** (`ItineraryDayRow`'s existing `onItemPress`) routes by `item.type`: `'custom'` opens `CustomItemSheet` in edit mode; `'place'` and `'booking'` open that entity's own detail sheet, where removal deletes the place/booking and Phase 1's cascade drops the orphaned itinerary entry automatically.

## 6. Shared delete confirmation

**New `src/utils/confirmDelete.ts`:**

```ts
export function confirmDelete(opts: { title: string; message: string; onConfirm: () => void }): void
```

Wraps `Alert.alert` with a cancel-default, destructive-styled confirm. Every Remove action (stop, booking, trip, itinerary item) calls it. One implementation, not four.

## Testing

Follows the repo's TDD convention and existing patterns (`__tests__/components/StopForm.test.tsx` for forms, `__tests__/hooks/*` for hooks, `@testing-library/react-native`).

- **Ordering:** `compareStopsChronologically` unit tests — out-of-order entry sorts chronologically, same-start tiebreak, identical-dates stability, and that `color`/`order` are unchanged by sorting (the regression that would silently break the "colors stay fixed" decision).
- **Forms:** `BookingForm` per type — required-field validation, blank optionals omitted, flight multi-leg add/remove, pre-filled edit mode, rejection surfaces inline without data loss.
- **Sheets:** add vs. edit mode dispatch to the right write function; Remove triggers `confirmDelete` and only writes after confirmation.
- **Trip admin:** `tripWrites` archive/restore write shapes; `useUserTrips` partitions active vs. deleted; Restore clears `deletedAt`.
- **Day picker:** past days non-interactive, scope toggle filters correctly, selection returns the right day.
- **Rules:** extend `__tests__/databaseRules.test.ts` for the new `deletedAt` node (owner writes allowed, non-owner rejected).

## Out of scope

- The scheduled cleanup job for abandoned trips and abandoned onboarding sessions (this phase only lays the `deletedAt` groundwork).
- Hero "smart states" — pre-trip countdown, travel-day flight card, weather/problem state, leave-time ETAs (roadmap Phase 3; needs weather + routing data).
- Onboarding steps 3 (auth) and 5 (invite) (roadmap Phase 4).
- Email-forward booking import (roadmap Phase 5).
- Replacing `HotelSheet`/`FlightSheet` mock enrichment with real API data.
- Drag-to-reorder itinerary items.
- Offline write-queue adoption — writes stay direct, consistent with Phase 1.

## Critical files

**New:** `src/lib/tripWrites.ts`, `src/hooks/useTripAdmin.ts`, `src/features/jernie/BookingForm.tsx`, `src/features/jernie/sheets/BookingFormSheet.tsx`, `src/features/jernie/sheets/DayPickerSheet.tsx`, `src/features/jernie/sheets/CustomItemSheet.tsx`, `src/features/jernie/sheets/RestaurantSheet.tsx`, `src/utils/confirmDelete.ts`

**Modified:** `src/types.ts` (`deletedAt`), `database.rules.json` (`deletedAt` rule), `src/hooks/useTripData.ts` (sort), `src/domain/trip.ts` (comparator), `src/hooks/useUserTrips.ts` (name + deletedAt), `app/(home)/index.tsx` (names, deleted section), `app/(trips)/[tripId]/(tabs)/profile.tsx` (trip settings), `app/(trips)/[tripId]/(tabs)/jernie.tsx` (sheet wiring), `app/(trips)/[tripId]/(tabs)/explore.tsx` (day picker), `src/features/jernie/StopForm.tsx` (`initialValues`), `src/features/jernie/sheets/AddStopSheet.tsx` (→ `StopFormSheet`), `src/features/jernie/HeroLayer.tsx` (edit affordance), `src/features/jernie/CTACardZone.tsx` (pressable CTAs), `src/features/jernie/StopSection.tsx` (per-type add), `src/features/jernie/components/TravelCard.tsx` (`RentalCard` press), `src/features/jernie/sheets/EntityDetailSheet.tsx` (restaurant/rental kinds, Edit action)

**Reused from Phase 1, unchanged:** `useBooking`, `useEditStop`, `bookingWrites`, `stopWrites`, `itineraryWrites`, `domain/cascade`, `stripUndefined`

## Verification

- `npx jest` green, including all new tests above.
- Manual pass in the app: create a trip; add stops out of date order and confirm chronological display with stable colors; add one of each booking type; edit and delete each; add a custom itinerary item via the day picker; delete a stop and confirm its bookings/itinerary disappear; delete a trip and restore it from My Trips.
