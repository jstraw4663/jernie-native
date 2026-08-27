# Build order

Adapted from `guidelines/claude-code-handoff.md` in the source project, with paths checked
against this repo. Annotations marked **[repo]** were added during the import and record
what is actually here today.

The goal: build the redesigned screens against the existing Firebase backend, without
redesigning anything and without inventing components.

**Each step is a separate session with a narrow brief. Do not ask for the whole app in one
go.** If you finish a step early, stop.

| # | Task | Touches | Done when |
| --- | --- | --- | --- |
| 1 | Regenerate `src/design/tokens.ts` from `tokens/*.css`, add the dark object and a `useTheme()` hook | `src/design/` | Existing screens still build, colours shift to the new palette |
| 2 | Install and wire the new deps: `phosphor-react-native`, `react-native-svg`, `expo-image`, `@shopify/flash-list`, `expo-haptics` | `package.json`, one smoke screen | Icons render, no emoji left in `app/` |
| 3 | Build the primitives in `src/ui/` from `components/` — Button, Chip, Badge, ListRow, ItineraryRow, GapRow, PromptRow, SegmentedControl, ProgressBar, Toggle, StopCard, StatStrip | new `src/ui/` | Each renders in a scratch screen with all its variants |
| 4 | Jernie home: hero, collapse, stop rail, day groups, CTA card | `app/(trips)/[tripId]/(tabs)/jernie.tsx`, `src/features/jernie/` | Collapse matches the 0–140 table; rail snaps |
| 5 | Agenda with the four type groups and derived gap rows | `(tabs)/agenda`, `src/domain/gaps.ts` | Gap rules from `components/travel/GapRow.prompt.md` hold |
| 6 | Detail sheet — one shell, block library per type | `src/features/jernie/sheets/` | Restaurant / Stay / Activity / Travel all render from one shell |
| 7 | Explore: single filter bar, carousel, grid | `(tabs)/explore` | Filter state shared with Map |
| 8 | Map: route mode + Explore mode on one `react-native-maps` surface | `(tabs)/map` | Sheet detent survives the mode switch |
| 9 | Profile (passport) + settings screens | `(tabs)/profile` | Empty-state version designed first |
| 10 | Onboarding wizard rebuild: 4 steps, MMKV draft, Apple/Google/magic link, exit sheet | `app/onboarding/`, `src/contexts/OnboardingDraftContext.tsx` | Draft survives app kill; sign-in asked once |
| 11 | Skeletons and empty states across all six screens | `src/ui/Skeleton.tsx` | Every list has a shimmer state |

## [repo] What exists today

Checked at import time, on branch `feat/design-system`:

- **Step 1** — `src/design/tokens.ts` exists (144 lines, Brand / Core / Semantic /
  TypeColors / WeatherColors). **53 files import it.** `Brand.navy` / `navySoft` / `gold`
  are referenced 56 times in live code, `Core.bg` 19 times. Deleting rather than deprecating
  them is deliberate — an unmigrated screen should break loudly. Expect step 1 to red-line a
  lot of files at once.
- **Step 2** — none of the five deps are installed. Emoji appear in **16 files**, and some
  originate in the *data* layer (`src/domain/bookings.ts`, `src/lib/createTrip.ts`,
  `src/hooks/useAddStop.ts`, `src/fixtures/devTrip.ts`, `src/lib/devSeed.ts`), so clearing
  `app/` alone will not finish the job.
- **Step 3** — `src/ui/` **does not exist**. Closest existing primitive is
  `src/features/jernie/profile/SettingsRow.tsx` (≈ `ListRow`). `Button`,
  `SegmentedControl`, `ProgressBar`, `Toggle` and `GapRow` have no implementation anywhere —
  `Button` exists as 13 separate inline style blocks with four different disabled opacities.
- **Step 5** — `app/(trips)/[tripId]/(tabs)/agenda.tsx` is a **17-line stub**.
  `src/domain/gaps.ts` does not exist, and there is no gap or coverage concept in the
  codebase. See the risk note below.
- **Step 8** — there is **no map tab**. The tab bar is currently four tabs (Jernie, Explore,
  Agenda, Profile); this system specifies five. Step 8 adds a route, not just a screen.
- **Step 10** — `OnboardingDraftContext` is plain `useState` and is torn down when the user
  leaves the wizard; it does not survive app kill today. Note also that `trips/{tripId}` is
  create-once and immutable at the top level by RTDB rule, so a partial trip written during
  a draft could not be cleaned up by the client.

## [repo] Blocking issues to resolve before their step

- **Fonts (before step 3, ideally step 1).** `tokens/typography.css` uses DM Sans
  **400 / 600 / 700**, Fraunces 400, DM Mono 500. `app/_layout.tsx` registers no DM Sans 600
  or 700, and `assets/fonts/` has no static SemiBold or Bold file — only
  `DMSans[opsz,wght].ttf`, whose weight axis React Native will not reliably address.
  `--text-screen`, `--text-section`, `--text-row`, `--text-caps` and the "Jernie" wordmark
  are all DM Sans 700. Fetch the static weights and register them first.
- **Date semantics (before step 5).** `Stop.dates.end` is treated as end-*exclusive* in
  `getActiveStopId` (`src/domain/trip.ts`), end-*inclusive* in `syncItineraryDaysForRange`
  (`src/domain/itinerary.ts`), and checkout-inclusive in `isTodayBooking`
  (`src/domain/bookings.ts`). "Nights covered" cannot be computed until this is settled.
- **Item taxonomy (before step 5 or 6).** Four competing taxonomies exist: `TypeColors` (9),
  `ItineraryItemCategory` (9, a different 9), `CustomItemSheet`'s picker (7), and Explore's
  `FilterId` (6). `stay` and `shopping` have no data-model representation at all, and
  `TypeColors.bars`, `.stay`, `.shopping` are currently dead tokens.

## Two things to decide before step 10

- Draft expiry. The exit sheet says 30 days; nothing enforces it yet.
- Whether the confirmation-email parser is real for v1, or whether "paste a booking" is
  hidden until it is. It appears twice in the wizard and once on the first-run home.
