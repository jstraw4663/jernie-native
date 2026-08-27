# Custom components register

**The rule: nothing custom that a maintained library already does.**

`react-native-mapping.md` assigns a library to every component and behaviour in this
system. This file records the exceptions — the places where we deliberately write our own
code — and why each one is justified.

## The blocking rule

> Before hand-rolling any component, check `reference/react-native-mapping.md`.
>
> - If it **assigns a library**, use that library. No exceptions, no "just this once".
> - If it **does not**, stop and propose the custom build to Jeremy *before writing it* —
>   name the libraries you considered and why each one fails.
> - On approval, add a row to the register below in the same change.
>
> **No custom component appears in a diff without having been called out first.**

The same applies to dependencies: do not add a library `react-native-mapping.md` does not
name without saying why first.

## Register

| Custom | Library rejected | Why |
| --- | --- | --- |
| `StopCard` rail | carousel libraries | A snapping `ScrollView` with three cards is ~30 lines. Carousel libs own their own scroll handler, which fights the collapse animation. |
| Collapse header | collapsing-header libraries | Every one assumes the header *translates*. Ours re-crops the photo in place, which is why no black band ever appears above it. See `collapse.md`. |
| `SegmentedControl` | `@react-native-segmented-control` | iOS-only, and renders the platform control, which will not take our tokens. Ours is a 25-line `View`. |
| `GapRow` derivation | — | Business logic, not UI: compare each stop's date span against bookings of that type. Belongs in `src/domain/`, not in a component. |
| Icon registry (`src/design/icons.ts`) | icon-pack wrappers | Not a component — a lookup table. `iconFor(category, subtype)` resolves the two-axis taxonomy to a Phosphor glyph. The icons themselves are all `phosphor-react-native`; this only decides which one. |
| `Toggle` | React Native's `Switch` | `Switch` renders the platform control. iOS gives it the system green and will not take `--accent`; `trackColor` reaches the track but not the knob shadow or the 44×26 geometry. Ours is a `Pressable` + one `withSpring` progress driving translate and `interpolateColor` — 45 lines. Named in `react-native-mapping.md`'s primitive table, but never registered here. |
| `StopMorph` | shared-element / hero-transition libraries | The card and the collapsed header bar are one object that changes shape on a scroll value. Every shared-element library drives its own timeline off a navigation event, and there is no navigation here. ~190 lines of `interpolate` on the collapse value we already have. |
| `ProgressBar` | `react-native-progress`, `react-native-animated-progress` | Both are wrappers around the same thing this is: a `View` with an animated width. 15 lines against a dependency, an unmaintained one in the second case, and neither does the wizard's discrete-segment mode without fighting it. |
| `CoverageGrid` (Agenda) | `react-native-table-component` | A 2×N status matrix: the two things that can be missing against one column per stop. The only maintained table library renders its own text styles and will not take these tokens, for a grid whose whole content is two colours and two glyphs. ~120 lines of `View`. |
| `AgendaSection` header | SectionList wrappers | `ListRow` is the closest primitive and the wrong one — its title is `roles.row` 13.5px against this one's `roles.section` 15px, its media tile is 44px against 30, and it is an *item* where this is the list's heading. Every library that owns section headers owns the sectioning too, and Agenda's sections are a flat `FlashList` array by design. |
| Detail-sheet template | detail-screen generators | `@gorhom/bottom-sheet` owns the modal, detents, drag, backdrop and scroll view. The app-owned part is the Session 6 template inside it: hero, title, a data-ordered block run and one footer. It replaces six per-type component trees with one shell. |
| Detail `InfoList` | `ListRow`, table libraries | A two-column definition list with one aligned 92px label column. `ListRow` is media/title/subline/trailing, while table libraries own styling and layout for a grid that is only paired text. |
| Detail compact stats | `StatStrip` | The existing primitive is the Profile passport's 21px figures without rules. Detail stats are deliberately subordinate: 15px figures between hairline dividers directly below a title. |
| Detail review rail | carousel libraries | A non-paginated horizontal `ScrollView` of quote cards. Carousel libraries add gesture and paging ownership to a simple overflow rail and would fight the containing bottom-sheet gesture. |
| Detail travel timeline | `react-native-timeline-flatlist`, `ListRow` | The only dedicated package is stale, and `ListRow` cannot express a connected sequence. The custom view is a fixed mono lead column, a dot/line spine and text body. |

