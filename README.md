# Auto CLI

> Claude Code 超级开发辅助 -- 一条命令，AI 自动编排所有能力完成任务

---

## 这是什么？

Auto CLI 是运行在 Claude Code 中的智能开发辅助工具。输入 `/auto` + 你的需求，AI 会：

1. **扫描项目** -- 检测语言、框架、已有规范
2. **发现能力** -- 盘点可用的 commands、agents、skills、hooks
3. **智能推理** -- 结合 Router、Skills、当前上下文生成 Quest 计划
4. **Quest 拆解** -- 将任务拆成可验证的执行步骤和验收标准
5. **逐步执行** -- PHASE 3 产出执行计划并汇总真实执行结果
6. **自动门禁** -- 按模式执行构建、测试、lint 与安全检查
7. **Git 提交** -- 完整模式进入提交阶段，结果统一汇总输出

**核心理念**：不是硬编码路由，是 AI 动态发现 + 推理编排。

---

## 环境要求

- **Node.js** >= 18（终端输入 `node --version` 检查）
- **Claude Code** 已安装并可用

---

## 安装

```bash
# 方式一：npm 全局安装
npm install -g auto-cli
auto install -y

# 方式二：从源码安装
# 如需重新安装，先删除旧打包产物再重新 npm pack
# rm ./auto-cli-0.29.1.tgz
npm pack
npm install -g auto-cli-0.29.1.tgz
auto install -y -f

# 安装后重启 Claude Code
```

如果是覆盖旧版资源，推荐顺序：

```bash
auto uninstall -y
auto install -y -f
```

---

## 使用

```bash
# 超级命令 -- 描述需求，AI 自动完成
/auto 用 Spring Boot 实现用户分页查询接口
/auto 在 React 项目中实现可复用的表单组件
/auto 实现完整的电商订单系统

# 智能路由 -- 自动推荐最合适的 Agent
/auto:route 编写测试用例        # -> 推荐 tdd-guide
/auto:route 检查密码泄露漏洞      # -> 推荐 security-reviewer

# 环境诊断
/auto:doctor

# 会话续接
# 将 createResumeDirective() 生成的指令交给 auto resume

# 项目状态
/auto:status

# 创建 Hook
/auto:create-hook
```

---

## 能力总览

### 核心命令

| 命令 | 用途 |
|------|------|
| `/auto` | 超级命令 -- 说需求，AI 自动编排所有能力完成 |
| `/auto:route` | 智能路由 -- 自动分析意图并推荐最合适的 Agent |
| `/auto:doctor` | 环境诊断 -- 支持健康检查与安全范围内的自动修复 |
| `/auto:status` | 项目状态 -- 输出 runtime、summary、capabilities |
| `/auto:create-hook` | 生成 Hook 模板建议 |
| `/auto:learn` | 分析 Git 历史模式并返回结构化结果 |
| `auto run` | 执行完整 6 PHASE 工作流 |
| `auto analyze` | 仅执行 PHASE 1 + 2，输出分析快照 |
| `auto route` | 在终端输出路由推荐结果 |
| `auto doctor` | 在终端执行健康检查 |
| `auto resume` | 根据 resume directive 继续任务 |
| `auto status` | 输出 runtime / summary / capabilities |
| `auto learn` | 输出 Git 历史模式分析结果 |
| `auto create-hook` | 生成 Hook 模板建议 |
| `auto codemaps` | 生成 REPO_MAP.md 与 symbol-index.json |
| `auto install/update/uninstall/list/docs` | 安装、更新、卸载、列组件与打开文档 |
| `auto save insight/list/search` | 保存、列出和搜索知识条目 |

### Agent（11 个）

| Agent | 作用 |
|-------|------|
| architect | 系统设计和架构决策 |
| tdd-guide | 测试驱动开发专家 |
| code-reviewer | 代码质量审查 |
| security-reviewer | 安全漏洞检测 |
| build-error-resolver | 构建错误修复 |
| e2e-runner | E2E 测试管理 |
| refactor-cleaner | 死代码清理 |
| doc-updater | 文档更新 |
| verification | 对抗性验证 |
| quest-designer | 闯关大纲设计师 v4 |
| planner | 实现规划专家 |

### Rules 编码规范（7 个）

| 规范 | 领域 |
|------|------|
| agents | Agent 编排模式 |
| coding-style | TypeScript/JavaScript 编码风格 |
| git-workflow | Git 提交和 PR 工作流 |
| hooks | Hook 系统配置 |
| performance | 性能与设计模式 |
| security | 安全检查清单 |
| testing | 测试要求（80%+ 覆盖率） |

