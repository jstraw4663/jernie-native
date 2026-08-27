# GitHub delivery workflow

GitHub Issues and Projects are the delivery record. Repository plans and `HANDOFF.md` hold the
technical detail that must travel with the code. This document is the shared procedure for Codex,
Claude, Orca-connected agents, and human contributors.

## Source of truth and roles

An issue contains the outcome, acceptance criteria, scope, dependencies, risk, and links to its
parent initiative. The linked branch, commits, pull request, review, and CI result are the work
record. Agents pass work through those artifacts, never through assumed shared chat memory.

| Role | Responsibility |
| --- | --- |
| Planner | Turns an initiative into independently testable, decision-complete issues. |
| Implementer | Owns one issue, branch, and worktree; makes only scoped changes and reports evidence. |
| Reviewer | Independently compares the PR with the issue and repository contract; review before editing. |
| Integrator | Applies accepted review feedback, confirms the gate, and prepares the merge. |
| Human gatekeeper | Creates/approves GitHub artifacts, marks PRs ready, and merges them. |

Use models by capability, not brand. A planner, implementer, and reviewer may each be Codex,
Claude, or another model, but one agent must not silently fill every role for the same change.

## Issue to pull-request lifecycle

1. Create a parent issue for an initiative and child issues for independently mergeable work.
   Record blocking relationships in GitHub; do not start an issue blocked by another issue.
2. Move a child issue to `Ready` only when its acceptance criteria, test expectation, owner role,
   and affected area are known. A planner adds the repository plan/spec when the work is multi-step.
3. An implementer claims exactly one Ready issue and creates an isolated worktree from the current
   `origin/dev`:

   ```bash
   git fetch origin dev
   git worktree add -b feat/123-short-description .worktrees/123-short-description origin/dev
   ```

   Use `fix/` or `chore/` when appropriate. The issue number is mandatory. Never reuse a dirty
   worktree or share a writable worktree with another agent.
4. The implementer follows `AGENTS.md`, keeps commits coherent, and opens a PR into `dev` using the
   PR template. The PR links its issue and states tests run, remaining risks, and the next reviewer
   action. A PR that completes an issue uses `Fixes #123` only when it is ready to close that issue.
5. A reviewer uses the PR diff or a separate clean worktree. It checks the issue contract,
   architectural boundaries, tests, and regression risk. The implementer makes any needed change;
   the reviewer does not make unannounced scope changes.
6. The human gatekeeper merges only after required CI and review pass. The integrator updates the
   linked issue/Project status. After merge, remove the local worktree:

   ```bash
   git worktree remove .worktrees/123-short-description
   git worktree prune
   ```

   Keep the remote branch until the PR is merged; delete it through GitHub after merge if desired.

## GitHub Project

Create one **Jernie Delivery** Project and enable parent issue and sub-issue progress fields.
Use the fields `Status` (Backlog, Ready, In progress, In review, Blocked, Done), `Priority`
(P0–P3), `Work type` (Feature, Bug, Chore, Research, Design), `Agent role`, `Risk`, and
`Target release`.

Keep a board grouped by Status, a current-session view filtered to active work, and a roadmap view
grouped by parent issue or target release. Configure GitHub's built-in workflow to add repository
issues automatically and move closed issues to Done. The Project is the only status board; do not
duplicate its status in a spreadsheet or agent-specific tracker.

## Required GitHub administration

The repository currently has `origin/dev` but no remote `main`. Before creating a release flow,
the human gatekeeper must create and protect `main`, then set `dev` as the PR integration branch.
Protect both branches with no direct pushes, required CI, and at least one review. Require
CODEOWNERS review for high-risk paths if GitHub plan settings support it.

Do not give agents permission to merge or to change branch protection in the initial rollout.
Agents may draft issue and PR text, but the human creates/approves the external GitHub artifacts.

## Collision and escalation rules

- One active writer per worktree and branch, always.
- Do not begin a task that overlaps files owned by an open issue. Mark it blocked or sequence it
  after the first PR merges.
- Rebase or merge the current `origin/dev` only after the issue owner confirms that doing so will
  not overwrite uncommitted work.
- A model that cannot complete a task because of reasoning limits is reassigned one capability tier
  higher, as required by `AGENTS.md`; record the escalation in the plan/issue.
- If an issue grows beyond one coherent PR, return it to planning and split it before coding.
