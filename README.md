# Auto CLI

> `/auto` 超级命令仓库 -- Claude Code 提供完整原生编排，Codex 提供优化版 prompt + skills 工作流

> [English README](README.en.md)

---

## 这是什么？

Auto CLI 是运行在 Claude Code / Codex 中的纯 Markdown 智能开发辅助工具。输入 `/auto` + 你的需求，AI 会：

1. **扫描项目** -- 检测语言、框架、已有规范，产出 `RouteDecision`
2. **编排 Quest** -- 结合 Router、Skills、历史经验生成 `QuestMap`
3. **逐关执行** -- 按任务本质自主判定执行深度，产出 `QuestResult`
4. **自动门禁** -- 14-gate 分级验证（build/test/lint/coverage/security/adversarial/self-verification/self-critique/skill-activation/knowledge-reuse/knowledge-distribution/clean-state/cost），产出 `VerifyReport`
5. **完成总结** -- 汇总变更与遗留阻塞，不自动提交
6. **知识沉淀** -- 产出 `LearnCard` 回写 insights/feedback，下次自动检索复用

**核心理念**：纯 Markdown 指令驱动，无需额外运行时。Claude Code 侧走完整 command/agent/hook 编排；Codex 侧重点优化主 `/auto` 单入口，让用户只提一次任务，随后由 `/auto` 自行完成路由、执行、验证和知识沉淀。

## 运行时支持矩阵

| 能力                                          | Claude Code        | Codex                                                 |
| --------------------------------------------- | ------------------ | ----------------------------------------------------- |
| `/auto` 主命令                                | 原生 slash command | `/prompts:auto`                                       |
| `/auto` 6 PHASE 主流程                        | 完整支持           | 支持，使用 Codex 专用 prompt                          |
| `/auto:route` / `doctor` / `status` / `learn` | 原生 slash command | 支持，使用 Codex 覆盖版 prompt                        |
| 项目 `skills/` 安装与触发                     | 支持               | 支持                                                  |
| 项目能力快照（commands / skills / feedback）  | 通过 project scan  | 支持，优先读取 `.auto/cache/capability-snapshot.json` |
| 自定义 agents 目录                            | 支持               | 不支持，改用 Codex 内建代理能力                       |
| rules / hooks 安装                            | 支持               | 不支持                                                |
| `commands/auto.md` 直装                       | 是                 | 否，优先安装 `commands/auto.codex.md` 覆盖版          |

这意味着同名 `/auto` 在两端目标一致，但执行机制不同。文档和安装产物必须分别贴合各自 runtime。

对于 Codex，推荐使用方式是只使用 `/prompts:auto`。子命令存在，但目标是让主 `/auto` 自己吸收这些能力，自动完成路由、规划、执行、验证和沉淀，而不是要求用户手动串起来。
在当前仓库里，Codex 侧 preflight 还会优先读取 `CLAUDE.md`、`REPO_MAP.md`、`.auto/cache/capability-snapshot.json`、`commands/**/*.md`、`skills/*.md`，先理解项目和本地能力，再 route。

---

## 环境要求

- **Node.js** >= 18（仅用于安装脚本，运行时零依赖）
- **Claude Code 或 Codex** 已安装并可用

---

## 安装

### 通过 Plugin Marketplace 安装（推荐 · Claude Code 原生）

在 Claude Code 中：

```
/plugin marketplace add ktyyer/auto-cli
/plugin install auto-cli@auto-cli
```

Claude Code 会自动发现并加载本仓库的 `commands/`、`agents/`、`skills/`、`hooks/`。安装后重启 Claude Code 即生效。

更新插件：`/plugin update auto-cli`。

### 从源码安装（开发者 / Codex 用户）

```bash
git clone https://github.com/ktyyer/auto-cli.git
cd auto-cli
npm run sync           # 自动同步到已检测到的工具目录
```

