# Auto CLI For Codex

This file is the global bridge layer for Codex, aiming to make user input of `/prompts:auto` or `/auto` in Codex behave as close as possible to `/auto` in Claude Code.

## Entry Recognition

The following inputs are treated as invoking Auto CLI main entry, not as regular chat text:

- `/prompts:auto <task>`
- `/auto <task>`
- `/prompts:auto` alone on a line
- `/auto` alone on a line

If user initiates task with these prefixes:

1. Remove command prefix, treat remaining text as actual task
2. Process this round's task per Auto CLI workflow, not as regular Q&A or regular review
3. Prioritize following `commands/auto.codex.md` rules in current workspace (if exists)
4. If current project has `CLAUDE.md`, `REPO_MAP.md`, `.auto/cache/capability-snapshot.json`, `commands/`, `skills/`, read these capability indexes first, then form RouteDecision

## Behavior Requirements

When matching `/prompts:auto` or `/auto`:

1. Must form `RouteDecision` first
2. Must form `Plan` first
3. After minimal preflight completion, first commentary must directly show simplified `## RouteDecision` and `## Plan` to user
4. Then execute deeper checks, modifications, verification
5. If project has `.auto/`, must write run artifacts
6. First complete result must adopt following skeleton:

```markdown
## RouteDecision

## Plan

## Execution / Findings

## Verify

## Learn
```

Don't degrade to regular review because user input is short, e.g. "confirm local changes have no issues"; also don't first send "let me check" regular commentary, then supplement planning later.

## Source of Truth

Auto CLI's detailed rules in Codex are defined by `commands/auto.codex.md` in repository; this file only ensures entry is truly taken over.

## Context

This repository is a pure Markdown instruction repository, running through Claude Code / Codex slash command mechanism.

- `commands/` — slash command entries, `/auto` is the sole orchestration entry
- `skills/` — Reusable skill knowledge, new capabilities prioritized as skills
- `agents/` — Claude Code Agent definitions (Codex doesn't support, ignore)
- `hooks/` — Claude Code automation hooks (Codex doesn't support, ignore)
- `.auto/` — Run artifact source (runs / insights / feedback / cache)

Current version `v0.52.0`, 38 skills, 16 VERIFY gates.

## Avoid

- Don't add parallel slash command entries (like `/goal`, `/workflow`), all capabilities orchestrated through `/auto`
- Don't introduce JS/Node runtime code, this project is a pure Markdown instruction repository
- Don't modify `agents/` directory (Codex doesn't use agent files)
- Don't promise unimplemented features in documentation
- Keep minimal diff when modifying `.md` files, don't refactor unrelated content opportunistically
