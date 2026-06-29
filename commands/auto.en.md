---
name: auto
description: Intelligent super command - Context scanning + Quest design + Step-by-step execution + Verification + Summary + Knowledge consolidation
---

# /auto — Intelligent Super Command

> SCAN → PLAN → EXECUTE → VERIFY → SUMMARIZE → LEARN
>
> Runtime note: This file targets Claude Code native slash command workflow; when installed to Codex, if `commands/auto.codex.md` exists, use the Codex override version.

---

## Execution Strategies

Choose execution depth autonomously based on task nature:

| Strategy      | Use Case                                               | Execution Path                                                                                          |
| ------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| **Explore**   | Analysis/consultation/code review, no code changes     | SCAN → Direct answer (fast track, see 1.3); complex analysis may follow full PHASE flow                 |
| **Fix**       | Bug/minor adjustment, few files localized modification | SCAN → PLAN → EXECUTE (direct fix) → VERIFY → SUMMARIZE → LEARN                                         |
| **Implement** | New feature/multi-file changes                         | SCAN → PLAN → quest-designer → EXECUTE (quest-by-quest) → VERIFY → SUMMARIZE → LEARN                    |
| **Refactor**  | Architectural-level changes                            | SCAN → PLAN → quest-designer → EXECUTE (quest-by-quest) → VERIFY (with adversarial) → SUMMARIZE → LEARN |

AI autonomously determines strategy in SCAN phase by synthesizing task semantics, security sensitivity, architectural impact, not by hardcoded file count or line numbers.

### Loop Mode (orthogonal to strategy)

⚠️ **Current Limitation**: Loop automatic scheduling depends on runtime environment support. If `ScheduleWakeup` is blocked (error: "/loop dynamic runtime gate is off"), system automatically downgrades to single-execution mode.

**Downgrade behavior**:

- Still produces loop-contract.md recording goal
- Executes one complete round of 6 PHASE
- Prompts user for manual continuation if goal not achieved

Loop is a **repetition mode** layered on top of any strategy above, activated by interval parameter in SCAN 1.8. When activated, `/auto` becomes a loop engine that "repeats focused 6 PHASE at intervals until goal converges or budget exhausted":

```
/auto 5m watch CI until all green        → loop + fix strategy
/auto 30m increase test coverage 62%→80% → loop + implement strategy
/auto 2h maintain prod with no P0 alerts → loop + explore strategy (continuous maintenance)
```

- **No loop**: No interval and goal achievable in one shot → Original 6 PHASE single pipeline.
- **Open loop**: Detects interval, or semantics contain continuous-type (watch/patrol/continuous/maintain/keep/autonomous/self-heal) / convergent-type (until/reach/increase to/decrease to/converge + measurable goal) → Activates `loop-engineering` skill, enters DOER + CHECKER loop (see PHASE 1.8 and that skill). Convergent keywords are heuristic triggers, ultimately filtered by skill's "no CHECKER = no loop" hard gate.
- **Core invariant unchanged**: Loop mode still uses `/auto` as single entry, each round internally still standard 6 PHASE, protocol objects still land in `.auto/runs/`.

## Protocol Objects & Phase I/O

`/auto` uniformly consumes and produces the following 5 standard objects (defined in `_shared-principles.md`):

- `RouteDecision` · `QuestMap` · `QuestResult` · `VerifyReport` · `LearnCard`

### PHASE Input / Output Matrix

| Phase       | Primary Input                                                | Standard Output                                                            | Default Persistence Location                                                  |
| ----------- | ------------------------------------------------------------ | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `SCAN`      | User requirements + tech stack + capability list + preflight | `RouteDecision`                                                            | `.auto/runs/<runId>/route-decision.md`                                        |
| `PLAN`      | `RouteDecision` + relevant context + Memory/insights         | `QuestMap`                                                                 | `.auto/runs/<runId>/quest-map.md`                                             |
| `EXECUTE`   | `QuestMap` + upstream output contract                        | `QuestResult`                                                              | `.auto/runs/<runId>/quest-results.md`                                         |
| `VERIFY`    | `QuestResult` list + relevant command output                 | `VerifyReport`                                                             | `.auto/runs/<runId>/verify-report.md`                                         |
| `SUMMARIZE` | `QuestResult` + `VerifyReport`                               | Summary (human-readable)                                                   | `.auto/runs/<runId>/index.md`                                                 |
| `LEARN`     | `QuestResult` + `VerifyReport` + Git patterns                | `LearnCard` list + `session-continuity.md` (only when continuation needed) | `.auto/runs/<runId>/learn-cards.md` + `.auto/insights/*` + `.auto/feedback/*` |