> `npm run sync` 会自动检测已安装的 Claude Code、Codex，并同步到对应目录（`~/.claude/` / `~/.codex/`）。
> 不再提供 `npm run install` 别名，避免与 `npm install` / `npm ci` 的生命周期脚本语义冲突。
> 安装到 Codex 时，当前会为受支持的 `/auto` 命令集合优先安装对应的 `*.codex.md` 覆盖文件，并自动去掉 `.codex` 后缀；未列入 Codex 支持矩阵的命令不会被安装。
> 安装到 Codex 时，还会额外安装 `~/.codex/AGENTS.md` 作为入口桥接层。原因是部分 Codex 运行时对 `~/.codex/prompts/` 的展开并不稳定，桥接层负责把 `/prompts:auto` / `/auto` 显式识别成 Auto CLI 工作流入口。
> `npm test` / `npm run check` 现在还会校验三件事：格式与引用、npm 分发包是否包含 Codex 关键文件、以及存在 `.auto/runs/` 时最近一次 run 是否具备基础闭环工件；干净环境或未启用 `.auto/` 的仓库不会因为缺少本地 run 而失败。

### 打包分发到其他电脑

```bash
# 在源码仓库执行打包
npm run pack
# 产物: auto-cli-<version>.tgz
```

将 tgz 文件拷贝到目标电脑，然后：

```bash
# macOS / Linux / Git Bash
tar -xzf auto-cli-<version>.tgz
cd package
node scripts/install.js

# Windows
# 解压 auto-cli-<version>.tgz，进入 package 目录
# 双击 scripts\install.bat
```

### 一键重装（开发机用）

```bash
# macOS / Linux / Git Bash
npm run reinstall

# Windows 双击运行
scripts\reinstall.bat
```

该脚本自动完成：打包 → 清理 Auto CLI 托管资源 → 解压安装新版 → 清理临时文件。

### 卸载

```bash
npm run uninstall      # 源码仓库内
node scripts/uninstall.js  # 从 tgz 解压目录
```

---

## 使用

```bash
# 超级命令 -- 描述需求，AI 自动完成
/auto 用 Spring Boot 实现用户分页查询接口
/auto 在 React 项目中实现可复用的表单组件
/auto 熟悉一下当前项目，总结一段话

# 智能路由 -- 自动推荐最合适的 Agent
/auto:route 编写测试用例
/auto:route 检查密码泄露漏洞

# 环境诊断
/auto:doctor

# 项目状态
/auto:status

# Git 历史模式分析
/auto:learn --git

# 创建 Hook（Claude Code）
/auto:create-hook
```

---

## 为什么 auto-cli 用过回不去

业界主流 Claude Code 工具（Superpowers、Everything Claude Code 等）解决了 **怎么用得稳** 的问题。auto-cli 进一步解决了 **怎么让 AI 越用越懂你的项目** 的问题。

### 1. 协议驱动 · 5 个标准对象立刻写盘

每次 `/auto` 强制产出 5 个标准对象（`RouteDecision` / `QuestMap` / `QuestResult` / `VerifyReport` / `LearnCard`），落到 `.auto/runs/<runId>/`。带来三件实事：

- 任意一关失败可精确回溯到具体 Quest，而非"代码乱了"
- 跨会话续接时下个 Claude Code 实例能从 `.auto/runs/` 读上次产出，无信息丢失
- 同样的需求 N 次跑出的产物结构一致，可脚本批量分析

### 2. 知识闭环 · LearnCard 反查复用

每次 run 的踩坑/模式/决策沉淀到 `.auto/insights/` 和 `.auto/feedback/`。**下次 SCAN 自动按关键词反查**，命中条目以 `[insight:traps.md#xxx]` 注入当前 QuestMap，PHASE 4 `knowledge-reuse` gate 强制检查"是否真复用了已有经验"。

> 你犯过的错 auto-cli 记得；你证实过的好做法它主动复用。

### 3. Session Continuity · 跨会话续接

run 中断（上下文压缩、Claude Code 重启、用户离开）时自动写 `session-continuity.md`，含 `interruptPoint` + `cleanStateChecklist`。下次 `/auto` 启动直接续接："上次在 Quest 3/5 中断（已完成 Read，待 Edit）"一行回到现场，**不需要把上次对话再讲一遍**。

### 4. Quest 级失败回滚 · 不连累整个仓库

某关失败时只回滚当前 Quest 触及的文件，已成功的关保留产出。对比仓库级 `git reset` 回滚，平均多保留 80% 已完成工作。

### 5. 14-Gate 自适应验证 · 不是一个 lint 就放行

按策略动态选择 gate 组合：

