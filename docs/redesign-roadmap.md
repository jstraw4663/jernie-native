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
| Sessions 4–12 | Not started |

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

## Blocking decisions

Settle the first three before Session 3. **All three are now settled** — taxonomy in `docs/redesign-plan.md` §8, date semantics disproved as a conflict, photo seam in §6d.

| Decision | Blocks | The conflict |
| --- | --- | --- |
| **Date semantics** — is `Stop.dates.end` inclusive? nights vs days? | 5 | End-*exclusive* in `getActiveStopId` ([src/domain/trip.ts:173](src/domain/trip.ts#L173)), end-*inclusive* in `syncItineraryDaysForRange` ([src/domain/itinerary.ts:70](src/domain/itinerary.ts#L70)), checkout-inclusive in `isTodayBooking`. "7 of 8 nights covered" is uncomputable until settled. |
| **Item taxonomy — REOPENED** | 5, 6 | **Jeremy flagged 2026-08-23: "I need a smarter hierarchy."** §8's two-axis model (10 categories + open subtypes) was decided in Session 1 and is what `src/design/icons.ts` implements, but it has never been used to set up real items. Revisit **before Session 5** — Agenda's four groups and the gap rules both derive from category, so a change lands there. Session 4 does not touch it. |
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
- **Agenda is a 17-line stub.** `src/domain/gaps.ts` does not exist; there is no gap or
  coverage concept anywhere in the codebase.
- **Drafts are in-memory only** and `trips/{tripId}` is create-once and immutable at the top
  level by RTDB rule — a partial trip written during a draft could not be cleaned up by the
  client.
- **Metro has no watchman here.** A resolution error for a file that exists is the stale
  watcher; cold-bundle to confirm, then `npx expo start --clear`. See `CLAUDE.md`.