### `.auto/` canonical structure

`cache/` (disposable) | `runs/<runId>/` (single-run source) | `insights/` (long-term knowledge) | `memory/` (project memory) | `feedback/` (structured feedback). See `_shared-principles.md` for path responsibilities.

---

## Core Orchestration Rules

1. **Phase unidirectional flow** — `RouteDecision → QuestMap → QuestResult → VerifyReport → LearnCard`
2. **Quest-level failure control** — Default rollback only affects current Quest touched files, no repository-level global rollback
3. **Default auto-continue** — Continue execution after showing phase summary, unless user explicitly interrupts
4. **Knowledge reuse read-only insights/feedback** — `cache/` not a long-term knowledge source
5. **Result source priority** — Single run writes to `.auto/runs/<runId>/`; cross-run feedback writes to `.auto/feedback/`
6. **Production governance delegation** — Goal convergence, artifact source, run state, cost quality and skill health delegated to `production-governance` skill
7. **Protocol preemptive validation** — `protocol-validator` validates upstream object integrity before Phase handoff, cannot continue if missing key fields
8. **Each round continuable** — Supplement `session-continuity.md` when cross-session needed

Phase hard constraints, protocol headers, object responsibilities detailed in `_shared-principles.md`.

---

## PHASE Conventions

- `SCAN`: Produces `RouteDecision`, decides primary Agent, fallback chain, strategy, sensitivity.
- `PLAN`: Consumes `RouteDecision`, produces `QuestMap`, solidifies Quest decomposition, dependencies, contracts, failure strategies.
- `EXECUTE`: Execute quest-by-quest, produces `QuestResult`, records attempt counts, verification results, failure context.
- `VERIFY`: Consumes `QuestResult`, produces `VerifyReport`, decides whether to continue execution, summarize or terminate.
- `SUMMARIZE`: Aggregates `QuestResult` and `VerifyReport`, does not auto-commit.
- `LEARN`: Consolidates execution and verification results into `LearnCard`, then archives to `.auto/insights/` and `.auto/feedback/`.

---

## Subcommand Relationships

- `/auto:route`: Explicitly outputs `RouteDecision`
- `/auto:doctor`: Provides `preflight` auxiliary information, attached to `RouteDecision.preflight`
- `/auto:status`: Reads `.auto/` canonical structure, shows run history, cache, knowledge and feedback status
- `/auto:dashboard`: Aggregates `.auto/runs/` historical data, shows strategy distribution, gate pass rate, skill activation frequency and long-term trends
- `/auto:learn`: Outputs `LearnCard` view and updates insights/feedback
- `/auto:create-hook`: Generates Hook template recommendations, assists manual completion of configuration
- `quest-designer`: Consumes `RouteDecision`, produces `QuestMap`
- `verification`: Consumes `QuestResult`, produces `VerifyReport`
- `build-error-resolver`: Consumes failure context, outputs fixed `QuestResult` increment

---

## Core Principles

1. **One entry point** — `/auto` completes unified orchestration
2. **Protocol-driven** — Key phases uniformly produce standard objects
3. **Autonomous orchestration** — AI synthesizes capability list, autonomously chooses Agent/Skill scheduling path
4. **Default continuation** — Continue execution after showing summary, unless user explicitly interrupts
5. **Quest atomization** — Each quest has acceptance criteria, failure only does Quest-level rollback
6. **Knowledge loop** — Experience consolidates to memory + insights + feedback, gets stronger with use
7. **Result persistence** — Standard objects write to `.auto/runs/`, cross-session queryable
8. **Write-heavy read-light** — Protocol objects immediately persist, context only keeps handoff summary, forbid accumulating complete JSON
9. **Context engineering** — Right tokens at right time: budget awareness, progressive disclosure, compression downgrade, Subagent isolation (see `context-engineering` skill)

---

**Note**: This is a simplified English version. For complete workflow details, PHASE definitions, and advanced features, refer to the Chinese version `commands/auto.md` which serves as the canonical reference.
