# Redesign audit — Session 1

Read-only audit of `jernie-native` against the `jernie-design` skill. No code changed.
Companion to [redesign-roadmap.md](redesign-roadmap.md), which this audit **corrects in two
places** (see *Corrections* at the end).

Method: the "by screen" grouping below is a real transitive import-graph walk from each
`app/**` route (resolving `@/*` and relative specifiers), not a manual grouping — so a file
appears under every screen that actually pulls it in.

---

## Headline findings

1. **`Fraunces.ttf` renders Black, not Regular.** Its `OS/2.usWeightClass` is **900**. Every
   Fraunces string in the shipped app — trip names, place names, profile name — is rendering
   at Black weight. This is a live visual bug, not just a redesign gap.
2. **All four "static" font files are duplicates of the variable files.** Identical md5s.
   There are no static weights in `assets/fonts` at all.
3. **Emoji removal should not happen all at once.** 20 of the ~33 affected files are rewritten
   wholesale by Sessions 4–10. Replacing their emoji in Session 2 is work thrown away.
4. **There is no three-way date-semantics conflict.** I claimed one in the roadmap; it is
   wrong. See *Corrections*.
5. **The test suite is entirely insulated** — 88 suites / 948 tests / 2 snapshots, green, and
   not one references `src/design/tokens`.

---

## 1. Legacy tokens and emoji, by screen

`navy` = `Brand.navy` + `Brand.navySoft` · `gold` = `Brand.gold` · `bg` = `Core.bg` ·
`sem` = `Semantic.confirmed|selected`. All are deleted by Session 2.

| Route | Files in closure | navy | gold | bg | sem | emoji | icon-glyphs |
| --- | --: | --: | --: | --: | --: | --: | --: |
| `(tabs)/jernie.tsx` | 77 | 19 | 9 | 9 | 5 | 90 | 53 |
| `(tabs)/explore.tsx` | 51 | 17 | 8 | 6 | 5 | 69 | 47 |
| `(tabs)/profile.tsx` | 56 | 0 | 2 | 6 | 4 | 9 | 10 |
| `onboarding/step-1.tsx` | 22 | 3 | 4 | 0 | 0 | 20 | 2 |
| `onboarding/step-4.tsx` | 12 | 4 | 4 | 0 | 0 | 8 | 1 |
| `join/[token].tsx` | 5 | 3 | 2 | 0 | 0 | 0 | 0 |
| `(home)/index.tsx` | 9 | 1 | 2 | 2 | 0 | 0 | 0 |
| `(tabs)/_layout.tsx` | 6 | 2 | 0 | 0 | 0 | 0 | 2 |
| `onboarding/step-3.tsx` | 22 | 1 | 1 | 0 | 0 | 1 | 1 |
| `onboarding/step-2.tsx` | 8 | 0 | 1 | 1 | 0 | 1 | 1 |
| `(tabs)/agenda.tsx` | 2 | 0 | 0 | 1 | 0 | 0 | 4 |
| `_layout.tsx`, `index.tsx` | 18 / 17 | 0 | 0/1 | 0/1 | 0 | 2 | 3 |
| `(home)/_layout.tsx` | 1 | — | — | — | — | — | — clean |

**Three glyph classes — only two need replacing.**

| Class | Examples | Action |
| --- | --- | --- |
| Emoji proper | `🦞 ✈️ 🏨 🚗 🍽 📍 🔍 👤 🔒 🥾 🏊 🛎` | Replace with Phosphor |
| Text glyphs used as icons | `→ ✕ ✓ ★ ☆ ⌄ › ↑ ↓ ⚠` | Replace with Phosphor |
| Legitimate typography | `·` `…` `–` | **Keep.** The design uses `·` as its standard separator ("May 24 – 27 · 3 nights") |

A blanket "delete every non-ASCII glyph" sweep would strip the separators the design depends
on. Any Session 2 gate check must exclude `·`, `…`, `–`.

