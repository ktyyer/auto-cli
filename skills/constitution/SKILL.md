---
name: constitution
description: 项目级非协商原则文件 — 当用户希望为项目沉淀「无论何种情况都不可违反」的硬约束（如「禁止引入运行时依赖」「禁止破坏单一入口」「测试覆盖率不低于 80%」），或现有 CLAUDE.md 已过度膨胀需要硬约束分层时使用。SCAN 自动检测 `.auto/constitution.md` 并在 PLAN/EXECUTE/VERIFY 三 phase 注入为硬约束。
tags: [constitution, hard-constraints, scan-phase, plan-phase, verify-phase, governance, spec-kit]
---

# Constitution — 项目级非协商原则

> 借鉴 [GitHub Spec Kit](https://github.com/github/spec-kit) 的 Constitution 机制。
> 核心原则：**CLAUDE.md 是软约束（指导），constitution.md 是硬约束（违反即阻断）**。

## 激活摘要

**何时激活**：

- SCAN 阶段检测到项目根目录存在 `.auto/constitution.md` → 自动激活
- 用户显式说「为项目立法」「定个不能违反的原则」→ 主动激活
- 项目 CLAUDE.md 超过 200 行且混入了多种约束（指导 + 硬规则）→ 建议分层激活

**检查清单（PLAN/EXECUTE/VERIFY 注入）**：

1. 每条 constitution 是否仍被本 run 的方案遵循？逐条列出"本 run 如何满足"
2. 是否引入了违反 constitution 的依赖、入口、抽象？
3. constitution 是否需要因本次需求更新？需要则先停下让用户决定，不偷偷改

**强制约束（不可妥协）**：

- constitution 是「非协商的」— 任何 Quest 触碰其底线即 VERIFY 报 fail，回流 PLAN
- 不要在没有用户授权时修改 `.auto/constitution.md`
- constitution 写完即生效，禁止在 QuestMap.outOfScope 里偷偷绕开

**反模式（禁止）**：

- 把 constitution 写成"建议"或"应该"，正确写法是"必须 / 禁止 / 不可"
- 把可调整的偏好（如代码风格细节、命名约定）塞进 constitution — 那是 CLAUDE.md 的事
- constitution 超过 30 行 — 它是宪法不是字典，必须极简

**输出模板**（首次为项目立法时产出 `.auto/constitution.md`）：

```markdown
# Project Constitution

> 本文件定义项目级非协商原则。违反任何一条都将触发 VERIFY 失败并回流 PLAN。
> 修订需用户明确授权。AI 不得自行变更。

## Article I — 架构不变量

1. 单一入口：用户唯一交互入口是 `<x>`，不引入并列入口。
2. 运行时禁令：项目纯 `<x>` 实现，不引入需运行时进程的依赖（Node/Python/Docker server 等）。

## Article II — 质量底线

1. 测试覆盖率不低于 `<x>%`。
2. 所有变更必须满足现有 13 个 gate。

## Article III — 范围纪律

1. 不在用户未授权时引入新依赖、新 agent、新 skill。
2. 「最小 diff」是默认行为，扩张需显式声明 `scope-expand`。
```

## 详细机制

### SCAN 自动检测

PHASE 1 SCAN 1.1 应额外执行：

```text
Glob(".auto/constitution.md") → 如存在则 Read 全文，并以 priority=critical 注入 RouteDecision.notes 的 constitution 字段
```

### PLAN 注入

PHASE 2 PLAN 2.1 知识检索后，将 constitution 全文以 `[CONSTITUTION]` 标签注入到 QuestMap.constraints 字段（区别于 pitfalls / knowledgeHints）。

每张 Quest 的 acceptance 必须在 QuestResult.validations 中显式声明「constitution-compliance: pass」。

### EXECUTE 持续约束

EXECUTE 内每关执行前自检：本关变更可能违反哪条 constitution 条款？命中即写 `[constitution-risk]` 到 QuestResult.notes 并暂停决策。

### VERIFY 新增 gate（可选 — v0.44 候选）

```
constitution-compliance:
  - pass: 所有 Quest 均无 constitution-risk 记录
  - warning: 命中 1-2 条但已修正
  - fail: 至少一条 critical 条款被违反 → 阻断 SUMMARIZE，回流 PLAN
```

## 与现有能力的关系

| 能力                        | 区别                                              |
| --------------------------- | ------------------------------------------------- |
| CLAUDE.md                   | 软约束 / 指导 / 偏好 / 可视情况调整               |
| **constitution.md**         | **硬约束 / 非协商 / 违反即阻断 / 需用户授权修改** |
| QuestMap.outOfScope         | 单 run 范围声明 / 临时                            |
| .auto/insights/decisions.md | 历史决策记录 / 可被新决策覆盖                     |

## 何时不用 constitution

- 项目还在快速原型阶段，约束未稳定
- 用户拒绝引入分层约束体系
- CLAUDE.md 已足够简洁（< 100 行）且无硬规则需要单独突出

## 参考

- [GitHub Spec Kit Documentation](https://github.github.com/spec-kit/)
- auto-cli 内部讨论：`.auto/runs/run-20260524-external-research/learn-cards.md` #1
