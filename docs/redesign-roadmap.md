# Jernie redesign — roadmap and stage gates

The operating document for the redesign. Sessions read this alongside the
`jernie-design` skill. Source: `guidelines/claude-code-prompts.md` in Claude Design project
`96c8aef2-f975-4e2c-8c09-cea27dfb1575`, reconciled against this repo.

**Goal:** the shipped app becomes the mockups — visually and behaviourally — library-first,
with hand-rolled code limited to the register in
`.claude/skills/jernie-design/reference/custom-components.md`.

---

## Status

| | |
| --- | --- |
| Branch | `feat/design-system` |
| Session 0 — import | **Done, verified.** 50 skill files (6 tokens · 36 component · 6 reference · SKILL · README) + 4 canvases + `support.js`.  |
| Session 1 — audit | **Done.** `docs/redesign-plan.md`. Taxonomy decided (§8); date-semantics "conflict" disproved — two units, both correct. |
| Session 2a — fonts | **Done, gate green.** Six static faces; variable fonts deleted; weight now comes from the family name. Awaiting device check at `jernie://dev/fonts`. |
| Session 2b — tokens + sweep | **Done, gate green.** `tokens.ts` regenerated; 54 files re-pointed; `Brand` deleted; three deps installed. Awaiting Jeremy's screen-by-screen look. |
| Session 2c — icons | **Done, verified on device.** Zero emoji in `app/` and `src/`; `src/design/icons.ts` registry; `Stop.emoji` deprecated, not removed. Needed an `eas.json` build-flag fix — see Known repo facts. |
| Session 3 — primitives | **Done, gate green.** Twelve components in `src/ui/`, all theme-aware via `useTheme()`. Photo seam split across `src/lib/images.ts` and `src/ui/Photo.tsx`. Gallery at `jernie://dev/ui`. Two deps added (`expo-haptics`, `@shopify/flash-list`) — **needs a dev build**. |
| Session 4 — Jernie home | **Done, gate green.** One vertical scroll; hero, collapse, rail, CTA row, day groups. Pager, accordion and `CTACardZone`'s phase router removed. Revised on device: the card *becomes* the bar, the header keeps the trip name, range stretched to 165, hero photo bug fixed. |
| Session 5 — Agenda + gaps | **Done, awaiting device check.** Three lenses, four type groups, derived gap rows, coverage grid. `taxonomy.ts` / `gaps.ts` / `agenda.ts` new and unit tested. 87 suites / 951 tests. |
| Sessions 6–12 | Not started |

---

## Three corrections to the source prompts

Found while reconciling the twelve prompts against the repo. Each changes the sequence.

### 1. Session 2 orphans ~12 surfaces — fold the sweep into 2b

Session 2's tokens rewrite deletes `Brand.navy`, `Brand.gold` and cream `Core.bg` and deliberately leaves
compile errors as the migration signal. **33 files reference those tokens.** Sessions 4–12
rebuild ~21. These are owned by no session:

| Orphan | Why no session covers it |
| --- | --- |
| `app/(home)/index.tsx` | "My Trips" — the redesign has a trip switcher in Profile instead |
| `app/join/[token].tsx` | Invite-accept screen, absent from the mockups |
| `src/features/jernie/profile/AdminPanel.tsx` | Internal tool |
| `src/features/jernie/sheets/FeedbackSheet.tsx` | Internal tool |
| `sheets/BookingFormSheet` · `CustomItemSheet` · `DayPickerSheet` · `StopFormSheet` | **Form** sheets. Session 6 covers **entity detail** sheets only |
| `sheets/MemberSheet.tsx` | Session 9 makes companions a *screen*, not a sheet |
| `TripLoadingScreen` · `TripErrorScreen` | Touched only glancingly by Session 12 |
| `(tabs)/_layout.tsx` | Session 8 adds a fifth tab but no session restyles the bar |

**Fix: sweep in the same session as the rewrite (2b).** Re-point every orphan at the new tokens. *Restyle,
do not redesign* — same layout, new palette and type. This restores a compiling, runnable
app so every later gate has something to look at. It also makes Sessions 4–10 pure
redesign work rather than redesign-plus-repair.

