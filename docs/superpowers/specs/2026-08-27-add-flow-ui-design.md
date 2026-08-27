# Add flow — the sheet UI

**Date:** 2026-08-27
**Status:** approved, ready for an implementation plan
**Design source:** `Jernie Add Flow.dc.html` (canvas), copied into `docs/design/` as part of this work
**Builds on:** `.claude/plans/great-this-makes-sense-cozy-fox.md` (the add-flow data layer, complete)

---

## Scope

The presentation layer over the finished add-flow data layer: one sheet that takes a query,
resolves it, answers with a card, and commits — replacing every add and edit path that
`BookingFormSheet` and `CustomItemSheet` serve today.

The data layer is done and is **not** re-opened by this work. It already provides:

| Contract | Module |
| --- | --- |
| `Candidate`, `ResolvedField`, `FieldConfidence`, `canCommit`, `FIELD_TABLES`, `buildCandidate` | `src/domain/candidate.ts` |
| `resolveQuery` client + MMKV result cache | `src/lib/resolveClient.ts`, `src/lib/resolveCache.ts` |
| Tray persistence | `src/lib/addTray.ts` |
| One-write commit and its inverse | `src/domain/batchCommit.ts`, `src/lib/addFlowWrites.ts` |
| Drive times, cache-first | `src/lib/routeClient.ts`, `src/hooks/useRoute.ts` |
| User-facing callable errors | `src/domain/callableError.ts` |

---

## Locked decisions

| Decision | Choice | Consequence |
| --- | --- | --- |
| Replacement scope | **Full.** The new sheet does add *and* edit | `BookingFormSheet`, `CustomItemSheet` and `BookingForm` are deleted, along with their three test files — 833 lines and 40 cases |
| The details form | **Written new**, to the card's anatomy | Does not reuse `BookingForm`. Must re-derive its whole field and validation surface or booking shapes silently stop being creatable |
| Rental cars | **The Drive chip absorbs them** | The canvas's five chips stay as drawn. A rental is reached by picking Drive and saying it is a rental |
| Global add control | **A round `+`, top-right of the hero, in its own layer above the collapse** | Icon-only, so it is a registered custom control. Scoped exception to the roadmap's "header Add is a labelled Button" |
| Blur behind the `+` | **No `expo-blur`** | The dep is named by the design system but is not installed, and adding it forces a fresh dev build. A tokenized solid fill over the existing hero scrim is used instead |
| Multiple matches | **Top result as the card, plus a "N more matches" row** | The canvas draws one card and does not say what ten matches look like. Consistent with the stop picker's rule that nothing resolves without a tap |
| The `asking` phase | **Only from `place_enrichment` hours** | Nothing else in v1 can produce an `OpenQuestion`, so the phase is built against a real producer rather than shipped dead |
| Detent heights | **A share of window height, clamped to 92%** | The canvas's 560/620/690/730/790 were drawn on one handset; taken literally, 790 overruns an SE |
| Explore | **Untouched** | Keeps its `DayPickerSheet` path. Not an entry point in this build |

---

## 1. Deletions

Removed in full:

- `src/features/jernie/BookingForm.tsx` (520 lines)
- `src/features/jernie/sheets/BookingFormSheet.tsx`
- `src/features/jernie/sheets/CustomItemSheet.tsx`
- `__tests__/components/BookingForm.test.tsx` (17 cases)
- `__tests__/components/BookingFormSheet.test.tsx` (11 cases)
- `__tests__/components/CustomItemSheet.test.tsx` (12 cases)

Explicitly **kept and unmodified** — every write path survives, so this is a UI replacement
and not a data change:

`src/lib/bookingWrites.ts`, `src/lib/itineraryWrites.ts`, `src/lib/placeWrites.ts`,
`src/hooks/useBooking.ts`, `src/features/jernie/sheets/DayPickerSheet.tsx`,
`src/features/jernie/sheets/DecisionSheet.tsx`, `src/utils/confirmDelete.ts`.

---

## 2. New modules

