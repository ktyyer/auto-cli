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

Three orthogonal dimensions decide how a run executes: **strategy** (what), **assurance level** (how strict verification is: `routine` | `reinforced` | `high-assurance`, upgrade-only — recorded in `RouteDecision.assurance`) and **execution mode** (how organized: single-executor | expert-collaboration | bounded-iteration | continuous-monitoring — recorded in `QuestMap.executionMode`). Fast track compresses orchestration, never acceptance: the evidence loop and applicable gates cannot be skipped.

### Knowledge Governance 2.1

Canonical source: `docs/protocols/knowledge-governance-2.1.md`.
This document consumes governance semantics and must not redefine lifecycle, ranking, retrieval, relationship, or conflict-resolution rules.

### Governance Reference

All retrieval priorities, ranking rules, lifecycle transitions, exclusion rules, planner priorities, and relationship semantics are inherited from `docs/protocols/knowledge-governance-2.1.md`.

### Loop Mode (orthogonal to strategy)

⚠️ **Current Limitation**: Loop automatic scheduling depends on runtime environment support. If `ScheduleWakeup` is blocked (error: "/loop dynamic runtime gate is off"), system automatically downgrades to single-execution mode.

**Downgrade behavior**:

- Still produces loop-contract.md recording goal
- Executes one complete round of 6 PHASE
- Prompts user for manual continuation if goal not achieved

Loop is a **repetition mode** layered on top of any strategy above, activated by interval parameter in SCAN 1.9. When activated, `/auto` becomes a loop engine that "repeats focused 6 PHASE at intervals until goal converges or budget exhausted":

```
/auto 5m watch CI until all green        → loop + fix strategy
/auto 30m increase test coverage 62%→80% → loop + implement strategy
/auto 2h maintain prod with no P0 alerts → loop + explore strategy (continuous maintenance)
```

- **No loop**: No interval and goal achievable in one shot → Original 6 PHASE single pipeline.
- **Open loop**: Detects interval, or semantics contain continuous-type (watch/patrol/continuous/maintain/keep/autonomous/self-heal) / convergent-type (until/reach/increase to/decrease to/converge + measurable goal) → Activates `loop-engineering` skill, enters DOER + CHECKER loop (see PHASE 1.9 and that skill). Convergent keywords are heuristic triggers, ultimately filtered by skill's "no CHECKER = no loop" hard gate.
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

1. **Phase forward-first with controlled backflow** — Main line `RouteDecision → QuestMap → QuestResult → VerifyReport → LearnCard`; legal backflows only: EXECUTE→PLAN (scope materially changed), VERIFY→EXECUTE (defect localized), VERIFY→PLAN (contract missing), each recorded with reason while keeping produced evidence
2. **Quest-level failure control** — Default rollback only reverts changes owned by the current Quest; files also containing out-of-task edits or unclear ownership are preserved and reported, no repository-level global rollback
3. **Default auto-continue** — Continue execution after showing phase summary, unless user explicitly interrupts
4. **Knowledge reuse read-only insights/feedback** — `cache/` not a long-term knowledge source
5. **Result source priority** — Single run writes to `.auto/runs/<runId>/`; cross-run feedback writes to `.auto/feedback/`
6. **Production governance delegation** — Goal convergence, artifact source, run state, cost quality and skill health delegated to `production-governance` skill
7. **Protocol preemptive validation** — `protocol-validator` validates upstream object integrity before Phase handoff, cannot continue if missing key fields
8. **Each round continuable** — Supplement `session-continuity.md` when cross-session needed

Phase hard constraints, protocol headers, object responsibilities detailed in `_shared-principles.md`.

---

## PHASE Conventions

