# Jernie Native — shared agent contract

This is the canonical repository contract for every coding agent. Tool-specific instruction
files may add operating details, but they must point here instead of duplicating or overriding
project rules. Keep this file stable and concise; current work belongs in
`docs/agents/HANDOFF.md`.

## Required startup

Before repository work:

1. Read `docs/agents/HANDOFF.md` in full.
2. Run `git status --short` and inspect the recent log. Preserve user-owned and unrelated
   changes; never assume an untracked file is disposable.
3. Read only the active plan/spec and source files identified by the handoff or user request.
   Do not scan the whole codebase by default.
4. Consult `docs/agents/PROJECT_CONTEXT.md` for commands and known runtime traps relevant to
   the task.
5. Before writing any application code, read the exact Expo SDK 56 documentation at
   https://docs.expo.dev/versions/v56.0.0/. Do not substitute unversioned or older Expo docs.

Git, source, and actual command output outrank the handoff when they disagree. Correct a stale
handoff as part of material work.

## Task routing

- **Any visual, UI, copy, icon, layout, animation, or interaction work:** read
  `.claude/skills/jernie-design/SKILL.md` and follow its routing table. Read its `README.md`
  and every reference it marks as required for the task. The `.claude` path is historical;
  the design system is shared project documentation, not Claude-only policy.
- **Redesign sequencing or scope:** read `docs/redesign-roadmap.md`, then the active file in
  `docs/superpowers/plans/` and its paired spec when one exists.
- **Deferred defects or architectural risks:** read and update
  `docs/superpowers/known-issues.md` only when a real issue is deliberately deferred or fixed.
- **Metro, EAS, fonts, MMKV, images, icons, theming, or Reanimated:** read the matching section
  of `docs/agents/PROJECT_CONTEXT.md` before changing or diagnosing it.
- **A referenced library or Expo API:** verify the installed version and use primary,
  version-matched documentation. Expo APIs always use the SDK 56 docs above.

## Planning and delegation

- Multi-step work gets a written plan in `docs/superpowers/plans/` before implementation, paired
  with its spec when one exists.
- Prefer delegated execution: one fresh subagent per task, a review after each task, and a broad
  review of the whole branch at the end. The session owning the plan keeps the coordination
  context; each subagent receives only what its task needs.
- Every task in the plan states its capability tier and reasoning level *before* dispatch, with a
  one-line justification, written directly under the task heading:

  `Tier: standard | Reasoning: medium - multi-file integration across the timeline and writes.`

- Choose the tier from the task's complexity, and use the cheapest one that can do the job:
  - **light / low** - one or two files against a complete spec: transcription, mechanical edits,
    renames, focused test additions.
  - **standard / medium** - multi-file integration, matching existing patterns, ordinary
    debugging, review of a small or mechanical diff.
  - **deep / high** - architecture and design judgment, concurrency and transactional write
    paths, security rules, cross-cutting redesign, and the final whole-branch review.
- Never dispatch without stating the tier. An omitted model inherits the session default, which
  is usually the most expensive one.
- If a task returns blocked for want of reasoning rather than missing context, re-dispatch one
  tier higher and record the escalation in the plan. Never retry the same tier unchanged.
- Tiers stay tool-neutral so either agent can execute the plan. Each maps them onto its own model
  lineup: Claude in `CLAUDE.md`, Codex in its own configuration.
- When another agent is already working in the checkout, delegated or parallel execution runs in
  an isolated Git worktree. Two writers in one working tree invalidate each other's gates.

## Scope and architecture rules

- Build only what the current brief describes. If the requested work is complete, stop rather
  than expanding into the next roadmap session.
- Reuse the existing domain, platform, hook, and UI layers before creating another abstraction.
- Use the library assigned by the design system for a behavior. Do not hand-roll behavior that
  the React Native mapping assigns to a library.
- Do not add a dependency that the design system does not name without explaining the need and
  obtaining user approval first.
- Anything genuinely custom in design/UI work must be proposed before implementation and
  registered in `.claude/skills/jernie-design/reference/custom-components.md`.
- During redesign/UI work, do not change Firebase schemas, security rules, or backend logic
  unless the user explicitly expands the task to include them.
