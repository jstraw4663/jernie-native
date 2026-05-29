# Jernie Native — Dev Context

> Greenfield React Native Expo app. Design spec: `../jernie/docs/superpowers/specs/2026-05-29-jernie-native-migration-design.md`

## Running locally
```bash
npx expo start          # Metro on Ubuntu, iPhone connects via Tailscale
npx jest                # run tests
eas build --profile development --platform ios   # first-time dev build
eas update --branch preview --message "..."      # push JS update to testers
```

## Git rules
1. Never commit to main directly. Branch from dev.
2. npm test must pass before any PR to main.
3. Never commit .env.
