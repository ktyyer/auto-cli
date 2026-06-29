# REPO_MAP.md

> 2026-06-13 | Pure Markdown — 0 JS runtime | v0.52.0

**Latest Optimizations** (v0.49-0.52):

- ✅ loop-engineering skill: `/auto <interval>` autonomous loop engine (DOER+CHECKER, ScheduleWakeup/CronCreate scheduling, cross-iteration convergence & learning feedback)
- ✅ plan-ensemble skill: PLAN phase multi-perspective parallel planning & review synthesis (NeurIPS 2025 multi-agent debate review)
- ✅ Knowledge loop evolution: ACE Curator checks + Insight reuse counting + AWM workflow induction (v0.48)
- ✅ Codex dual-side alignment: constitution / self-critique / VERIFY gate set / LEARN feedback loop completion
- ✅ Full-repository audit fixes: version count unification, ghost reference cleanup, manifest uninstall list completion

## commands/

### commands/auto.md

`/auto` main command — 6 PHASE workflow (SCAN → PLAN → EXECUTE → VERIFY → SUMMARIZE → LEARN)
4 execution strategies: explore / fix / implement / refactor

### commands/auto/

- `dashboard.md` — Aggregates `.auto/runs/` historical data to show long-term trends
- `create-hook.md` — Generates Claude Code Hook templates
- `doctor.md` — Environment diagnostics & preflight auxiliary information
- `learn.md` — LearnCard knowledge consolidation entry (unified output to insights / feedback)
- `route.md` — Routing entry that outputs standard `RouteDecision`
- `status.md` — View `.auto/` canonical structure & capability installation status

## agents/ (10 business Agents + 1 shared principles)

> `_shared-principles.md` defines protocol objects and common principles for other Agents to reference, not scheduled as an independent Agent. Total of 10 business Agents.

| Agent                     | Purpose                                                           |
| ------------------------- | ----------------------------------------------------------------- |
| `_shared-principles.md`   | Agent common principles, protocol objects & failure state machine (shared, not independent Agent) |
| `architect.md`            | System design, scalability, technical decisions                   |
| `build-error-resolver.md` | Build and TypeScript error fixing                                 |
| `code-reviewer.md`        | Code review                                                       |
| `doc-updater.md`          | Documentation and code map updates                                |
| `e2e-runner.md`           | Playwright E2E testing                                            |
| `quest-designer.md`       | Quest designer that outputs standard `QuestMap`                   |
| `refactor-cleaner.md`     | Dead code cleanup and consolidation                               |
| `security-reviewer.md`    | Security vulnerability detection and fixing                       |
| `tdd-guide.md`            | Test-driven development                                           |
| `verification.md`         | Adversarial verification that outputs standard `VerifyReport`     |

## skills/ (38 total)

| Skill                      | Purpose                                                    |
| -------------------------- | ---------------------------------------------------------- |
| `agentless-repair`         | Two-phase bug fixing pipeline (localize → repair)          |
| `api-design`               | API design standards (RESTful, pagination, error codes, OpenAPI) |
| `brainstorming`            | Socratic questioning for multi-approach exploration        |
| `code-analyzer`            | tree-sitter driven code analysis (AST extraction, structure understanding) |
| `code-style-enforcer`      | Code style enforcement                                     |
| `comment-standards`        | Comment standards                                          |
| `constitution`             | Project-level hard constraints (`.auto/constitution.md`)   |
| `context-engineering`      | Context window management (compression, segmentation)      |
| `dependency-analyzer`      | Dependency analysis                                        |
| `error-patterns`           | Error pattern library                                      |
| `feedback-loop`            | I/O system self-verification loop (Reflexion, ACI)         |
| `git-workflow`             | Git workflow standards                                     |
| `incremental-review`       | Session-end incremental code review                        |
| `init-project`             | Project initialization                                     |
| `java-patterns`            | Java/Spring Boot coding patterns                           |
| `knowledge-management`     | LEARN full process (LearnCard production & distribution)   |
| `logging-patterns`         | Logging and observability patterns                         |
| `loop-engineering`         | Autonomous loop engine (DOER+CHECKER, convergence)         |
| `performance-patterns`     | Performance optimization patterns                          |
| `plan-ensemble`            | Multi-perspective planning synthesis                       |
| `prd-writer`               | PRD requirements writing (two-phase: concept → implementation) |
| `predict-verify`           | Predict before executing impactful commands                |
| `production-governance`    | Production governance (goal convergence, cost quality)     |
| `production-standards`     | Production environment standards                           |
| `protocol-validator`       | Phase handoff protocol validation                          |
| `quality-gates`            | 14 VERIFY gates definitions                                |
| `refactoring-patterns`     | Safe refactoring methodology (test safety net, batch strategy) |
| `requirement-clarifier`    | Requirements clarification (ask user for ambiguous requirements) |
| `research-analyst`         | Autonomous research methodology (research before implementation) |
| `robustness-patterns`      | Robustness patterns (retry, circuit breaker, rate limiting) |
| `self-critique`            | Post-quest self-reflection (Reflexion)                     |
| `skill-creator`            | Skill authoring methodology (intent capture → SKILL.md → test iteration) |
| `skill-evaluator`          | Skill health assessment (static D1-D7 + effectiveness D8)  |
| `spec-driven`              | Specification-driven development (requirements → interface contract → executable acceptance) |
| `systematic-debugging`     | Systematic debugging methodology (4-phase enforced process) |
| `test-plan-writer`         | Test plan writing (6-dimension matrix)                     |
| `using-git-worktrees`      | Parallel Quest execution via git worktrees                 |
| `workflow-patterns`        | Workflow patterns                                          |

