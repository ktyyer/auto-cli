---
name: workflow-patterns
description: 开发工作流模式集合 - Plan Mode 工作流、Multi-Agent 编排、根因追踪方法论，让任务自动匹配最优工作流
version: 1.0.0
author: auto-cli
tags: [workflow, plan-mode, orchestration, root-cause, debugging, patterns, agent, parallel, troubleshooting]
---

# Workflow Patterns -- 开发工作流模式集合

> 三大核心方法论合一：Plan Mode 工作流选择、Multi-Agent 编排模式、结构化根因追踪。
> 让 quest-designer 在 PHASE 2 自动匹配最优工作流。

---

## 一、Plan Mode 工作流（4 种）

### 工作流选择决策

| 信号关键词 | 工作流 | 上下文预算 |
|-----------|--------|-----------|
| 重构/迁移/架构/系统/redesign | Explore | 10-15 文件, 3000-5000 行 |
| 实现/开发/新增/功能/feature | Implement | 5-8 文件, 1500-3000 行 |
| bug/错误/失败/error/fix/修复 | Fix | 3-5 文件, 500-1500 行 |
| 审查/review/检查/安全/质量 | Review | 3-6 文件, 1000-2000 行 |

### 自动检测逻辑

```
用户意图 -> 关键词匹配:
  +--- [重构|迁移|全面|架构|系统|microservice] -> Explore
  +--- [实现|开发|新增|功能|feature|创建|接口] -> Implement
  +--- [bug|错误|失败|error|fix|修复|异常|debug] -> Fix
  +--- [审查|review|检查|安全|质量|PR] -> Review
  +--- 无匹配 -> 默认 Implement
```

### 与 Auto CLI 对应

| 工作流 | PHASE 1 | quest-designer | Canonical Router |
|--------|---------|----------------|------------------|
| Explore | 完整扫描（不用缓存） | 读取 10-15 文件 | 默认 quest-designer |
| Implement | 缓存优先 | 读取 5-8 文件 | 默认 quest-designer |
| Fix | 最小化 | 读取 3-5 文件 | 优先 build-error-resolver |
| Review | 缓存优先 | 读取 3-6 文件 | 优先 code-reviewer |

---

## 二、Multi-Agent 编排模式（4 种）

### 选择决策树

```
任务是否可拆分？
+-- 否 -> 单 Agent（quest-designer）
+-- 是 -> 子任务之间是否有依赖？
    +-- 有依赖 -> Sequential Chain（串行链）
    +-- 无依赖 -> 需要总协调者吗？
        +-- 需要 -> Orchestrator-Workers（主从模式）
        +-- 不需要 -> Parallel Fan-Out（并行扇出）

质量要求特别高？-> 追加 Evaluator-Optimizer（评估优化）
```

### 模式详解

| 模式 | 流程 | 适用场景 | Quest 数量建议 |
|------|------|---------|--------------|
| Sequential Chain | A -> B -> C | 后一步依赖前一步输出 | 1-5 关 |
| Parallel Fan-Out | Router -> [A, B, C] | 子任务无依赖 | 6-15 关 |
| Orchestrator-Workers | 总指挥 -> 分配 -> 收集 | 复杂任务需协调 | 15+ 关 |
| Evaluator-Optimizer | 产出 -> 审查 -> 迭代 | 质量要求高（最多 3 轮） | 追加于任何模式 |

### 最佳实践

1. **上下文隔离**：每个子 Agent 只接收它需要的上下文
2. **并行 Agent 不修改同一文件**：如有冲突需串行化
3. **失败不阻塞**：单个 Agent 失败设定超时和重试
4. **结果聚合**：Union（审查类）/ Latest Wins（修复类）/ Vote（决策类）

---

## 三、根因追踪方法论（五步法）

> 修 Bug 不是打地鼠。从症状出发，逐步定位根因，确保修复源头而非表面。

### 五步流程

| 步骤 | 名称 | 输出格式 |
|------|------|---------|
| 1 | 症状描述 | 现象 + 触发条件 + 影响范围 + 复现步骤 |
| 2 | 假设生成 | 按可能性排序的原因列表（参考 error-patterns.md 速查） |
| 3 | 二分排除 | 最小验证实验表格（假设 -> 验证方法 -> 结论） |
| 4 | 根因确认 | 一句话根因 + 证据链 + 代码位置 |
| 5 | 修复 + 防复发 | 最小修复 + 测试覆盖 + 防复发检查 |

### 常见根因模式

| 模式 | 症状 | 定位方法 |
|------|------|---------|
| 依赖版本漂移 | 本地正常 CI 失败 | 对比 `npm ls`，检查 lock 文件 |
| 时序竞态 | 偶发性失败 | 检查 await、事件监听、回调顺序 |
| 状态泄漏 | 测试顺序影响结果 | 逐个运行测试，检查共享状态 |
| 隐式依赖 | 删代码后功能异常 | Grep 全项目搜索引用 |
| 编码不一致 | 特殊字符显示异常 | 检查所有数据流转环节的编码 |

### 工具辅助

| 工具 | 命令 |
|------|------|
| git bisect | `git bisect start` / `good` / `bad` |
| git diff | `git diff HEAD~1 -- src/file.js` |
| git log | `git log --oneline -20 -- src/file.js` |
| Node.js 调试 | `node --inspect-brk script.js` |

---

## 来源

- Claude Code 官方文档：Plan Mode 四种工作流
- Andrew Ng "AI Agent Design Patterns"：Reflection、Multi-Agent
- linux.do 社区验证数据
- Vibe Coding 实战策略
