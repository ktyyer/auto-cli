---
name: workflow-patterns
description: 开发工作流编排方法论 — 在策略、依赖或协作方式存在真实取舍时，按需选择 explore/fix/implement/refactor、编排模式、根因追踪和审查方法；以共享执行契约、当前授权与宿主能力为准。
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
> 由当前执行者依据任务选择工作流；默认单执行者，角色名称不代表实际已调用的 agent。

## 快速使用

```
/auto:route 审查这个模块的代码质量    → explore 工作流
/auto:route 修复登录页白屏 bug       → fix 工作流
/auto:route 用 React 实现搜索组件    → implement 工作流
/auto:route 把 Redux 迁移到 Zustand  → refactor 工作流
```

---

## 激活摘要 (Activation Digest)

**检查清单** (checklist):

- [ ] 判定工作流: explore(审查/分析) | fix(bug修复) | implement(新功能) | refactor(架构变更)
- [ ] 选择编排模式: 串行链(有依赖) | 并行扇出(独立任务) | 主从(复杂协调) | 评估优化(质量优先)
- [ ] Bug 修复: 走根因追踪五步法 (症状→日志→范围→假设→验证)
- [ ] 代码审查: 覆盖 10 维度(正确性/安全/性能/可读性/测试/错误处理/并发/依赖/日志/配置)
- [ ] 生产级任务: 声明 Goal State / Evidence / Exit Criteria，并激活 `production-governance`

**硬约束** (constraints):

- 重构先形成可验证计划；由当前执行者完成，存在已授权的独立任务时才委派
- 交接按依赖执行；失败证据可受控回流 PLAN 或 EXECUTE，并保留原因
- 安全敏感场景必须做对应安全审查；是否委派取决于授权、能力和独立审查收益
- 多 Agent 或多 Quest 只表达依赖与交接，不引入运行时调度器

**输出模板** (output):

- 工作流 → 编排模式 → Agent 调度计划 → Skill 注入 → 交接路径

**反模式** (anti-patterns):

- 小改动用重构策略 → 过度工程
- 有依赖的任务用并行 → 数据不一致

---

## 一、Plan Mode 工作流（4 种）

### 工作流选择决策

> 这里的工作流名称直接对应 canonical `RouteDecision.strategy`：`explore | fix | implement | refactor`。

| 信号关键词                   | 工作流      | 初始定位参考（非读取配额） |
| ---------------------------- | ----------- | -------------------------- |
| 审查/review/检查/安全/质量   | `explore`   | 3-6 文件, 1000-2000 行     |
| bug/错误/失败/error/fix/修复 | `fix`       | 3-5 文件, 500-1500 行      |
| 实现/开发/新增/功能/feature  | `implement` | 5-8 文件, 1500-3000 行     |
| 重构/迁移/架构/系统/redesign | `refactor`  | 10-15 文件, 3000-5000 行   |

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

| 工作流      | PHASE 1              | PLAN                         | 执行方式               |
| ----------- | -------------------- | ---------------------------- | ---------------------- |
| `explore`   | 问题相关资料与来源   | 最小 `QuestMap`              | 默认单执行者           |
| `fix`       | 复现与故障链         | 独立期望、失败证据与修复范围 | 默认单执行者           |
| `implement` | 业务依据与现有接口   | 契约、假设、取舍、风险与验证 | 授权且有独立任务才协作 |
| `refactor`  | 受影响依赖与回归基线 | 不变量、分批范围与恢复边界   | 授权且有独立任务才协作 |

> 注：本 Skill 的工作流选择逻辑由 `/auto:route` 的 `RouteDecision` 复杂度与策略判定承接，此处保留为设计参考和人类可读文档。

---

## 二、按需加载：详细参考文档

### Multi-Agent 编排模式

完整决策树、4 种模式详解、最佳实践、Agent 交接规则：
→ 读取 `references/multi-agent.md`

### 根因追踪方法论

快速参考（五步流程、常见根因模式）：
→ 读取 `references/root-cause.md`

完整调试方法论（4 阶段强制流程、铁律约束、假说验证）：
→ 加载 `systematic-debugging` skill

### 10 维度代码审查清单

完整 10 维度审查项、精简版 5 维度、自动化建议：
→ 读取 `references/review-checklist.md`

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

**按需加载**（PHASE 1 SCAN 和 PHASE 2 PLAN）：

- 策略或任务依赖存在真实取舍
- 已授权多 Agent 协作，需要明确 owner、隔离与交接
- 审查范围或调试方法需要补充参考

**按需加载**（具体方法论）：

- Bug 修复 → 加载 `systematic-debugging` skill（深度调试）或根因追踪五步法（快速定位）
- 多 Agent 协作任务 → 加载 Multi-Agent 编排模式
- 代码审查 → 加载 10 维度审查清单

## 验收标准

- [ ] 每次 /auto 任务的 PHASE 1 输出包含 `RouteDecision.strategy`（explore/fix/implement/refactor 之一）
- [ ] QuestMap 按真实依赖与验收拆分，不为满足数量或角色配额增加任务
- [ ] Bug 修复能以复现、根因和验证证据解释结果，不按步骤数量判定通过
- [ ] 代码审查覆盖当前改动的实际风险，未覆盖的重要风险明确报告

## 来源

- Claude Code 官方文档：Plan Mode 四种工作流
- Andrew Ng "AI Agent Design Patterns"：Reflection、Multi-Agent
- linux.do 社区验证数据
- Vibe Coding 实战策略
- 社区经验仅作候选方法；本项目的缺陷率与净收益需要独立任务对照
