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
- Task 6 reorder is implemented on the existing Gesture Handler + Reanimated stack. A 500 ms
  stationary hold lifts a persisted row, dims siblings, and tracks a dashed drop slot across
  every persisted day's five bands and Unscheduled section. Synthetic booking events are
  deliberately not draggable.
- Drops use a real row anchor when one exists and update `time` when the destination changes,
  so clock sorting cannot undo the visible move. Loose items update optimistically and persist
  through the authenticated RTDB transaction. Booking-backed and locked items wait for the
  designed decision sheet; failures roll back and expose Retry.
- Task 6 focused gate: 72 tests pass across six suites. Repository TypeScript and diff checks
  pass; cold Expo SDK 56 iOS export passes at 2,618 modules. All 90 Jest suites and 1,026 tests
  report pass; the process retains the pre-existing post-teardown `TripLoadingScreen`/Expo
  logger exit diagnostic.
- Task 6.1 extends the measured destination coordinator across dates and stops, adds bounded
  edge autoscroll, labels cross-day insertion boundaries, and updates the lifted time column
  and target band live. Same-day moves retain the day-level transaction; cross-day moves use
  one authenticated transaction at the itinerary root so source removal and destination
  insertion commit atomically. The UI applies the same pure transform optimistically and rolls
  back to the server-backed itinerary on failure.
- The final audit adds screen coverage for the atomic cross-day route and visibility coverage
  for stable cross-day preview layout. Device tracing found the real flash/cancel cause in the
  cross-day preview: lift expanded every empty band and mounted an empty Unscheduled section in
  every day, changing the scroll height by hundreds of points while Pan activated. Task 6.2
  removes those global layout mutations while retaining the five measured bands, labels and
  autoscroll. The remaining activation path still published preview through screen-level React
  state, reconciling every day while the native Pan was active. Task 6.3 removes that feedback
  loop: the source day owns its visual preview locally and the global coordinator remains mutable.
  Destination-day-wide tint is deferred until it can be driven without a parent render.
- Task 6.4 traces the remaining cancellation to native configuration changes after activation:
  the lifted row disabled its nested ReanimatedSwipeable while the source day simultaneously
  gained a new stacking order. Both changes occurred beneath the same active finger. The nested
  handler now keeps stable configuration and the day wrapper is no longer restacked; cross-day
  measurement and persistence are unchanged. Focused gate: 14 tests across two suites. Full
  gate: 91 suites, 1,082 tests and two snapshots, exit 0; TypeScript clean; cold SDK 56 iOS
  export passes at 2,624 modules.


- Same-day dragging is now confirmed smooth on device, isolating the remaining concern to
  cross-day visual ownership. Task 6.5 keeps the real row and native Pan mounted in the source
  day while a pointer-transparent screen overlay renders the lifted copy and insertion boundary
  from shared absolute coordinates. Later day siblings and edge autoscroll can no longer cover
  or displace the visual under the finger, and the parent receives no per-frame React updates.
  Cross-day confirmation, rollback, and atomic persistence are unchanged. Focused gate: 33 tests
  across two suites. Full gate: 91 suites, 1,083 tests and two snapshots, exit 0; TypeScript and
  diff checks clean; cold SDK 56 iOS export passes at 2,624 modules. Device review is next.

- Cross-day drag is now device-confirmed. Task 6.6 smooths the remaining post-drop source-gap
  closure without counter-scrolling the collapse-owned viewport. During a tokenized 420 ms
  settle window, Reanimated layout transitions move persisted rows, bands, and downstream days
  with the registered settle spring; device review confirmed the geometry now closes smoothly.
  The accepted follow-up raises damping from 34 to 47 at the same 280 stiffness, targeting about
  70% less visible rebound while retaining a small spring response. A second drag cannot start
  until the layout is stable.
  Reanimated defaults the transition to the system reduced-motion preference. Persistence and
  rollback are unchanged. Focused gate: 34 tests across two suites. Full gate: 91 suites,
  1,084 tests and two snapshots, exit 0; TypeScript/diff checks clean; cold SDK 56 iOS export
  passes at 2,624 modules. Device review confirms the reduced-bounce tuning feels smooth.

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

