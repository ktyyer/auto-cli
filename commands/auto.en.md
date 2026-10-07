---
name: auto
description: Turn a task into a grounded plan, focused edits, execution evidence, and reusable project knowledge
---

# /auto — task and evidence workflow

SCAN → PLAN → EXECUTE → VERIFY → SUMMARIZE → LEARN.
This is the English Claude entry; Codex uses auto.codex.md. /auto remains the single orchestration entry.

## Load once, then follow the current phase

Resolve production-governance/references/ under this repository's skills/ or the installed host's skills/ directory.
Read workflow-contract.md once. Read only the current section of workflow-phases.md when needed; host-adapters.md defines installed paths and support boundaries.
These shared documents are the semantic source of truth, not another runtime. If missing, report an incomplete installation.

Show a short RouteDecision and Plan before deep inspection or edits. Include strategy, complexity, relevant skills, gates, intended files and checks.
Keep the original request and existing authorization. Inspect project instructions, business sources, available tools, full Git baseline and existing failures.
Create the minimum run artifacts when .auto exists. Small tasks use small plans; relevant verification still applies.

## Execute the contract

- Choose explore / fix / implement / refactor; record assurance separately. Default to one executor and delegate only when authorized and useful.
- Define independent acceptance and invariants before implementation. Preserve existing edits and record necessary scope expansion.
- Resolve ordinary choices from context; ask only about consequential missing information. Do not repeatedly request permission for authorized reversible steps.
- Locate the real code, preserve failure evidence, make focused edits and run appropriate checks. Legitimate test changes are allowed; weakened acceptance needs review.
- Verify the business expectation, implementation behavior, and sensitivity of checks separately. Mutation success does not prove the expectation correct.
- Bind evidence to the final artifact state. Empty tests, all-skipped runs, stale logs, self-scores and a bare zero exit code cannot establish success.
- Model-writable evidence is local consistency, not trusted attestation. Independent execution and acceptance require an actual separate trust boundary.
- Report failures and missing validation honestly. Never force an endless Stop loop to obtain a success claim.
- Activate reflection when evidence indicates failure, drift or consequential uncertainty; do not invent blind spots or require a score for every task.

## Host and delivery

Use actual tool schemas, versions and permissions. Do not copy Claude hook assumptions into Codex.
“Continue until done” means finish the active task. Load loop-engineering only for an explicit interval or ongoing monitoring; never invent budget authorization or a persistent task.
Retain risk-relevant capacity checks, independent verification, protocol validation and knowledge distribution as defined by the shared workflow.
Report behavior, changed files, actual checks, remaining uncertainty and delivery status. Write run artifacts and only evidence-backed lessons.
Do not auto-commit or publish. Finish already authorized installation or deployment steps after validation.
