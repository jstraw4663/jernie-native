# Jernie Native — Dev Context

> Greenfield React Native Expo app. Design spec: `../jernie/docs/superpowers/specs/2026-05-29-jernie-native-migration-design.md`

## Running locally
```bash
npx expo start          # Metro on Ubuntu, iPhone connects via Tailscale
npx jest                # run tests
eas build --profile development --platform ios   # first-time dev build
eas update --branch preview --message "..."      # push JS update to testers
```

## Metro on this machine

`watchman` is **not installed**, so Metro falls back to Node's fs watcher, which misses files
created while the dev server is already running. The symptom is a resolution error for a file
that demonstrably exists:

```
Unable to resolve module @/src/features/jernie/sheets/MemberSheet ...
could not be found within the project
```

Confirm it's the watcher and not the code by cold-bundling — if this succeeds, the code is fine:

```bash
npx expo export --platform ios --output-dir /tmp/verify
```

Then restart Metro with `npx expo start --clear`.

Restarting is usually enough. Installing `watchman` stops it recurring, but it is **optional**
— it is a background daemon with its own failure modes (`watchman watch-del-all`), and it needs
sudo. Worth doing only if the restarts get annoying.

If you do: **do not `apt install watchman`.** watchman itself is current and actively developed
(releases weekly), but Debian/Ubuntu's *package* has been frozen at 4.9.0 since 2017 — that
specific ancient build is what React Native warns against, not watchman. A current build is
staged at `~/.local/share/watchman-dist`:

```bash
sudo mkdir -p /usr/local/bin /usr/local/lib /usr/local/var/run/watchman
sudo cp ~/.local/share/watchman-dist/bin/* /usr/local/bin/
sudo cp ~/.local/share/watchman-dist/lib/* /usr/local/lib/
sudo chmod 755 /usr/local/bin/watchman /usr/local/bin/watchmanctl
sudo chmod 2777 /usr/local/var/run/watchman
watchman version   # verify
```

The binaries hardcode `/usr/local/lib` in their `DT_NEEDED` entries, which is why they cannot
be installed under `$HOME` — `LD_LIBRARY_PATH` does not apply to absolute paths.

## Key API notes

- **MMKV v4:** Use `createMMKV({ id: 'name' })` — NOT `new MMKV()`. The constructor was removed in v4.
  ```typescript
  import { createMMKV } from 'react-native-mmkv';
  const storage = createMMKV({ id: 'jernie-write-queue' });
  ```
- **Fonts are static, never variable.** React Native cannot drive a variable font's `wght`
  axis, and iOS synthesises no weight at all. `assets/fonts/` holds six static TTFs, each
  registered under its own family name in `app/_layout.tsx`: Fraunces 400, DM Sans
  400/600/700, DM Mono 400/500. That is every weight the design specifies — it uses no
  italic and no bold serif, so neither is bundled.
  **Weight is selected by family name.** `fontFamily: 'DMSans', fontWeight: '700'` renders
  Regular; you want `fontFamily: 'DMSans-Bold'`. A token role must resolve to a bundled
  face — if you add a role, add the face or pick an existing one.
  The variable Google Fonts downloads (`Fraunces[SOFT,WONK,opsz,wght].ttf`,
  `DMSans[opsz,wght].ttf` and their short-named duplicates) were deleted; Fraunces's default
  instance was Black, which is why every serif heading rendered heavy. The static faces come
  from the `@expo-google-fonts/{fraunces,dm-sans}` tarballs and are vendored, not depended
  on. Check them on device at `jernie://dev/fonts`.
- **`eas build` builds the committed git state, not your working tree.** It warns about
  uncommitted changes and offers to continue; continuing uploads `HEAD` regardless. **Commit
  before every build that adds a native dependency**, or the client comes back without it.
  The symptom is a salmon-tinted box showing a single letter where an icon should be — that
  is RN's `Unimplemented component: <RNSVGSvgView>` label crushed into a 16px square, not a
  rendering bug. Confirm with `git show HEAD:package.json | grep <the-dep>`.
- **`RCT_USE_PREBUILT_RNCORE=0` and `EXPO_USE_PRECOMPILED_MODULES=0` are set in `eas.json`,
  deliberately.** EAS turns both on by default for SDK 56. Prebuilt RN core skips
  `use_react_native_codegen_discovery`, so third-party New-Arch libraries never get their
  generated Fabric `ComponentDescriptor`s — the library compiles, links, and then renders as
  `Unimplemented component: <RNSVGSvgView>` at runtime. `react-native-screens` is immune
  because Expo ships pre-generated codegen for it; `react-native-svg` is not. Builds are
  slower from source; that is the whole cost. See expo/expo#47266.
  Diagnose by pulling the `.ipa` from `eas build:list --json` and comparing:
  `RNSScreenComponentDescriptor` present vs `RNSVGSvgViewComponentDescriptor` absent means
  codegen discovery did not run.
- **Native deps need a dev build.** `react-native-svg` (Phosphor icons) and `expo-image` ship
  native code, so `eas build --profile development --platform ios` after adding them.
- **Phosphor icons import per-icon, never from the barrel.** Metro does not tree-shake
  barrels and the index is over 500KB: `import Star from 'phosphor-react-native/src/icons/Star'`.
  The package declares that subpath in its `exports`.
- **Design tokens: `src/design/tokens.ts`.** Regenerated from
  `.claude/skills/jernie-design/tokens/*.css`. The navy / gold / cream palette is deleted, not
  deprecated — `Brand` no longer exists. Colours come from `Core` / `Semantic` / `TypeColors`
  / `Scrim`, type from `Typography.roles`, and there is exactly one accent (`Core.action`,
  teal) meaning *secured*; amber `Semantic.warning` means *unfinished*; red is a failed
  booking and almost never appears. New components take colours from `useTheme()`
  (`src/design/useTheme.ts`) so dark mode is a config flip rather than a second pass.
- **Reanimated v4** (not v3 as spec'd): API is backward-compatible. Use `useSharedValue`, `withSpring`, etc. as documented in v3 — all work in v4.

## Git rules
1. Never commit to main directly. Branch from dev.
2. npm test must pass before any PR to main.
3. Never commit .env.