```
src/domain/addFlow.ts                    pure reducer: phases, growth, the Add gate
src/features/jernie/add/
  AddSheet.tsx                           the shell — modal, detents, pinned header
  AddContextChip.tsx                     "Bar Harbor · Sat 27", tappable
  MagicField.tsx                         the pinned query input
  TypeRow.tsx                            five chips; unpicked dim to 42%
  SkeletonCard.tsx                       shimmer at the height the card will take
  SuggestionCard.tsx                     identity row / field table / footer row
  CardFieldTable.tsx                     the four rows and their confidence styling
  MoreMatchesRow.tsx                     "4 more matches" → the ranked list
  QuestionBlock.tsx                      the one question, as taps
  DetailsForm.tsx                        the form that finishes
  detailsFields.ts                       per-type field specs and required sets
  TrayList.tsx                           "Ready to add · N" + Review
  AddedStrip.tsx                         "Added Delta 2214 · Undo"
  index.ts
src/features/jernie/home/HeroAddButton.tsx
```

---

## 3. The state machine

`src/domain/addFlow.ts` is pure — no React, no React Native, no Firebase — so growth rules and
the Add gate are unit-testable without rendering. It follows the precedent of `gaps.ts`,
`cascade.ts` and `agenda.ts`.

```typescript
export type AddPhase =
  | 'idle'       // chip + magic field + type row
  | 'searching'  // debounce fired; skeleton showing
  | 'asking'     // the one question this candidate cannot infer
  | 'card'       // the suggestion card
  | 'details'    // the form that finishes; also every edit
  | 'tray';      // ready-to-add list

export interface AddFlowState {
  phase: AddPhase;
  query: string;
  type: CandidateType | null;        // null = nothing picked, every chip at full weight
  typeConfidence: TypeConfidence;
  results: Candidate[];              // ranked, from resolveQuery
  expandedMatches: boolean;          // the "N more matches" row is open
  selected: Candidate | null;
  answers: Record<string, string>;   // keyed by OpenQuestion.fillsKey
  tray: Candidate[];                 // mirrored from addTray
  lastAdded: { label: string; inverse: Record<string, unknown> } | null;
  error: string | null;
}
```

### Height per phase

| Phase | Canvas height | Notes |
| --- | --- | --- |
| `idle` | 560 | |
| `searching` | 690 | Deliberately the `card` height, so nothing jumps when the real card lands |
| `asking` | 620 | |
| `card` | 690 | |
| `details` | 690 | Content scrolls inside |
| `tray` | 730, then 790 at 3+ items | |

`addSheetHeight(phase, trayCount, windowHeight)` returns the canvas number clamped to
`0.92 * windowHeight`. The clamp exists for the same reason `stopCardWidth()` does: a constant
drawn on one handset reads as a different weight on every other one.

### Rules encoded in the reducer

- **The query never moves.** Structural, not stylistic: chip, field and type row render
  *outside* `BottomSheetScrollView`; results, cards, forms and tray grow inside it.
- **Add turns on when title, type, day and stop are all true.** Delegated to the existing
  `canCommit(candidate)`. Amber fields never gate it.
- **Unpicked types dim to 42%; they never disappear.** One tap corrects a wrong guess.
- **Lookup is debounced 350ms** and shows a skeleton at the real card's height.
- Detent transitions use `Animation.springs.drag` (damping 50 / stiffness 460), the registered
  token other sheets already use. The canvas's raw "spring .82" is not a value this system has.

---

## 4. The suggestion card

Fixed anatomy, unchanged from the canvas: identity row → divider → four-row field table → one
contextual footer row. Only the field table's contents vary by type, which is what lets one
component serve five.

Field confidence maps straight onto the existing `FieldConfidence` union:

| Confidence | Rendering |
| --- | --- |
| `pulled` | DM Mono, full ink |
| `inferred` | DM Mono, `--ink-2` grey |
| `wanted` | amber, with its placeholder as the label ("Add code") — **never blocks Add** |
| `absent` | grey, "Not in the schedule" |

### More than one match

The canvas draws a single card and does not say what happens when ten places match. Showing
only the top hit is how the wrong restaurant gets added silently, and the stop picker already
settled the principle in this app: every match is offered, nothing resolves without a tap.

So the top result renders as the full card, and a quiet `MoreMatchesRow` beneath it reads
"4 more matches". Tapping it expands the ranked list; tapping a row promotes that candidate
into the card. The sheet stays at 690 either way.

Registered in `custom-components.md` as a deliberate addition to the canvas.

