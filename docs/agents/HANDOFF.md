# Agent handoff

Updated: 2026-08-26
Agent: Claude, executing Session 7 (Explore) subagent-driven
Branch: `feat/session-7-explore`, branched from `feat/design-system` @ `d5b65af`
HEAD: `dc6302c`

## Current objective

- Session 7 (Explore) is code-complete and its automated gate is green. **Next: Jeremy's
  device pass**, then merge `feat/session-7-explore` into `feat/design-system`.
- Active plan: `docs/superpowers/plans/2026-08-26-explore.md` — its "What to test on device,
  and how" section is the device script.
- Still open from the previous sprint: the itinerary-timeline Task 7 device pass
  (`docs/superpowers/plans/2026-08-24-itinerary-timeline.md`), listed below.

## Verified state

- Session 7 gate is green on both halves: filter state lives in `ExploreFilterContext`,
  mounted above `<Tabs>` so Session 8's Map consumes it unchanged; and
  `getExploreDefaultStopId` resolves current → next → last, so the stop never defaults to
  "All stops" while the trip has stops. `'all'` remains a legal explicit choice.
- The screen now matches the canvas: one filter bar (stop bubble, type bubble, sliders button
  with a count badge), exactly one carousel, a two-column FlashList grid. Search moved into
  the filter sheet, where the Apply commit point is.
- New: `src/ui/ChipDropdown.tsx` (approved as custom and registered),
  `src/contexts/ExploreFilterContext.tsx`, and four components under
  `src/features/jernie/explore/`. Retired: `FilterPillRow`, `SearchBar`, `PlaceCarouselCard`,
  `PlaceCarouselRow`, `PlaceList`, `PlaceListCard` and their four suites.
- **Two things the canvas asks for that the data cannot support**, both decided with Jeremy:
  no save/bookmark circle (no saved-places schema, and redesign work may not add one), and no
  distance sort or "open now" line (6 of 54 places carry coordinates, `hours` is a free-form
  `string[]`, `expo-location` is not installed). The carousel states its real basis instead.
- Before this branch: `d5b65af` and `f2e2e98` commit Codex's 2026-08-26 work. Its handoff
  claimed the gate was green; it was not — `__tests__/app/jernie.test.tsx` built
  `TimelineDropRequest` without the `destination` field the handler reads, and `tsconfig`
  excludes `__tests__`, so only jest could see it. Fixed in `f2e2e98`.
- Verified 2026-08-26 on `dc6302c`: `npx tsc --noEmit` exit 0; `npm test` **91 suites,
  1,079 tests, exit 0**; `npx expo export --platform ios --output-dir /tmp/verify-s7` exit 0.
- No dependency, schema, security-rule or native-config change this session.

## Remaining work

1. **Session 7 device pass** — the plan's device script. Both themes, VoiceOver on the
   bubbles and the sort control, largest Dynamic Type on the grid's two columns.
2. **Itinerary-timeline Task 7 device pass**, still open: accessible alternatives for
   swipe-only Remove and long-press-only reorder; font scaling at the timeline's 7.5–9px
   labels; reduced motion; long-trip performance; `StopMorph`'s invisible full-height return
   target; and the Task 6.1 drag-destination treatment.
3. **Maps-app chooser** still needs `eas build --profile development --platform ios` before
   it can be tested — application-query schemes are native configuration.
4. Two parked items in `.superpowers/sdd/2026-08-26-explore/progress.md`: `ChipDropdown`'s
   clamp assumes a 180px card, and the tab bar is still on the static `Core` palette with
   letter placeholders (Session 8 rebuilds it as five tabs).

## Watch-outs

- `tsconfig.json` excludes `__tests__`, so `tsc` cannot catch a test built against a changed
  interface. A green `tsc` is not evidence the suite compiles — run `npm test`.
- A suite printing all-pass is not green unless the process exits 0. Three separate
  after-teardown leaks caused a false exit 1 on this repo before; the newest was FlashList's
  post-mount layout update, flushed inside `act()` in the Explore suites.
- `.vscode/` is untracked and intentionally untouched.

## Next milestone

- After the Session 7 device pass: Session 8 Map — a **new fifth route**, consuming
  `ExploreFilterContext`. Then 9 Profile passport, 10 Onboarding, 11 Images, 12 Skeletons.