- **探索**：`analysis` + `skill-activation` + `knowledge-reuse` + `knowledge-distribution` + `clean-state`
- **修复**：+ `build` + `test` + `self-verification`
- **实现**：+ `lint` + `coverage` + `self-critique`（Reflexion 每关自纠）
- **重构**：+ `security` + `adversarial`（红蓝对抗验证）

任一 gate 缺证据就回流 EXECUTE 补强，不是"看起来对了就 done"。

### 6. Context Engineering · 管理 AI 的注意力预算

AI Agent 的上下文窗口是有限的注意力预算。auto-cli 内建完整的上下文工程体系：

- **预算三区感知**：绿区/黄区/红区动态调节加载策略，进入红区自动压缩而非崩溃
- **渐进披露**：Skill 三级激活（摘要→全文→深度），低匹配 Skill 只读 ~20 行，节省 80%+ token
- **Subagent 隔离**：每个验证子代理只获取最小必要上下文，减少幻觉 + 降低 token 消耗 40-60%
- **漂移防护**：复读原话 + 反向翻译 + 扩张词刹车，长 run 不跑偏
- **知识蒸馏**：沉淀原子化(≤5行)、标 scope、去重合并，每次复用真正有效

> —— 2026 年 AI Agent 质量第一瓶颈不是模型能力，而是上下文管理。auto-cli 让“对的 token 在对的时间”成为默认行为。

---

## 示例 runs

`.auto/runs/<runId>/` 是单次 run 的真源（不入 git，每个项目本地累积）。下面是本仓库自身近期真实 run 案例：

| Run 主题       | 策略 | 关键产出                                                                       |
| -------------- | ---- | ------------------------------------------------------------------------------ |
| 项目体检       | 探索 | `/auto 全面分析当前项目` 识别 5 个文档一致性问题 + 1 个 validate 脚本健壮性缺陷 |
| 一致性修复     | 修复 | `/auto 修复全部问题到最优` 6 个 Quest 内修完上述全部问题，`npm run check` 由红转绿 |
| 战略层优化分析 | 探索 | `/auto 找可优化点，结合 github/gitee/linux.do` 产出 14 项分梯队优化建议         |
| 增量打磨       | 实现 | `/auto 优化所有不影响单入口的项` 强化 README 护城河文档 + 路线图同步           |

每个 run 目录均含完整 6 工件（`route-decision` / `quest-map` / `quest-results` / `verify-report` / `index` / `learn-cards`），可用 `node scripts/validate-run-completeness.js --run <runId>` 校验闭环。

---

## 能力总览

### 核心命令

| 命令                | 用途                                         |
| ------------------- | -------------------------------------------- |
| `/auto`             | 超级命令 -- 说需求，AI 自动编排所有能力完成  |
| `/auto:route`       | 智能路由 -- 自动分析意图并推荐最合适的 Agent |
| `/auto:doctor`      | 环境诊断 -- 健康检查与安全范围内的自动修复   |
| `/auto:status`      | 项目状态 -- 输出 runtime、能力、健康度       |
| `/auto:dashboard`   | 运行数据聚合 -- 展示策略分布、gate 通过率等趋势 |
| `/auto:create-hook` | 生成 Hook 模板建议（Claude Code）            |
| `/auto:learn`       | 分析 Git 历史模式并返回结构化结果            |

### 四种执行策略

AI 在 SCAN 阶段综合任务语义、安全敏感度和架构影响自主判定，不按文件数或行数硬编码。

| 策略     | 适用场景                       | 执行路径                                                                                                          |
| -------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| **探索** | 分析/咨询/代码审查，无代码变更 | SCAN → PLAN（最小 QuestMap）→ EXECUTE（只读分析）→ VERIFY(skipped) → SUMMARIZE → LEARN                            |
| **修复** | bug/小调整，少量文件局部修改   | SCAN → PLAN → EXECUTE（直接修复）→ VERIFY（build+test+clean-state）→ SUMMARIZE → LEARN                            |
| **实现** | 新功能/多文件变更              | SCAN → PLAN → quest-designer → EXECUTE（逐关）→ VERIFY（build+test+lint+coverage+clean-state）→ SUMMARIZE → LEARN |
| **重构** | 架构级变更                     | SCAN → PLAN → quest-designer → EXECUTE（逐关）→ VERIFY（含对抗验证+clean-state）→ SUMMARIZE → LEARN               |

