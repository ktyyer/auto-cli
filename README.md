# Auto CLI

> `/auto` 超级命令仓库 -- Claude Code 提供完整原生编排，Codex 提供优化版 prompt + skills 工作流

---

## 这是什么？

Auto CLI 是运行在 Claude Code / Codex 中的纯 Markdown 智能开发辅助工具。输入 `/auto` + 你的需求，AI 会：

1. **扫描项目** -- 检测语言、框架、已有规范，产出 `RouteDecision`
2. **编排 Quest** -- 结合 Router、Skills、历史经验生成 `QuestMap`
3. **逐关执行** -- 按任务本质自主判定执行深度，产出 `QuestResult`
4. **自动门禁** -- 12-gate 分级验证（build/test/lint/coverage/security/adversarial/self-verification/skill-activation/knowledge-reuse/clean-state/cost），产出 `VerifyReport`
5. **完成总结** -- 汇总变更与遗留阻塞，不自动提交
6. **知识沉淀** -- 产出 `LearnCard` 回写 insights/feedback，下次自动检索复用

**核心理念**：纯 Markdown 指令驱动，无需额外运行时。Claude Code 侧走完整 command/agent/hook 编排；Codex 侧重点优化主 `/auto` 单入口，让用户只提一次任务，随后由 `/auto` 自行完成路由、执行、验证和知识沉淀。

## 运行时支持矩阵

| 能力                                          | Claude Code        | Codex                                        |
| --------------------------------------------- | ------------------ | -------------------------------------------- |
| `/auto` 主命令                                | 原生 slash command | `/prompts:auto`                              |
| `/auto` 6 PHASE 主流程                        | 完整支持           | 支持，使用 Codex 专用 prompt                 |
| `/auto:route` / `doctor` / `status` / `learn` | 原生 slash command | 支持，使用 Codex 覆盖版 prompt               |
| 项目 `skills/` 安装与触发                     | 支持               | 支持                                         |
| 项目能力快照（commands / skills / feedback） | 通过 project scan  | 支持，优先读取 `.auto/cache/capability-snapshot.json` |
| 自定义 agents 目录                            | 支持               | 不支持，改用 Codex 内建代理能力              |
| rules / hooks 安装                            | 支持               | 不支持                                       |
| `commands/auto.md` 直装                       | 是                 | 否，优先安装 `commands/auto.codex.md` 覆盖版 |

这意味着同名 `/auto` 在两端目标一致，但执行机制不同。文档和安装产物必须分别贴合各自 runtime。

对于 Codex，推荐使用方式是只使用 `/prompts:auto`。子命令存在，但目标是让主 `/auto` 自己吸收这些能力，自动完成路由、规划、执行、验证和沉淀，而不是要求用户手动串起来。
在当前仓库里，Codex 侧 preflight 还会优先读取 `CLAUDE.md`、`REPO_MAP.md`、`.auto/cache/capability-snapshot.json`、`commands/**/*.md`、`skills/*.md`，先理解项目和本地能力，再 route。

---

## 环境要求

- **Node.js** >= 18（仅用于安装脚本，运行时零依赖）
- **Claude Code 或 Codex** 已安装并可用

---

## 安装

### 从源码安装

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

## 能力总览

### 核心命令

| 命令                | 用途                                         |
| ------------------- | -------------------------------------------- |
| `/auto`             | 超级命令 -- 说需求，AI 自动编排所有能力完成  |
| `/auto:route`       | 智能路由 -- 自动分析意图并推荐最合适的 Agent |
| `/auto:doctor`      | 环境诊断 -- 健康检查与安全范围内的自动修复   |
| `/auto:status`      | 项目状态 -- 输出 runtime、能力、健康度       |
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

### Skills 知识库（22 个）

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

> 每个 Skill 含 `## 激活摘要` 段落，支持三级按需激活（摘要级 / 全文级 / 深度级），低匹配 Skill 只读 ~20 行摘要，节省 80%+ 上下文。

### Hooks 自动化（Claude Code）

位于 `hooks/hooks.json`，包含 18 个 Hook：

- PreToolUse (6): TDD Guard、Dev Server Blocker、Git Push Review、Doc Blocker、Large File Warning、TDD Guard CLI
- PostToolUse (7): Prettier + ESLint、TypeScript Check、Coverage Check、Console.log Warning、Frequent Commit Reminder、PR Creation Log、Skill Health Reminder
- PostCompaction (1): 上下文重注入
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
PHASE 4: VERIFY    -- 12-gate 分级门禁（按策略强制不同 gate 组合）
PHASE 5: SUMMARIZE -- 完成阶段总结（不自动提交）
PHASE 6: LEARN     -- 知识沉淀（踩坑/模式/决策/Agent反馈）+ clean-state gate → 下次自动检索复用
```

每个 PHASE 均有自检机制（检查上一阶段产出）和门禁（输出后才能进入下一阶段）。

---

## 核心机制

### Skill 动态发现与三级激活

SCAN 阶段扫描所有 Skill frontmatter，PLAN 阶段按 `tags 命中数 × 2 + description 语义相似度` 计算匹配度，分三级激活：

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

### 12-Gate 验证门禁

| Gate              | 说明         | 探索 | 修复 | 实现 | 重构 |
| ----------------- | ------------ | :--: | :--: | :--: | :--: |
| analysis          | 分析完整性   |  ✓   |  —   |  —   |  —   |
| build             | 编译通过     |  —   |  ✓   |  ✓   |  ✓   |
| test              | 测试通过     |  —   |  ✓   |  ✓   |  ✓   |
| lint              | 代码风格     |  —   |  —   |  ✓   |  ✓   |
| coverage          | 覆盖率 ≥ 80% |  —   |  —   |  ✓   |  ✓   |
| security          | 安全审查     |  —   |  —   |  —   |  ✓   |
| adversarial       | 对抗验证     |  —   |  —   |  —   |  ✓   |
| self-verification | AI 自检      |  —   |  ✓   |  ✓   |  ✓   |
| skill-activation  | Skill 应用   |  ✓   |  ✓   |  ✓   |  ✓   |
| knowledge-reuse   | 经验复用     |  ✓   |  ✓   |  ✓   |  ✓   |
| clean-state       | 仓库清洁     |  ✓   |  ✓   |  ✓   |  ✓   |
| cost              | 成本审计     |  —   |  ✓   |  ✓   |  ✓   |

### 经验持续沉淀

每次 `/auto` 运行产出的 `LearnCard` 分发到 `.auto/insights/` 和 `.auto/feedback/`，下次 SCAN 阶段自动索引反查，实现经验的持续积累和自动复用。

---

## Agent Skills 标准兼容

auto-cli 的 Skill frontmatter 兼容 [Agent Skills 标准](https://agentskills.io/specification)：

| 字段            | 标准要求       | auto-cli                            |
| --------------- | -------------- | ----------------------------------- |
| `name`          | 必填           | 必填                                |
| `description`   | 必填           | 必填                                |
| `tags`          | —              | 必填（auto-cli 扩展，用于动态发现） |
| `license`       | 可选           | 可选                                |
| `compatibility` | 可选           | 可选                                |
| `metadata`      | 可选           | 可选                                |
| `allowed-tools` | 可选（实验性） | 可选                                |

auto-cli Skill 可直接发布为 Agent Skills 标准 Skill，只需补充 `license` 字段。

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