- Keep domain transforms pure and immutable. Shared-data writes that can race must use the
  repository's authenticated atomic/transactional path rather than read-then-set.
- Screens never hard-code image URLs. Resolve a named subject through `src/lib/images.ts` and
  render it through the shared photo seam.
- Do not introduce hard-coded colors. Components and screens take colors from `useTheme()`;
  design values come from the registered tokens.
- Compose primitives from `src/ui/`; do not reimplement them inside feature components.
- No emoji in product UI. Use per-icon Phosphor imports, never its barrel export.
- Accessibility is part of completion: provide non-gesture alternatives, 44px minimum targets,
  sensible screen-reader labels/actions, font-scaling behavior, and reduced-motion handling.

## Design invariants

The full source of truth is `.claude/skills/jernie-design/`. These high-risk rules apply to all
UI work:

- Teal is the single accent for secured/booked/current states; amber means unfinished.
- Red has exactly two jobs: a cancelled/failed booking and a confirmed destructive control
  (the revealed Remove tile or confirmation-sheet Remove button). It is never a success or
  progress state; a successful Removed/Undo bar uses inverse ink and turns red only on failure.
- Fraunces 400 names things and is never used below 20px. DM Sans runs the interface. DM Mono
  carries aligned values such as times, dates, nights, and distances.
- Use the bundled static font family for the desired weight; React Native must not select these
  faces through `fontWeight` on the regular family.
- Every screen uses a 20px gutter and every hit target is at least 44px. Use layout `gap`, not
  margin chains.
- A card has a border or a shadow, never both. Selected state is a 1.5px accent border plus the
  tokenized 9% accent fill, never a shadow change.
- Press feedback is opacity 0.85 plus a light haptic—never scale or color change.
- Empty states are actions, normally a `PromptRow`, not decorative illustration.
- Use only tokenized motion and elevation. Finger-driven motion uses the registered springs.
- Match the reference screens exactly. If a required value or behavior is absent, ask instead
  of inventing it.
- There is no logo or owned photography yet. Use the DM Sans 700 wordmark and the photo resolver.

## Testing and release gates

- Keep existing tests passing. For design-system work, do not add tests beyond the current
  brief; add them when the active implementation plan or user explicitly requires them.
- While iterating, run the smallest relevant test/compile checks first.
- Before declaring production-code work complete, run:
  1. `npm test` and confirm exit code 0.
  2. `npx tsc --noEmit` and confirm no diagnostics.
  3. `npx expo export --platform ios --output-dir /tmp/verify` for a cold SDK 56 bundle.
  4. `git status --short` and a scoped diff review.
- UI gates also check both themes, no touched-file legacy tokens or emoji, no hard-coded colors
  or image URLs, registered custom components, and on-device behavior when the gate calls for
  it.
- A test suite printing all-pass is not green unless the process exits 0.
- Documentation-only changes do not require the app test/export gate; report that it was not
  run and why.

## Git and native-build rules

- Never commit directly to `main`; branch from `dev`.
- `npm test` must exit 0 before opening a pull request to `main`.
- Never commit `.env` or secrets.
- Do not commit unless the user asks for a commit. If asked, keep unrelated changes out.
- EAS builds use committed `HEAD`, not working-tree changes. Commit native configuration and
  dependency changes before requesting an EAS build.
- Native dependencies and native configuration require a fresh development build; an OTA
  update cannot add them.

## Shared state and handoff protocol

At the end of material implementation, review, or diagnosis:

1. Update `docs/agents/HANDOFF.md` with the current objective, verified state, working-tree
   status, exact next actions, watch-outs, and commands actually run. Replace stale content;
   do not append a session diary. Keep it under roughly 50 lines.
2. Update `docs/redesign-roadmap.md` only when durable milestone status changes.
3. Update the active implementation plan/spec when its progress, accepted decisions, or gates
   change.
4. Add to `docs/superpowers/known-issues.md` only for a genuine deferred issue; remove the entry
   when it is fixed and cite the fixing commit/PR when available.
5. Let Git history carry completed-work history. The handoff should cite commits, not restate
   their full diffs.

Do not rewrite the handoff after a read-only question with no material repository finding.
When finishing work, report files changed, dependencies added, verification run, remaining
risks, and anything guessed.
