---
name: self-critique
description: 当 run 自纠机制 — 每个 Quest 完成后强制自我评审（Reflexion 模式），产出达成度评分 / 盲点清单 / 是否回退 PLAN 的判定，避免「功能做了但偏离主线」「换形式满足用户」的隐性偏移。补 LEARN（跨 run 沉淀）的盲区：当下自纠。
tags:
  [self-critique, reflexion, self-refine, execute-phase, verify-phase, quality-gate, methodology]
---

# Self-Critique — 当 run 自纠

> 借鉴 [Reflexion](https://www.promptingguide.ai/techniques/reflexion) 与 Self-Refine 经典方法论。
> 核心原则：**LEARN 是事后跨 run 沉淀，self-critique 是当下当 run 自纠**。两者互补，缺一不可。

## 激活摘要

**何时激活**：

- 策略 = `实现` 或 `重构`（多关任务、Quest ≥ 2）
- 用户希望「每关完成就验一遍」「避免最后一起发现漂移」
- 项目 VERIFY 已挂 13 个 gate 仍漏掉「主线偏移」类问题

**检查清单（每关执行）**：

1. 本关 `objective` 是否被本关 diff **真满足**（不是换形式、不是半满足）？
2. 本关有无引入「用户原话里没有」的内容？（参考 Touch-set Lock + Expansion-Word Stop）
3. 本关测试是否覆盖了"如果用户用最丑陋的输入怎么办"？
4. 本关是否引入了 outOfScope 清单上的内容？

**输出模板**（写入 `.auto/runs/<runId>/quest-<N>-critique.md`）：

```markdown
# Quest <N> Self-Critique

- **objective**: <复述本关目标>
- **diff 反向翻译**: <用 ≤ 3 句话把 diff 描述成需求>
- **达成度评分**: 0-100 (100 = 完全满足 objective，0 = 完全偏离)
- **盲点**:
  1. <盲点 1>
  2. <盲点 2>
- **建议**:
  - [ ] 继续下一关
  - [ ] 修补当前关（列出补丁要点）
  - [ ] 回退 PLAN（说明哪条假设需要重做）
```

**强制约束**：

- 达成度 < 70 → 必须回流 PLAN 或修补，禁止直接进入下一关
- 盲点列表为空时必须主动补 1 条「最不放心的事」— 永远有可改进点
- critique 文件必须落盘到 `.auto/runs/<runId>/`，不得仅在上下文存在

**反模式（禁止）**：

- 写 critique 时复制 QuestResult 的内容（critique 必须是独立视角的再评）
- 给自己打 100 分（强制要求"最不放心的事"避免自满）
- 把 critique 当装饰，不影响后续动作（critique 必须有 actionable 输出）

## 与 PHASE 4 gate 的关系

**新增第 14 个 gate**：`self-critique`

| 字段     | 内容                                             |
| -------- | ------------------------------------------------ |
| 触发策略 | 实现、重构（修复策略可选）                       |
| 触发时机 | EXECUTE 每关完成后立即触发（不是最后统一）       |
| 通过条件 | 所有 Quest 的 critique 达成度 ≥ 70，且无遗漏盲点 |
| 失败处置 | 回流 PLAN 修订 QuestMap，或修补当前关            |

**与现有 gate 的差异**：

| Gate                           | 关注点                       | 视角             |
| ------------------------------ | ---------------------------- | ---------------- |
| skill-activation               | 激活 skill 是否被应用        | 流程合规         |
| knowledge-reuse                | insights 是否被复用          | 知识闭环         |
| self-verification (Claude 4.7) | 代码语法/逻辑/边界           | 代码质量         |
| **self-critique**              | **本关是否真满足 objective** | **主线漂移防范** |
| knowledge-distribution         | LearnCard 分发是否完成       | 沉淀闭环         |

self-verification 是 Claude 4.7 模型能力（自动检查代码），**self-critique 是 Quest 级语义检查**，两者关注层次不同。

## 何时不用

- 修复策略且单关（< 20 行变更，快速通道直接跳过）
- 探索策略（无代码变更，主线漂移风险低）
- 用户显式禁用（`--no-critique`）

## 实施位置

PHASE 3.3 QuestResult 落盘后，每关追加：

```
触发 self-critique skill → 产出 .auto/runs/<runId>/quest-<N>-critique.md
读取 critique → 决定下一动作：next / patch / replan
```

VERIFY taxonomy 应加入 `self-critique`，实现/重构策略的最少 gate 列表包含此项。

## 参考

- [Reflexion 方法论](https://www.promptingguide.ai/techniques/reflexion)
- Self-Refine: [arXiv 2303.17651](https://arxiv.org/abs/2303.17651)
- auto-cli 内部 LearnCard：`.auto/runs/run-20260524-external-research/learn-cards.md` #5
