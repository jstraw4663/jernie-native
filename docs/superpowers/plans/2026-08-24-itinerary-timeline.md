# Jernie itinerary timeline — implementation plan

Branch: `feat/jernie-itinerary-timeline`

Design: `docs/superpowers/specs/2026-08-24-itinerary-timeline-design.md`

## Progress — 2026-08-24

- Tasks 1 and 2 are implemented on this isolated branch; no app screen or Session 6 file is modified.
- Focused timeline gate: 30 tests pass.
- Cold Expo SDK 56 iOS export: passes (2,607 modules).
- Diff/style audit: passes; production source contains no hard-coded URL, hex colour, or emoji.
- Repository TypeScript remains red on baseline Firebase Functions resolution, Session 6 sheet
  typings, and an upstream Phosphor SVG typing; none of the diagnostics name a timeline file.
- All 89 Jest suites and 981 tests report pass, but the full process exits 1 on the existing
  post-teardown `TripLoadingScreen`/Expo logger diagnostics.
- Task 3 deliberately waits at the rebase boundary until Session 6 is committed.

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
- Add designed confirmation and recoverable undo feedback.

## Task 6 — reorder

- Define a pure same-day reorder and an authenticated atomic writer.
- Add long-press lift/drop with Gesture Handler and Reanimated.
- Loose/unconfirmed drops persist immediately.
- Booked/locked drops persist only after the decision sheet approves them.

## Task 7 — release gate

- Accessibility, font scaling, reduced motion, long-trip performance, and both themes.
- Remove old itinerary code only after it has no callers.
- Full tests, cold bundle, clean diff, and screen-by-screen device review.