### Agent（Claude Code）

| Agent                | 作用               |
| -------------------- | ------------------ |
| architect            | 系统设计和架构决策 |
| tdd-guide            | 测试驱动开发专家   |
| code-reviewer        | 代码质量审查       |
| security-reviewer    | 安全漏洞检测       |
| build-error-resolver | 构建错误修复       |
| e2e-runner           | E2E 测试管理       |
| refactor-cleaner     | 死代码清理         |
| doc-updater          | 文档更新           |
| verification         | 对抗性验证         |
| quest-designer       | 闯关大纲设计师     |

> `agents/_shared-principles.md` 定义协议对象与公共原则，供其他 Agent 引用，不作为独立 Agent 调度。Codex 不安装这些自定义 agents。

### Rules 编码规范（Claude Code）

位于 `rules/`，安装后配置在 `~/.claude/rules/`：

- `agents.md` — Agent 编排
- `coding-style.md` — 编码风格
- `commands.md` — Commands 编写规范
- `git-workflow.md` — Git 工作流
- `hooks.md` — Hook 系统
- `markdown-authoring.md` — Markdown 文件编写规范
- `performance.md` — 性能与设计模式
- `security.md` — 安全指南
- `testing.md` — 测试要求
- `version-and-release.md` — 版本与发布规范

### Skills 知识库（29 个）

| Skill                 | 领域                                                           |
| --------------------- | -------------------------------------------------------------- |
| init-project          | CLAUDE.md 智能初始化                                           |
| workflow-patterns     | 开发工作流模式 + Multi-Agent 编排 + 根因追踪 + 代码审查清单    |
| code-style-enforcer   | TS/JS + Java 代码风格规则                                      |
| git-workflow          | Git 分支策略 + 约定式提交                                      |
| dependency-analyzer   | 依赖安全分析                                                   |
| performance-patterns  | 性能优化模式                                                   |
| java-patterns         | Spring Boot + MyBatis Plus 模板                                |
| error-patterns        | 错误模式速查（含语言特定参考）                                 |
| robustness-patterns   | 生产级健壮性（重试/熔断/限流/幂等等）                          |
| logging-patterns      | 结构化日志与可观测性                                           |
| comment-standards     | 代码注释规范                                                   |
| production-standards  | 新项目生产就绪标准                                             |
| requirement-clarifier | 需求模糊度评估与澄清                                           |
| research-analyst      | 自主调研（外部资料/官方文档）                                  |
| test-plan-writer      | 6 维测试计划生成                                               |
| systematic-debugging  | 系统化调试方法论（4 阶段强制流程）                             |
| code-analyzer         | tree-sitter 代码结构分析                                       |
| skill-creator         | Skill 编写方法论（意图捕获 → SKILL.md 编写 → 测试迭代）        |
| skill-evaluator       | Skill 健康度评估（结构分 + 效果分双路径，keep-or-revert 闭环） |
| prd-writer            | PRD 需求文档写作（两阶段：概念版 → 落地板）                    |
| api-design            | API 设计规范（RESTful/分页/错误码/版本管理/OpenAPI）           |
| refactoring-patterns  | 安全重构方法论（提取函数/拆分文件/测试保护网/分批策略）        |
| spec-driven           | 规格驱动开发（需求 → 接口契约 → 可执行 acceptance）           |
| context-engineering   | 上下文工程方法论（预算管理/渐进加载/压缩策略/隔离模式）  |
| brainstorming         | 方案探索方法论（多路径对比/权衡分析/用户选择）              |
| using-git-worktrees   | 多 Agent 并行隔离开发（Git Worktree 自动化触发/合并/清理）  |
| constitution          | 项目级非协商原则（仿 Spec Kit · `.auto/constitution.md` 硬约束载体） |
| incremental-review    | 增量代码审查（PostToolUse 累积 dirty 清单 · 会话末仅审改动文件） |
| self-critique         | 每关 Reflexion 自纠（达成度评分 + 盲点 + 主线漂移防范）   |

> 每个 Skill 含 `## 激活摘要` 段落，支持三级按需激活（摘要级 / 全文级 / 深度级），低匹配 Skill 只读 ~20 行摘要，节省 80%+ 上下文。

### Hooks 自动化（Claude Code）

位于 `hooks/hooks.json`，包含 22 个 Hook：

