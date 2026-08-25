# Jernie itinerary timeline — implementation plan

Branch: `feat/jernie-itinerary-timeline`

Design: `docs/superpowers/specs/2026-08-24-itinerary-timeline-design.md`

## Progress — 2026-08-24

- Tasks 1–5 are implemented on the current design-system branch. The continuous timeline is
  wired into Jernie while the existing collapse, CTA, forms, and shared detail sheet remain.
- Focused timeline gate: 30 tests pass.
- Cold Expo SDK 56 iOS export: passes (2,603 modules).
- Diff/style audit: passes; production source contains no hard-coded URL, hex colour, or emoji.
- Repository TypeScript passes with no diagnostics.
- All 85 Jest suites and 982 tests report pass, but the full process exits 1 on the existing
  post-teardown `TripLoadingScreen`/Expo logger diagnostics.
- Task 3 passes its focused compile/test gate and awaits the on-device interaction review.
- Device review follow-up: the date rail pins beneath the existing compact trip header, day
  bars push one another away, and measured date/stop navigation preserves the hero's current
  collapse state while scrolling smoothly to the requested day.
- Second device pass masks itinerary content beneath the expanded stop card, cancels live
  momentum before a date jump, and gives explicit stop selection stable ownership of shared
  transition days.
- Third device pass separates stop-rail gesture ownership from timeline-driven rail sync:
  stale horizontal momentum can no longer select an old stop and scroll the itinerary back.
- Upward-scroll follow-up measures the within-day handoff marker and applies a small
  hysteresis band, so stop cards switch once at the real boundary in either direction.
- Late-date navigation now has measured bottom runway and every date request cancels older
  queued motion immediately. The stop rail also settles to its latest state-owned card and
  accepts navigation only from a live horizontal drag or tap.
- Navigation/swipe follow-up: rows always reveal Details, and reveal Navigate only when the
  derived source record carries an address/location. The installed-app chooser, optional
  saved preference, and Profile setting are wired.
- Destructive swipe follow-up: swipe right reveals Remove while Details/Navigate remain on the
  opposite swipe. A designed confirmation sheet gates every removal. Confirmed rows are hidden
  locally while the Firebase write waits behind a four-second Undo window; Undo cancels that
  queued write, so no compensating restore is needed. On expiry, place/custom removal deletes
  only the latest matching itinerary row, while booking removal atomically deletes the
  reservation and every linked row. Failed commits re-show the row and offer Retry.
- Task 5 focused gate: 60 tests pass across six suites. Repository TypeScript passes; cold Expo
  SDK 56 iOS export passes at 2,613 modules. All 89 Jest suites and 1,007 tests report pass; the
  process retains the existing post-teardown `TripLoadingScreen`/Expo logger exit diagnostic.
- Task 6 reorder is implemented on the existing Gesture Handler + Reanimated stack. A 280 ms
  long press lifts a persisted row, dims siblings, and tracks a dashed drop slot across the
  day's five bands and Unscheduled section. Targets are constrained to the same persisted
  `stopId + dayId`; synthetic booking events are deliberately not draggable.
- Drops use a real row anchor when one exists and update `time` when the destination changes,
  so clock sorting cannot undo the visible move. Loose items update optimistically and persist
  through the authenticated RTDB transaction. Booking-backed and locked items wait for the
  designed decision sheet; failures roll back and expose Retry.
- Task 6 focused gate: 72 tests pass across six suites. Repository TypeScript and diff checks
  pass; cold Expo SDK 56 iOS export passes at 2,618 modules. All 90 Jest suites and 1,026 tests
  report pass; the process retains the pre-existing post-teardown `TripLoadingScreen`/Expo
  logger exit diagnostic.


## Task 7 — release gate, 2026-08-25

Review of Tasks 3–6 against the design system, then the gate itself.

**Design conformance.** Colour discipline was already clean — no hard-coded hex or `rgba()`
anywhere in the new production files, everything through `useTheme()`, no emoji, no new deps.
Five things were corrected:

- **Red was doing routine work.** The swipe-Remove tile *and* the Undo bar were `--error`,
  including the bar's success state ("Removed Eventide"). Resolved by decision: the system now
  carves out a confirmed destructive control as red's second legitimate job, so the swipe tile
  and the sheet's Remove button keep it; the Undo bar became an inverse ink bar and turns red
  only on `failed`. `README.md`, `SKILL.md`, `tokens.ts` and the Session 12 gate all say so.
- `MoveEntrySheet` + `RemoveEntrySheet` were ~130 near-identical lines, both hand-rolling
  footer buttons while `MapAppSheet` composed `src/ui/Button` correctly. Merged into one
  `DecisionSheet` that uses `Button`, with a new `danger` variant for the destructive tone.
- Off-token motion and elevation in the new drag code: an invented `withSpring(22/260)` →
  `Animation.springs.gentle`; an invented shadow → `Shadow.float`; the drop placeholder's
  6% accent fill → `actionSoft`, which is the 9% the selected-state rule specifies.
