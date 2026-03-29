---
name: agentic-workflow-patterns
description: Agentic 工作流模式 - 6 种经典 Multi-Agent 编排模式的定义、适用场景和实现参考
version: 1.0.0
author: auto-cli
tags: [agent, workflow, patterns, orchestration, multi-agent, chaining, routing]
---

# Agentic Workflow Patterns -- 工作流模式参考

> 将 Multi-Agent 编排中的常见模式标准化，为 quest-designer 提供设计参考。
> 灵感来源：Anthropic 的 Agentic Workflow Patterns 和开源社区最佳实践。

---

## 模式总览

| # | 模式 | 适用场景 | 复杂度 | Agent 数 |
|---|------|---------|--------|---------|
| 1 | Baseline（单 Agent） | 简单任务 | 低 | 1 |
| 2 | Chaining（链式） | 流水线式任务 | 中 | 2-5 |
| 3 | Routing（路由） | 意图分派 | 中 | 1+N |
| 4 | Parallelization（并行） | 无依赖子任务 | 中 | 2-N |
| 5 | Orchestrator-Workers（主从） | 复杂分解 | 高 | 1+N |
| 6 | Evaluator-Optimizer（评估优化） | 质量迭代 | 高 | 2 |

---

## 模式 1：Baseline（单 Agent）

```
用户 → Agent → 结果
```

**定义**：所有工作由单个 Agent 完成，无编排开销。

**适用**：
- 任务明确、步骤少（<5 步）
- 上下文窗口足够容纳所有信息
- 不需要多视角分析

**Auto CLI 实现方式**：
- quest-designer 直接产出 Quest Map，单 Agent 串行执行
- 典型命令：`/auto 修复登录按钮的样式问题`

**优点**：简单、无通信开销、上下文完整
**缺点**：复杂任务容易丢失细节、无法并行加速

---

## 模式 2：Chaining（链式）

```
Agent A → [输出作为输入] → Agent B → [输出作为输入] → Agent C
```

**定义**：多个 Agent 串行执行，前一个的输出是后一个的输入。

**适用**：
- 任务有明确的阶段划分
- 后一阶段依赖前一阶段的产出
- 每个阶段需要不同的专业能力

**Auto CLI 实现方式**：
```
PHASE 2: quest-designer（规划）
    ↓ Quest Map
PHASE 3: tdd-guide（编码+测试）
    ↓ 测试结果
PHASE 4: code-reviewer（审查）
    ↓ 审查报告
PHASE 5: doc-updater（文档更新）
```

**优点**：流程清晰、每步有验证点、失败可精确定位
**缺点**：总耗时 = 各阶段之和、某阶段阻塞会延迟全局

---

## 模式 3：Routing（路由）

```
用户意图 → Router → 匹配最合适的 Agent → 执行
```

**定义**：一个中心路由器根据意图分析，将任务分派给最合适的 Agent。

**适用**：
- 用户意图多样，需要不同专业 Agent 处理
- 需要自动选择而非手动指定 Agent
- 有回退机制应对无精确匹配的情况

**Auto CLI 实现方式**：
```
用户输入 → CanonicalRouter.route(intent)
    → 关键词匹配 + 优先级排序 + 安全优先
    → 推荐最合适的 Agent + 回退链
```

**优点**：用户体验好（无需知道用哪个 Agent）、有回退保障
**缺点**：路由准确度依赖关键词匹配质量

---

## 模式 4：Parallelization（并行）

```
         → Agent A
用户意图 → Agent B → 聚合结果
         → Agent C
```

**定义**：多个 Agent 同时执行独立子任务，最后聚合结果。

**适用**：
- 子任务之间无数据依赖
- 需要加速执行（并行 < 串行耗时）
- 每个子任务需要不同视角

**Auto CLI 实现方式**：
```bash
# 并行启动 3 个审查 Agent
# 1. 安全审查
Agent({ subagent_type: "security-reviewer" })
# 2. 代码质量审查
Agent({ subagent_type: "code-reviewer" })
# 3. 测试覆盖率审查
Agent({ subagent_type: "tdd-guide" })
```

**优点**：执行速度快、多视角分析
**缺点**：需要确保子任务无冲突（不能修改同一文件）

---

## 模式 5：Orchestrator-Workers（主从）

```
Orchestrator（编排者）
  ├── 分析任务，拆分子任务
  ├── 分配给 Worker Agent A
  ├── 分配给 Worker Agent B
  ├── 收集结果，处理冲突
  └── 整合最终输出
```

**定义**：一个主 Agent 负责任务分解、分配和整合，多个 Worker Agent 执行具体工作。

**适用**：
- 任务复杂，需要"总指挥"协调
- 子任务有复杂依赖关系
- 需要根据中间结果动态调整后续任务

**Auto CLI 实现方式**：
- Orchestrator = quest-designer（PHASE 2 产出 Quest Map）
- Workers = 各专用 Agent（PHASE 3 按依赖分组执行）
- 15+ Quest 自动切换到 Agent Teams 模式

**优点**：处理复杂度高、可动态调整
**缺点**：Orchestrator 本身成为瓶颈、通信开销大

---

## 模式 6：Evaluator-Optimizer（评估优化）

```
Generator Agent → 产出代码
    ↓
Evaluator Agent → 审查 + 反馈
    ↓
Generator Agent → 根据反馈优化
    ↓（循环直到 Evaluator 通过）
最终输出
```

**定义**：一个 Agent 生成产出，另一个 Agent 评估质量并给出改进建议，循环迭代直到质量达标。

**适用**：
- 质量要求高（安全代码、核心算法、API 设计）
- 有明确的质量标准可评估
- 初次产出可能不完美但可迭代改进

**Auto CLI 实现方式**：
```
Round 1: tdd-guide 编写测试 → code-reviewer 审查 → 反馈
Round 2: tdd-guide 根据反馈修改 → code-reviewer 复审 → 反馈
Round 3: tdd-guide 最终修改 → code-reviewer 通过 → 完成
```

**优点**：质量有保障、自动迭代优化
**缺点**：耗时较长（多轮循环）、需设定最大迭代次数

---

## 模式选择指南

```
开始
  │
  ├─ 任务简单（<5 步）？ ──→ Baseline
  │
  ├─ 需要选不同的 Agent？ ──→ Routing
  │
  ├─ 任务可并行分解？ ──→ Parallelization
  │
  ├─ 有复杂依赖关系？ ──→ Orchestrator-Workers
  │
  ├─ 有明确阶段划分？ ──→ Chaining
  │
  └─ 质量要求极高？ ──→ Evaluator-Optimizer
```

---

## 与 Auto CLI 的集成

- **quest-designer**：在 PHASE 2 设计时参考本 Skill 选择编排模式
- **Canonical Router**：实现了模式 3（Routing）的具体实例
- **/auto 命令**：PHASE 3 按规模自动选择执行模式（Baseline / Parallelization / Orchestrator-Workers）
- **PHASE 4 VERIFY**：实现了模式 6（Evaluator-Optimizer）的简化版（构建 → 测试 → 安全扫描 → 迭代修复）