- `SCAN`: Produces `RouteDecision`, decides primary Agent, fallback chain, strategy, assurance level, execution mode, sensitivity; records the untruncated workspace baseline and host capability status in `RouteDecision.notes` (workspace protection: pre-existing uncommitted edits are immutable inputs — never overwritten, reverted or mixed in).
- `PLAN`: Consumes `RouteDecision`, produces `QuestMap`, solidifies Quest decomposition, dependencies, contracts, failure strategies. Implement/refactor strategies must solidify a business contract (`businessContract`: restatement, invariants, independent evidence refs, open assumptions) and a quality contract (acceptance stated as observable business behavior, independent of implementation).
- `EXECUTE`: Execute quest-by-quest, produces `QuestResult`, records attempt counts, verification results, failure context. Implement/fix quests default to the evidence-first loop: confirm real symbols and the project's actual test commands → capture failing output (bug) or write a minimal failing test (feature) → minimal edit → immediately run relevant tests; two consecutive no-progress attempts switch to `agentless-repair`. Before writing, lock onto team conventions: read 2-3 sibling files plus lint/formatter configs and mimic existing naming, error-handling and comment style (project config overrides any default rules); comments explain WHY and edge cases, public APIs must be documented. For business-logic changes, bind acceptance to an independent business source and version (confirmed requirements, formal contracts or trusted domain examples); label model-derived rules as assumptions, and do not mark unresolved business assumptions as verified. First restate the business effect and its invariants, locate the domain source of truth along the call chain, and mutation-check at least one key business assertion (break one line, the test must turn red; then restore and re-run to confirm green, keeping both outputs as evidence — if it stays green, confirm the mutation changes the intended behavior before diagnosing the test gap; mutation sensitivity does not establish business correctness).
- `VERIFY`: Consumes `QuestResult`, produces `VerifyReport`, decides whether to continue execution, summarize or terminate. Verification conclusions organize into three evidence chains: **A** — the change matches business intent (against an independent business source, not the implementation's self-description); **B** — the implementation matches expectations (acceptance + build/test/lint/review); **C** — the verification itself can detect errors (mutation spot-check in an isolated copy, adversarial probes, test-discovery check). Exit code 0 alone is insufficient; any verification claim must cite the actual command, output and exit code — a gate without measured output can only be `skipped`, never `pass`.
- `SUMMARIZE`: Five parts, mandatory for both success and failure: behavior change (business language), actual changes (files + line counts, command-measured), verification results (one conclusion per evidence chain + evidence pointers), residual risks, delivery status (`pass` / `partial` / `blocked`). Does not auto-commit.
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
2. **Business-driven** — Code changes carry business evidence, independent acceptance and verification, delivered to enterprise-grade standards (global execution contract)
3. **Protocol-driven** — Key phases uniformly produce standard objects
4. **Autonomous but bounded** — AI synthesizes capability list, autonomously chooses Agent/Skill scheduling path; operations outside the authorization boundary always ask first
5. **Default continuation** — Continue execution after showing summary, unless user explicitly interrupts
6. **Quest atomization** — Each quest has acceptance criteria, failure only rolls back owned Quest-level changes
7. **Knowledge loop** — Experience consolidates to memory + insights + feedback, gets stronger with use
8. **Result persistence** — Standard objects write to `.auto/runs/`, cross-session queryable
9. **Write-heavy read-light** — Protocol objects immediately persist, context only keeps handoff summary, forbid accumulating complete JSON
10. **Context engineering** — Right tokens at right time: budget awareness, progressive disclosure, compression downgrade, Subagent isolation (see `context-engineering` skill)

---

**Note**: This is a simplified English version. For complete workflow details, PHASE definitions, and advanced features, refer to the Chinese version `commands/auto.md` which serves as the canonical reference.

New run protocol objects use JSON (raw JSON or fenced `json` blocks; result/learning lists may be arrays), following `protocol-validator`. Legacy Markdown receives only a labeled limited check. Missing observations remain null; the dashboard and metrics generator share the protocol collector. Scheduler selection depends on tools actually exposed by the current host and their lifecycle, not the host name alone.
