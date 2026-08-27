# Agent handoff

Updated: 2026-08-27
Agent: Claude, add-flow sheet UI
Branch: `dev` at `976ab47`, pushed. `master` is still `0a25e97` (v0.7.0) — not yet promoted.

## Current objective

The add-flow **data layer is complete**. The **sheet UI is specified and planned, not started**:

- Spec `docs/superpowers/specs/2026-08-27-add-flow-ui-design.md` (`4d5b251`)
- Plan `docs/superpowers/plans/2026-08-27-add-flow-ui.md` (`f6364dc`) — 10 tasks, each carrying
  its tier and reasoning level, each leaving the app working
- Canvas `docs/design/Jernie Add Flow.dc.html`, now in the repo beside the other five

**Next action: Task 1 — `src/domain/addFlow.ts`, the pure phase machine, TDD.**

## Checkout layout — changed today

**Canonical checkout is `~/jernie-native` on `dev`,** reversing the earlier move to
`~/jernie-fresh`. `jernie-native` is the main clone and holds six local-only branches with no
upstream, so deleting it would have destroyed history.

- `~/jernie-fresh` — superseded, safe to delete; nothing unpushed remains in it.
- `~/jernie-native-clam` — a **worktree** of jernie-native, clean and pushed. Remove with
  `git worktree remove`, never `rm`.
- **Never push `archive/add-flow-granular`** — its pre-squash commits contain the real App
  Check debug token, which is why that history was squashed.

## Verified state (run in `~/jernie-native`)

- `npm test` → **105 suites / 1,286 tests, exit 0**. This is the baseline Task 9 does
  arithmetic against when it deletes 40 tests; the old 104 / 1,260 was true at `04f00a7`.
- `npx tsc --noEmit` → exit 0. `npm install` → `@react-native-firebase/app-check` present.
- `.env`, `GoogleService-Info.plist`, `google-services.json`, `expo-env.d.ts` all present.

## Working tree

Two files left untracked on purpose: `.vscode/settings.json` (one personal editor preference,
belongs in `.gitignore`) and `docs/add-flow-data-layer.md` (a review written against the
pre-squash commits — stale, not broken; they survive on `archive/add-flow-granular`).

## Remaining work and concerns

1. **Owed, and invisible in the repo when skipped:** the **`route_cache` TTL policy** is not
   enabled — `gcloud` is absent, so use Cloud console → Firestore → Time-to-live, field
   `expiresAt`, group `route_cache`. And **`GOOGLE_PLACES_API_KEY` is still live** (Secret
   Manager v1) with zero source references: destroy the secret, then disable the **Geocoding
   API** — deleting from Credentials risks Firebase's auto-created iOS/Android keys.
2. **CI now runs** (`109a69d`). It triggered on `[dev, main]` and this repo has no `main`, so
   PRs into the default branch were never checked; it now lists `dev`, `master`, `main`.
3. App Check deployed but NOT enforcing (`ENFORCE_APP_CHECK=false`); order in `functions/src/appCheck.ts`.
4. `MAPBOX_ACCESS_TOKEN` is a public `pk.` where `secrets.ts` documents an `sk.` — works, but
   cannot be scope-limited.
5. Foursquare returns 0 for "lobster pound" and 10 for "lobster" at the same anchor. Not ours;
   the "Nothing found" card is the designed answer.
