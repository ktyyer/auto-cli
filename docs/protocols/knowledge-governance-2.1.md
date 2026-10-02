# Knowledge Governance 2.1 Canonical Contract

Status: Canonical / SSOT
Scope: Claude + Codex + Skills + Validators + Planners + Retrieval
Authority: Protocol-level contract

## Purpose

This document is the single source of truth for Knowledge Governance 2.1.

Any governance consumer MUST reference this contract and MUST NOT redefine governance semantics independently.

Consumers include:

- commands/auto.md
- commands/auto.en.md
- commands/auto.codex.md
- commands/auto/learn.md
- commands/auto/learn.codex.md
- agents/_shared-principles.md
- skills/knowledge-management/SKILL.md
- skills/protocol-validator/SKILL.md
- skills/quality-gates/SKILL.md

---

## Field Enumerations

Governance fields on knowledge objects (LearnCard and insight entries):

- `confidence`: `low | medium | high`
- `insightScore`: integer 0-100, computed from the Insight Score formula above
- `lifecycleStatus`: one of the five lifecycle states
- `evidenceStrength`: `weak | medium | strong`
- `supersedes`: array of superseded knowledge ids (may be empty)

Decay markers (line-end annotations on insight entries, not separate states):

- `**状态**: archived | merged | outdated | harmful`
- All decay markers are lifecycle-archival annotations; their semantics are defined by this contract's Lifecycle and Retrieval Governance sections.

---

## Insight Score

InsightScore =

- Confidence (40%)
- Freshness (25%)
- Usage Feedback (20%)
- Validation Feedback (15%)

Purpose:

- Retrieval ranking
- Planner prioritization
- Knowledge lifecycle decisions

---

## Lifecycle

Allowed states:

candidate → active → validated → superseded → archived

Rules:

- New knowledge starts as candidate.
- Runtime reuse promotes candidate to active.
- Repeated successful validation promotes active to validated.
- Replacement by a newer conclusion promotes to superseded.
- Long-term decay promotes to archived.

---

## Relationship Graph

Allowed relations:

- supports
- conflicts
- supersedes
- depends-on

Rules:

- relations must be explicit.
- conflicts require a recorded resolution.
- supersedes chains must be acyclic.
- superseded knowledge cannot supersede back.

---

## Conflict Resolution

When conflicting conclusions exist:

1. Preserve the newest authoritative conclusion.
2. Mark replaced knowledge as superseded.
3. Create an explicit supersedes relationship.
4. Record conflict resolution outcome.
5. Silent coexistence is forbidden.

---

## Retrieval Governance

Default ranking:

Ranking =
InsightScore +
ScopeMatch +
RecencyBoost +
RunSimilarity

Default retrieval priority:

1. validated patterns
2. validated decisions
3. high-score insights
4. harmful traps

Excluded by default:

- entries with lifecycleStatus `superseded` or `archived`
- entries carrying a decay marker (`**状态**: archived | merged | outdated | harmful`)

Decay-marked entries have `confidence` downgraded by one level and are injected only on strong hit (all tags matched); they never participate in default ranking.

---

## Planner Feedback Loop

SCAN and PLAN prioritize:

- validated patterns
- validated decisions
- high-score insights
- harmful traps

---

## Claude/Codex Parity

Governance semantics are implementation-independent.

Claude and Codex MUST share:

- lifecycle rules
- scoring model
- relationship graph
- retrieval rules
- planner rules
- conflict-resolution rules

No platform-specific governance variants are allowed.

---

## Validator Requirements

Validators must enforce:

- insightScore
- lifecycleStatus
- evidenceStrength
- relationship integrity
- conflict-resolution presence
- retrieval exclusion rules

---

## Amendment Rule

Governance semantics may only be changed here first.

All consumers inherit semantics from this contract.

Consumer documents may summarize or reference the contract but must not become competing sources of truth.
