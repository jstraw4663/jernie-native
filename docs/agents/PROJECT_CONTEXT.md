# Jernie Native — shared project context

Durable commands and repository-specific traps live here so `AGENTS.md` stays compact. Read the
section relevant to the current task; do not load this entire file reflexively when the handoff
and task do not call for it.

Jernie Native is a greenfield React Native Expo app. The original migration design is
`../jernie/docs/superpowers/specs/2026-05-29-jernie-native-migration-design.md` relative to this
repository root's parent, and the in-repo redesign operating documents are
`docs/redesign-roadmap.md` and `docs/redesign-plan.md`.

## Running locally

```bash
npm start
npm test
npx tsc --noEmit
npx expo export --platform ios --output-dir /tmp/verify
eas build --profile development --platform ios
eas update --branch preview --message "..."
```

`npm test` is the canonical full gate and currently delegates to Jest. `npx jest` remains useful
for focused suite arguments, but an all-pass printout is not sufficient unless the process exits
0.

Metro runs on Ubuntu and the iPhone connects through Tailscale.

## Metro and Watchman on this machine

Watchman is not installed, so Metro falls back to Node's filesystem watcher. It can miss files
created while the development server is already running. The usual symptom is a resolution error
for a file that demonstrably exists, for example:

```text
Unable to resolve module @/src/features/jernie/sheets/MemberSheet ...
could not be found within the project
```

First rule out code or resolution errors with a cold bundle:

```bash
npx expo export --platform ios --output-dir /tmp/verify
```

If that succeeds, restart Metro with `npx expo start --clear`.

Installing Watchman is optional. It is a background daemon with its own failure modes, including
occasionally needing `watchman watch-del-all`, and installation requires sudo. If installation is
chosen, do not use `apt install watchman`: Debian/Ubuntu's package is the frozen 4.9.0 build from
2017, not a reflection of current Watchman development. A current build is staged at
`~/.local/share/watchman-dist`:

```bash
sudo mkdir -p /usr/local/bin /usr/local/lib /usr/local/var/run/watchman
sudo cp ~/.local/share/watchman-dist/bin/* /usr/local/bin/
sudo cp ~/.local/share/watchman-dist/lib/* /usr/local/lib/
sudo chmod 755 /usr/local/bin/watchman /usr/local/bin/watchmanctl
sudo chmod 2777 /usr/local/var/run/watchman
watchman version
```

The binaries hardcode `/usr/local/lib` in their `DT_NEEDED` entries, so they cannot be installed
under the home directory; `LD_LIBRARY_PATH` does not apply to those absolute paths.

## MMKV v4

Use `createMMKV`, not the removed constructor:

```typescript
import { createMMKV } from 'react-native-mmkv';

const storage = createMMKV({ id: 'jernie-write-queue' });
```

## Fonts

Fonts are static, never variable. React Native cannot drive a variable font's `wght` axis, and
iOS synthesizes no weight here. `assets/fonts/` contains six static TTFs, each registered under
its own family in `app/_layout.tsx`:

- Fraunces 400
- DM Sans 400, 600, and 700
- DM Mono 400 and 500

That is every weight the design specifies; there is no italic or bold serif. Weight is selected
by family name. `fontFamily: 'DMSans', fontWeight: '700'` renders Regular; use
`fontFamily: 'DMSans-Bold'`. Every typography role must resolve to a bundled face: add the face or
choose an existing one.

The variable Google Font downloads (`Fraunces[SOFT,WONK,opsz,wght].ttf`,
`DMSans[opsz,wght].ttf`, and their short-name duplicates) were deleted. Fraunces's default
variable instance was Black, which caused the earlier heavy serif headings. The static faces
came from the `@expo-google-fonts/{fraunces,dm-sans}` tarballs and are vendored rather than
runtime dependencies. Verify on device at `jernie://dev/fonts`.

## EAS and native code

EAS builds the committed Git state, not the working tree. It may warn about uncommitted changes
and allow continuation, but the upload still uses `HEAD`. Commit changes that add native code or
native configuration before building.