- `weight="bold"` on the move sheet's icon → `fill`. The system has two icon weights.
- Four custom components had never been registered: the undo toast, the decision sheet, the
  reorder gesture, and the swipe actions. All four are now rows in `custom-components.md`.

**Defects fixed.**

- A *failed* removal left an undismissable bar: the auto-dismiss timer is skipped when `failed`
  is set, so an offline retry loop pinned a permanent red bar over the itinerary. It now carries
  a dismiss as well as a Retry, and `onDismiss` means "abandon" on a failed bar rather than
  "commit".
- Stacked removals reported the wrong item. Confirming a second removal finalizes the pending
  one first; if *that* failed, the sheet blamed the row the user had just confirmed. A
  `DecisionSheetError` now carries the real sentence.
- `removeItineraryItemById` was read-then-set beside a `reorderItineraryDayItems` that used a
  transaction. Over a four-second Undo window that drops a companion's concurrent add. Now
  transactional, with tests proving the transform runs on the server value.

**Dead code.** `src/features/jernie/home/DayGroup.tsx` deleted — zero callers, as Task 7 requires.

**The jest gate was never green.** `npx jest` printed all-pass and exited 1 on every run, going
back before this branch, and there was no `npm test` script at all. Two teardown leaks, both
multi-suite-only: jest-expo's lazy `fetch` global warning after teardown, and Gesture Handler's
`setImmediate` firing post-teardown and crashing the worker. Both fixed; `TripLoadingScreen` and
`TripErrorScreen` also turned out to be snapshotting `null` because neither wrapped its render
in `act`. **89 suites, 1,033 tests, exit 0.** Cold iOS export passes. TypeScript clean.

**Still open — needs a device, and a new dev build first.** Accessibility (swipe-only Remove and
long-press-only reorder are unreachable under VoiceOver), font scaling at the timeline's 7.5–9px
labels, reduced motion, long-trip performance, both themes. `StopMorph`'s invisible full-height
return target wants Jeremy's eyes before it is kept or cut.

## Standing gates

Each task runs the TypeScript check, full Jest suite, cold iOS Expo export, and Git diff check.
Device gates use both themes and a trip with a transition date, empty day, red-eye flight,
unconfirmed stay, and untimed custom plan.

## Task 1 — pure timeline model

- Add `src/domain/itineraryTimeline.ts`.
- Declare five bands and normalize hard, loose, and unscheduled times.
- Collapse stop-keyed days into one chronological day per date.
- Resolve itinerary placements and synthesize events for unplaced bookings.
- Derive stop segments, transitions, night's stay, warnings, past, and next.
- Add focused domain tests.

Gate: no React import and no existing screen modified.

## Task 2 — static components

- Register the custom date rail and timeline spine before implementation.
- Add components under `src/features/jernie/itinerary`.
- Compose `Photo`, the icon registry, and approved tokens.
- Render all bands, quiet blanks, unscheduled fallback, stay context, and handoff.
- Add component tests for semantic output and press routing.

Gate: both palettes; no hard-coded URL, emoji, legacy token, or hit target below 44px.

## Task 3 — rebase and Jernie integration

- Wait for Session 6, then rebase.
- Replace `DayGroup` usage without rewriting the header, rail, CTA, forms, or detail sheet.
- Feed the existing single scroll value into the date rail and timeline.
- Wire measured day offsets, rail, stop bar, Today pill, and active-stop synchronization.
- Preserve refresh and developer time travel.

## Task 4 — preferred maps app

- Add an optional preferred maps-app value to the self-owned user profile.
- Add read/write helpers and Profile setting.
- Build the navigation sheet with installed choices and "Always use <app>".
- Prompt whenever no preference is saved and omit Navigate without a destination.

## Task 5 — swipe actions and reservation removal

- Add Gesture Handler details/navigate and remove actions.
- Place/custom removal calls `removeItineraryItem`.
- Booking removal calls `removeBooking` so reservation and linked rows go together.
- Add designed confirmation and delayed-commit Undo: hide locally, cancel before expiry, then
  commit the actual delete. Failed commits restore visibility and offer Retry.

## Task 6 — reorder

- Keep the existing Gesture Handler + Reanimated stack and build the constrained gesture
  locally. `react-native-reanimated-dnd` v2 is version-compatible, but its Sortable owns a
  scroll container and internal list state while this timeline already owns one animated
  scroll surface with nested day/band structure and live external updates.
- Define a pure same-day reorder and an authenticated atomic writer.
- Add long-press lift/drop with Gesture Handler and Reanimated.
- Loose/unconfirmed drops persist immediately.
- Booked/locked drops persist only after the decision sheet approves them.

## Task 7 — release gate

- Accessibility, font scaling, reduced motion, long-trip performance, and both themes.
- Remove old itinerary code only after it has no callers.
- Full tests, cold bundle, clean diff, and screen-by-screen device review.