- PreToolUse (7): TDD Guard、Dev Server Blocker、Git Push Review、Doc Blocker、Large File Warning、TDD Guard CLI、**Auto-Snapshot**（git stash 非破坏性快照）
- PostToolUse (8): Prettier + ESLint、TypeScript Check、Coverage Check、Console.log Warning、Frequent Commit Reminder、PR Creation Log、Skill Health Reminder、**Incremental Dirty Files**（累积 `.auto/runs/<latest>/dirty.txt`）
- **SessionStart (1)**: 冷启动注入 CLAUDE.md / `.auto/constitution.md` / 上次 session-continuity
- PreCompact (1): 压缩前保存 Quest 进度
- PostCompact (1): 上下文重注入
- UserPromptSubmit (1): 密钥泄露检测
- TeammateIdle (1): 空闲队友提醒
- TaskCompleted (1): 质量门禁
- Stop (1): console.log 审计

---

## 6 PHASE 工作流

```
/auto 用户需求
    |
PHASE 1: SCAN      -- 扫描技术栈、能力清单、环境快检（含缓存）
PHASE 2: PLAN      -- 知识检索（索引反查） + Skill 动态发现（三级激活） + Quest Map
PHASE 3: EXECUTE   -- 逐关执行（串行/并行/Teams，每关输出进度卡片）
PHASE 4: VERIFY    -- 14-gate 分级门禁（按策略强制不同 gate 组合）
PHASE 5: SUMMARIZE -- 完成阶段总结（不自动提交）
PHASE 6: LEARN     -- 知识沉淀（踩坑/模式/决策/Agent反馈）+ clean-state gate → 下次自动检索复用
```

每个 PHASE 均有自检机制（检查上一阶段产出）和门禁（输出后才能进入下一阶段）。

---

## 核心机制

### Skill 动态发现与三级激活

SCAN 阶段扫描所有 Skill frontmatter，PLAN 阶段按四信号加权算法计算匹配度：`tags 命中×2 + 语义相似度×1 + 历史反馈×1.5 + 预算调节×(-0.5~+0.5)`，分三级激活：

| 级别   | 匹配度 | 加载策略                     | 上下文成本   |
| ------ | ------ | ---------------------------- | ------------ |
| 摘要级 | 3-4    | 只读 `## 激活摘要` (~20 行)  | ~500 tokens  |
| 全文级 | 5-6    | 摘要 + 按需读相关子段落      | ~2000 tokens |
| 深度级 | 7+     | 全文 + .references/ 参考文件 | ~5000 tokens |

对于 Codex，能力发现还有一层更靠前的项目预热：

1. 先读 `CLAUDE.md` 与 `REPO_MAP.md`
2. 若存在 `.auto/cache/capability-snapshot.json`，优先把它当作命令 / skills / feedback 的快速索引
3. 若 snapshot 缺失或过期，再回退扫描 `commands/**/*.md` 与 `skills/*.md`
4. 再结合 `.auto/feedback/*.json` 和 insights 进入 route / plan

### 14-Gate 验证门禁

| Gate                    | 说明                     | 探索 | 修复 | 实现 | 重构 |
| ----------------------- | ------------------------ | :--: | :--: | :--: | :--: |
| analysis                | 分析完整性               |  ✓   |  —   |  —   |  —   |
| build                   | 编译通过                 |  —   |  ✓   |  ✓   |  ✓   |
| test                    | 测试通过                 |  —   |  ✓   |  ✓   |  ✓   |
| lint                    | 代码风格                 |  —   |  —   |  ✓   |  ✓   |
| coverage                | 覆盖率 ≥ 80%             |  —   |  —   |  ✓   |  ✓   |
| security                | 安全审查                 |  —   |  —   |  —   |  ✓   |
| adversarial             | 对抗验证                 |  —   |  —   |  —   |  ✓   |
| self-verification       | AI 自检（代码层）        |  —   |  ✓   |  ✓   |  ✓   |
| self-critique           | Reflexion 自纠（每关）   |  —   |  —   |  ✓   |  ✓   |
| skill-activation        | Skill 应用证据           |  ✓   |  ✓   |  ✓   |  ✓   |
| knowledge-reuse         | 经验复用                 |  ✓   |  ✓   |  ✓   |  ✓   |
| knowledge-distribution  | LearnCard 分发硬约束     |  ✓   |  ✓   |  ✓   |  ✓   |
| clean-state             | 仓库清洁                 |  ✓   |  ✓   |  ✓   |  ✓   |
| cost                    | 成本审计                 |  —   |  ✓   |  ✓   |  ✓   |

