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

To stop it recurring, install watchman (needs sudo; the Ubuntu `apt` package is 4.9.0 from
2017 and React Native warns against it). A current build is staged at
`~/.local/share/watchman-dist`:

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
- **Fraunces font filenames:** Google Fonts uses 4 axes — actual files are `Fraunces[SOFT,WONK,opsz,wght].ttf` and `Fraunces-Italic[SOFT,WONK,opsz,wght].ttf` (not `[opsz,wght]` as originally spec'd). Use these in `useFonts()` in `app/_layout.tsx`.
  ```typescript
  import { createMMKV } from 'react-native-mmkv';
  const storage = createMMKV({ id: 'jernie-write-queue' });
  ```
- **Reanimated v4** (not v3 as spec'd): API is backward-compatible. Use `useSharedValue`, `withSpring`, etc. as documented in v3 — all work in v4.

## Git rules
1. Never commit to main directly. Branch from dev.
2. npm test must pass before any PR to main.
3. Never commit .env.