*(Session 2 is now three: **2a** fonts — done; **2b** the tokens rewrite plus this sweep, in
one go; **2c** icons. 2a came first because every later gate is a visual judgement, and none
of them can be trusted while the app renders Fraunces Black and every bold as Regular.)*

### 2. Session 2's heading says "images"; its body does not

The heading reads *"Fonts, icons, images, tokens"* and the standing rules say *"Photography
comes from the image provider (see session 2)"* — but Session 2's body has exactly three
jobs: FONTS, ICONS, TOKENS. The image work is Session 11. Treat the heading and that
standing-rules line as stale; `expo-image` is installed in Session 2 as a *rendering*
library only.

### 3. The photo seam must land in Session 3, not Session 11

Session 11 says *"build the abstraction now so screens stop hard-coding URLs"* — but
Sessions 4, 7, 8 and 9 all render photography first, so they would hard-code and then be
retrofitted. Split it:

- **Session 3** defines `src/lib/images.ts` — the resolver interface and `ImagePlaceholder`,
  backed by a stub. Screens consume the seam from day one.
- **Session 11** writes `docs/imagery.md`, picks the provider, implements behind the same
  interface. No screen changes.

---

## Stage gates

A gate is a stop. The session ends, the gate runs, Jeremy reviews, and only then does the
next session start. **No session begins while the previous gate is red.**

### Every gate, without exception

```bash
npx jest       # baseline 88 suites / 948 tests / 2 snapshots, all green
npx expo export --platform ios --output-dir /tmp/verify    # cold bundle; also rules out
                                                           # the Metro stale-watcher fault
git status --porcelain                                     # confined to the session's paths
```

Plus:
- No `Brand.navy` / `Brand.gold` / `Core.bg` in any file the session touched
- No emoji codepoints in any file the session touched
- Any custom component has a new row in `reference/custom-components.md`, proposed *before*
  it was written
- The session reports: files changed, deps added, anything guessed

### Per-session gates

| # | Session | Gate — what Jeremy checks | Build state |
| --- | --- | --- | --- |
| 1 | Audit | `docs/redesign-plan.md` exists and is the only change. Three claims spot-checked against code. | green |
| 2a | Fonts | `jernie://dev/fonts` — six faces all distinct, Fraunces Regular not Black, and the four DMSans lines asking 400/500/600/700 all render **identically**. | green |
| 2b | Tokens + migration sweep | App builds and launches. Every screen readable on the new palette, layouts unchanged from today. Inline `fontWeight` numbers converted to family names. Three deps installed, unused. | green |
| 2c | Icons | Zero emoji anywhere in `app/` and `src/` — the partial sweep was abandoned, see below. Every glyph resolves through `iconFor()`. Requires a dev build with `react-native-svg`. | green |
| 3 | Primitives | `src/ui/__gallery.tsx` on a dev route shows all twelve components, every variant and state. Dashed borders checked on **both** platforms. Photo seam stubbed. | green |
| 4 | Jernie home | **Hero photo comes from the stop's own places** — see below. Collapse matches the 0–140 table exactly — hero 272→96 re-cropping, **no band above the photo at any scroll position**. Rail snaps at 302. Screen re-implements no row or card. | green |
| 5 | Agenda + gaps | `src/domain/gaps.ts` unit tested (this session *is* the ask that lifts the no-new-tests rule). Four groups; gap rows inline with their own Add; coverage grid only when a gap exists. | green |
| 6 | Detail sheet | All four types render from one shell. Adding a fifth type is provably a list entry. Consolidates the 7-file duplicated sheet scaffold. | green |
| 7 | Explore | Filter state lifted into a shared store. Stop defaults to current/next, never "anywhere" with a trip. | green |
| 8 | Map | **New route — five tabs now.** Detent survives the mode switch. Marker hierarchy is size, never colour. Consumes Session 7's store. | green |
| 9 | Profile | **Zero state reviewed first.** Four zeros must read as intentional before the populated version ships. Companions is a screen. | green |
| 10 | Onboarding | Draft survives app kill (force-quit and relaunch mid-wizard). Sign-in asked once. Close opens the exit sheet, never acts. Notifications fire *after* first booking, not in the wizard. | green |
| 11 | Images | `docs/imagery.md` recommendation approved **before** implementation. No screen file changes. | green |
| 12 | Skeletons + states | Every list has a shimmer. Red appears in exactly one place — failed booking sync. | green |

