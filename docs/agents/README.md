# Shared agent documentation

This directory is the small, tool-neutral coordination layer for Jernie Native. It prevents
Claude and Codex from maintaining separate versions of project truth.

## Ownership

| File | Owns | Must not contain |
| --- | --- | --- |
| `../../AGENTS.md` | Stable repository rules, required startup, routing, gates | Sprint status or session diary |
| `PROJECT_CONTEXT.md` | Durable commands, environment facts, API/runtime traps | Current task status |
| `HANDOFF.md` | Current branch state and the next agent's resume point | Long history or duplicated specs |
| `../redesign-roadmap.md` | Durable redesign milestone status | File-by-file implementation notes |
| `../superpowers/plans/*.md` | Active implementation sequence and gate evidence | General repository rules |
| `../superpowers/known-issues.md` | Real deferred defects and architectural risks | Active-task todos |
| `../../.claude/skills/jernie-design/` | Visual and behavioral source of truth | Branch status |

## Startup contract

Every agent working in the repository should:

1. Load `AGENTS.md` as the canonical contract.
2. Read `HANDOFF.md`.
3. Verify the handoff with `git status --short`, recent commits, and the active plan.
4. Read only the references routed by the task.

This is intentionally a targeted startup. A handoff is a map to evidence, not permission to
trust stale prose or skip inspecting the code being changed.

## Update contract

- Replace the handoff after material work; never append a chronological log.
- Keep it concise enough to read every session (target: 50 lines or fewer).
- Record exact commands and exit results. Do not say “green” from printed pass counts alone.
- Link the active plan/spec and cite relevant commits instead of copying their contents.
- Preserve unrelated and personal working-tree changes.
- If Git or test output contradicts a document, treat the executable evidence as authoritative
  and correct the stale document.

Tool-specific files may tell an agent how to load this structure, but shared project rules are
changed in `AGENTS.md`, not duplicated into those files.