**Emoji originating in the data layer**, not the screens — clearing `app/` alone will not
finish the job: `src/domain/bookings.ts` (8), `src/lib/devSeed.ts` (2), `src/lib/createTrip.ts`
(1), `src/hooks/useAddStop.ts` (1), `src/features/jernie/StopForm.tsx` (1),
`src/domain/explore.ts` (2).

---

## 2. The twelve components vs. what exists

| Design component | Nearest existing | Closeness |
| --- | --- | --- |
| `ListRow` | `src/features/jernie/profile/SettingsRow.tsx` | **~95%.** Already has label/sublabel/accessory/onPress/destructive/disabled/testID, pressed state, chevron fallback. Only gap: `icon: string` is an emoji — its own docstring says *"This app has no icon set yet"* |
| `Chip` | `src/features/jernie/explore/FilterPillRow.tsx` | ~70%. The row is extracted; the chip body is inline and re-implemented 5 more times |
| `Badge` | `profile/CacheCard.tsx` (private) | ~80%, but unexported. 13 other badge sites; a byte-identical `badge:` rule is copied into 4 entity sheets |
| `StatStrip` | `sheets/HikeSheet.tsx` `StatCard` (private) | ~85%, unexported |
| `ItineraryRow` | inline `itemRow` inside `components/ItineraryDayRow.tsx` | The file is a day accordion; the row is inline, unexported, no props type |
| `StopCard` | inline `activePill` inside `StopsStrip.tsx` | Conceptually present, not extracted |
| `PromptRow` | `CTACardZone.tsx` `checkRow` + `StopSection.tsx` `AddPill` | Two partial shapes of the same idea |
| `Button` | **none** | 14 independent disabled-opacity sites across **six** different values: `0.4`, `0.45`, `0.5`, `0.6`, `0.7`, `0.8`. Design says `0.5` |
| `SegmentedControl` | **none** | Nearest is `DayPickerSheet.tsx`'s 2-way `scopeRow` |
| `ProgressBar` | **none** | No determinate progress anywhere in the app |
| `Toggle` | **none** | RN `Switch` is not imported anywhere |
| `GapRow` | **none** | No gap concept exists at all — see §4 |

`src/ui/` does not exist. Two consolidation targets worth taking while rebuilding:

- **A 7-file identical bottom-sheet scaffold** — `BookingFormSheet`, `MemberSheet`,
  `DayPickerSheet`, `StopFormSheet`, `CustomItemSheet`, `FeedbackSheet`, `EntityDetailSheet`
  all repeat the same `handle` + `background` + backdrop + spring config.
- **Two competing alpha-blend idioms** — template-literal `${color}1F` versus
  `hexWithAlpha()` from `src/utils/colors.ts`.

---

## 3. Font status

### What is actually on disk

| File | Kind | `usWeightClass` | Note |
| --- | --- | --: | --- |
| `Fraunces.ttf` | **variable** (wght 0–210) | **900** | md5-identical to `Fraunces[SOFT,WONK,opsz,wght].ttf` |
| `Fraunces-Italic.ttf` | variable | 900 | identical to `Fraunces-Italic[...].ttf` |
| `DMSans.ttf` | **variable** (wght 0–215) | 400 | identical to `DMSans[opsz,wght].ttf` |
| `DMSans-Italic.ttf` | variable | 400 | identical to `DMSans-Italic[opsz,wght].ttf` |
| `DMMono-Regular.ttf` | static | 400 | ✅ |
| `DMMono-Medium.ttf` | static | 500 | ✅ |
| `DMMono-Italic.ttf` | static | 400 | ✅ |

**Four of the eleven files are exact duplicates.** The `[axes]` copies and the short-named
copies are the same bytes — this is what the CLAUDE.md note about filenames was circling.

### What `app/_layout.tsx` registers

