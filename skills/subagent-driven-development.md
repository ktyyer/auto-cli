---
name: subagent-driven-development
description: 子代理驱动开发 - 标准化 Multi-Agent 编排工作流，让复杂任务自动拆分给专用 Agent 并行执行
version: 1.0.0
author: auto-cli
tags: [agent, workflow, parallel, orchestration, multi-agent]
---

# Subagent-Driven Development -- 子代理驱动开发

> 复杂任务不靠一个 Agent 硬扛，而是拆分给专用 Agent 并行执行。本 Skill 定义了
> 4 种标准编排模式和最佳实践，供 quest-designer 和 `/auto` 命令参考。

---

## 适用场景

- 任务涉及多个模块（前端 + 后端 + 数据库）
- 任务包含独立可并行的子任务（如同时编写测试 + 实现代码 + 更新文档）
- 单个 Agent 上下文窗口不足以容纳全部信息
- 任务预估超过 15 个 Quest

---

## 四种编排模式

### 模式 1：Sequential Chain（串行链）

```
Agent A 完成 → 输出传给 → Agent B 完成 → 输出传给 → Agent C
```

**适用**：后一步依赖前一步的输出（如：规划 → 编码 → 测试）

**Auto CLI 对应**：
```
/auto:plan → quest-designer → tdd-guide → code-reviewer
```

**注意**：每一步都要验证上一步的产出。如果上一步失败，立即停止链条。

### 模式 2：Parallel Fan-Out（并行扇出）

```
                → Agent A (独立子任务)
用户意图 → Router → Agent B (独立子任务)
                → Agent C (独立子任务)
```

**适用**：子任务之间无依赖关系（如：同时审查 3 个文件）

**Auto CLI 对应**：
```bash
# 并行启动 3 个专用 Agent
/auto route "安全分析 auth.ts"      # -> security-reviewer
/auto route "编写测试 cache.ts"     # -> tdd-guide
/auto route "检查类型 utils.ts"     # -> code-reviewer
```

**注意**：并行 Agent 不能修改同一文件。如有冲突，需要串行化。

### 模式 3：Orchestrator-Workers（主从模式）

```
Orchestrator（编排者）
  ├── 分析任务，拆分为子任务
  ├── 分配给 Worker Agents
  ├── 收集结果
  └── 整合输出
```

**适用**：复杂任务需要"总指挥"来协调多个 Agent（如：系统重构）

**Auto CLI 对应**：
- Orchestrator = quest-designer（设计 Quest Map）
- Workers = 各专用 Agent（tdd-guide, refactor-cleaner 等）
- PHASE 3 按规模自动选择：单 Agent / Subagent / Teams

**注意**：Orchestrator 不直接执行编码，只做规划和协调。

### 模式 4：Evaluator-Optimizer（评估优化）

```
Generator Agent 产出代码 → Evaluator Agent 审查 → 反馈给 Generator → 迭代优化
```

**适用**：质量要求高的任务（如安全敏感代码、核心算法）

**Auto CLI 对应**：
```
tdd-guide 编写测试 → code-reviewer 审查 → tdd-guide 修复 → 循环直到通过
```

**注意**：设定最大迭代次数（推荐 3 轮），避免无限循环。

---

## 选择决策树

```
任务是否可拆分？
├── 否 → 使用单 Agent（quest-designer）
└── 是 → 子任务之间是否有依赖？
    ├── 有依赖 → Sequential Chain
    └── 无依赖 → 需要总协调者吗？
        ├── 需要 → Orchestrator-Workers
        └── 不需要 → Parallel Fan-Out

质量要求是否特别高？
└── 是 → 在任何模式后追加 Evaluator-Optimizer
```

---

## 最佳实践

### 1. 上下文隔离

每个子 Agent 只接收它需要的上下文，不要把整个项目塞给每个 Agent。

```
# 好的做法：只传相关文件
Agent({ subagent_type: "tdd-guide", prompt: "为 src/auth.js 编写单元测试" })

# 坏的做法：传整个项目
Agent({ subagent_type: "tdd-guide", prompt: "这个项目有 200 个文件...为 auth 写测试" })
```

### 2. 结果聚合

并行 Agent 的结果需要明确聚合策略：

- **Union**：合并所有结果（适用于审查类）
- **Latest Wins**：最后完成的结果覆盖（适用于修复类）
- **Vote**：多数结果胜出（适用于决策类）

### 3. 失败处理

- 单个 Agent 失败不应阻塞整个流程
- 设定超时和重试策略
- 失败结果写入 PHASE 6 知识沉淀

### 4. Quest Map 规模映射

| Quest 数量 | 推荐模式 | 说明 |
|------------|---------|------|
| 1-5 | 单 Agent 串行 | 上下文足够，无需并行 |
| 6-15 | Parallel Fan-Out | 按依赖分组并行 |
| 15+ | Orchestrator-Workers | 需要总协调者管理复杂度 |

---

## 与 Auto CLI 的集成

- `/auto` 命令在 PHASE 2 会参考本 Skill 选择编排模式
- quest-designer 在设计 Quest Map 时可根据任务特征推荐模式
- Canonical Router 的路由决策可参考本 Skill 的模式分类
- PHASE 3 执行时按本 Skill 的规模映射选择执行方式
