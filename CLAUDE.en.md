# Auto CLI

> Claude Code `/auto` super command. This repository aims to unify discovery, reasoning, orchestration, and reuse of various capabilities through `/auto`.

## Positioning

Pure Markdown instruction repository, running through Claude Code's slash command mechanism. Contains no JS runtime code.

## Project Structure
- `commands/auto.md`: `/auto` main command, defining 6 PHASE workflow
- `commands/auto/`: Subcommands (doctor, learn, status, route, create-hook, dashboard)
- `agents/`: Built-in agent catalog and descriptions
- `skills/`: Reusable skill knowledge
- `rules/`: Coding standards
- `hooks/`: Default hooks configuration

## Architecture Constraints
- `/auto` is the sole orchestration entry point. New capabilities should be integrated into auto.md first, not as parallel entry points.
- Documentation must reflect current actual behavior. Do not promise unimplemented features.
- PHASE 1 SCAN is read-only by default; only explicit `--fix` allows safe automatic fixes.
- Subcommands are self-contained Markdown instructions that don't depend on external JS runtime.

## Coding Standards
- Keep minimal diff when modifying Markdown files.
- Do not refactor unrelated content opportunistically.
- Do not add unfounded fallback explanations or compatibility notes.

## Verification
- Run `npm run format:check` after modifications to ensure formatting consistency.
- Check internal references for consistency after modifying subcommands.

## Installation & Uninstallation
- `npm run sync` — Copy commands/agents/skills/hooks to ~/.claude/ (recommended path)
- `npm run uninstall` — Remove installed files

## Git & Release
- Commit messages follow conventional commits: `feat: ...` / `fix: ...` / `docs: ...`
- Only commit when explicitly requested by user.

## AI Working Style
- Read relevant files before modifying, don't guess implementations.
- Plan first for multi-file or multi-path tasks.
- Be cautious with visible operations like file deletion or git commits, execute within user's requested scope.
- If documentation conflicts with actual behavior, prioritize fixing documentation to match reality.

## Architectural Layers (root/dev pattern)

Inspired by karpathy/llm.c root/dev separation:

| Layer | Directory | Responsibility | Complexity Tolerance |
|-------|-----------|----------------|----------------------|
| **root** | `commands/` | User-callable entries, simple and readable | Low — reject complexity without significant benefit |
| **dev** | `skills/` | Capability library called by commands, experimental allowed | Medium — local complexity permitted |
| **infra** | `agents/` | Agent definitions and protocols | Low — keep < 450 lines |
| **guard** | `rules/` + `hooks/` | Coding standards and automation | Low — declarative-first |

When adding new capabilities, prioritize placing them in `skills/`, don't modify main commands. Main commands only handle routing and orchestration.

## Roadmap

### In Progress

- [ ] Community skills mechanism: `skills/community/` directory supporting third-party extensions

### Planned (v0.52 candidates)

- Agent Teams dual-mode execution: Parallel Quests provide native Agent Teams mode alongside git-worktrees (with tiered model cost guidance)
- OpenSpec delta specs: `spec-driven` skill absorbs ADDED/MODIFIED/REMOVED markers and proposal→apply→archive state machine
- Hook `agent_id`/`agent_type` field utilization + PostToolUseFailure re-evaluation
- agentless-repair removes outdated SWE-bench score claims (preserves methodology)

### Completed

- [x] v0.52.0: **loop-engineering skill (/auto autonomous loop engine)**: Added `skills/loop-engineering/SKILL.md`, upgrading `/auto` from single pipeline to DOER+CHECKER autonomous loop triggered by interval parameter (`5m`/`30m`/`2h`). Theoretical foundation: 2026 loop engineering paradigm (Boris Cherny "My job is to write loops") + Anthropic official DOER/CHECKER model + Ralph Loop + Agent SDK budget caps + non-degeneracy convergence. Implementation: `commands/auto.md` adds "Loop Mode (orthogonal to strategy)" section + SCAN 1.8 Loop parameter parsing (with continuous/convergent semantic auto-trigger) + fallback index trigger + LEARN 6.6 cross-iteration feedback; `commands/auto.codex.md` dual-side alignment (Codex lacks native scheduling tools → external cron/schtasks or manual trigger fallback, strictly forbid faking background runs); RouteDecision adds `loopBudgets` (maxIterations 20 / maxBudgetUsd 10 / maxWallClock 72h / noProgressLimit 3); convergence criteria hard gate (no measurable CHECKER = no loop); skills upgraded from 37 to 38 (along with predict-verify added to README table, fixing long-standing count lag)

- [x] v0.51.0: **Automatic run cleanup mechanism**: SessionStart Hook auto-archives run history older than 30 days (configurable), maintaining SCAN performance; adds `hooks/lib/auto-clean-runs.sh` cross-platform script (supports Linux/macOS/Windows Git Bash/Node.js/Python fallback); `hooks/hooks.json` SessionStart Hook integration (< 50ms overhead); `commands/auto.md` PHASE 6.4 supplements configuration/manual trigger/recovery instructions; `commands/auto.codex.md` LEARN section sync (annotates Codex lacks Hook); `rules/hooks.md` SessionStart section supplement; `skills/community/README.md` top explicitly declares organizational directory identity; `scripts/validate-references.js` whitelist completion

- [x] v0.50.0: **Full-repository audit fixes (27 items)**: Codex dual-side alignment (constitution / self-critique / VERIFY gate set completion + adversarial fallback mode / LEARN feedback realization / Curator completion / Session Continuity / Portable Patterns); version count full-chain unification (README bilingual badges / plugin.json / marketplace.json / REPO_MAP); ghost reference cleanup (doctor.md `auto install`/`RepoIndexer`, community README unimplemented promises changed to "in development"); CHANGELOG backfills 0.46/0.47 entries; quest-designer slimming 464→440 lines; knowledge-management + quality-gates supplement activation summary. Audit method: 2 parallel Explore agents (document consistency / dual-side alignment) + mechanical checks, checklist at `.auto/runs/run-20260613-top-down-audit/index.md`

- [x] v0.49.0 through v0.31.0: [Previous version history omitted for brevity - see Chinese version for full details]

## Current Repository High-Value Focus
- `commands/auto.md` is the unified action entry point.
- Capability descriptions in subcommand md files need continuous sync with actual behavior.
- Keep only currently needed versions of package artifacts, old tgz files can be deleted after confirmation.
- **Core Invariant**: Users accomplish tasks perfectly using only the `/auto` command. All new capabilities are prioritized as skills auto-activated by `/auto`, not as parallel entry points.
