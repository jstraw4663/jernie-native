# Jernie Design System

Jernie is a trip-planning app for people who plan a trip as a sequence of **stops**
rather than a single destination — a Maine coast drive with three towns, not "Maine".
Everything in the product hangs off that idea: a trip has stops, stops have dates,
and every plan belongs to a stop. The app's job is to tell you where you are, what is
next, and what is still missing.

This system is the visual and behavioural result of ten rounds of redesign done in
this project, grounded in the shipped React Native codebase.

## Sources

- **Repo:** `github.com/jstraw4663/jernie-native`, branch `master` (Expo 56 / RN 0.85,
  expo-router, Firebase). Read for: `src/design/tokens.ts`, `src/design/tripPacks.ts`,
  `app/(trips)/[tripId]/(tabs)/*`, `src/features/jernie/*`, `app/onboarding/step-1..4.tsx`,
  `src/contexts/OnboardingDraftContext.tsx`. See `github.md` at the project root for the
  sync record and screen map.
- **Design work in this project:** `Jernie Redesign.dc.html` (ten turns of options, with
  the rejected ones and why), `Jernie Spec.dc.html` (the decided screens, interactive,
  light + dark, three trip states), `Jernie Onboarding.dc.html` (the wizard, sheets, and
  first-run home).
- No Figma file was provided.
- **No logo was provided.** Nothing in this system draws one. Where a mark would go, the
  word *Jernie* is set in DM Sans 700. Send the real asset and it drops into `assets/`.

## What changed from the shipped app

**This system describes the mockups, not the shipped app.** The app becomes this; this
does not accommodate the app.

The shipped build is navy `#0D2B3E`, gold `#C89A2B`, cream `#F7F4EF`, with emoji as
iconography. None of it survives. The redesign is a white photo-led surface with a teal
accent, a warm-charcoal dark mode, and Phosphor icons. Reasons, briefly: the cream-on-navy
palette fought the photography that carries the product, gold read as "confirmed" and as
"brand" at the same time, and emoji made an itinerary look like a chat log.

There are no legacy tokens in this system. `src/design/tokens.ts` in the repo gets
replaced wholesale rather than extended — if a value is not in `tokens/`, it is not part
of Jernie any more.

## Content fundamentals

**Voice: a well-briefed friend who has read your itinerary.** Plain, specific, never
cheerful about problems.

- **Name the thing, then the consequence.** "No transport in Southwest Harbor" then
  "May 27 – 29 · the car drops off before you arrive". Never "Something's missing!"
- **Second person, present tense.** "Where you're staying", "You're checked in".
  Section headers are phrases, not nouns: *Where you're eating*, not *Dining*.
- **Unfinished is not failure.** "Nothing booked yet is a perfectly normal answer."
  No apology, no exclamation mark, no "Oops".
- **Numbers do the arguing.** "7 of 8 nights covered", "2 of 3 stops", "0.4 mi away".
  A sentence that could carry a count carries it.
- **Sentence case everywhere** except the tracked micro-labels (`STOP 2 OF 3`,
  `MON · MAY 25`), which are uppercase DM Sans or DM Mono.
- **No emoji.** The shipped build used them for item types; Phosphor icons replace them
  one-for-one.
- **Buttons are verbs the user would say**: Add, Book, Fix, Resend, Switch, Start over.
  Never "Submit", "OK", "Confirm".
- **Sheets state what is at stake before they ask.** The exit sheet names the trip:
  "Maine Coast, 2 stops, May 22 – 29."

## Visual foundations

**Photography is the brand.** Every trip, stop and place has a photo, and the layout's
job is to keep type legible over it without dulling it. Type never sits directly on an
image at small sizes: either a three-stop scrim (`--scrim-top/mid/bottom`) or a white
card lifted off the photo. Images are warm and natural — landscape and food photography,
no filters, no duotone, no grain.

**Colour.** One accent (teal `#0F7B6C`) for anything secured — booked, checked in, now.
One warning (amber `#B56B00`) for anything unfinished. Red (`#A3485F`) is reserved for
a cancelled booking and appears almost never. Item types keep their own nine colours
from the shipped build, used for icon glyphs and 10% tints only, never as row
backgrounds. Two background colours per screen maximum: `--surface` and one photo.

**Type.** Three families, one job each. Fraunces (400) names things — trips, places,
people; never labels or buttons; never below 20px. DM Sans runs the interface, 700 for
titles and row names, 400 for body and sublines. DM Mono carries anything that lines up
in a column: times, dates, night counts, distances. That mono column is why every
itinerary row reads as a timetable.

**Layout.** 20px gutter on every screen, no exceptions. Rows are 11px vertical padding
with a 44px media square. Sections sit 18px apart with a hairline `--line-soft` between
list items and a full `--line` between sections. Flex and grid with `gap` — never margin
chains. Tab bar is 84px including the 24px home-indicator inset. Minimum hit target 44px.

**Corners.** Role-named: 8px icon tiles, 12px media thumbs, 15px rows and cards, 18px
lifted cards, 24px sheets (top two corners only). Nothing is fully rounded except pills
and avatars.