A salmon-tinted 16px box with one letter where an icon belongs is React Native's crushed
`Unimplemented component: <RNSVGSvgView>` label, not a normal rendering defect. Confirm whether
the dependency is committed with `git show HEAD:package.json | grep <the-dep>`.

`RCT_USE_PREBUILT_RNCORE=0` and `EXPO_USE_PRECOMPILED_MODULES=0` are deliberately set in
`eas.json`. Expo SDK 56 otherwise enables both by default. Prebuilt React Native core skips
`use_react_native_codegen_discovery`, so third-party New Architecture libraries can compile and
link without their generated Fabric `ComponentDescriptor`s. `react-native-screens` is unaffected
because Expo ships its generated code; `react-native-svg` is not. Source builds are slower, which
is the accepted cost. See `expo/expo#47266`.

For diagnosis, pull the `.ipa` referenced by `eas build:list --json` and compare symbols.
`RNSScreenComponentDescriptor` being present while `RNSVGSvgViewComponentDescriptor` is absent
means codegen discovery did not run.

Native dependencies require a fresh development build. This includes `react-native-svg`
(Phosphor icons) and `expo-image`. Native configuration also requires a fresh build; OTA updates
cannot add it. In particular, maps-app discovery depends on `LSApplicationQueriesSchemes` and the
Android queries plugin, so a stale binary can make `canOpenURL` falsely show only Apple Maps.

## Icons

Use Phosphor regular for inactive/navigation states and fill for active, booked, or emphatic
states. Import every React Native icon from its per-icon path; Metro does not tree-shake the
500KB-plus barrel:

```typescript
import Star from 'phosphor-react-native/src/icons/Star';
```

The package declares these subpaths in its exports. Do not draw a custom icon when Phosphor lacks
an exact match; choose the nearest icon and record the choice.

## Tokens, themes, and primitives

`src/design/tokens.ts` is regenerated from `.claude/skills/jernie-design/tokens/*.css`. The old
navy/gold/cream palette is deleted, not deprecated, and `Brand` no longer exists. Colors come from
`Core`, `Semantic`, `TypeColors`, and `Scrim`; type comes from `Typography.roles`.

There is one teal accent (`Core.action`) for secured states, amber (`Semantic.warning`) for
unfinished states, and red for only a failed/cancelled booking or confirmed destructive control.
A successful Removed/Undo bar is inverse ink and becomes red only on commit failure.

New components get colors from `useTheme()` in `src/design/useTheme.ts`, never directly from
`Core`. Use `createThemedStyles()` because a module-scope `StyleSheet.create` cannot see a hook and
creating a sheet in every component render allocates per row. It caches by palette object and
returns `[sheet, palette]`. `Palette` includes `warning*` and `error*` alongside neutrals. Dark
amber is `#E0A244`, a separate color rather than dimmed `#B56B00`.

The twelve primitives in `src/ui/` are `Button`, `Chip`, `Badge`, `ListRow`, `ItineraryRow`,
`GapRow`, `PromptRow`, `SegmentedControl`, `ProgressBar`, `Toggle`, `StopCard`, and `StatStrip`, plus
the photo seam. Compose them rather than recreating them. See every variant at `jernie://dev/ui`.
`Button` includes the registered `danger` variant used for confirmed destructive actions.

The design system's complete color, type, layout, corner, elevation, motion, state, icon, copy,
and custom-component rules remain authoritative in `.claude/skills/jernie-design/README.md` and
the references routed by its `SKILL.md`.

## Images

Screens never hard-code an image URL. Name the subject and resolve it through
`resolvePhoto({ kind: 'place', place }, { enrichment })` in `src/lib/images.ts`, then render the
result through `<Photo>`, which falls back to `<ImagePlaceholder>`.

Resolved URLs are derived on read and never written back. Enrichment lives in Firestore, the
Realtime Database record stays clean, and `trips/{tripId}` remains immutable at its top level.
`stop` and `trip` subjects return `undefined` until a provider is chosen.

## Reanimated

The repository uses Reanimated v4, not the v3 named by older specs. Its relevant APIs are
backward compatible: `useSharedValue`, `withSpring`, and the established v3-style calls work in
v4. Motion values still come from the design tokens; do not invent springs or shadows.
