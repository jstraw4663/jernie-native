# Jernie Native — Claude bootstrap

`AGENTS.md` is the canonical repository contract, shared by Claude and Codex. This file only
tells Claude how to load and maintain that structure. It deliberately carries no project rules
of its own — read those at the source, every session.

## Before any repository work

1. Read `AGENTS.md` in full.
2. Read `docs/agents/HANDOFF.md` in full.
3. Run `git status --short` and inspect recent commits (`git log --oneline -10`). Git, source,
   and real command output outrank the handoff when they disagree. Preserve untracked and
   unrelated user changes; never assume an untracked file is disposable.
4. Read only the active plan/spec the handoff names, plus the references `AGENTS.md` routes for
   this specific task. Do not scan the codebase by default.
5. Before writing any application code, satisfy `AGENTS.md`'s Expo requirement: read the exact
   SDK 56 documentation at https://docs.expo.dev/versions/v56.0.0/. Unversioned or older Expo
   docs do not satisfy it.
6. For any UI, visual, copy, icon, animation, or interaction work, load the `jernie-design`
   skill (`.claude/skills/jernie-design/SKILL.md`) and read every reference its routing table
   marks as required — before writing the first line of that work.

Then follow `AGENTS.md` for scope, architecture, design invariants, testing and release gates,
Expo, Git, and completion reporting. Do not work from memory of those rules; they live and
change in `AGENTS.md`.

## After material implementation, review, or diagnosis

1. Replace `docs/agents/HANDOFF.md` with the verified current state: objective, verified facts,
   working-tree status, exact next actions, watch-outs, and the exact commands run with their
   results. Replace stale content; never append a session diary.
2. Keep the handoff at roughly 50 lines or fewer.
3. Update `docs/redesign-roadmap.md` only when durable milestone status changes.
4. Update the active plan/spec when its progress or accepted decisions change.
5. Use `docs/superpowers/known-issues.md` only for a genuine deferred defect or architectural
   risk — never for active-task todos — and remove entries when they are fixed.
6. Do not update the handoff after a simple read-only question that produced no material
   repository finding.

## Where new persistent information goes

| Information | File |
| --- | --- |
| Stable rule for every agent | `AGENTS.md` |
| Durable runtime, command, or environment fact | `docs/agents/PROJECT_CONTEXT.md` |
| Immediate branch state or next action | `docs/agents/HANDOFF.md` |
| Milestone status | `docs/redesign-roadmap.md` |
| Implementation progress or accepted decision | the active plan in `docs/superpowers/plans/`, or its spec |
| Deferred defect or architectural risk | `docs/superpowers/known-issues.md` |
| Claude-only tool, hook, or permission behavior | this file or `.claude/settings*.json` |

Never resolve a documentation problem by copying a shared rule back into this file. Codex does
not read it, and a duplicated rule drifts out of sync.

## Delegation mapping

`AGENTS.md`'s planning and delegation rules are the contract; this is only Claude's mapping of
them onto its own tooling.

- Author plans with `superpowers:writing-plans`; execute them with
  `superpowers:subagent-driven-development`. That skill's Model Selection guidance agrees with
  `AGENTS.md`; the project rule only moves the choice earlier, into the plan text, so Codex can
  read the same assignment.
- Tier maps to the `Agent` tool's `model` parameter: light -> `haiku`, standard -> `sonnet`,
  deep -> `opus`. Pass it on every dispatch; omitting it inherits this session's model.
- The `Agent` tool takes no reasoning parameter. Carry the plan's reasoning level in the dispatch
  prompt as an explicit depth instruction. To bind it mechanically instead, add a definition
  under `.claude/agents/` with model and reasoning effort in its frontmatter - no such directory
  exists today.
- Subagent briefs, reports, and review diffs go in `.superpowers/sdd/<plan-name>/`, which is
  gitignored. Keep them out of `docs/`.

## Claude-specific notes

- `.claude/skills/jernie-design/` is shared project truth, not Claude-only policy — the path is
  historical and Codex reads those files directly. Do not move, restructure, or re-scope it.
- Settings split: `.claude/settings.json` is shared, committed configuration (enabled plugins);
  `.claude/settings.local.json` holds personal permission allowlists. Neither is a place for
  durable project rules.
- This file uses plain instructions rather than `@` file imports, so each read above is an
  explicit step. If an import is ever added, keep the plain-language instruction to read
  `AGENTS.md` alongside it.
- Skills and default workflows are subordinate to `AGENTS.md` and to direct user instructions.
  Where a Superpowers or Expo skill's default conflicts with the contract, the contract wins.
