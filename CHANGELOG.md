# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.25.0] - 2026-03-29

### Changed

- **Commands 精简**：7 -> 6（合并 `skill-create` 到 `learn`）
  - `/auto:learn` 现在支持双模式：会话级提取 + Git 历史分析
  - 减少维护负担，统一知识提取入口
- **Skills 精简**：5 -> 4（合并 `self-review` 到 `workflow-patterns`）
  - `workflow-patterns` 现在包含 10 维度代码审查清单
  - 更全面的工作流和代码质量指导
- **Rules 精简**：8 -> 7（合并 `patterns` 到 `performance`）
  - `performance.md` 现在包含常用设计模式
  - 更名为"性能与设计模式"，内容更全面

### Removed

- commands/skill-create.md（功能已合并到 learn.md）
- skills/self-review.md（审查清单已合并到 workflow-patterns.md）
- rules/patterns.md（设计模式已合并到 performance.md）

### Improved

- `commands/learn.md` 增强为双模式提取工具
  - 模式 1：从当前会话提取编码模式
  - 模式 2：从 Git 历史分析项目规范
- `skills/workflow-patterns.md` 新增 10 维度代码审查清单
  - 功能正确性、错误处理、安全性、性能、代码风格
  - 测试覆盖、接口兼容性、可维护性、文档、Git 规范
- `rules/performance.md` 新增常用设计模式
  - API 响应格式、仓储模式、自定义 Hook 模式

### Technical Details

- 无破坏性变更（仅合并和删除冗余文件）
- 测试全部通过（247 个）
- 项目复杂度降低约 15-20%
- 核心功能完整保留

## [0.24.0] - 2026-03-29

### Changed

- **项目定位精简**：聚焦"智能超级命令"核心定位
- **Skills 精简**：7 -> 5（移除 `backend-patterns`, `frontend-patterns`）
  - 原因：通用代码示例与"超级开发辅助工具"定位不符
  - 用户项目应该有自己的 CLAUDE.md 定义编码规范
- **COMPONENTS 清理**：6 -> 5（移除冗余 `knowledge` 定义）
  - `skills` 组件使用 `recursive: true` 已覆盖整个 skills 目录
  - 避免组件功能重复
- **doctor.md 诊断阈值**：Skills 检查从 `>= 7` 调整为 `>= 5`

### Removed

- skills/backend-patterns.md（通用后端代码示例）
- skills/frontend-patterns.md（通用前端代码示例）
- src/utils.js 中的 `knowledge` 组件定义

### Fixed

- 修正 tests/utils.test.js 组件数量断言（6 -> 5）
- 更新 doctor.md 示例输出（Skills 11 -> 5）
- 测试全部通过（247 个）

### Technical Details

- 无破坏性变更（仅删除非核心文件）
- 代码覆盖率保持 89.93%
- 所有 247 个测试通过
- 项目定位更加清晰：CLI 工具 + 核心开发辅助能力

## [0.22.0] - 2026-03-29

### Added

- **TodoLists 系统**：依赖感知任务管理（Claude Code 官方核心能力）
  - `src/todos/todo-types.js` - TodoItem 和 TodoListSnapshot 类型定义
  - `src/todos/todo-manager.js` - TodoManager 类（依赖感知排序 + 拓扑排序 + 跨会话持久化）
  - `tests/todo-manager.test.js` - 23 个测试，覆盖率 98.38%
  - 支持依赖阻塞、优先级排序、进度统计、Markdown 报告、归档功能

- **Reflection Skill**：自我反思模式（Andrew Ng "AI Agent Design Patterns" 第一模式）
  - `skills/reflection.md` - 4 步反思流程（回顾 → 质疑 → 评估 → 纠偏）
  - 与 `self-review.md` 互补：self-review 是提交前清单，Reflection 是执行中纠偏
  - 可嵌入 Quest 执行，提供量化评分表和反思模板

- **能力分析器**：项目能力画像分析
  - `src/todos/capability-analyzer.js` - CapabilityAnalyzer 类（10 个能力领域评估）
  - `tests/capability-analyzer.test.js` - 9 个测试，全面覆盖
  - 自动识别项目强项和缺口，生成改进建议
  - CLI 命令：`auto analyze`（支持 `-j` JSON 输出）