## hooks/

- `hooks.json` — 19 Hook configurations (PreToolUse 6 / PostToolUse 7 / PreCompact 1 / PostCompact 1 / UserPromptSubmit 1 / TeammateIdle 1 / TaskCompleted 1 / Stop 1)
- `lib/tdd-guard.js` — TDD guard logic
- `lib/tdd-guard-cli.js` — TDD guard CLI entry
- `lib/codemaps-hook.sh` — Codemaps hook script

## rules/

- `agents.md` — Agent orchestration
- `coding-style.md` — Coding style
- `commands.md` — Commands authoring standards
- `git-workflow.md` — Git workflow
- `hooks.md` — Hook system
- `markdown-authoring.md` — Markdown authoring standards
- `performance.md` — Performance & design patterns
- `security.md` — Security guide
- `testing.md` — Testing requirements
- `version-and-release.md` — Versioning & release standards

## scripts/

- `install.js` / `install.sh` / `install.bat` — Installation scripts
- `uninstall.js` / `uninstall.bat` — Uninstallation scripts
- `reinstall.sh` / `reinstall.bat` — One-click reinstall
- `rebuild-skill-extracts.js` — Rebuild `.auto/cache/skill-extracts/`
- `rebuild-insight-index.js` — Rebuild `.auto/cache/insight-index.json`
- `validate-references.js` — Markdown reference integrity validation
- `validate-run-completeness.js` — `.auto/runs/<runId>/` basic loop validation
- `validate-package-contents.js` — npm distribution package Codex key files validation

## .auto/

```text
.auto/
├── cache/
│   ├── capability-snapshot.json
│   └── pattern-cards.json
├── runs/
│   └── <runId>/
│       ├── route-decision.md
│       ├── quest-map.md
│       ├── quest-results.md
│       ├── verify-report.md
│       ├── learn-cards.md
│       ├── session-continuity.md (optional)
│       └── index.md
├── insights/
│   ├── traps.md
│   ├── patterns.md
│   ├── decisions.md
│   ├── prompts.md
│   └── agent-feedback.md
├── memory/
│   └── store.json
└── feedback/           # canonical feedback source (may be missing before first LEARN, needs canonical seed initialization)
    ├── agents.json
    └── skills.json
```

- `cache/` — Disposable cache layer, not a long-term knowledge source
- `runs/` — Single `/auto` workflow protocol object persistence source
- `runs/<runId>/session-continuity.md` — Structured continuation summary for current run (optional, only exists when continuation needed)
- `runs/<runId>/index.md` — Human-readable summary and wrap-up for current run
- `insights/` — Long-term knowledge views after LearnCard categorization
- `memory/` — Project-level auxiliary memory index
- `feedback/` — Structured records of agent / skill routing feedback
- Legacy paths can continue to be read, but new writes uniformly use canonical structure
