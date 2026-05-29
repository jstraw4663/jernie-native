# Jernie Native — Dev Context

> Greenfield React Native Expo app. Design spec: `../jernie/docs/superpowers/specs/2026-05-29-jernie-native-migration-design.md`

## Running locally
```bash
npx expo start          # Metro on Ubuntu, iPhone connects via Tailscale
npx jest                # run tests
eas build --profile development --platform ios   # first-time dev build
eas update --branch preview --message "..."      # push JS update to testers
```

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
