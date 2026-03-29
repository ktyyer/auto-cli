---
name: plan-mode-workflows
description: Plan Mode 工作流模式 - 4 种官方工作流（探索/实现/修复/审查）的自动检测与上下文策略，来自 Claude Code 官方，可减少 50% 上下文浪费
version: 1.0.0
author: auto-cli
tags: [plan-mode, workflow, context-strategy, efficiency, official-pattern]
---

# Plan Mode Workflows -- 4 种工作流模式

> Claude Code 官方将 Plan Mode 细分为 4 种工作流，每种工作流对应不同的上下文收集策略。
> 用错策略 = 浪费 50% 上下文窗口。本 Skill 定义自动检测逻辑和上下文收集策略，
> 供 quest-designer 和 `/auto` 命令参考。

---

## 四种工作流

### 工作流 1：Explore（探索模式）

**信号**：大规模变更、架构重构、系统迁移

**上下文策略**：全面收集

```
收集清单:
+ CLAUDE.md              -- 项目规则和约束
+ REPO_MAP.md            -- 仓库符号索引
+ .auto/insights/         -- 历史知识沉淀
+ package.json           -- 依赖和脚本
+ 目录结构（3 层）        -- 项目骨架
+ 最近 10 次 git log     -- 变更历史
+ skills/ 索引           -- 可用能力清单
```

**适用场景**：
- "重构整个认证模块"
- "从 REST 迁移到 GraphQL"
- "系统性能全面优化"
- "技术栈升级（如 Vue2 -> Vue3）"

**Auto CLI 对应**：
- PHASE 1 DISCOVER 完整扫描（不使用缓存）
- quest-designer 读取 10-15 个文件进行深度分析
- 产出完整的变更范围预判

### 工作流 2：Implement（实现模式）

**信号**：新功能开发、API 实现、组件创建

**上下文策略**：聚焦依赖

```
收集清单:
+ CLAUDE.md              -- 编码规范
+ 直接依赖的文件          -- 如 Service -> Entity -> Mapper
+ 同层已有文件（2-3 个）   -- 作为代码模式参考
+ 相关测试文件            -- 已有测试模式
+ 相关配置文件            -- 路由、数据库等
```

**适用场景**：
- "实现用户注册 API"
- "创建可复用的表单组件"
- "新增订单导出功能"
- "添加 WebSocket 支持"

**Auto CLI 对应**：
- PHASE 1 DISCOVER 使用缓存（如有效）
- quest-designer 读取 5-8 个直接依赖文件
- 复用已有代码模式（Controller -> Service -> Mapper 链）

### 工作流 3：Fix（修复模式）

**信号**：Bug 修复、错误排查、构建失败

**上下文策略**：最小化聚焦

```
收集清单:
+ 错误信息/堆栈追踪      -- 问题定位的起点
+ 报错文件               -- 出错的源文件
+ 直接依赖（1-2 层）     -- 与报错相关的外部调用
+ 相关测试               -- 复现和验证
+ 最近 git diff          -- 最近改了什么
```

**适用场景**：
- "TypeError: Cannot read properties of undefined"
- "构建失败：TypeScript 类型错误"
- "测试用例失败"
- "接口返回 500"

**Auto CLI 对应**：
- 跳过完整 PHASE 1 扫描，直接读取错误相关文件
- Canonical Router 优先路由到 `build-error-resolver`
- 使用 `root-cause-tracing` Skill 的五步定位法
- Quest 数量通常 1-3 个

### 工作流 4：Review（审查模式）

**信号**：代码审查、质量检查、合规审查

**上下文策略**：规范 + 变更

```
收集清单:
+ CLAUDE.md              -- 编码规范
+ rules/ 目录            -- 所有编码规则
+ 变更文件列表           -- git diff --name-only
+ 变更内容               -- git diff HEAD
+ self-review 检查清单   -- 10 维度审查框架
```

**适用场景**：
- "审查最近的代码变更"
- "检查安全漏洞"
- "代码质量评估"
- "PR 审查"

**Auto CLI 对应**：
- Canonical Router 路由到 `code-reviewer` 或 `security-reviewer`
- 使用 `self-review` Skill 的 10 维度清单
- Quest 数量通常 1-2 个（纯审查无编码）

---

## 自动检测逻辑

quest-designer 在 PHASE 2 REASON 阶段，根据用户意图自动选择工作流：

```
用户意图输入
  |
  v
关键词匹配 + 上下文分析
  |
  +--- 包含 [重构|迁移|全面|redesign|架构|系统|microservice]
  |    -> Explore 模式
  |
  +--- 包含 [实现|开发|新增|功能|feature|implement|创建|接口|API]
  |    -> Implement 模式
  |
  +--- 包含 [bug|错误|失败|error|fix|修复|TypeError|报错|异常|debug|排查]
  |    -> Fix 模式
  |
  +--- 包含 [审查|review|检查|安全|质量|PR|code-review|scan]
  |    -> Review 模式
  |
  +--- 无明确匹配
       -> 默认 Implement 模式（最常用）
```

### 检测关键词清单

| 工作流 | 检测关键词 |
|--------|-----------|
| Explore | 重构, 迁移, 全面, redesign, 架构, 系统, microservice, 微服务, 分布式, 整体, 升级, 评估 |
| Implement | 实现, 开发, 新增, 功能, feature, implement, 创建, 接口, API, 组件, 模块 |
| Fix | bug, 错误, 失败, error, fix, 修复, TypeError, 报错, 异常, debug, 排查, 崩溃 |
| Review | 审查, review, 检查, 安全, 质量, PR, code-review, scan, 合规, 漏洞 |

---

## 上下文预算管理

每种工作流有不同的 Token 预算（基于上下文窗口大小）：

| 工作流 | 建议读取文件数 | 建议读取行数 | Token 占比 |
|--------|-------------|------------|-----------|
| Explore | 10-15 | 3000-5000 | 60-80% |
| Implement | 5-8 | 1500-3000 | 30-50% |
| Fix | 3-5 | 500-1500 | 15-30% |
| Review | 3-6 | 1000-2000 | 20-40% |

**原则**：宁可少读不可多读。缺失的上下文可以在 PHASE 3 执行时按需补充。

---

## 与 Auto CLI 现有组件的关系

| Plan Mode 工作流 | PHASE 1 DISCOVER | quest-designer | Canonical Router |
|-----------------|------------------|----------------|------------------|
| Explore | 完整扫描（不用缓存） | 读取 10-15 文件 | 默认 quest-designer |
| Implement | 缓存优先 | 读取 5-8 文件 | 默认 quest-designer |
| Fix | 最小化 | 读取 3-5 文件 | 优先 build-error-resolver |
| Review | 缓存优先 | 读取 3-6 文件 | 优先 code-reviewer |

### 与 subagent-driven-development 的关系

`plan-mode-workflows` 决定"收集多少上下文"，`subagent-driven-development` 决定"如何分配执行"。两者互补：

```
Plan Mode 工作流 -> 确定上下文范围 -> quest-designer 设计 Quest Map
                                              |
                                              v
                              Subagent 编排模式 -> 确定执行方式
```

---

## 来源

- Claude Code 官方文档：Plan Mode 四种工作流模式
- linux.do 社区实测："用对工作流模式，上下文浪费减少 50%"
- Vibe Coding 策略 1："先让 AI 进入计划模式"
