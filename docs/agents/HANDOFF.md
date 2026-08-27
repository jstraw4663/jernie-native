# Agent handoff

Updated: 2026-08-27
Agent: Codex, promoting v0.7.0
Branch: `master`
Release tag: `v0.7.0` at `1a52472`; feature closeout: `b4e7c12`

## Current objective

- GitHub release `v0.7.0 — Jernie, redesigned` is published and its history is promoted
  through `dev` to the default `master` branch without squashing or moving the tag.
- The remaining work is the broader itinerary Task 7 and Explore device pass.

## Verified state

- Home, Agenda, the unified detail sheet, Explore, and the continuous itinerary timeline are
  implemented on the shared design system.
- Itinerary supports conditional Details/Navigate swipe actions, delayed-commit removal with
  Undo, and atomic same-day/cross-day drag with edge autoscroll.
- Same-day/cross-day drag, smooth post-drop geometry close, reduced-bounce tuning, and maps-app
  navigation are device-confirmed. After a fresh native build, installed Google Maps and Waze
  are both discovered and launch correctly on iPhone.
- Final release gate: focused Profile suite 45/45; `npm test` 91 suites / 1,084 tests / two
  snapshots, exit 0; `npx tsc --noEmit` exit 0; cold SDK 56 iOS export passed at 2,624
  modules; `git diff --check` clean.
- Expo `version` is `0.7.0`; the build milestone is `redesign-through-explore`.
- The maps confirmation update is documentation-only; the app gate was not rerun after it.

## Working tree and recovery

- User-owned untracked `.github/`, `.vscode/`, `docs/add-flow-data-layer.md`,
  `docs/agents/WORKFLOW.md`, and the GitHub workflow plan remain excluded.
- The retired itinerary worktree is archived at stash `d536e75`; its branch remains at
  `06aa6ff`.

## Remaining work and concerns

1. Run Explore's device pass and itinerary Task 7: both themes, Dynamic Type, VoiceOver and
   non-gesture paths, reduced motion, locked-write rollback, and long-trip performance.
2. Destination-day-wide tint and a fully empty remote Unscheduled target remain deferred.