`Fraunces`, `Fraunces-Italic`, `DMSans`, `DMSans-Italic`, `DMMono`, `DMMono-Medium`,
`DMMono-Italic` — seven families, all pointing at the short-named copies.

### The gap

`tokens/typography.css` uses exactly five faces:

| Token role | Needs | Available today |
| --- | --- | --- |
| `--text-hero` `--text-display` `--text-title` | **Fraunces 400** | ❌ renders **900 (Black)** |
| `--text-screen` `--text-section` `--text-row` `--text-caps` | **DM Sans 700** | ❌ not selectable |
| `--text-button` `--text-chip` | **DM Sans 600** | ❌ not selectable |
| `--text-body` `--text-sub` | DM Sans 400 | ✅ |
| `--text-data` `--text-data-sm` | DM Mono 500 | ✅ `DMMono-Medium` |

React Native's `fontWeight` does not drive a variable font's `wght` axis reliably — iOS falls
back to the file's default instance and Android is worse. So the two DM Sans weights are
unreachable, and Fraunces renders at its default instance, which is Black.

**Decision — vendor static instances.** Done in Session 2a. `assets/fonts/` now holds six
static TTFs and nothing else:

| Face | Weight | Serves |
| --- | --: | --- |
| `Fraunces-Regular.ttf` | 400 | `--text-hero` `--text-display` `--text-title` |
| `DMSans-Regular.ttf` | 400 | `--text-body` `--text-sub` |
| `DMSans-SemiBold.ttf` | 600 | `--text-button` `--text-chip` |
| `DMSans-Bold.ttf` | 700 | `--text-screen` `--text-section` `--text-row` `--text-caps` |
| `DMMono-Regular.ttf` | 400 | today's `mono` role (5 call sites) |
| `DMMono-Medium.ttf` | 500 | `--text-data` `--text-data-sm` |

Sourced from the `@expo-google-fonts/{fraunces,dm-sans}` tarballs and vendored — the packages
are **not** added to `package.json`. This keeps the existing vendored-font architecture.

**No italic, no bold serif.** `typography.css` sets Fraunces at 400 only, and neither canvas
contains a single `font-style: italic`. `fonts.css`'s Google-CDN `@import` asks for Fraunces
600/700 and italic 400, but nothing in the system uses them — that import is over-broad, not
a requirement. So `Fraunces-Bold`, `Fraunces-Italic`, `DMSans-Italic` and `DMMono-Italic`
were dropped: ~271KB of binaries no design token references.

**The rule this establishes: weight comes from the family name.** React Native's `fontWeight`
does not drive a variable font's `wght` axis, and iOS synthesises nothing. Each weight is its
own file registered under its own family. `fontWeight` stays in the role objects as advisory
metadata for RNW and accessibility tooling, but it selects nothing on device.