**Still open — needs a device.** Long-press reorder, cross-day movement, edge autoscroll, and
post-drop settlement are confirmed. Cover non-gesture alternatives for swipe/reorder, font
scaling at the timeline 7.5–9px labels, reduced motion, long-trip performance, both themes,
and locked-item rollback.
`StopMorph`'s invisible full-height return target wants Jeremy's eyes before it is kept or cut.

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

## Task 6.1 — cross-day reorder and destination clarity

Tier: deep | Reasoning: high - shared gesture measurement, edge scrolling, optimistic state,
and a concurrency-safe transactional write spanning multiple itinerary days.

- Share measured row and band destinations across the continuous timeline.
- Keep all persisted days reachable while dragging, including empty bands and Unscheduled.
- Show the destination date/band and before/after anchor while the lifted time column follows it.
- Move across stops/days with one authenticated atomic write and retain confirmation semantics.
- Cover the pure transform, writer races, screen routing, and cross-day destination visibility.

## Task 6.2 — drag-start layout stability

Tier: standard | Reasoning: medium - isolate a device-only gesture cancellation caused by
cross-day preview layout changes while preserving the shared measured coordinator.

- Never grow every empty band or mount every empty Unscheduled section when drag begins.
- Keep the source day's established same-day Unscheduled target and all persisted cross-day zones.
- Preserve cross-day target tint, insertion labels, time previews, and edge autoscroll.
- Add a regression proving an external cross-day preview does not reflow an otherwise empty day.

## Task 6.3 — keep React state out of the active pan

Tier: deep | Reasoning: high - isolate a device-only gesture lifecycle cancellation across a
Reanimated/Gesture Handler worklet and the parent React render loop.

- Do not publish live drag preview through Jernie screen state while Pan is active.
- Keep global measurements and autoscroll in mutable coordinator/refs; keep visual lift, time,
  insertion boundary, and destination request in the source day's local state.
- Stop autoscroll on finalize without a parent render.
- Defer destination-day-wide tint until it can be driven without reconciling the gesture subtree.

## Task 6.4 — keep native handler configuration stable while active

Tier: deep | Reasoning: high - device-only cancellation at the boundary between the outer
long-press Pan, nested ReanimatedSwipeable handlers, and Fabric view stacking.

- Do not toggle a nested Swipeable handler's `enabled` configuration after reorder activates.
- Do not restack the source-day native wrapper while its descendant owns the active touch.
- Preserve the established 500 ms hold, local lift visuals, shared cross-day measurements,
  edge autoscroll, and atomic destination writes.
- Add focused coverage that a lifted row does not publish a changing Swipeable `enabled` prop.

## Task 6.5 — screen-level cross-day drag overlay

Tier: deep | Reasoning: high - cross-day visual ownership across sibling day stacking contexts,
programmatic edge scrolling, shared window coordinates, and an active native Pan.

- Keep the real row and its gesture mounted in the source day without restacking that day.
- Render the lifted copy and insertion boundary in one always-mounted, pointer-transparent
  screen layer so later day siblings and autoscroll cannot cover or displace them.
- Drive lifted-row position from the native Pan's absolute pointer coordinate; drive insertion
  position from the existing measured destination coordinator.
- Limit React updates to overlay content changes at destination boundaries, never per-frame
  pointer movement, and do not feed overlay state back into the gesture subtree.
- Preserve same-day behavior, edge autoscroll, confirmation/rollback, and atomic cross-day writes.
- Add focused overlay and screen-wiring coverage.

## Task 6.6 — smooth the post-drop layout settle

Tier: standard | Reasoning: medium - coordinate tokenized layout motion across nested rows,
time bands, and days without changing the active Pan or the collapse-owned scroll position.

- Keep the viewport offset stable when a source gap closes; do not counter-scroll the timeline.
- After the Pan finalizes and an optimistic move begins, animate affected row, band, and day
  geometry with Reanimated and the registered settle spring (damping 47, stiffness 280).
- Disable the transition outside the short settle window so drag activation never animates or
  reconfigures a native ancestor beneath the active finger.
- Respect the system reduced-motion preference and leave persistence/rollback behavior unchanged.
- Extend focused component and screen coverage for the settle-window wiring.

## Task 7 — release gate

- Accessibility, font scaling, reduced motion, long-trip performance, and both themes.
- Remove old itinerary code only after it has no callers.
- Full tests, cold bundle, clean diff, and screen-by-screen device review.
