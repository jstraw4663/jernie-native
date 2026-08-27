# Agent handoff

Updated: 2026-08-27
Agent: Claude, add-flow sheet UI
Branch: `dev` at `109a69d`, pushed. `master` is still `0a25e97` (v0.7.0) — not yet promoted.

## Current objective

The add-flow **data layer is complete**. The **sheet UI is specified and planned but not
started**:

- Spec: `docs/superpowers/specs/2026-08-27-add-flow-ui-design.md` (`4d5b251`)
- Plan: `docs/superpowers/plans/2026-08-27-add-flow-ui.md` (`f6364dc`) — 10 tasks, each with
  its tier and reasoning level, each leaving the app working
- Canvas: `docs/design/Jernie Add Flow.dc.html`, now in the repo beside the other five

Next action is Task 1 of that plan: `src/domain/addFlow.ts`, the pure phase machine, TDD.

## Checkout layout — changed today

**Canonical checkout is `~/jernie-native`, branch `dev`.** This reverses the earlier move to
`~/jernie-fresh`. `jernie-native` is the main clone and holds six local-only branches with no
upstream, so deleting it would have destroyed history; `jernie-fresh` held only `dev` and
`master`.

- `~/jernie-fresh` — superseded, safe to delete. Nothing unpushed remains in it.
- `~/jernie-native-clam` — a **worktree of jernie-native**, clean and fully pushed. Remove with
  `git worktree remove`, not `rm`. Left in place only because it is an active session's shell
  directory.
- **`archive/add-flow-granular` must never be pushed** — its 13 pre-squash commits contain the
  real App Check debug token, which is why that history was squashed.

## Verified state (commands actually run, in `~/jernie-native`)

- `npm test` → **105 suites / 1,286 tests, exit 0**. This is the baseline Task 9 compares
  against; the earlier handoff's 104 / 1,260 was true at `04f00a7` and has been overtaken.
- `npx tsc --noEmit` → exit 0.
- `npm install` → `@react-native-firebase/app-check` present (the one dep `dev` adds over
  `master`).
- `.env`, `GoogleService-Info.plist`, `google-services.json`, `expo-env.d.ts` all present.

## Working tree

Two untracked files left deliberately, neither committed:

- `.vscode/settings.json` — one personal editor preference (`claudeUsageBar.displayMode`).
  Belongs in `.gitignore`, not in the repo.
- `docs/add-flow-data-layer.md` — a 112-line review of the data layer written against the
  pre-squash commits. Those commits still exist on `archive/add-flow-granular`, so it is stale
  rather than broken. Decide whether it is worth keeping before the next cleanup.

## Remaining work and concerns

1. **Still owed, and neither leaves a trace in the repo when skipped:**
   - **The `route_cache` TTL policy is NOT enabled.** `gcloud` is not installed; use the Google
     Cloud console → Firestore → Time-to-live, field `expiresAt`, collection group
     `route_cache`. Until then nothing is ever deleted.
   - **`GOOGLE_PLACES_API_KEY` is still live** (Secret Manager v1, ENABLED) with zero source
     references. Destroy the Secret Manager copy, and separately disable the **Geocoding API**
     for the project — deleting a key from Credentials risks hitting Firebase's auto-created
     iOS/Android keys and breaking the app.
2. **CI now runs.** `.github/workflows/ci.yml` was untracked and is committed as of `109a69d`.
   It triggered on `[dev, main]` and this repo has no `main`, so PRs into the default branch
   would never have been checked; it now lists `dev`, `master` and `main`.
3. App Check is deployed but NOT enforcing (`ENFORCE_APP_CHECK=false`). Rollout order is in
   `functions/src/appCheck.ts`.
4. `MAPBOX_ACCESS_TOKEN` is a public `pk.` token where `secrets.ts` documents an `sk.` one. It
   works and is unrestricted, but cannot be scope-limited.
5. Foursquare returns 0 results for "lobster pound" while "lobster" returns 10, same anchor and
   radius. Not ours to fix; the "Nothing found" card is the designed answer.