### Skills 知识库（8 个）

| Skill | 领域 |
|-------|------|
| init-project | CLAUDE.md 智能初始化（结构化模板 + 7 板块生成 + 会话恢复） |
| workflow-patterns | 开发工作流模式（Plan Mode + Multi-Agent 编排 + 根因追踪 + 10 维度审查） |
| code-style-enforcer | TS/JS + Java 代码风格规则（自动注入 PHASE 4 VERIFY） |
| git-workflow | Git 分支策略 + 约定式提交 + PR 模板（自动注入 PHASE 5 COMMIT） |
| dependency-analyzer | npm/Maven/Go 依赖安全分析（自动注入 PHASE 1 + PHASE 4） |
| performance-patterns | 15+ 性能优化模式（DB/缓存/React/通用） |
| java-patterns | Spring Boot + MyBatis Plus 12 个高频模板 |
| error-patterns | 9 类错误模式速查（Node/Java/Go/Rust/Claude Code） |

### Hooks 自动化

| 事件类型 | Hook | 功能 |
|---------|------|------|
| PreToolUse | TDD Guard | 强制测试文件存在 |
| PreToolUse | Dev Server Blocker | 阻止非 tmux dev server |
| PreToolUse | Long Cmd tmux | 建议长命令用 tmux |
| PreToolUse | Git Push Review | 推送前审查 |
| PreToolUse | Doc Blocker | 阻止随意创建 .md |
| PreToolUse | File Size Warning | 500+ 行文件警告 |
| PostToolUse | Prettier + ESLint | 自动格式化 |
| PostToolUse | TypeScript Check | 即时类型检查 |
| PostToolUse | Console.log Warning | console.log 告警 |
| PostToolUse | Coverage Check | 测试覆盖率 < 80% 告警 |
| PostToolUse | PR Auto-detect | PR URL + CI 状态 |
| PostToolUse | Commit Reminder | 5+ 文件提醒提交 |
| PostCompaction | Context Reinject | 上下文重注入 |
| UserPromptSubmit | Secret Detection | 密钥模式检测 |
| TeammateIdle | Team Lead Alert | 空闲队友通知 |
| TaskCompleted | Quality Gate | 未提交变更拦截 |
| Stop | Console.log Audit | 最终 console.log 审计 |

---

## 按规模自动选择执行模式

| 条件 | 执行模式 | 说明 |
|------|---------|------|
| 1 文件且预计 <=10 行变更 | 微型模式 | Discover → Micro Execute → Verify → Learn |
| <=3 文件且无架构变更 | 轻量模式 | Discover → Reason → Verify → Learn |
| >3 文件或存在架构变更 | 完整模式 | 完整 6 PHASE |

完整模式内，PHASE 3 会根据 Quest 数量选择串行或分组执行策略；结果会汇总到 `executionSummary`。

---

## 技术架构

```
用户输入 /auto
    |
+------------------------------------------+
|  auto-core（智能路由大脑）                 |
|                                          |
|  PHASE 1: DISCOVER（健壮扫描）            |
|    扫描技术栈、能力清单、doctor 结果       |
|                                          |
|  PHASE 2: REASON                         |
|    生成 Quest Map                         |
|    Canonical Router 推荐 Agent            |
|                                          |
|  PHASE 3: EXECUTE                        |
|    生成执行计划并消费执行结果              |
|    汇总 changedFiles / executionSummary   |
|                                          |
|  PHASE 4: VERIFY（按模式门禁）           |
|  PHASE 5: COMMIT（完整模式提交）         |
|  PHASE 6: LEARN（经验沉淀）              |
|    可选输出 Git patterns / resume 指令    |
+------------------------------------------+
```

---

## Canonical Router（权威路由器）

v0.12.0 引入的核心组件，实现中心化 Agent 路由决策：

- **Agent 注册表**：11 个内置 Agent 的完整清单定义
- **智能路由**：意图识别 + 关键词匹配 + 优先级排序 + 回退链
- **安全优先**：安全敏感意图自动提升 security-reviewer 优先级

使用方式：
```bash
# Claude Code 中
/auto:route 编写单元测试

# 或终端
auto route "编写测试用例"
auto route "构建失败" --debug
```

---

## 支持的语言

- Java / Spring Boot
- JavaScript / TypeScript / React
- Python / Django
- Go / Gin
- Rust（基础支持）

---