| ItineraryTimeline spine | react-native-timeline-flatlist and timeline wrappers | FlashList keeps the maintained-list responsibility. Timeline packages own measurement and styling, cannot represent one date containing two stop segments, and cannot share the existing collapse scroll value. The spine, band ticks, stay context and handoff are presentation over a pure model using View; row content still composes approved primitives. |
| ItineraryDateRail | react-native-calendars | The installed calendar is a month/range picker. This is a small horizontal scroll-position control with date chips, split stop dots, warnings, and two-way timeline synchronization. A Gesture Handler ScrollView plus Pressable chips preserves those semantics without adding a second calendar vocabulary. |
| Timeline reorder | `react-native-reanimated-dnd` v2 | Version-compatible, but its `Sortable` owns a scroll container and its own list state, while this timeline already owns one animated scroll surface with nested day/band structure and live external updates. Built on the Gesture Handler + Reanimated already here: `Gesture.Pan().activateAfterLongPress(500)`, with pre-activation movement beyond Gesture Handler's 10-point allowance cancelling the pending drag so scrolling wins. A shared measured coordinator exposes every persisted day/band as a destination, including empty bands, and bounded edge autoscroll keeps distant dates reachable. Drag start must not grow those bands, mount empty Unscheduled sections across the trip, publish live preview through screen-level React state, toggle nested handler configuration, or restack a native ancestor: those mutations can cancel the active device gesture. The source day owns the labeled insertion boundary and lifted row's live time-column preview; cross-day persistence uses one authenticated transaction at the itinerary root so removal and insertion commit together across stops. |
| Timeline cross-day overlay | — | Extension of the registered reorder above. The real row remains the gesture owner in its source day; an always-mounted, pointer-transparent screen layer renders the lifted copy and insertion boundary from shared absolute coordinates so sibling days and edge autoscroll cannot cover or displace them. It performs no hit testing and publishes React state only when destination copy changes, never for per-frame pointer movement. |
| Timeline swipe actions | — | `ReanimatedSwipeable` (Gesture Handler) owns the gesture, the thresholds and the close; only the action tiles behind the row are app-owned. Not a custom gesture — listed so the reorder row above is not read as covering both. |
| `ItineraryUndoToast` | `react-native-toast-message`, `burnt`, Material Snackbar | Not a notification. Its dismissal **is** the database commit, and it carries a busy / failed / retry lifecycle that outlives any fire-and-forget queue. It also has to sit above the tab bar inside the trip shell, on the safe-area inset the screen already measures. |
| `DecisionSheet` | detail-screen and dialog generators | `@gorhom/bottom-sheet` owns the modal, detents, drag and backdrop; the app-owned part is the template inside — icon tile, title, message, two `Button`s. Same split as the Detail-sheet template row above. It replaced `MoveEntrySheet` and `RemoveEntrySheet`, which were the same 140 lines with a different tint. |
| `ChipDropdown` | `@react-native-menu/menu`, `react-native-element-dropdown` | The first renders the platform `UIMenu`, which will not take these tokens, the DM Sans faces or the dark palette — the same reason `SegmentedControl` and `Toggle` are ours. The second owns its own trigger and text styling, and the trigger here has to be `Chip` so the two bubbles and every other chip in the app stay one object. `@gorhom/bottom-sheet` is already the answer for the *filter* sheet; the spec deliberately distinguishes it from the bubbles, where a one-tap stop switch may not cost a sheet open and a dismiss. A measured anchor over a `Modal` is ~120 lines. |
<!-- Add new rows above this line. Include: what, the library you rejected, and why. -->

## Notes on the register

**`StopCard` rail.** The *card* is custom; the scroll is not. Use a horizontal
`Animated.ScrollView` from `react-native-gesture-handler` with `decelerationRate="fast"` and
`snapToInterval={stopCardWidth(screen) + STOP_CARD_GAP}`.

The card's width is **a share of the screen, not the canvas's literal 292**. 292 against the
390pt phone the canvas was drawn on is 75%, but shipped as a constant it was 78% of an SE and
68% of a Max — the same card reading as a different weight per handset. `stopCardWidth()`
holds 78%, clamped at the ends for tablets and for anything narrower than the design was ever
drawn for. Everything that has to agree with it — the rail's snap grid and side inset, and
`StopMorph`'s starting frame — calls that function rather than carrying its own number.