**Cards.** A card is a white surface with either a 1px `--line` border (in-flow) or a
`--shadow-card` and no border (lifted off a photo). Never both. No card has a coloured
left border. Selected state is a 1.5px accent border plus a 9% accent fill, never a
shadow change.

**Elevation.** Three shadows only: `--shadow-row` (1px, for a segmented control's
active pill), `--shadow-card` (lifts the stop rail off the hero), `--shadow-sheet`
(inverted, lifts a sheet off the screen). Everything else is flat.

**Transparency and blur.** Only over photography: `--on-photo-chip` at 18% white with an
8px backdrop blur for controls sitting on a hero. Never over a solid surface.

**Motion.** Durations 175 / 300 / 420ms, sheets 460ms. Springs, not easing curves, for
anything a finger drives (rail snap, sheet detent, toggle): damping 34–50, stiffness
280–460 — the values are in `tokens/motion.css` and match Reanimated's `withSpring`.
The one structural animation is the **collapse system**: a single 0–140 scroll value
drives every screen's header. Identity shrinks, navigation widens and pins, content
stays still. The hero photo re-crops in place rather than translating, so no band ever
appears above it.

**States.** Press is opacity 0.85 plus a light haptic — never a scale, never a colour
change. Disabled is opacity 0.5 with the label saying why ("Pick a stop to continue").
There is no hover; this is a phone.

**Empty states are actions.** No illustration-and-caption screens. An empty list is a
`PromptRow` — "Where are you staying?" with an Add button. The one full empty state
(no trip at all) is a single line, a sentence, and a button.

## Iconography

**Phosphor Icons**, regular and fill weights. Regular for navigation and inactive
states, fill for anything active, booked, or emphatic. Sizes: 23px tab bar, 19px in a
44px media tile, 16px in a 30px tile, 13–15px inline with text. Colour is `--ink-2`
by default, the item type colour for itinerary glyphs, `--accent` when active.

Web surfaces load Phosphor from the CDN (`@phosphor-icons/web@2.1.1`, regular + fill).
React Native uses `phosphor-react-native` — same glyph names, per-icon imports.
This replaces the emoji used in the shipped `step-1.tsx` and `step-4.tsx`.

No custom icons were drawn for this system. Where a glyph does not exist in Phosphor,
pick the nearest and note it rather than drawing one.

## Index

| Path | What it is |
| --- | --- |
| `styles.css` | Global entry point. Link this one file. |
| `tokens/` | `fonts` · `colors` · `typography` · `spacing` · `elevation` · `motion` |
| `guidelines/` | 13 specimen cards, plus the two documents below |
| `guidelines/react-native-mapping.md` | **Every component and behaviour mapped to an RN library.** Read before writing native code. |
| `guidelines/claude-code-handoff.md` | The build order for Claude Code, and what to hand it. |
| `guidelines/claude-code-prompts.md` | **Twelve paste-ready session prompts**, in order, plus the standing rules block. |
| `components/core/` | Button · Chip · Badge · ListRow · SegmentedControl · ProgressBar · Toggle |
| `components/travel/` | StopCard · ItineraryRow · GapRow · PromptRow · StatStrip |
| `ui_kits/jernie-app/` | Five-tab click-through of the app |
| `SKILL.md` | Makes this folder loadable as a Claude Code Agent Skill |
| `Jernie Spec.dc.html` | The decided screens, interactive, light + dark |
| `Jernie Onboarding.dc.html` | The wizard, its sheets, and the first-run home |
| `Jernie Redesign.dc.html` | Ten rounds of options, including rejected ones |

### Intentional additions

Nothing here existed as a named component in the shipped codebase — the app was built
as screens, not primitives. The twelve components are extracted from the patterns that
repeat across the redesigned screens. `GapRow` and `PromptRow` are new concepts
introduced by this redesign, not extractions.

### Caveats

- Component specimen cards are static HTML rather than live mounts of the `.jsx`, because
  this project is not yet typed as a Design System. Once you switch the file type, the
  compiler bundles `components/**` and the cards can mount the real components.
- Fonts load from Google Fonts on web. The native app has the real Fraunces / DM Sans /
  DM Mono files in `assets/fonts`; they were not copied here.
- No logo, no illustration set, and no photography library — every image in this system is
  an Unsplash placeholder. The wordmark is set in DM Sans 700 wherever a mark would go.
  Photography is resolved at trip and stop creation by a provider chosen in session 11 of
  `claude-code-prompts.md`; screens never hard-code an image URL.

---

> **Import note (added when this system was copied into the repo).** The paths in the Index
> above describe the source project in Claude Design. In this repo the layout is:
> `tokens/` unchanged; `guidelines/react-native-mapping.md` → `reference/react-native-mapping.md`;
> `guidelines/claude-code-handoff.md` → `reference/build-order.md`; the `collapse`, `voice` and
> `photo-scrim` specimens distilled to `reference/*.md`; the two decided canvases exported to
> `docs/design/`. `styles.css`, `support.js`, `ui_kits/`, `uploads/`, the eight value-specimen
> cards and the `Redesign` / `Screen` / `Wizard` canvases were not copied — they remain in
> Claude Design, project `96c8aef2-f975-4e2c-8c09-cea27dfb1575`.