### The `asking` phase

`buildCandidate` never populates `question`, the flight path has no provider, and Foursquare
search requests Pro fields only — so in v1 exactly one thing can produce an `OpenQuestion`: an
Eat candidate whose `place_enrichment` record already carries hours. That is the canvas's own
example ("Time — offered as two guesses from its hours").

`QuestionBlock` therefore renders a client-derived question: two time guesses from the day's
hours as taps, plus the "Another time" picker escape. When hours are absent there is no
question and the flow goes straight to `card`. The phase is built against a real producer, not
shipped dead.

---

## 5. `DetailsForm` — the form that finishes

The largest piece of the build, and the one carrying regression risk.

It replaces `BookingForm` entirely, rendered to the card's anatomy: an aligned label column, DM
Mono for values that line up, amber for wanted, grey "Optional" said out loud rather than
implied. It must carry **every** field the deleted form did, or booking shapes stop being
creatable without anything failing loudly.

`detailsFields.ts` holds the specs. Ported verbatim from the deleted `FIELDS`, `REQUIRED` and
`LEG_FIELDS` tables:

| Type | Fields | Required |
| --- | --- | --- |
| stay (`hotel`) | Hotel name · Check-in · Check-out · Room type · Address · Confirmation code | name, checkIn, checkOut |
| eat (`restaurant`) | Restaurant · Date · Time · Party size · Confirmation code | name, date |
| drive (`rental`) | Company · Car type · Pickup location · Pickup time · Dropoff location · Dropoff time · Confirmation code | company, both dates, both locations |
| flight | Confirmation code, plus repeatable **leg** groups: Airline · Flight number · From · To · Departure date · Departure time · Arrival time | every field of every leg |
| do / custom | Title · Day · Time · Where · Booking | title, day |

**Flight legs are the sharp edge.** A connection is two legs; the deleted form supported
repeatable groups and `legsComplete` validation, and the replacement must too.

**Rental reaches this form through the Drive chip.** `src/domain/gaps.ts:130` reads
`b.type === 'rental'` for `pickupDate`/`dropoffDate`, and `GAP_ROLES` is `['sleep','move']`, so
a rental is one of only two ways a transport gap ever closes. A test asserts that a booking
created through Drive → rental closes a transport gap.

---

## 6. Commit, undo, and the tray

Three commit paths, all through the existing data layer:

1. **`Add to Saturday 27`** — `commitCandidates(tripId, [candidate], itinerary)`, one
   root-level multi-path `update()`. The sheet stays open, the field re-arms, and `AddedStrip`
   shows "Added Delta 2214 · Undo". Undo applies the retained inverse.
2. **`Add and keep going`** — plain-text action beside the filled Add. `addToTray`, field
   re-arms, phase becomes `tray`, the button counts up. No mode is announced anywhere.
3. **`Add N items`** — `commitCandidates(tripId, tray, itinerary)`. **One write, therefore one
   undo**, not N toasts. `clearTray` on success.

`AddedStrip` is in-sheet and deliberately **not** `ItineraryUndoToast`. That component's
dismissal *is* its database commit — a deferred-write lifecycle. Here the write has already
happened and undo reverses it, which is a different contract and a different component.

Errors surface through `describeCallableError(err, fallback)`, so a quota refusal reads as
"You've reached today's lookup limit" rather than a gRPC status.

---

## 7. `HeroAddButton`

A round 44px `+` at the top-right of the hero, in **its own layer above the collapse system** —
not a child of `kickerRow`, which is driven by `kickerFade` and would take the button with it
on scroll. It holds position across the whole 0→165 collapse range and comes to rest beside the
trip name in the collapsed bar.

- Icon-only, so it is registered in `custom-components.md`: `Button` has no icon-only mode.
- A **scoped exception** to the roadmap's standing "the header's Add is a labelled `Button`,
  not the canvas's bare round `+`". That decision stands for Agenda; the hero overrules it.
- Sits over photography, where the system would normally use `--on-photo-chip` at 18% white
  with an 8px backdrop blur. `expo-blur` is not installed and is a native module, so a
  tokenized solid fill over the hero's existing scrim is used instead.
- Accessibility: 44px target, `accessibilityRole="button"`,
  `accessibilityLabel="Add to this trip"`.

