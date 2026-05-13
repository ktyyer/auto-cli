# Auto CLI

> Claude Code / Codex `/auto` 超级命令 -- 一条指令，AI 自动编排所有能力完成任务

---

## 这是什么？

Auto CLI 是运行在 Claude Code / Codex 中的纯 Markdown 智能开发辅助工具。输入 `/auto` + 你的需求，AI 会：

1. **扫描项目** -- 检测语言、框架、已有规范，产出 `RouteDecision`
2. **编排 Quest** -- 结合 Router、Skills、历史经验生成 `QuestMap`
3. **逐关执行** -- 按任务本质自主判定执行深度，产出 `QuestResult`
4. **自动门禁** -- 12-gate 分级验证（build/test/lint/coverage/security/adversarial/self-verification/skill-activation/knowledge-reuse/clean-state/cost），产出 `VerifyReport`
5. **完成总结** -- 汇总变更与遗留阻塞，不自动提交
6. **知识沉淀** -- 产出 `LearnCard` 回写 insights/feedback，下次自动检索复用

**核心理念**：纯 Markdown 指令驱动，无需额外运行时。三级激活协议按需加载 Skill，上下文节省 57%。经验持续沉淀并自动检索复用。

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

> `npm run sync` / `npm run install` 会自动检测已安装的 Claude Code、Codex，并同步到对应目录（`~/.claude/` / `~/.codex/`）。
> `npm run install` 是 `sync` 的向后兼容别名（避免与 `npm install` 歧义，推荐使用 `sync`）。

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

# 创建 Hook
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
| `/auto:create-hook` | 生成 Hook 模板建议                           |
| `/auto:learn`       | 分析 Git 历史模式并返回结构化结果            |

### 四种执行策略

AI 在 SCAN 阶段综合任务语义、安全敏感度和架构影响自主判定，不按文件数或行数硬编码。

| 策略     | 适用场景                       | 执行路径                                                                                                          |
| -------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| **探索** | 分析/咨询/代码审查，无代码变更 | SCAN → PLAN（最小 QuestMap）→ EXECUTE（只读分析）→ VERIFY(skipped) → SUMMARIZE → LEARN                            |
| **修复** | bug/小调整，少量文件局部修改   | SCAN → PLAN → EXECUTE（直接修复）→ VERIFY（build+test+clean-state）→ SUMMARIZE → LEARN                            |
| **实现** | 新功能/多文件变更              | SCAN → PLAN → quest-designer → EXECUTE（逐关）→ VERIFY（build+test+lint+coverage+clean-state）→ SUMMARIZE → LEARN |
| **重构** | 架构级变更                     | SCAN → PLAN → quest-designer → EXECUTE（逐关）→ VERIFY（含对抗验证+clean-state）→ SUMMARIZE → LEARN               |

### Agent（10 业务 Agent + 1 共享原则）

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

> `agents/_shared-principles.md` 定义协议对象与公共原则，供其他 Agent 引用，不作为独立 Agent 调度。

### Rules 编码规范

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

### Hooks 自动化

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

**Q: `/auto` 和单个命令的区别？**
`/auto` 是超级命令，AI 会自动判断并调用合适的 Agent。单个命令（如 `/auto:route`）用于精确控制。

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