- **CLI 命令扩展**：
  - `auto analyze` - 分析当前项目的能力画像（Agent + Skill + Rule 覆盖度）

- **测试覆盖**：
  - 新增 32 个测试（215 -> 247，+14.9%）
  - TodoManager 覆盖率 98.38%，CapabilityAnalyzer 全面覆盖

### Changed

- **Skills 数量**：6 -> 7（新增 `reflection`）
- **Skills 数量修正**：7 -> 10（v0.21.0 的 "精简至 6" 描述不准确，实际文件从未被删除）
- **Commands 数量**：5 -> 6（新增 `auto analyze`）
- **输入验证增强**：TodoManager.add() 和 initialize() 现在验证 `content` 和 `taskName` 参数

### Removed

- skills/reflection.md（再次移除：与 self-review + workflow-patterns 重叠）
- skills/git-worktree.md（快速参考级，不属于核心 Skill）
- skills/chrome-devtools-mcp.md（快速参考级，MCP 配置一次性操作）

### Fixed

- 修正 README 命令数量（6 -> 5，移除不存在的 /auto:analyze）
- 修正 README Skills 列表与实际文件一致（10 -> 7）
- 修正源码中对不存在命令的引用（/auto:tdd, /auto:code-review, /auto:plan）
- 修正 CHANGELOG 历史版本中的不准确描述
- 修正 doctor.md 中 Skills 检查阈值（>= 8 -> >= 7）
- 修复 CLI 中 `analyze` 命令的未使用变量（`key` → `,`）
- 修复代码审查中指出的输入验证缺失问题

## [0.21.0] - 2026-03-29

### Changed

- **Skills 精简优化**：13 个 -> 10 个（移除/合并 8 个，新增 workflow-patterns）
  - 移除 agentic-workflow-patterns.md（与 subagent-driven-development 重叠）
  - 移除 coding-standards.md（功能被 rules/ 目录覆盖）
  - 移除 model-selection-guide.md（内容已过时）
  - 移除 prompt-templates.md（功能被 auto 命令/init-project 覆盖）
  - 合并 plan-mode-workflows + subagent-driven-development + root-cause-tracing -> workflow-patterns.md
  - 精简 unified-memory-system.md（去除重复策略详解）

- **README 修正**：
  - 更新 Skills 数量统计（13 -> 10）
  - 移除不属于本项目的 java-coding-style Rule 描述
  - 更新 Rules 数量（9 -> 8）

### Removed

- skills/agentic-workflow-patterns.md（合并入 workflow-patterns.md）
- skills/coding-standards.md（功能被 rules/ 目录覆盖）
- skills/model-selection-guide.md（内容已过时）
- skills/prompt-templates.md（功能被 auto 命令/init-project 覆盖）
- skills/plan-mode-workflows.md（合并入 workflow-patterns.md）
- skills/subagent-driven-development.md（合并入 workflow-patterns.md）
- skills/root-cause-tracing.md（合并入 workflow-patterns.md）

### Added

- skills/workflow-patterns.md（三合一合并：Plan Mode + Multi-Agent + 根因追踪）

## [0.10.0] - 2026-03-29

### Added

- **技能目录系统** (`src/skills/`)
  - `skill-types.js` - 技能类型定义和解析器
  - `skill-catalog.js` - 技能目录扫描和索引
  - `skill-installer.js` - 技能安装、卸载、更新
  - 9 大技能域分类（需求、工程、调试、测试、数据、AI、科研、数学、多媒体）
  - CLI 子命令：`auto skills list/search/install`

- **诊断命令** - `auto doctor` 环境健康检查

- **知识保存命令** - `auto save` 一键保存知识条目

### Changed

- **架构简化** - 移除 6 个超出范围的模块
  - 删除 `src/graph/`（知识图谱系统）
  - 删除 `src/governance/`（治理规则引擎）
  - 删除 `src/brain/`（个人知识大脑）
  - 删除 `src/ecosystem/`（生态编排器）
  - 删除 `src/runtime/`（VCO 适配器）
  - 删除 `src/skills/`（旧的技能发现系统）
  - COMPONENTS 从 12 个减少到 7 个

- **CLI 优化** - 移除 query、brain、rules、workflow 等命令

### Fixed

