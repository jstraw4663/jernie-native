# GitHub agent workflow

## Objective

Make GitHub Issues and Projects the durable delivery record while isolating every concurrent
agent write in an issue-scoped worktree and branch.

## Task 1 — Publish the shared workflow

Tier: standard | Reasoning: medium - establishes durable coordination rules across agents and GitHub.

- Add `docs/agents/WORKFLOW.md` with the issue, branch, worktree, PR, review, and cleanup lifecycle.
- Define planner, implementer, reviewer, and integrator roles, with the human as the only merge gatekeeper.
- Treat GitHub Issues/PRs and committed code as the cross-model handoff; agents do not rely on shared conversational context.

## Task 2 — Add GitHub contribution guardrails

Tier: standard | Reasoning: medium - adds structured intake and CI without changing application behavior.

- Add issue forms for feature, bug, and research work, a PR template, CODEOWNERS, and pull-request CI for tests, TypeScript, and cold iOS export.
- Keep branch protection and Project setup out of repository automation because they are GitHub administrator actions and the human remains the gatekeeper.

## Task 3 — Record the operational state

Tier: light | Reasoning: low - synchronize the current handoff with the new workflow and actual branches.

- Replace the handoff with the active workflow objective, created assets, verification, and the `main`-branch prerequisite discovered from `origin`.

## Verification

- Validate GitHub workflow and issue-form YAML parsing with Ruby's built-in YAML parser.
- Review the scoped diff and run `git diff --check`.
- This is documentation and CI configuration only; the Expo test/export gate is intentionally not run locally.