**A corollary worth enforcing: every token role must resolve to a bundled face.** Three roles
did not, and were deleted — `h1Bold`, `h2Bold` (Fraunces 700, zero call sites) and `bodySoft`
(Fraunces italic, zero call sites). `h2Italic` has one call site
([TripLoadingScreen.tsx:51](src/features/jernie/TripLoadingScreen.tsx#L51)) and now points at
upright Fraunces; the screen loses an italic it should not have had. Session 2b restyles it.

### Deferred out of 2a, into 2b and 6

**42 inline `fontFamily` + `fontWeight` pairs across 16 files still ask for weights by number**
— `fontFamily: 'DMSans', fontWeight: '700'` — and so still render Regular. They were left
alone deliberately: 2b restyles the survivors and Session 6 deletes most of them (they are
concentrated in the seven entity sheets), so a mechanical pass now would be churn against
files about to be rewritten.

Two things to catch when sweeping them:

- **`fontWeight: '800'` appears five times** (`HotelSheet.heroDates`, `RentalSheet.heroTitle`,
  `FlightSheet.heroAirport` ×2, `HikeSheet.statValue`, `RestaurantSheet.heroTitle`). There is
  no 800 face and never will be — these map to `DMSans-Bold`.
- **`fontWeight: '500'` on DM Sans** (`PlaceSheet.price`) has no face either. DM Sans 500 is
  not in `typography.css`; map it to 400 or 600 by eye against the mockup.

---

## 4. Risk list — what the data model cannot express

### 4a. Per-stop gaps — nothing exists

No `src/domain/gaps.ts`; no gap, coverage, or unbooked concept anywhere. The raw material is
present (`Stop.dates` + `HotelBooking.checkIn/checkOut` + `RentalBooking` windows). Closest
existing behaviour is `StopSection.tsx`, which checks whether a stop has *any* booking of a
type — trip-wide and date-blind. It cannot say "no lodging for May 27–29".

Also note `CTACardZone` reads `trip.setupIntent` — a **user-declared intent boolean from
onboarding**, not a derived fact. A row can read "Added ✓" with zero bookings in RTDB.

### 4b. Trip drafts — in-memory only

`OnboardingDraftContext` is plain `useState`, mounted above the onboarding `Stack` and torn
down on exit. Its own docstring confirms nothing is persisted. Compounding constraint:
`trips/{tripId}` is **create-once and immutable at the top level** by RTDB rule, so a partial
trip written during a draft could never be cleaned up by the client. MMKV is already a
dependency with seven stores in use — the pattern is established.

### 4c. Companion permissions — real but frozen

Two roles (`organizer` / `traveler`), assigned **by rule**, create-once. No rules path lets
anyone promote, demote, or remove a member. A traveler has identical write power to the
organizer over all trip content. `Group` exists with `groupIds` filtering, but there is no
group-creation UI — only `devSeed` writes it. Group-scoped visibility is enforced
**client-side only**.

The design's Companions screen implies removal, resend, and a stated permission rule. **All
three require security-rule changes**, which every session brief forbids. Session 9 must ship
a read-only Companions screen, or the rules work must be scheduled separately.

### 4d. Item types — four competing taxonomies

| Set | Values |
| --- | --: |
| `TypeColors` (tokens) | flight, car, stay, food, bars, hike, activity, sight, shopping |
| `ItineraryItemCategory` | restaurant, activity, sight, hike, bar, flight, other, transport, custom |
| `CustomItemSheet` picker | 7 of the above |
| `explore.FilterId` | all, restaurant, hike, bar, sights, activity |

`stay` and `shopping` have **no** representation in the data model. `TypeColors.stay`,
`.bars` and `.shopping` are dead tokens — referenced by nothing.

---

## 5. Decisions I am making

**Date semantics — settled, no product input needed.** `Stop.dates.end` is the departure
date. **Nights at a stop = `end − start`** (end-exclusive); **days shown = `[start, end]`**
(inclusive). Every stop in the mockups obeys this (22–24 = 2 nights, 24–27 = 3, 27–29 = 2),
and it matches hotel `checkIn`/`checkOut` exactly. A stay gap is any night `d` where no
booking satisfies `checkIn <= d < checkOut`.

**Gap dismissal — per stop, per trip.** Stated explicitly in `GapRow.prompt.md`.

**Only stays and transport generate gaps.** Eating and doing produce counts only.

**Emoji replacement is deferred per-surface, not done in one sweep.** 20 of the affected files
are rewritten wholesale by Sessions 4–10; replacing their glyphs in Session 2 is discarded
work. Session 2 converts only the surfaces that survive; later sessions use Phosphor natively.

**Photo seam lands with the primitives, not at Session 11.** `src/lib/images.ts` exposes
`resolvePhoto(subject): Promise<string | null>` plus an `ImagePlaceholder` component, stubbed
initially. Screens consume it from Session 4. Session 11 swaps the provider behind it.

---

## 6. Questions I need answered

1. ~~**`stay` and `shopping` as itinerary categories.**~~ **Resolved — see §8.** Added as
   categories; no colour dropped; a tenth (`transit`) added. No data migration.
2. ~~**Companions scope.**~~ **Resolved.** Session 9 ships Companions **read-only** —
   one row per person with their contribution, invite state including the stale-invite amber
   row, and the permission rule in one sentence. No remove, no resend. Removal needs a
   callable in `functions/` (a client cannot delete another user's member record under the
   current rules) and becomes its own scheduled work.
3. ~~**Draft expiry.**~~ **Resolved.** Keep the draft indefinitely; change the exit-sheet line
   to "We'll keep it on this phone." If the dates have passed on return, prompt to update them
   rather than discarding the work.
4. ~~**Paste-a-confirmation for v1.**~~ **Resolved.** Hide the entry points — wizard step 1 and
   the first-run home. The home keeps its other three prompts, so it does not read as empty.

**All four audit questions are now closed. No open blockers before Session 2a.**

---

## 6b. Session 2b — what the sweep decided

`tokens.ts` keeps its **shape** (`Core` / `Semantic` / `TypeColors`) and loses all its
**values**, per `reference/react-native-mapping.md`. Key names were kept wherever the role
survived — `Core.text`, `Core.border`, `Core.surfaceMuted` needed no edits at 168 call sites
between them — and changed only where the design's name carries meaning the old one lost.

**Collapsed into one accent.** `Semantic.confirmed`, `.confirmedTint`, `.confirmedDark`,
`.selected`, `.selectedTint`, `.saved`, `.success`, `.successTint` → `Core.action` /
`Core.actionSoft`. That is the "one accent" rule doing real work: gold-means-booked,
navy-means-selected and green-means-success were three vocabularies for one idea.

**The wizard is white.** `Jernie Wizard.dc.html` uses `var(--surface)` throughout — there is
no dark step. So onboarding steps 1, 3, 4 and `join/[token]` flipped from navy to
`Core.surface`, which meant flipping their text too: white → `Core.text`, and the
`rgba(255,255,255,0.xx)` ladder → `textMuted` / `textFaint` / `border`. The Apple button
keeps white-on-black; that is Apple's requirement, not ours.

**Stars are not gold.** The canvas renders a rating as meta text — `Cafe · $$ · 0.4 mi ·
4.5 ★` in `--ink-2`, with the star as a literal character. `Brand.gold` on stars →
`Core.textMuted`. **Note for 2c: `★` survives as text.** A blanket glyph sweep would remove
something the design actually uses, alongside `·`, `…` and `–`.

**Type roles were renamed, and the scale shrank.** `h1/h2/h3/label/labelCaps/meta/mono` →
`display/title/section/chip/caps/sub/data`. The design's scale is tighter than the app's
was — body 16→13, meta 13→11 — so screens will read smaller. That is the design, but it is
the single most visible change in this session and the thing most worth checking first.

**Gradients.** The navy hero blend is replaced by the three-stop `Scrim`. `stopHeroGradient`
now blends toward `#14201B` (opaque `--scrim-bottom`) instead of navy; Session 4 removes its
last caller when the hero becomes a photograph.

**Deleted as dead:** `WeatherColors` (zero call sites, absent from the design),
`Core.surfaceRaised`, `Core.navyTint10/20`, `Core.overlay`, `Semantic.saved`,
`Animation.springs.bouncy`.

**Still deferred to 2c and 6:** the 42 inline `fontFamily`+`fontWeight` pairs from §3. The
sweep did not touch them.

---

## 6c. Session 2c — the partial sweep did not survive contact

§7 scoped 2c to "surviving surfaces only — the ~12 orphans plus the data layer", on the
assumption that emoji were per-screen decoration. They were not. **`emoji` is a field on
`Stop` and `Place`**, written by `createTrip` and `useAddStop`, stored in RTDB, and rendered
by nine components spread across Sessions 4, 6, 7 and 9. `getBookingDisplay` returned one
too. The data layer and its renderers could not be separated, so the sweep went wide:
**zero emoji remain in `app/` or `src/`.**

**`src/design/icons.ts`** is the deliverable — the icon half of the §8 taxonomy. Category
resolves to a glyph, subtype overrides it, unknown values fall back rather than throw.
Registered in `custom-components.md`; it is a lookup table, not a component.

**The schema was not touched.** `trips/{tripId}` is create-once and immutable at the top
level by RTDB rule, so `Stop.emoji` stays — marked `@deprecated`, still written (as `''`)
because the field is non-optional, and never read. A stop's glyph is now `MapPin`.

**Kept as typography, not swept:** `·` `…` `–` `—` and — the two that would have been easy
to get wrong — **`→` and `★`**. The canvas renders routes as `BOS → PWM` and ratings as
`Cafe · $$ · 0.4 mi · 4.5 ★`, both literal characters in a meta string. A blanket glyph
sweep would have deleted design vocabulary.

**Swapped as affordances:** `✓ ✕ › ⌄ ⚠ ● ☆ ✚ ↑ ↓ 🔍`. Two labels were rewritten rather than
iconified, because an arrow inside a sort label is not an icon: `Price ↑` / `Price ↓` →
`Price, low first` / `Price, high first`.

**Bundle cost: +0.2MB** (5.4 → 5.6MB) for ~70 icons, because every import is per-icon.
A barrel import would have pulled the 500KB index alone. This is the rule that has to hold.

**Tests:** ten assertions across six suites named the old API (`display.emoji`,
`emoji: '📍'`, `'✓ Added'`, the emoji-prefixed vibe labels). Updated in place, not rewritten.
`jest.config.js` needed `phosphor-react-native` added to `transformIgnorePatterns` — it ships
untranspiled `.tsx`, so fourteen suites failed to parse before that.

## 6d. Session 3 — what building the primitives settled

Twelve components into `src/ui/`, plus the photo seam and the gallery. Five decisions worth
recording, because later sessions inherit all of them.

**The photo seam was already half-built.** `resolvePlacePhoto()` in
[src/domain/placeEnrichment.ts](../src/domain/placeEnrichment.ts) has been resolving a
place's display photo in production since the Foursquare work — curated `photoUrl` first,
then the first photo from the Firestore enrichment cache. So `src/lib/images.ts` is not a new
mechanism, it is that one generalised: `resolvePhoto(subject, ctx)` over a
`{ place | stop | trip }` union. **Resolved URLs stay derived and are never written back.**
That is what the existing code already does, it needs no schema change (which the standing
rules forbid), it has no staleness problem when a provider rotates its URLs, and for trips it
is the only legal option — `trips/{tripId}` is create-once and immutable at the top level.
`stop` and `trip` return `undefined` today and render a placeholder; Session 11 fills them in
and touches no screen.

**`Palette` gained `warning*` and `error*`.** `colors.css` redefines all six for dark —
`#B56B00` on charcoal reads as brown, not as a warning — but 2b's `Palette` type covered only
neutrals and the accent. `GapRow` and `PromptRow` are the two amber components, so
"theme-aware from birth" was impossible without this. `Semantic` still exports the light
values for the 54 pre-redesign files, exactly as `Core` does; it is now derived from `light`
rather than duplicating the hexes. In dark, `warningInk` collapses onto `warning` — there is
no darker ink that stays legible on an 11%-amber fill.

**Three tokens read `#fff` in the reference and should not.** `Button` variant `accent`,
`Badge` tone `solid` and the selected `Chip` all hard-code white on `--accent`. That is
correct on light's `#0F7B6C` and unreadable on dark's `#5CCBB4` mint. All three now use
`textInverse`, which **is** `#FFFFFF` in light — so the light rendering is byte-identical to
the reference and dark is merely correct.

**Weight comes from the family name, so every literal is spelled out.** Seven components
carry type the roles do not cover — `Badge` at 9.5/0.05em, `StopCard`'s kicker at 9.5/0.12em,
`StatStrip`'s value at 21/-0.5px, the 11px action pills, `Button`'s `sm` at 11.5. These are
literal in the reference `.jsx`, not missing from `tokens/`, so they are inline with an
explicit `fontFamily`. None of them is a new role and none should become one until a second
component wants it.

**`createThemedStyles` keys the stylesheet on the palette object.** `StyleSheet.create` at
module scope cannot see a hook, and calling it inside a component allocates a fresh sheet per
mounted row — unacceptable for `ListRow`. A `WeakMap` over the two module-constant palettes
gives every instance the same sheet, so theming costs nothing. It returns `[sheet, palette]`
because colour that varies with a prop has to be applied inline.

**Deferred deliberately:** the twelve components have no call sites yet. `SettingsRow`
remains the Profile's row and is Session 9's consolidation; the 7-file sheet scaffold is
Session 6's. Adopting them early would be redesign work under a primitives brief.

---

---

## 7. Recommended ordering change

Session 2 as written ends with a non-compiling app and no session ever repairs ~12 orphaned
surfaces. Split it so the build is never left red across a session boundary:

| | Session | Ends |
| --- | --- | --- |
| **2a** | **Fonts.** Add three static instances, fix the Fraunces-Black bug, delete four duplicate files. Verify on a scratch screen. | green |
| **2b** | **Tokens + migration sweep.** Rewrite `tokens.ts`, then immediately re-point all 33 affected files — restyle, do not redesign. Install `phosphor-react-native`, `react-native-svg`, `expo-image` as deps only. | green |
| **2c** | **Icons on surviving surfaces only** — the ~12 orphans plus the data layer. Screens owned by Sessions 4–10 keep their emoji until rewritten. | green |

2a is worth doing first regardless: it fixes a bug that exists today, independently of the
redesign.

---

## Corrections to the roadmap

Two claims in [redesign-roadmap.md](redesign-roadmap.md) are wrong and should be amended at
this gate:

1. **"Date semantics — three-way conflict, blocks Session 5."** There is no conflict.
   `syncItineraryDaysForRange` is inclusive because it counts **days** (its docstring says
   so); `getActiveStopId` is exclusive because it counts **nights**; `isTodayBooking` is
   inclusive because "is this relevant today" is a day question. Two units, each handled
   correctly. This is a definition to write down, not a blocker.
2. **"`assets/fonts` has no static SemiBold or Bold, only `DMSans[opsz,wght].ttf`."**
   Understated. `DMSans.ttf` *is* that same variable file, and `Fraunces.ttf` is a variable
   file defaulting to weight 900 — a live rendering bug the roadmap does not mention.

One caveat on the mockups: `Jernie Wizard.dc.html` shows "May 22 – 29 · 2 stops · **8
nights**", but its own stops sum to 7 (2 + 3 + 2) and "Day 3 of 8" is a **day** count. The
stop-level arithmetic is consistent and is what `gaps.ts` should implement; the trip-level
"8 nights" is a mock error.

---

## 8. Item taxonomy — DECIDED

Resolves question 1. Two axes, not one:

- **Category** — closed set of 10. Owns the **colour**, the **Agenda group**, and the **gap rule**.
- **Subtype** — open string. Owns the **icon** and the **default label**. Never affects logic.

Colour is the scarce resource (a fixed palette); Phosphor icons are effectively free. So
`camping` and `hotel` share one colour, one Agenda section and one gap rule, while showing a
tent and a bed.

### Categories

| Category | Colour token | Agenda group | Gap |
| --- | --- | --- | --- |
| `flight` | `--type-flight` `#2C5880` | Getting around | transport |
| `transit` | `--type-transit` **new** | Getting around | transport |
| `car` | `--type-car` `#5A7082` | Getting around | transport |
| `stay` | `--type-stay` `#465E7A` | Where you're staying | stay |
| `food` | `--type-food` `#B44F1E` | Where you're eating | — |
| `bars` | `--type-bars` `#8E4E2F` | Where you're eating | — |
| `hike` | `--type-hike` `#2F6B47` | What you're doing | — |
| `activity` | `--type-activity` `#7A4F82` | What you're doing | — |
| `sight` | `--type-sight` `#8A5A2B` | What you're doing | — |
| `shopping` | `--type-shopping` `#6B4A3A` | What you're doing | — |

Agenda group and gap rule are **derived** from category — pure functions, never stored.
Gap-generating categories are `{flight, transit, car}` (transport) and `{stay}`.

### `--type-transit` — provisional `#57518C`

The three existing cool colours are crowded into the blue/slate band (`#2C5880` ~213°,
`#465E7A` ~213°, `#5A7082` ~215°). A teal would collide with `--accent` `#0F7B6C`, which
means *secured* — the one meaning that must never be ambiguous. `#57518C` sits at ~247°
(blue-violet): clear of the slates, clear of the accent, and clear of `--type-activity`
`#7A4F82` at ~292°, at a saturation consistent with the rest of the palette.

**Provisional.** Validate in the Session 3 gallery alongside all ten. Alternates if it reads
badly: `#4C4A7A` (darker, more indigo) or `#5F6B8A` (greyer, safer but closer to `car`).

Also flag at that gate: `bars` `#8E4E2F`, `sight` `#8A5A2B` and `shopping` `#6B4A3A` are three
browns, and may not separate in a dense list.

### Subtype registry

`subtype?: string` on the item; a registry in `src/domain/` maps known values to a Phosphor
icon and default label. Unknown values fall back to the category's own icon — so old data
carrying an unrecognised subtype degrades cleanly rather than throwing.

| Category | Subtypes |
| --- | --- |
| `flight` | flight, seaplane, helicopter |
| `transit` | train, subway, tram, bus, coach, ferry, shuttle, funicular, walk |
| `car` | rental, own car, taxi, rideshare, campervan |
| `stay` | hotel, vacation rental, hostel, b&b, inn, resort, cabin, camping, rv, boat, with friends |
| `food` | restaurant, cafe, bakery, market, food truck |
| `bars` | bar, brewery, winery, distillery, pub, club |
| `hike` | hike, trail, summit, climb, bike ride, paddle, ski, run |
| `activity` | tour, show, concert, theatre, sports, spa, class, beach, wildlife, water sports |
| `sight` | museum, gallery, monument, viewpoint, park, garden, landmark |
| `shopping` | shop, market, mall, bookstore, boutique |

Adding a travel style is one registry entry — no type change, no migration. A recreational
bike ride is `hike/bike ride`; a bike as transport is `transit/bike`.

### Migration — none

Normalize on read, write canonical. `normalizeCategory()` in `src/domain/` maps the legacy
values (`restaurant`→`food`, `bar`→`bars`, `transport`→`car`, `other`/`custom`→`null`).
`category` is already optional and null already renders `--ink-2`, so uncategorised items keep
working untouched. No RTDB migration, and the create-once immutability constraint is never
engaged.

`explore.FilterId` becomes a view over categories rather than a fifth competing list.

### Bookings — deferred to Session 6, made safe

`BookingType` stays `flight | hotel | rental | restaurant` for now. `gaps.ts` must **not**
read it directly — it consumes `bookingCategory(booking)` returning a category
(`hotel`→`stay`, `rental`→`car`, `flight`→`flight`, `restaurant`→`food`). Session 6's rename
then touches that one adapter and nothing else. A campsite booking uses the existing
`HotelBooking` shape — `checkIn`/`checkOut` is exactly right for a campsite — with
`subtype: 'camping'`.