## CLI 命令

```bash
auto                           # 交互模式（安装/更新/卸载）
auto install                   # 安装组件（-y 跳过确认，-f 强制覆盖）
auto update                    # 更新已安装组件
auto uninstall                 # 卸载组件
auto run "修复登录流程"          # 执行完整 /auto 工作流
auto analyze "修复登录流程"      # 仅执行 PHASE 1 + 2
auto route <意图>              # 智能路由（-d 调试，-j JSON 输出）
auto doctor --json -d .        # 项目健康检查 + 安装状态
auto resume "<directive>"      # 根据续接指令继续任务
auto status --json -d .        # 查看 runtime / summary / capabilities
auto learn --git --json        # 分析 Git 历史模式
auto create-hook --json        # 生成 Hook 模板建议
auto codemaps -d .             # 生成 REPO_MAP.md 与 symbol-index.json
auto list                      # 列出可用组件
auto docs                      # 打开文档
auto save insight -c "内容"     # 保存知识条目
auto save list                 # 列出知识条目
auto save search -q "关键词"    # 搜索知识条目
```

推荐在源码打包或全局重装后执行最小验证：

```bash
auto --version
auto doctor --json -d .
auto status --json -d .
auto learn --git --json -d .
```

---

## 常见问题

**Q: 安装后命令不生效？**
重启 Claude Code，检查 `node --version` >= 18。

**Q: 代码会泄露吗？**
Auto CLI 本身主要负责本地安装、命令组织和结果汇总；具体数据流边界取决于你在 Claude Code 中启用的模型、Agent 和外部集成配置。

**Q: 安装后怎么使用 `/auto`？**
先在终端运行 `auto install` 安装命令文件，然后重启 Claude Code；`/auto`、`/auto:route` 等 slash commands 需要在 Claude Code 会话内使用，不是在普通 shell 里直接执行。


**Q: `/auto` 和单个命令的区别？**
`/auto` 是超级命令，AI 会自动判断并调用合适的 Agent。单个命令（如 `/auto:route`）用于精确控制。

---

## 最佳实践

### 上下文管理

| 策略 | 要点 | Auto CLI 工具 |
|------|------|--------------|
| 先计划后编码 | 别一上来就让 AI 写代码 | `/auto`（自动进入 Quest Map） |
| 子代理隔离 | 复杂任务拆给专用 Agent | `/auto:route`, Canonical Router |
| 验收标准写进 Prompt | 明确"什么是完成" | Quest 验收表, PHASE 4 VERIFY |

### Agent 循环：感知 -> 思考 -> 行动 -> 验证

- **感知** = PHASE 1 DISCOVER（扫描项目上下文）
- **思考** = PHASE 2 REASON（Quest Map + Router + Skills）
- **行动** = PHASE 3 EXECUTE（执行计划 + 结果回流）
- **验证** = PHASE 4 VERIFY（按模式门禁检查）

---

## 版本历史

### v0.29.1（当前）

**v9 深度审计 + planner Agent 注册 + 旧版清理**：
- 注册 planner Agent（之前仅在 rules 中引用但未注册到 BUILT_IN_AGENTS）
- 可达性从 94% 提升到 100%（11/11 Agent 全部可达）
- 清理旧版 commands（13 个废弃命令）、agents（2 个）、skills（6 文件 + 12 目录）
- 总评分 88/100，0 P0、0 P1、6 P2（均为低优先级）
- 当时版本对应测试全绿，lint 0 错误

### v0.29.0

**v6 深度审计 + 10 项架构修复**：
- P0: 修复 PHASE 5 changedFiles 空转（Quest 执行后通过 git diff 收集变更文件）
- P0: 修复 Agent 反馈回路 ID 不匹配（预路由获取真实 feedbackId 关联路由决策）
- P0: 修复 `auto analyze` 命令崩溃（安全访问 agentRegistry）
- P1: 覆盖率门禁强制执行（FULL 模式 <80% 回滚变更）
- P1: doc-updater/refactor-cleaner 实际调度执行（写入 .auto/pending-invocations.json 队列）
- P1: PhaseCommit 集成 FlowEngine（新增 COMMITTING 状态 + COMMIT_DONE 事件）
- P1: 扩展 handoff 路径含全部 10 Agent（7 条标准流程 + 触发条件映射）
- P1: 全部 10 Agent 添加"参考 Skills"节（Agent-Skill 交叉引用）
- P2: error-patterns 新增 TypeScript 编译错误表（10 个 TS 错误码）
- P2: verification Agent 修复 Phase 编号缺失（新增 Phase 3 深度攻击执行）
- 当时版本对应测试全绿，lint 0 错误，评分 82→88