---

## 8. Entry points

One imperative payload; each caller fills only what it knows.

```typescript
export interface AddSheetPayload {
  stopId: string;
  day?: ItineraryDay;                 // absent → DayPickerSheet resolves it
  typeHint?: CandidateType;           // a gap row carries the gap's type
  query?: string;                     // reserved for share/paste
  editing?:
    | { kind: 'booking'; booking: Booking }
    | { kind: 'item'; item: ItineraryItem; day: ItineraryDay };
}
```

`editing` opens straight at `details` with a Remove action — that is how the five existing
entry points keep working after their sheets are deleted.

`BookingType` → `CandidateType`: `hotel → stay`, `restaurant → eat`, `flight → flight`,
`rental → drive`.

| Screen | Entry point | Carries |
| --- | --- | --- |
| Jernie | Hero `+` | Current stop, today's day |
| Jernie | Setup CTA ("You still need a rental car") | Stop + `typeHint` from `SETUP_BOOKING_TYPE` |
| Jernie | Prompt rows / stop page | Stop, day unset |
| Jernie | Detail sheet → Edit | `editing` |
| Agenda | Gap row → Fix | Stop + `typeHint` (stay → stay, transport → drive) |
| Agenda | Prompt row → Add | Stop + role's type |
| Agenda | Detail sheet → Edit | `editing` |

Both screens drop their `BookingFormSheet` / `CustomItemSheet` refs and mount one `<AddSheet>`.

---

## 9. Deferred

Each accommodated by the same contracts, so none requires reopening this design:

- **The stop sheet** (canvas §03: search → drop into route → say what it costs). Today's
  `StopFormSheet` with the ranked Mapbox picker is device-confirmed and stays.
  `planStopInsertion` and `countAffectedBookings` are already built and waiting.
- **"Saved for this stop"** rail. Derivable from Explore's places, deliberately omitted.
- **Explore** as an entry point. Keeps `DayPickerSheet`.
- **Onboarding step 5.** The wizard is being redone separately; `AddSheetPayload` is shaped so
  that step is a mount rather than a rewrite.
- **Share sheet, paste, link unfurl, email ingest** — no provider.
- **Flight lookup** — no schedule provider, and `src/domain/airports.ts` has 10 airports and no
  coordinates. The Flight chip opens `DetailsForm` directly, which is the canvas's own
  "a miss is not a dead end" state.

---

## 10. Testing

**`DetailsForm` is TDD-first, with the deleted suite's cases ported before the component
exists.** Deleting 40 passing tests and re-deriving their validation is exactly where a silent
regression would hide, so the gate must be red-then-green rather than "looks right on device".
Minimum coverage carried over: required-field enforcement per type, multi-leg flight
completeness, edit-mode seeding, submit rejection leaving values intact, and cancel.

`src/domain/addFlow.ts` is TDD throughout — pure, no mocks needed.

New behaviour that must be asserted rather than eyeballed:

- Add is enabled by `canCommit` and **never** gated by an amber field.
- A search resolves nothing on its own; a lone match still arrives as a card.
- Two tray items commit in **one** `update()` and undo in one.
- A Drive → rental booking closes a transport gap in `src/domain/gaps.ts`.
- The type row keeps all five chips visible with unpicked ones dimmed, in every phase.

Release gate, per `AGENTS.md`: `npm test` exit 0, `npx tsc --noEmit` clean,
`npx expo export --platform ios`, both themes checked, no hard-coded colours or emoji in
touched files, and every custom component registered.

---

## 11. Risks

1. **The re-derived form.** The single largest regression surface in this plan. Mitigated by
   porting the old cases first.
2. **Flight legs.** Repeatable validated groups are the most intricate thing the deleted form
   did.
3. **Rental discoverability.** It now lives one level inside Drive. The transport gap row and
   the setup CTA both still route to it directly, so the shallow paths survive.
4. **The hero `+` and the collapse.** A control pinned above an animation driven by one shared
   scroll value has to be verified on device, not in a test renderer.
5. **Foursquare phrasing.** "lobster pound" returns 0 results where "lobster" returns 10. Not
   ours to fix, but the search box will feel broken on some plausible queries. The
   "Nothing found" card is the designed answer.
