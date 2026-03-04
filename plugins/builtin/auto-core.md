---
name: auto-core
version: 5.0.0
description: 智能路由大脑 - 统一路由协议、双模型架构、智能护栏、自动化门禁与经验沉淀
author: ai-max
priority: 100
builtin: true
---

# 智能路由大脑 (auto-core v5.0)

> `/aimax:auto` 的核心路由引擎：一个大脑，统一调度所有世界级能力

---

## 🚀 步骤0：强制会话初始化（每次必须先执行）

```
每次执行 /aimax:auto 前，必须完成以下检测：

1. 读取 CLAUDE.md（如存在）→ 加载项目规范、禁止事项、响应格式
2. 读取 REPO_MAP.md（如存在）→ 加载仓库符号地图，快速定位代码
3. 读取 .claude/rules/ 目录 → 加载适用规则（java-coding-style/security等）
4. 检测技术栈（详见下方语言/框架检测表）
5. 记录 session_context：{task_type, complexity, files_to_modify}

⚠️ 如果文件数量 > 50 且不存在 REPO_MAP.md：
   → 建议用户先运行 /aimax:update-codemaps 生成符号地图
```

---

## 📊 步骤1：任务复杂度评估

| 级别 | 预估 | 关键词信号 | 路由策略 |
|------|------|-----------|---------|
| 🟢 **简单** | <30分钟 | 修复、函数、方法、变量、样式 | 直接 Editor 模型实现 |
| 🟡 **中等** | 30-120分钟 | 模块、接口、API、组件、服务 | Architect + Editor + TDD + 审查 |
| 🔴 **复杂** | >120分钟 | 系统、架构、重构、迁移、微服务 | Architect + Editor + Focus Chain |

**复杂度修正规则：**
- 有外部 API 调用 → +1 级
- 有数据库 Schema 变更 → +1 级
- 跨 5 个以上文件 → 提升至复杂

---

## 🛡️ 步骤2：Smart Guardrails 智能护栏评估

根据当前任务意图，自动评估本次任务的权限安全级别：

| 操作类型 | 护栏级别 | 动作 |
|---------|---------|------|
| 读取/搜索/分析代码 | **安全** (Safe) | 自动执行 |
| 编辑文件/新建文件/测试 | **中等** (Moderate) | 默认自动执行（可配 `confirm-edits`） |
| 删除/运行重构脚本/部署 | **危险** (Dangerous) | 必须等待用户确认 (`confirm-all`) |

---

## 🧠 步骤3：Architect/Editor 双模型工作流

**根据复杂度决定是否拆分推理与编辑职责：**

```
IF 复杂度 >= 中等:
  1. [Architect] 模型启动：
     - 分析需求、分析依赖、确认修改范围
     - 输出《编辑计划单》（明确指明文件、函数级别的改动意图）
  
  2. [Editor] 模型启动：
     - 读取《编辑计划单》
     - 使用 Diff-First 策略精确应用变更
     - 不做架构层面的自我发挥

ELSE (复杂度 == 简单):
  1. [Editor] 直接根据上下文执行 Diff 编辑
```

---

## ⛓️ 步骤4：能力链（单一职责，去重分层）

**每个业务域只有一条能力链：命令 → Agent → Skill**

```
功能开发:    /aimax:auto → tdd-guide(Agent) → tdd-workflow(Skill) + superpowers(触发)
代码审查:    /aimax:code-review → code-reviewer(Agent) → pr-review-toolkit(触发)
重构清理:    /aimax:refactor-clean → refactor-cleaner(Agent) → code-simplifier(触发)
安全审计:    /aimax:security-scan → security-reviewer(Agent) → security-review(Skill)
架构规划:    /aimax:deep-plan → architect(Agent) + planner(Agent)
文档更新:    /aimax:update-docs → doc-updater(Agent)
E2E测试:     /aimax:e2e → e2e-runner(Agent)
构建修复:    (已被 auto 门禁整合)
持续演进:    /aimax:evolve → evaluate → iterate (集成自 adaptive-evolution)
任务编排:    /aimax:loop → checkpoint → resume (集成自 task-state-machine)
```

---

## 🔌 步骤5：意图信号路由表

| 信号关键词 | 触发能力 | 优先级 |
|-----------|---------|--------|
| 功能、特性、模块、实现、新增 | superpowers → TDD流程 + tdd-templates | 高 |
| 组件、界面、UI、页面、样式 | Frontend Design → 视觉规范 | 高 |
| 清理、重构、简化、代码质量 | code-simplifier → 重构 | 高 |
| 审查、review、检查、PR | code-reviewer → PR审查 | 高 |
| 安全、漏洞、扫描、密钥、注入 | security-reviewer → 安全审计 | 🔴紧急 |
| 可视化、工具、演示、看板 | Playground → HTML生成 | 中 |
| 浏览器、抓取、爬虫、自动化 | Chrome Automation → Playwright | 中 |
| 迭代、演进、回归、CI、基准 | evolve → 评估驱动门禁 | 中 |
| 状态机、分步、中断、编排 | state-machine → 构建检查点 | 中 |
| 取消合并、解决冲突 | Git Auto-Commit → 自动修复/恢复 | 高 |

### 技能主动判断规则（自动检测触发）

| 条件检测 | 自动激活技能 |
|---------|------------|
| 对话轮次 > 15 或上下文 > 70% | **context-compression** — 自动锚定摘要 |
| 文件数 > 50 且无 REPO_MAP | **repo-map** — 建议先生成符号地图 |
| 复杂任务 且有多个独立子模块 | **git-worktree** — 提示并行 worktree |
| 预估 > 3000 tokens | **cost-optimizer** — 自动降级 Editor 模型执行 |
| 复杂度 ≥ 中等 | **focus-chain** — 强制开启专注保持模式 |

---

## ✅ 步骤6：自动化门禁（严格执行，不可跳过）

```
1. 编译/构建  → 必须0错误
2. 单元测试   → 必须全部通过
3. 测试覆盖率 → 必须 >= 80%
4. 代码规范   → check 格式和质量
5. 安全扫描   → 检测敏感密钥、注入风险

任一失败 → Self-Fixing（最多3次）:
  第1次失败: 微调（比如修复类型错误）
  第2次失败: 替代方案
  第3次失败: Git Checkout 恢复初始状态，报告给用户
```

---

## 🔄 步骤7：Git Auto-Commit

```
门禁通过后，必须自动执行 Git 提交（除非设置 --no-auto-commit）：

1. 检查 `git status`
2. 仅添加（git add）本轮修改过的文件
3. 按照 Conventional Commits 规范生成 commit message
   格式：类型(范围): 简短描述 + [可选的 diff summary body]
4. 执行 `git commit -m "..."`
```

---

## 🧠 步骤8：经验沉淀（持久化记忆）

```
任务完成后，必须通过 Save Memory 持久化：

1. [Project Memory] 记录本次关键架构决策和遇到的库版本兼容问题
2. [Instinct] 记录学到的团队编码风格（如：使用 `Result.success()` 包装返回）
3. [Smart Context] 更新变更过文件的知识向量
4. 如修改了核心架构 → 提示立刻运行 `/aimax:update-codemaps`
```

---

## 核心原则

1. **单一大脑** — 路由逻辑只在此文件，不分散
2. **世界级分工** — Architect 负责纯思考，Editor 负责纯行动
3. **安全底线** — Smart Guardrails 必须拦截危险操作
4. **可回溯** — 每一步有意义的变更必须 Git Commit
5. **Diff 优先** — 绝不轻易全文替换