**Collapse header.** Reanimated v4 is already a dependency. One `useSharedValue`, one
`useAnimatedScrollHandler`, several `useAnimatedStyle`s. Do not introduce a second scroll
value.

**`SegmentedControl`.** `View` + three `Pressable`s, animated indicator via
`useAnimatedStyle`. The active pill is the only place `--shadow-row` is used.

**Icon registry.** Ten categories and ~70 subtypes, imported per-icon
(`phosphor-react-native/src/icons/<Name>`) because Metro does not tree-shake barrels and
phosphor's index is over 500KB. An unknown subtype falls back to its category's icon, and an
unknown category to `MapPin`, so old data degrades rather than throwing.

**`Toggle`.** `Pressable` + `withSpring` on a 0→1 progress: `translateX` for the knob,
`interpolateColor` for the track. `spring-snappy` (damping 44 / stiffness 400). The control
is 26px tall against a 44px minimum tap target, so it carries `hitSlop` of 9 top and bottom.
The knob stays white in both themes — against the resting grey it is `--shadow-row` that
separates it, not the fill.

**`ProgressBar`.** Two modes in one component: `segments` for the wizard header, `value` for
trip completeness. The continuous mode animates a pixel width off an `onLayout` measurement
rather than a percentage string — the string form works, but only once Reanimated has
resolved the parent's layout, which shows as a jump on first paint.

**`StopMorph`.** A second drawing of `StopCard`, laid out from the same exported
`STOP_CARD_METRICS` so the two are pixel-identical at rest. The rail's real card is on screen
at `scrollY === 0` and this one above it, both reading the same threshold in the same frame,
so the handoff has no seam and no doubled shadow. It exists because the real card lives inside
the rail's horizontal `ScrollView` and nothing in there can go full-bleed at the top of the
screen. Change a number in `StopCard`'s sheet without changing the metrics and the handoff
starts to flinch — that is the one way to break it.

Horizontal rail movement temporarily reverses that ownership: the morph hides and the real
active card remains in the ScrollView for the complete drag, deceleration and snap. Once the
selected card is centred, the rail and morph exchange visibility in the same frame. Never let
the fixed morph remain visible over a moving rail; the background cards will move while the
active one appears detached from the gesture.

**`GapRow` derivation.** The *component* is a `Pressable` with `borderStyle: 'dashed'`
(Android needs `borderRadius` ≤ 15 or the dash renders square). The *logic* — which gaps
exist — is a pure function over stops and bookings and belongs in `src/domain/`. Only stays
and transport generate gaps; eating and doing are preferences and only ever count.

**`CoverageGrid`.** Rendered **only when a gap exists** — a wall of teal checks is a screen
telling you nothing. Two rows, because there are exactly two gap-generating roles
(`GAP_ROLES` in `src/domain/taxonomy.ts`), and one column per stop. Partial is not covered:
two of three nights booked still leaves a night on a bench, so the cell is amber.

The whole grid sits in **one** horizontal `ScrollView` rather than three — a per-row scroll
view would let the header and the two rows fall out of alignment. The label column absorbs
the slack while the stops fit, exactly as the canvas's `flex:1` does, and holds a 96px floor
past that, at which point the grid scrolls sideways as a single piece. On a 393pt phone that
is five stops before it scrolls.

**`ItineraryUndoToast`.** Red is the `failed` state only. Resting and busy are an inverse ink
bar (`--ink` background, `--surface` label), because "Removed Eventide" is a completed action,
not a failure. The failed bar carries a dismiss as well as a Retry — a commit that keeps failing
would otherwise pin a permanent bar over the itinerary, since the auto-dismiss timer is skipped
whenever `failed` is set.

**`DecisionSheet`.** Two instances stay mounted on the Jernie tab rather than one shared one, so
a queued move can never overwrite a remove confirmation already on screen. `onConfirm` rejecting
with a `DecisionSheetError` replaces the request's generic sentence — that is how a stacked
removal reports the item that actually failed rather than the one just confirmed.

**`AgendaSection`.** The caret is real: the section collapses, and collapse state is keyed by
section rather than by index, so it survives a lens switch. A caret that does nothing is the
same dead affordance the hero's notification bell would have been, and this one costs a
`useState`. It buzzes on press — a committed state change, the rule `SegmentedControl` and
`Toggle` follow.