**No red gate.** The source prompt's Session 2 ended non-compiling by design; splitting the
tokens rewrite and the sweep into one session (2b) removes that, so every gate from here on
is a working app Jeremy can open.

---

### Session 4's hero photo — decided 2026-08-23

The design's home hero is a photograph, but `resolvePhoto({kind:'stop'})` returns `undefined`
until Session 11 picks a provider — so the hero would have been a grey tile for the whole
session, and the 272→96 re-crop is not judgeable on a tile.

**Decided: a stop's hero is the first place in that stop that resolves a photo.** Not a dev
stub, not vendored assets — real data on the real seam, and probably the right permanent
default. `TripContext` already exposes the enrichment map
([TripContext.tsx:114](../src/contexts/TripContext.tsx#L114)), so no plumbing is needed;
`PhotoSubject`'s `stop` variant grows the stop's places and `resolvePhoto` walks them.

**Caveat carried in:** there are zero curated `photoUrl` values in the fixtures or the dev
seed, so every photo comes from Foursquare enrichment at runtime. Coverage is whatever
Foursquare matched. A stop with no enriched places still renders `ImagePlaceholder`, and that
has to stay a designed state, not an accident. Session 11 still owns the question of where a
photo comes from when a *user* creates a trip.

---

### Session 4's one deliberate deviation from the canvas

`Jernie Screen.dc.html` moves content **3.2x faster than the finger** during the collapse:
its hero is `position:sticky` and in flow, so shrinking it from 272 to 96 reclaims 176px from
the layout, and the rail's `margin-top` reclaims another 136 — 312px of content movement on
top of 140px of scroll.

`reference/collapse.md` says the opposite, twice: *"content stays still"* and *"Only the
header layer animates; the list below it stays where it is."* The spec wins. The canvas
number is an artifact of a sticky-in-flow header, and 3.2x would read as the page bolting
away from the thumb.

The build puts the header in an **overlay above the scroll view**, so its 176px of shrink is
absorbed by the layer rather than charged to the list. The rail's own ~128px is still
reclaimed — a collapsing spacer does it, because otherwise the rail leaves a hole. Net
content velocity is ~1.9x over the collapse rather than 3.2x, and every other number
(272, 96, 140, 56, 62, the four opacity ramps, snap at 302) is the canvas's exactly.

**`--header-collapsed: 96` is also adapted.** The mockup renders no status bar, so a flat 96
would put the pinned bar's top third under the clock. Collapsed height is the inset plus the
bar — which *is* 96 on a device reporting a 34pt top inset, and grows correctly on a notch.

### The collapse, revised on device — 2026-08-23

Two changes after Jeremy scrolled the built screen. Both are now recorded in
`reference/collapse.md`; the numbers below are what the app does.

**The collapsed header keeps the trip name and a strip of photograph.** Collapsing to
navigation alone meant that two rows down the screen could be any trip. Collapsed height is
now `inset + 50 + 62` — status bar, a 50px photo strip carrying the trip name at 59% scale,
then the stop bar. 146 on a 34pt inset, against 96 before.

The name is bottom-anchored inside the hero, so the shrinking container carries it 108 of the
126px for free; only the residual 18px and the scale are animated, and it is `transform:
scale` rather than `fontSize` because animating `fontSize` re-measures the text every frame.
34px of Fraunces downsampled to 20 stays crisp — it is a downsample, not an upsample. The
name is `numberOfLines={1}`: two lines under a bottom anchor would push the first line up
under the status bar at full collapse.

Two knock-ons. The list's leading spacer collapses to `spacerMin(inset)` (70 on a 34pt inset)
rather than to zero, or the first card comes to rest behind the taller bar; net content
velocity drops from ~1.9x to ~1.5x, which is calmer and no worse. And the resting scrim's mid
stop is 12% — deliberately light so the photograph reads — which is not enough behind white
serif once the photo is a 50px strip, and the strip is exactly where that gradient is
thinnest. A second top-weighted gradient fades in over the last 45% of the collapse.

**The stop card *becomes* the bar.** The spec cross-fades: card out, bar in. On device that
read as two objects, one dying and one arriving. `StopMorph` is one object that changes
shape — widens to the screen, squares its corners, walks its thumbnail from the card's right
edge to the bar's left, sheds "Stop 2 of 3" and the status line, grows its dots.

It is a *second drawing* of `StopCard`, not the card itself, because the real card lives
inside the rail's horizontal `ScrollView` and nothing in there can travel to the top of the
screen and go full-bleed. The two are laid out from the same exported `STOP_CARD_METRICS`,
so at rest they are pixel-identical, and the handoff is a hard threshold both sides read off
the same shared value in the same frame: `scrollY === 0` the rail's card is drawn,
`scrollY > 0` the morph is. No window where both are drawn (a doubled shadow), none where
neither is (a flash).

**The range is 165, not 140.** Stretched 18% the same day, after the first pass: the header
finished before the gesture did, and a flick upward snapped the hero back to full height in
one frame. The stretch is applied in `collapse.ts`, not in `tokens.ts` — tokens are
regenerated from `tokens/*.css` and would clobber it. Every ramp on the screen is a fraction
of `RANGE`, so this one number still sets the whole screen's pacing.

Net content velocity falls again with it, to ~1.24x, and `spacerMin` rises to 95 against a
measured rail of ~134. That gap is the headroom: past the point where `spacerMin` exceeds the
rail's height the spacer would have to grow as you scroll, which is not a collapse.

One thing the bar does not reproduce: the name and dates keep the card's 16/11.5 rather than
the reference bar's 14/10.5. There is no way to animate a type size that is not either
re-measuring text every frame or scaling the line spacing with it, and the larger size reads
fine at 62 tall.

### The hero held the previous stop's photograph — 2026-08-23

Reported on Maine Coast: swipe to Bar Harbor, the rail card shows its photo, the hero keeps
Portland's. Two defects, both in how `expo-image` behaves and neither visible to the test
suite.

**1. A reused image view keeps its last successful image.** `expo-image` has a prop for
exactly this — `recyclingKey`, documented as *"prevents showing the previous source before
the new one fully loads"* — and the seam was not passing one. Every `<Photo>` now sets
`recyclingKey={source}`. Resetting only fires when the key changes, so a first mount is
unaffected; what changes is that a subject swap goes blank-then-loads instead of holding the
wrong photograph. Blank is honest.

**2. An image in an animating box re-downloads every frame.** `ImageView.swift` reloads on
every `bounds` change, and `reload()` calls `cancelPendingOperation()` first. The hero photo
was `absoluteFill` inside the container the collapse resizes, so it re-issued its request
about sixty times a second while the header moved — and `handleSelectStop` animates the list
back to the top on *every* stop change, which is precisely when a new photograph is being
fetched. With a `transition` set it also restarts a 300ms `UIView.transition` each frame.

The hero now renders the image at a fixed `HERO_MAX` box and translates it by half the height
the container has given up, so the container clips rather than stretches it. Same visible
slice for any photo the width binds on — everything narrower than about 16:9 — and a wider
one now holds its zoom through the collapse instead of easing out of it, which is closer to
`collapse.md`'s "re-crops in place" than the thing it replaced. `StopMorph`'s thumbnail had
the same defect (54 to 36 by animated width) and now scales a fixed box instead.

The rule is recorded at the top of `src/ui/Photo.tsx`: never put a `<Photo>` in a box whose
width or height is animated.

### Carried into Session 5

- **Bookings not on the itinerary are invisible on home.** `StopSection`'s "Flights / Stays /
  Rental cars / Restaurants" listing is gone; the design's home is day-by-day only. Agenda's
  four type groups are where they belong. `TravelCard` and `ItineraryDayRow` are orphaned but
  **deliberately not deleted** — both are tested, and Session 5 needs booking rendering.
- **The day group has no title.** The canvas sets an editorial one per day ("Arrival day",
  "Cadillac and the pond") that no field can produce. The slot is omitted rather than filled
  with a derivation nobody asked for. Needs a product answer, not a code one.
- **Stop status is a placeholder.** The rail card says "Stay booked" / "Nowhere to sleep"
  from a single `type === 'hotel'` check. Real statuses ("2 gaps to fix") need `gaps.ts`.
- **No blur on the hero.** `expo-blur` is named in the mapping for on-photo chips but is not
  installed, and it is native. The hero's top-right control is omitted entirely for now —
  the canvas puts a notification bell there and notifications are Session 10, so shipping a
  dead button was the worse option.

---

---

## Session 5 — Agenda and gap derivation, 2026-08-23

### The three new domain modules

**`src/domain/taxonomy.ts`** is the role layer — the top of a three-level taxonomy whose
lower two already existed. Subtype (open string) owns the icon; category (the closed ten of
`docs/redesign-plan.md` §8) owns the colour; **role** (`sleep`/`move`/`eat`/`do`) owns the
Agenda group and the gap rule. Nothing stored changed: the five competing category sets
became *inputs* to `normalizeCategory`, which absorbs `restaurant`→`food` and `bar`→`bars`
rather than picking a winner, and returns `null` for `other`/`custom` because "no category"
is a real answer. `bookingCategory()` is the single adapter between `BookingType` and the
taxonomy — `getBookingDisplay` now routes through it too, so Session 6's rename touches one
function.

**`src/domain/gaps.ts`** derives coverage and gaps in one pass. Two rules, and the asymmetry
between them is deliberate: sleep is counted **per night** (you need a bed every night, so
the gap says how many are missing), transport is **per stop** (you need a way to get around,
not one per night, so the gap explains the cause instead of counting).

**`src/domain/agenda.ts`** flattens bookings and itinerary items into one chronological row
list. A booking referenced from the itinerary appears once. This is where the bookings that
Session 4 removed from home went.

### Two decisions inside the derivation worth knowing

**Coverage asks dates, never `stopId`.** A hotel booked in on the 22nd and out on the 25th is
tagged to the first stop but genuinely covers the second stop's first night if the changeover
is the 24th. Asking the dates gets that right and cannot invent a gap from a mis-tagged
booking.

**A plan counts as cover, not only a booking.** An itinerary item whose role is `sleep`
covers that night; one whose role is `move` covers that day. Without it, *staying with
friends* is a permanent stay gap and *driving your own car* is a permanent transport gap on
every stop — two false alarms common enough to make the feature read as broken. The row still
says whether the thing is booked; the gap only asks whether the question has an answer.

That second rule needed `ItineraryItemCategory` widened to reach the canonical ten — `stay`
was previously inexpressible. **No writer offers the new values yet and nothing new is
written**; the type simply stopped forbidding what the domain understands. Giving
`CustomItemSheet`'s picker the wider set is Session 6's.

### Three lenses, not one

The canvas puts By type / By day / By stop above the list and the gate only asked for the
type groups. All three ship: they are one regrouping each over a row list that is built
once, `SegmentedControl` was written in Session 3 specifically for this screen and had no
call site, and two dead segments is the same problem as a dead notification bell.

Gaps attach where they make sense. **By type** they sit under the group that owns them —
stay gaps under *Where you're staying*, transport under *Getting around*. **By stop** they
sit under their stop, which is arguably their most natural home. **By day** they are carried
by the coverage grid alone: a gap is a range of nights, not a day, and pinning one to a date
would be a lie.

### What could not be derived

The canvas's group sublines are part derivation and part editorial. *"2 of 3 stops covered ·
7 of 8 nights"* is now computable and ships verbatim. *"2 dinners open"* and *"3 need
tickets"* have no field behind them — an open dinner is not a concept and nothing records
whether an activity needs a ticket. The derivable halves ship (`4 booked · 2 planned`,
`8 planned`) and the rest is omitted rather than invented, the same call the day-group title
got in Session 4.

### Deviations from the canvas, each on purpose

- **Rows are `ItineraryRow`.** `ItineraryRow.prompt.md` says verbatim "use inside a day group
  on Home, **and in Agenda's type groups**", so the primitive is the row. Its media tile is
  44px where the canvas's inline agenda markup draws 26, and the component reference wins.
- **The mono time column is 24-hour.** The lead is 44px wide by the component's own
  definition and "8:22 AM" is seven characters where five fit. Only Agenda converts; nothing
  else in the app changed.
- **A stay's lead is `22–24`, unspaced**, for the same width reason. Prose ranges use
  `formatDateRange`, which gained its spaces this session (`Jul 10 – 12`) because the design
  writes the range spaced in both places it appears.
- **The header's Add is a labelled `Button`, not the canvas's bare round `+`.** `Button` has
  no icon-only mode, and a naked glyph is more ambiguous than the word.
- **No sticky section headers.** The mapping suggests `stickyHeaderIndices` as a technique;
  the canvas does not sticky, and sticky plus collapsible plus a leading grid is a lot of
  behaviour to add unverified.

### Motion, made shared — same day

Two changes on device. Both are now in **`src/design/motion.ts`**, which is the point of
them: one module decides how content arrives and how it changes, so Sessions 6–12 do not each
invent an animation.

**`rise(step)`** — the staggered fade-up for *new* content — moved there out of
`jernie.tsx` unchanged, and home now imports it.

**`useSwapTransition(index)`** is new: the transition for the *same* content re-grouped by a
segmented control. It is **directional** — moving right sends the list in from the right — so
the content travels the way the thumb did, which is the only useful thing motion can say when
the rows on either side of the change are largely the same rows. It springs on
`springs.snappy`, the spring `SegmentedControl`'s own pill uses, so the control and the
content settle as one event rather than two.

Three details it turns on. There is **no fade-out**: a cross-fade would put a blank list on
screen for half the transition, which reads as a load rather than as a change. It runs in
**`useLayoutEffect`**, because the data swaps during the same render and a post-paint effect
would show one frame of the new list at rest before yanking it back to the animation's start
— a visible blink. And the list **scrolls to the top** on a lens change, un-animated, because
a scroll offset means nothing across a regrouping and two motions would fight.

`AgendaSection`'s caret is now one glyph rotating 180° on the same spring rather than two
glyphs swapped. The collapse itself is still instant — Reanimated layout animations inside a
recycling `FlashList` are the one thing here worth not attempting blind.

### The coverage grid, widened — same day

Columns were 56px against names like "Southwest Harbor" and ran into each other. Now 74px
with names wrapping to two lines, the region stripped for the column header only
(`Portland, ME` → `Portland`; the full name stays in the accessibility label), and the
available width finally measured properly — it was computed against the bare screen and
overstated the room by 26px, so a grid that fitted scrolled anyway. Three stops now fit a
393pt phone exactly; four scroll, and the scroll indicator only appears when there is
somewhere to go.

### Known limits

- **The by-stop lens silently drops an entry whose `stopId` matches no stop.** Only reachable
  from stale data, and the other two lenses still show it.
- **A stop's coverage column truncates a long city name** at 56px — "Southwest Harb…". The
  active stop is in accent, which is how you find yourself.
- **`DayGroup` on home still passes raw `item.time`** into an 11px mono column, so "8:22 AM"
  overflows 44px there. Pre-existing, one line to fix with `formatClock`, deliberately not
  swept this session.

## Blocking decisions

Settle the first three before Session 3. **All three are now settled** — taxonomy in `docs/redesign-plan.md` §8, date semantics disproved as a conflict, photo seam in §6d.

| Decision | Blocks | The conflict |
| --- | --- | --- |
| ~~**Date semantics**~~ | 5 | **SETTLED 2026-08-23 — see below.** |
| ~~**Item taxonomy**~~ | 5, 6 | **SETTLED 2026-08-23 — see below.** |

### Both Session 5 blockers, settled 2026-08-23

**`Stop.dates.end` is the departure date.** May 21 – 24 is **3 nights**: you are in that stop
on the 21st, 22nd and 23rd, and the 24th is the morning you leave. Consequences:

- `nights = end - start`. This is already what the rail card prints.
- "Am I at this stop today" is end-**exclusive** — `getActiveStopId` is correct as written.
- "What days does this stop cover" is end-**inclusive** — the 24th still gets an itinerary
  day, because you are there for part of it. `syncItineraryDaysForRange` is also correct as
  written. The two were never in conflict; they answer different questions and neither said
  which. Session 5 names them rather than changing them.
- A booking's checkout is the same convention, so `isTodayBooking` stands.
- "7 of 8 nights covered" is now computable: denominator is `end - start` summed over stops,
  numerator is the nights a stay booking overlaps.

**The taxonomy gets a derived role layer.** Two levels above the open subtype, and
**nothing stored changes** — no migration, no schema edit, no rules change:

| Role | Kinds | Generates gaps |
| --- | --- | --- |
| `sleep` | hotel, rental, camp | **yes** |
| `move` | flight, train, ferry, bus, car, transfer | **yes** |
| `eat` | restaurant, cafe, bar | no — counted only |
| `do` | hike, sight, activity, shop, event | no — counted only |

Role is a pure lookup from kind (`roleOf(kind)`), living in a new `src/domain/taxonomy.ts`.
It falls straight out of the design's own gap rule — *"only stays and transport generate
gaps; eating and doing are preferences and only ever count"* is literally these four, which
is the evidence the shape is right rather than invented.

What reads what, so the five competing sets stop competing:

- **Agenda** groups by **role**.
- **`src/domain/gaps.ts`** reads **role** — it never needs to know a kind.
- **Explore** filters by **kind**.
- **Icons** resolve **subtype** first, then kind, then role (the existing `iconFor` fallback
  chain, one level deeper).
- **Colour** keys off **kind**, and the design's `TypeColors` is the map — including
  `stay`/`shopping`, which stop being dead entries.

The five existing sets become *inputs* to the lookup rather than rivals: `PlaceCategory` and
`ItineraryItemCategory` are what is stored and keep their spellings, and the mapping absorbs
`food`/`restaurant` and `bars`/`bar` rather than picking a winner. An unknown kind falls back
to `do`, so old and hand-entered data degrades instead of throwing.
| ~~Unified item taxonomy~~ | ~~5, 6~~ | Four competing sets: `TypeColors` (9), `ItineraryItemCategory` (a different 9), `CustomItemSheet`'s picker (7), Explore's `FilterId` (6). `stay` and `shopping` have no data-model representation; `TypeColors.bars/.stay/.shopping` are dead tokens. Session 5's four groups need a clean 9→4 mapping. |
| ~~**Photo seam shape**~~ | ~~4, 7, 8, 9~~ | **Settled in Session 3.** `resolvePhoto(subject, ctx)` in `src/lib/images.ts`, generalising the existing `resolvePlacePhoto()`. Resolved URLs are **derived, never stored** — no schema change, no staleness, and the only legal option for trips. See `docs/redesign-plan.md` §6d. |
| Draft expiry | 10 | Exit sheet promises 30 days; nothing enforces it. |
| Paste-a-confirmation for v1 | 10 | Appears twice in the wizard and once on first-run home; parser undesigned. Build it or hide the entry points. |
| Gap dismissal scope | 5 | Per-trip agreed; per-person not ruled out. |

---

## Pixel reference — how to read it

`docs/design/` holds the full canvas set. Filenames keep their original spacing because
`support.js` resolves `<dc-import name="X">` to `X.dc.html`; renaming them breaks rendering.

| File | What it is |
| --- | --- |
| `Jernie Screen.dc.html` | **The screens.** All five tabs and the detail sheet, driven by props for theme, trip state and open sheet. This is the pixel truth for Sessions 4–9. |
| `Jernie Wizard.dc.html` | **The wizard.** Four steps, the exit / email / sent / notify sheets, and the first-run home. Pixel truth for Session 10. |
| `Jernie Spec.dc.html` | Presentation wrapper — imports Screen and adds the decisions, interaction tables and gap rules |
| `Jernie Onboarding.dc.html` | Presentation wrapper — imports Wizard and adds the step rules, auth model and retention notes |
| `support.js` | The dc-runtime. Required for any of the above to render. |

`Jernie Redesign.dc.html` (ten rounds of rejected options) was deliberately not imported;
the two `href` links to it are dead by design. It remains in Claude Design.

## Known repo facts worth carrying

- **No test references design tokens.** Baseline verified green: 88 suites, 948 tests, 2
  snapshots, 10s. All domain/writes/hooks. The palette
  rewrite breaks none of them.
- **Token vocabulary changed in 2b.** `Brand` is gone. `Core.bg` → `Core.surface`;
  `Semantic.confirmed/selected/success/saved` all collapsed into the single `Core.action`;
  `*Tint` → `*Soft`. Radii and type roles now carry the design's role names
  (`Radius.icon/tile/row/card/sheet/full`, `Typography.roles.hero/display/title/screen/
  section/row/body/sub/button/chip/caps/data`). `Scrim` and `Layout` are new. Colour is
  static via `Core`; new components use `useTheme()`.
- **iOS builds must compile RN from source.** `eas.json` sets `RCT_USE_PREBUILT_RNCORE=0`
  and `EXPO_USE_PRECOMPILED_MODULES=0` on all three profiles. EAS enables both by default on
  SDK 56; prebuilt RN core skips `use_react_native_codegen_discovery`, so `react-native-svg`
  linked but never got its Fabric `ComponentDescriptor`s and every icon rendered as
  `Unimplemented component: <RNSVGSvgView>`. Builds are slower; that is the whole cost.
- **`eas build` uploads the committed git state.** Commit before any build that adds a
  native dependency.
- **Fonts — fixed in 2a.** `assets/fonts/` now holds six static faces (Fraunces 400, DM Sans
  400/600/700, DM Mono 400/500) and the variable files are gone. **Weight comes from the
  family name, never from `fontWeight`** — `DMSans-Bold`, not `DMSans` + `700`. Every token
  role must resolve to a bundled face. 42 inline `fontFamily`+`fontWeight` pairs across 16
  files still ask by number and still render Regular; 2b and 6 sweep them. See
  `docs/redesign-plan.md` §3.
- **`src/ui/` is the primitives, as of Session 3.** Twelve components plus the photo seam,
  exported from `src/ui/index.ts`, every one theme-aware through `useTheme()`. Sessions 4–12
  compose these and re-implement none of them. They have **no call sites yet** — adopting
  them into existing screens is each later session's job, not a sweep:
  [SettingsRow.tsx](src/features/jernie/profile/SettingsRow.tsx) (≈ `ListRow` at ~95%) is
  Session 9's, the 7-file sheet scaffold is Session 6's. Gallery: `jernie://dev/ui`.
- **Colour that varies by theme needs `createThemedStyles`.** `StyleSheet.create` at module
  scope cannot see a hook, and calling it in a component body allocates a sheet per instance.
  The helper in [useTheme.ts](src/design/useTheme.ts) caches on the palette object and
  returns `[sheet, palette]`. `Palette` now carries `warning*` and `error*` too — dark amber
  is `#E0A244`, a different colour, not `#B56B00` dimmed.
- **Agenda is built, as of Session 5.** `src/domain/{taxonomy,gaps,agenda}.ts` are the
  derivation; `app/(trips)/[tripId]/(tabs)/agenda.tsx` renders it through the primitives plus
  two registered customs. Gaps come from `deriveCoverage()` and nothing else computes one.
- **Drafts are in-memory only** and `trips/{tripId}` is create-once and immutable at the top
  level by RTDB rule — a partial trip written during a draft could not be cleaned up by the
  client.
- **Metro has no watchman here.** A resolution error for a file that exists is the stale
  watcher; cold-bundle to confirm, then `npx expo start --clear`. See `CLAUDE.md`.
