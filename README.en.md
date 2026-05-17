# Auto CLI

> `/auto` super command repo — Claude Code provides complete native orchestration, Codex provides optimized prompts + skills workflow.

> [中文版 README](README.md)

---

## What is this?

Auto CLI is a pure Markdown intelligent development assistant running in Claude Code / Codex. Type `/auto` + your need, and AI will:

1. **Scan project** — detect language, framework, existing conventions, produce `RouteDecision`
2. **Orchestrate quests** — combine Router, Skills, historical experience to generate `QuestMap`
3. **Execute quests** — autonomously pick execution depth, produce `QuestResult`
4. **Auto gates** — 12-gate tiered validation (build/test/lint/coverage/security/adversarial/self-verification/skill-activation/knowledge-reuse/clean-state/cost), produce `VerifyReport`
5. **Summarize** — aggregate changes and remaining blockers, no auto-commit
6. **Sediment knowledge** — produce `LearnCard` writing back to insights/feedback, auto-retrieve on next run

**Core philosophy**: pure Markdown instruction driven, zero runtime required. Claude Code side runs complete command/agent/hook orchestration; Codex side focuses on optimizing the single `/auto` main entry, letting users state intent once and have `/auto` autonomously complete routing, execution, verification, and knowledge sedimentation.

## Why auto-cli is hard to leave once you've used it

Mainstream Claude Code tools (Superpowers, Everything Claude Code, etc.) solve **how to use it stably**. Auto-cli further solves **how to make AI understand your project better over time**.

### 1. Protocol-driven · 5 standard objects written to disk immediately

Every `/auto` run mandatorily produces 5 standard objects (`RouteDecision` / `QuestMap` / `QuestResult` / `VerifyReport` / `LearnCard`), landed to `.auto/runs/<runId>/`. Three real benefits:

- Any quest failure can be precisely traced to a specific Quest, not "the code is messy"
- Cross-session resumption: next Claude Code instance reads previous output from `.auto/runs/` with no info loss
- Same requirement N times produces structurally consistent artifacts, scriptable for batch analysis

### 2. Knowledge loop · LearnCard reverse lookup

Every run's traps/patterns/decisions sediment to `.auto/insights/` and `.auto/feedback/`. **Next SCAN auto reverse-lookups by keyword**, matched entries inject as `[insight:traps.md#xxx]` into current QuestMap, PHASE 4 `knowledge-reuse` gate enforces "is past experience actually being reused".

> Mistakes you made auto-cli remembers; good practices you validated it actively reuses.

### 3. Session Continuity · cross-session resumption

When a run is interrupted (context compression, Claude Code restart, user away), auto-writes `session-continuity.md` with `interruptPoint` + `cleanStateChecklist`. Next `/auto` starts directly resumes: "last interrupted at Quest 3/5 (Read done, Edit pending)" — **no need to re-narrate the previous conversation**.

### 4. Quest-level failure rollback · doesn't drag the whole repo

When a quest fails, only files touched by that Quest are rolled back, completed quests retain output. Compared to repo-level `git reset` rollback, on average preserves 80% completed work.

### 5. 12-Gate adaptive validation · not "lint passed = done"

Strategy-driven dynamic gate selection:

- **Explore**: `analysis` + `skill-activation` + `knowledge-reuse` + `clean-state`
- **Fix**: + `build` + `test` + `self-verification`
- **Implement**: + `lint` + `coverage`
- **Refactor**: + `security` + `adversarial` (red-blue verification)

Any gate missing evidence triggers reflow to EXECUTE, not "looks right = done".

---

## Environment

- **Node.js** >= 18 (only for install scripts, runtime zero-dep)
- **Claude Code or Codex** installed

---

## Install

### Via Plugin Marketplace (Recommended · Claude Code native)

In Claude Code:

```
/plugin marketplace add ktyyer/auto-cli
/plugin install auto-cli@auto-cli
```

Claude Code auto-discovers and loads `commands/`, `agents/`, `skills/`, `hooks/` from this repo. Restart Claude Code to take effect.

Update: `/plugin update auto-cli`.

### From source (Developers / Codex users)