### v0.28.0

**全能力审计 v5 + PHASE_SKILL_MAP 扩展**：
- PHASE_SKILL_MAP 从 3 phase 扩展到 5 phase（reason/execute/verify 自动注入 Skill）
- doc-updater 触发条件扩展（新增 15 个功能级+文档级关键词）
- 项目语言自动检测（`_detectProjectLanguages()` 检测 Java/Go/Python/Rust/Node）
- TDD Guard Hook 检查集成到 Doctor recommendedActions
- Skills 数量从 3 个扩展到 8 个（新增 code-style-enforcer, git-workflow, dependency-analyzer, performance-patterns, java-patterns）
- 当时版本对应测试全绿，lint 0 错误，可达性 98%

### v0.27.0

**全能力审计 + 架构重构**：
- WorkflowOrchestrator 拆分：2077行 → 579行协调器 + 5 个 phase 子模块
- PHASE 1 新增 Doctor 环境快检 + CLAUDE.md 自动检测
- PHASE 3 实现 Agent Teams 并行编排（Promise.allSettled + 批次分区）
- PHASE 5 增加自动增量提交逻辑
- CanonicalRouter 新增路由效果统计（getRoutingStats）
- SkillIndexer 新增热度排序（访问频次追踪 + getPopularSkills）
- ContextCompressor 新增自适应压缩策略（frontend/backend/monorepo 配置文件）
- verification Agent 升级到 Opus 模型
- error-patterns 新增 Java/Spring Boot 10 种错误模式
- status 新增 `--json` 输出模式
- learn 命令新增 Git 历史模式分析入口
- hooks.json 新增覆盖率自动检查 Hook
- rules/hooks.md 同步全部 7 种 Hook 类型文档
- 当时版本测试覆盖 91.61%，且测试与 lint 均通过

### v0.24.0

**定位精简优化**：
- 聚焦"智能超级命令"核心定位
- Skills 精简：7 -> 5（移除 backend-patterns, frontend-patterns）
- COMPONENTS 清理：6 -> 5（移除冗余 knowledge 定义）

### v0.23.0

**新增能力引入**：
- 新增知识学习相关命令雏形（后续收敛为当前 `auto learn` / `auto save` 体系）

### v0.22.0

**精简优化与文档修正**：
- Skills 从 10 个精简至 7 个
- 修正 README 能力统计与实际代码一致
- 修正源码中对不存在命令的引用（/auto:tdd, /auto:code-review, /auto:plan）
- 修正 CHANGELOG 历史记录
- 引入 TodoLists 系统、能力分析器（CapabilityAnalyzer）

### v0.21.0

**聚焦核心功能 -- Skills 精简优化**：
- Skills 从 13 个精简至 10 个（移除/合并 8 个，新增 workflow-patterns）
- 新增 workflow-patterns（Plan Mode + Multi-Agent + 根因追踪三合一）
- 注：v0.24.0 进一步精简至 5 个核心 Skills

### v0.20.0

新增 2 个 Skill（社区最佳实践整合）：
- reflection：反思能力（2026 年 5 大 Agent 设计模式之一）
- plan-mode-workflows：Plan Mode 4 种工作流模式

### v0.18.0

**精简优化 -- 文档与代码一致性**：
- 移除虚构的 15 个 Plugins 描述（从未实现）
- 移除虚构的 MCP 服务器配置描述（目录不存在）
- 移除 9 个未实现命令的描述
- 统一 README 能力统计与实际代码
- 补充 rules/patterns.md 和 rules/testing.md
- 精简版本历史，去除冗余特性描述

### v0.17.0

新增 3 个 Skill：init-project、prompt-templates、self-review

### v0.16.0

新增 3 个 Skill：subagent-driven-development、root-cause-tracing、agentic-workflow-patterns

### v0.12.0

新增 Canonical Router（权威路由器）+ Agent 注册表 + 38 个测试

### v0.11.0

新增 /auto:create-hook 命令、TDD Guard 模块、Session Restore

### v0.10.0

自动上下文注入器（4 种模式：探索/实现/修复/审查）

---

## 项目起源

基于以下开源项目开发：

- [everything-claude-code](https://github.com/affaan-m/everything-claude-code)
- [ai-max](https://github.com/zhukunpenglinyutong/ai-max)

---

## License

MIT