### 经验持续沉淀

每次 `/auto` 运行产出的 `LearnCard` 分发到 `.auto/insights/` 和 `.auto/feedback/`，下次 SCAN 阶段自动索引反查，实现经验的持续积累和自动复用。

---

## Agent Skills 标准兼容

auto-cli 的 Skill 源码结构**完全对齐** [Anthropic Agent Skills 开放标准](https://github.com/anthropics/skills)：

```
skills/<name>/
├── SKILL.md         # 必需（YAML frontmatter + Markdown）
└── references/      # 可选
```

frontmatter 字段兼容：

| 字段            | 标准要求       | auto-cli                            |
| --------------- | -------------- | ----------------------------------- |
| `name`          | 必填           | 必填                                |
| `description`   | 必填           | 必填                                |
| `tags`          | —              | 必填（auto-cli 扩展，用于动态发现） |
| `license`       | 可选           | 可选                                |
| `compatibility` | 可选           | 可选                                |
| `metadata`      | 可选           | 可选                                |
| `allowed-tools` | 可选（实验性） | 可选                                |

源码结构对齐意味着：

- 可直接被 Claude Code / Cursor / Windsurf / Aider / Gemini CLI / Codex / OpenCode 等支持 Agent Skills 标准的工具识别
- 安装到 Claude 时 `install.js` 仍写入 `~/.claude/skills/<name>.md`（flat 兼容旧用户路径，无需迁移）
- 安装到 Codex 时写入 `~/.codex/skills/<name>/SKILL.md`（与源结构一致）
- 通过 `/plugin marketplace add ktyyer/auto-cli` 安装时 Claude Code 自动按标准结构加载

---

## 社区 Skill

`skills/community/` 目录支持第三方 Skill 扩展。贡献流程：

1. Fork 本仓库
2. 在 `skills/community/` 下创建 Skill 文件（遵循 Agent Skills 标准 + auto-cli 扩展规范）
3. 运行 `node scripts/validate-references.js` 确认无错误
4. 提交 PR 到 `dev` 分支

详见 `skills/community/README.md`。

---

## 支持的语言

- Java / Spring Boot
- JavaScript / TypeScript / React
- Python / Django
- Go / Gin
- Rust（基础支持）

---

## 常见问题

**Q: 安装后命令不生效？**
重启 Claude Code 或 Codex。

**Q: 为什么 Codex 里感觉不如 Claude 好用？**
旧版本会把 Claude 风格的 `/auto` 直接复制到 Codex，导致 prompt 里充满 `~/.claude/agents`、hooks、自定义 Agent 调度等 Codex 并不原生支持的假设。当前版本除了安装 Codex 专用 `/auto` prompt，还会安装 `~/.codex/AGENTS.md` 作为入口桥接层，减少 `/prompts:auto` 被当成普通聊天文本处理的概率。

**Q: Codex 现在能完全等同 Claude Code 吗？**
不能。Claude Code 仍然拥有自定义 agents、rules、hooks 等原生 runtime。当前版本做的是在 Codex 实际边界内尽量逼近 Claude：先读取项目和能力清单，再走单入口 route → plan → execute → verify → learn，并把闭环写入 `.auto/runs/`。

**Q: `/auto` 和单个命令的区别？**
`/auto` 是超级命令，AI 会自动判断执行路径并激活相关 skills。单个命令（如 `/auto:route`）用于精确控制。

**Q: Claude 和 Codex 的能力完全一样吗？**
不是。Claude Code 具备本仓库定义的 commands + agents + rules + hooks 全套运行时；Codex 当前重点支持 prompt + skills，并通过专用 `/auto` prompt 贴合其实际能力边界。

**Q: 代码会泄露吗？**
Auto CLI 只负责本地文件安装，不发送任何数据到外部服务。

---

## 项目起源

基于以下开源项目开发：

- [everything-claude-code](https://github.com/affaan-m/everything-claude-code)
- [ai-max](https://github.com/zhukunpenglinyutong/ai-max)

---

## License

MIT