```bash
git clone https://github.com/ktyyer/auto-cli.git
cd auto-cli
npm run sync           # auto-detect installed tools and sync
```

### Uninstall

```bash
npm run uninstall      # in source repo
node scripts/uninstall.js  # from extracted tgz
```

---

## Usage

```bash
# Super command — describe need, AI handles all
/auto Implement Spring Boot user pagination API
/auto Build reusable form components in React
/auto Get familiar with the current project, summarize in a paragraph

# Smart routing — auto recommend best agent
/auto:route Write test cases
/auto:route Check for password leaks

# Diagnostics
/auto:doctor

# Project status
/auto:status

# Git history pattern analysis
/auto:learn --git
```

---

## Capability Overview

### Core Commands

| Command             | Purpose                                                    |
| ------------------- | ---------------------------------------------------------- |
| `/auto`             | Super command — state need, AI orchestrates all            |
| `/auto:route`       | Smart routing — auto analyze intent, recommend agent       |
| `/auto:doctor`      | Diagnostics — health check + safe auto-fix                 |
| `/auto:status`      | Project status — runtime, capabilities, health             |
| `/auto:dashboard`   | Aggregate run data — strategy distribution, gate pass rate |
| `/auto:create-hook` | Generate Hook template (Claude Code)                       |
| `/auto:learn`       | Analyze Git history patterns, return structured result     |

### Four execution strategies

| Strategy      | Use case                        | Path                                                                                          |
| ------------- | ------------------------------- | --------------------------------------------------------------------------------------------- |
| **Explore**   | Analysis/review, no code change | SCAN → PLAN → EXECUTE (read-only) → VERIFY(skipped) → SUMMARIZE → LEARN                       |
| **Fix**       | Bug/small tweak                 | SCAN → PLAN → EXECUTE → VERIFY(build+test+clean-state) → SUMMARIZE → LEARN                    |
| **Implement** | New feature/multi-file change   | SCAN → PLAN → quest-designer → EXECUTE → VERIFY(+lint+coverage) → SUMMARIZE → LEARN           |
| **Refactor**  | Architecture-level change       | SCAN → PLAN → quest-designer → EXECUTE → VERIFY(+adversarial+clean-state) → SUMMARIZE → LEARN |

### Skills (24)

Cover requirements clarification, brainstorming, init-project, workflow patterns, code style, git workflow, dependency analysis, performance/error/robustness/logging patterns, Java/Spring Boot, comment standards, production standards, research, test plan writing, systematic debugging, code analyzer, skill creator/evaluator, PRD writer, API design, refactoring patterns, spec-driven, git worktrees.

Each Skill includes `## Activation Digest` section, supports 3-tier on-demand activation (digest / full / deep), saves 80%+ context.

### Hooks (19) · Claude Code

PreToolUse, PostToolUse, PreCompact, PostCompact, UserPromptSubmit, TeammateIdle, TaskCompleted, Stop — full lifecycle automation.

---

## 6 PHASE Workflow

```
/auto <need>
    |
PHASE 1: SCAN      -- scan stack, capabilities, env (with cache)
PHASE 2: PLAN      -- knowledge retrieval + Skill dynamic discovery (3-tier activation) + Quest Map
PHASE 3: EXECUTE   -- per-quest execution (serial/parallel/Teams)
PHASE 4: VERIFY    -- 12-gate tiered gates (strategy-driven enforcement)
PHASE 5: SUMMARIZE -- completion summary (no auto-commit)
PHASE 6: LEARN     -- knowledge sediment + clean-state gate → auto-retrieve next time
```

---

## Agent Skills Standard Compatible

Auto-cli's Skill source structure **fully aligns** with [Anthropic Agent Skills open standard](https://github.com/anthropics/skills):

```
skills/<name>/
├── SKILL.md         # required (YAML frontmatter + Markdown)
└── references/      # optional
```

Can be directly recognized by tools supporting Agent Skills standard: Claude Code / Cursor / Windsurf / Aider / Gemini CLI / Codex / OpenCode.

---

## Supported Languages

- Java / Spring Boot
- JavaScript / TypeScript / React
- Python / Django
- Go / Gin
- Rust (basic)

---

## License

MIT