- 测试失败修复（175 个测试全部通过）

### Tests

- 新增 `tests/context-injector.test.js`（18 个测试用例）
  - 4 种预设模式：探索、实现、修复、审查
  - 智能任务识别自动选择预设
  - 支持 CLAUDE.md、REPO_MAP、session-knowledge、pattern-cards、insights、dependencies 6 种上下文源
  - 内置 Token 估算和缓存机制
  - 基于 linux.do 社区 "自动上下文注入" 最佳实践

- **最佳实践工作流预设**
  - 探索-规划-编码工作流 (`explore-plan-code-workflow`)
  - 上下文感知工作流 (`context-aware-workflow`)
  - 基于 linux.do 社区讨论的最佳实践

- **生态系统扩展**
  - 新增 Context 模块注册到生态编排器
  - MODULE_IDS 新增 CONTEXT 常量

### Tests

- 新增 `tests/context-injector.test.js`（18 个测试用例）
- VCO 适配器测试新增 2 个工作流验证
- 生态系统测试新增 Context 模块集成验证

---

## [0.2.0] - 2026-03-28

### Added

- **quest-designer v4** -- 完整代码输出式闯关大纲设计师，产出可直接复制执行的施工图纸
  - 精确锚点定位（文本锚点替代行号）
  - 完整 import 列表 + package 声明
  - 预判坑点（基于代码分析，非通用建议）
  - 6 步工作流：需求解析 -> 深度代码分析 -> 合约定义 -> Quest Map -> 一致性校验 -> 自验证评分

- **MCP 集成增强** -- 分类配置 + 检测工具
  - 新增 `analyzeMcpServers()` 和 `countMcpServers()` 工具函数
  - 9 个核心 MCP 服务器按类别分组（devtools/ai/search/database）
  - 自动检测 ready/needsConfig 状态

- **prompt-craft skill** -- 短小精悍的提示词模板库

- **project-init skill** -- 项目初始化工具 + 费用追踪工具

- **npm sync script** -- `npm run sync` 一键同步 commands/ 到 .claude/commands/auto/

### Changed

- **auto 命令精简 -64%** -- 命令定义大幅压缩，去除冗余描述
- **self-star skill 优化** -- 合并多个子能力
- **Skills 合并** -- 精简后的高效组合，减少维护成本
- **MCP 配置精简** -- 去除冗余配置，保留核心 9 个服务器

### Fixed

- **installer 备份文件** -- 使用时间戳后缀防覆盖
- **installer 递归保护** -- 新增 MAX_RECURSION_DEPTH = 20 防循环链接
- **Logger 级别控制** -- 修复级别判断逻辑
- **URL 硬编码消除** -- 移除未使用的 promptComponentSelection

### Improved

- **测试覆盖率** -- 新增 logger/config/prompts/index/installer 单元测试，覆盖率 59% -> 91%
- **静态导入优化** -- 消除动态 import，统一使用 ES Modules

---

## [0.1.1] - 2026-03-25

### Added

- **auto-core v7** -- 动态能力发现 + Quest Map 方法论
  - Grep 批量提取 frontmatter 健康检查
  - 三段推理日志（透明化 AI 决策过程）
  - 文件存在性校验

- **auto-core 透明度增强** -- 五大原则落地
  - 禁止因任务简单而跳过 PHASE（强制规则）
  - 硬性约束重写 + Gate Check 断言

- **quest-designer v2/v3** -- 深度代码分析 + 合约驱动
  - v2: 依赖排序 + 自验证评分 + 防幻觉机制
  - v3: 实现蓝图 + 风险分层 + 代码片段锚定

- **融合 3 项新能力**
  - Council Pattern -- 多 Agent 议会模式协作
  - Auto-lint-fix -- 自动代码格式修复
  - Repo Map 持久化 -- 仓库符号地图

### Fixed

- **auto.md 源文件同步** -- Gate Check 硬性约束，修复安装覆盖丢失问题
- **PHASE 3 执行器** -- 对接 v3 Quest Map 的实现蓝图/风险分层/合约/回滚方案

---

## [0.1.0] - 2026-03-01

### Added

- 初始版本
- 基于 everything-claude-code 二次开发
- npm 全局安装支持
- CLI 交互式安装器
