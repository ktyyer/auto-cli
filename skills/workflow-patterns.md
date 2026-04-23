---
name: workflow-patterns
description: 开发工作流编排方法论 — 选择正确的 Plan Mode 工作流（explore/fix/implement/refactor）、Multi-Agent 编排模式（串行链/并行扇出/主从/评估优化）、根因追踪五步法、10 维度代码审查清单。适用于所有 /auto 任务的 PHASE 1 路由和 PHASE 2 Quest 设计阶段。当用户提到 bug 修复、代码审查、性能优化、新功能实现、架构重构、multi-agent 协作、代码质量审查时，必须加载此 skill。
tags:
  [
    workflow,
    plan-mode,
    orchestration,
    root-cause,
    debugging,
    patterns,
    agent,
    parallel,
    troubleshooting,
    review,
    checklist,
    quality,
    self-correction,
    verification
  ]
---

# Workflow Patterns — 开发工作流模式集合

> 四大核心方法论合一：Plan Mode 工作流选择、Multi-Agent 编排模式、结构化根因追踪、10 维度代码审查清单。
> 让 quest-designer 在 PHASE 2 自动匹配最优工作流。

## 快速使用

```
/auto:route 审查这个模块的代码质量    → explore 工作流
/auto:route 修复登录页白屏 bug       → fix 工作流
/auto:route 用 React 实现搜索组件    → implement 工作流
/auto:route 把 Redux 迁移到 Zustand  → refactor 工作流
```

---

## 一、Plan Mode 工作流（4 种）

### 工作流选择决策

> 这里的工作流名称直接对应 canonical `RouteDecision.strategy`：`explore | fix | implement | refactor`。

| 信号关键词                   | 工作流      | 上下文预算               |
| ---------------------------- | ----------- | ------------------------ |
| 审查/review/检查/安全/质量   | `explore`   | 3-6 文件, 1000-2000 行   |
| bug/错误/失败/error/fix/修复 | `fix`       | 3-5 文件, 500-1500 行    |
| 实现/开发/新增/功能/feature  | `implement` | 5-8 文件, 1500-3000 行   |
| 重构/迁移/架构/系统/redesign | `refactor`  | 10-15 文件, 3000-5000 行 |

### 自动检测逻辑

```
用户意图 -> 关键词匹配:
  +--- [审查|review|检查|安全|质量|PR|咨询|分析] -> explore
  +--- [bug|错误|失败|error|fix|修复|异常|debug] -> fix
  +--- [实现|开发|新增|功能|feature|创建|接口] -> implement
  +--- [重构|迁移|全面|架构|系统|microservice] -> refactor
  +--- 无匹配 -> 默认 implement
```

### 与 Auto CLI 对应

| 工作流      | PHASE 1              | quest-designer                       | Canonical Router                     |
| ----------- | -------------------- | ------------------------------------ | ------------------------------------ |
| `explore`   | 完整扫描（不用缓存） | 可跳过，由主窗口生成最小 `QuestMap`  | 默认 direct analysis / code-reviewer |
| `fix`       | 最小化               | 可跳过，先走 direct / tdd-guide 修复 | 默认 direct / tdd-guide              |
| `implement` | 缓存优先             | 读取 5-8 文件                        | 默认 quest-designer                  |
| `refactor`  | 完整扫描（深度）     | 读取 10-15 文件                      | 默认 quest-designer                  |

> 注：本 Skill 的工作流选择逻辑由 `/auto:route` 的 `RouteDecision` 复杂度与策略判定承接，此处保留为设计参考和人类可读文档。

---

## 二、按需加载：详细参考文档

### Multi-Agent 编排模式

完整决策树、4 种模式详解、最佳实践、Agent 交接规则：
→ 读取 `workflow-patterns.references/multi-agent.md`

### 根因追踪方法论

快速参考（五步流程、常见根因模式）：
→ 读取 `workflow-patterns.references/root-cause.md`

完整调试方法论（4 阶段强制流程、铁律约束、假说验证）：
→ 加载 `systematic-debugging` skill

### 10 维度代码审查清单

完整 10 维度审查项、精简版 5 维度、自动化建议：
→ 读取 `workflow-patterns.references/review-checklist.md`

---

## 三、与 auto-cli 集成

| 注入时机 | Skill                               | 条件                                 |
| -------- | ----------------------------------- | ------------------------------------ |
| SCAN     | dependency-analyzer, init-project   | 如 CLAUDE.md 缺失则触发 init-project |
| PLAN     | workflow-patterns                   | Quest 设计参考                       |
| EXECUTE  | 按编排计划声明                      | Skill 内容写入 Agent prompt          |
| VERIFY   | code-style-enforcer, error-patterns | code-reviewer/verification 自动附带  |

| 技术栈   | 自动关联 Skill       |
| -------- | -------------------- |
| Java     | java-patterns        |
| 性能相关 | performance-patterns |
| 错误处理 | error-patterns       |

---

## 使用时机

**必须加载**（PHASE 1 SCAN 和 PHASE 2 PLAN）：

- 任意 /auto 任务的路由决策阶段
- quest-designer 生成 QuestMap 之前
- code-reviewer 执行代码审查前

**按需加载**（具体方法论）：

- Bug 修复 → 加载 `systematic-debugging` skill（深度调试）或根因追踪五步法（快速定位）
- 多 Agent 协作任务 → 加载 Multi-Agent 编排模式
- 代码审查 → 加载 10 维度审查清单

## 验收标准

- [ ] 每次 /auto 任务的 PHASE 1 输出包含 `RouteDecision.strategy`（explore/fix/implement/refactor 之一）
- [ ] 每次 /auto 任务的 PHASE 2 QuestMap 包含对应的 Quest 数量（1-5/6-15/15+）
- [ ] 每次 Bug 修复任务执行了根因追踪五步法中的至少三步
- [ ] 每次代码审查覆盖了精简版清单的 5 个核心维度

## 来源

- Claude Code 官方文档：Plan Mode 四种工作流
- Andrew Ng "AI Agent Design Patterns"：Reflection、Multi-Agent
- linux.do 社区验证数据
- Vibe Coding 实战策略
- 社区实测：AI 自我审查降低 60% Bug 率
