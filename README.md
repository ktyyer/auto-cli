# Auto CLI

> Claude Code 超级开发辅助 — 一条命令，AI 自动编排所有能力完成任务

---

## 这是什么？

Auto CLI 是运行在 Claude Code 中的智能开发辅助工具。输入 `/auto` + 你的需求，AI 会：

1. **扫描项目** — 检测语言、框架、已有规范
2. **发现能力** — 盘点所有可用的 commands、agents、skills、plugins、hooks
3. **智能推理** — quest-designer v4 深度分析代码，产出**完整可编译代码蓝图**
4. **Quest 拆解** — 将任务拆为原子化微步骤，每步含完整代码 + 预判坑点 + 验收标准
5. **逐步执行** — PHASE 3 直接复制蓝图代码，编译验证，增量提交
6. **自动门禁** — 构建、测试、安全扫描全量检查
7. **Git 提交** — 每关通过后增量提交，失败只回滚当前关

**核心理念**：不是硬编码路由，是 AI 动态发现 + 推理编排。

---

## 环境要求

- **Node.js** >= 18（终端输入 `node --version` 检查）
- **Claude Code** 已安装并可用

---

## 安装

```bash
# 步骤 1：全局安装
npm install -g auto-cli

# 步骤 2：安装组件（推荐全选）
auto install

# 步骤 3：重启 Claude Code


或者
# 1. 卸载旧版本（如果有）
npm uninstall -g auto-cli

# 2. 打包
npm pack

# 3. 全局安装
npm install -g auto-cli-0.1.0.tgz

# 4. 安装组件到 Claude Code
auto install

```

---

## 使用

```bash
# 超级命令 — 描述需求，AI 自动完成
/auto 用 Spring Boot 实现用户分页查询接口
/auto 在 React 项目中实现可复用的表单组件
/auto 实现完整的电商订单系统（自动触发 Agent Teams 并行）
```

---

## 能力总览

### 命令（15 个）

| 命令 | 用途 |
|------|------|
| `/auto` | 超级命令 — 说需求，AI 自动编排所有能力完成 |
| `/auto:quest` | 输入需求，输出完整可复制代码的闯关蓝图（v4） |
| `/auto:plan` | 只规划不编码 |
| `/auto:tdd` | 测试驱动开发 |
| `/auto:code-review` | 代码质量审查 |
| `/auto:build-fix` | 修复构建错误 |
| `/auto:e2e` | 端到端测试 |
| `/auto:test-coverage` | 测试覆盖率分析 |
| `/auto:loop` | 状态机编排（中断恢复） |
| `/auto:evolve` | 持续迭代优化（评估门禁） |
| `/auto:refactor-clean` | 死代码清理 |
| `/auto:update-docs` | 更新文档 |
| `/auto:update-codemaps` | 更新架构地图 |
| `/auto:status` | 查看项目状态 |
| `/auto:help` | 帮助信息 |

### Agent（11 个）

| Agent | 作用 |
|-------|------|
| planner | 制定实施计划 |
| architect | 架构设计评审 |
| tdd-guide | TDD 流程指导 |
| code-reviewer | 代码质量审查 |
| security-reviewer | 安全漏洞检查 |
| build-error-resolver | 构建错误修复 |
| e2e-runner | E2E 测试 |
| doc-updater | 文档更新 |
| refactor-cleaner | 死代码清理 |
| quest-designer | PRD → 闯关大纲 |
| multi-agent-orchestrator | Agent Teams 并行编排 |

### Rules 编码规范（9 个）

| 规范 | 领域 |
|------|------|
| agents | Agent 编排模式 |
| coding-style | TypeScript/JavaScript 编码风格 |
| git-workflow | Git 提交和 PR 工作流 |
| hooks | Hook 系统配置 |
| java-coding-style | Java/Spring Boot 规范 |
| patterns | 常用设计模式 |
| performance | 性能优化策略 |
| security | 安全检查清单 |
| testing | 测试要求（80%+ 覆盖率） |

### Skills 知识库（19 个）

| Skill | 领域 |
|-------|------|
| backend-patterns | 后端架构最佳实践 |
| frontend-patterns | 前端组件模式 |
| clickhouse-io | ClickHouse 查询优化 |
| coding-standards | 编码规范 |
| project-guidelines-example | 项目规范模板 |
| council-pattern | 议会模式多 Agent 协作 |
| agentic-loop | Agentic 循环系统 |
| context-compression | 上下文压缩 |
| continuous-learning | 持续学习系统 |
| conversational-state-machine | 对话状态机 |
| cost-optimizer | Token 成本优化 |
| git-worktree | Git Worktree 并行开发 |
| project-memory | 项目记忆系统 |
| repo-map | 仓库符号地图 |
| self-star | Self-* 自我进化 |
| smart-context | 智能上下文索引 |
| tdd-workflow | TDD 工作流 |
| security-review | 安全审查 |

### Plugins 插件（17 个）

**内置插件（13 个）：**
auto-core、superpowers、tdd-templates、frontend-design、code-simplifier、diff-first、git-auto-commit、playground、pr-review-toolkit、chrome-automation、architect-editor、focus-chain、smart-guardrails

**框架插件（4 个）：**
Spring (Java)、React (JavaScript)、Django (Python)、Gin (Go)

### Hooks 自动化（1 个配置）

预定义配置：PreToolUse、PostToolUse、PostCompaction、UserPromptSubmit、TeammateIdle、TaskCompleted、Stop 等 7 类钩子事件

### MCP 服务器集成（19 个模板）

MCP (Model Context Protocol) 为 Claude Code 提供外部工具和服务集成能力。Auto CLI 内置 19 个常用 MCP 服务器配置模板。

**按分类选用**（`mcp-configs/` 目录）：

| 分类 | 文件 | 服务器数 | 典型用途 |
|------|------|---------|---------|
| 数据库 | `database.json` | 2 | Supabase、ClickHouse |
| 搜索 | `search.json` | 4 | Brave Search、Tavily、Context7、Firecrawl |
| 云服务 | `cloud.json` | 6 | Vercel、Railway、Cloudflare 系列 |
| 开发工具 | `devtools.json` | 4 | GitHub、Playwright、AST Grep、Filesystem |
| AI 增强 | `ai.json` | 3 | Memory、Sequential Thinking、Magic UI |
| 第三方集成 | `integration.json` | 1 | Composio (250+ SaaS) |

**使用方式**：
1. 安装 Auto CLI 后，配置文件位于 `~/.claude/mcp-configs/`
2. 选择需要的分类 JSON，将服务器配置复制到 `~/.claude.json` 的 `mcpServers` 字段
3. 替换 `YOUR_*_HERE` 占位符为实际 API Key
4. 重启 Claude Code 生效

**状态检测**：`/auto:status` 命令会自动扫描 MCP 配置，报告就绪/需配置的服务器数量。

---

## 按规模自动选择执行模式

| Quest Map 规模 | 执行模式 | 说明 |
|----------------|---------|------|
| 1-5 关 | 单 Agent | 主窗口串行逐关执行 |
| 6-15 关 | Subagent 并行 | 按依赖分组，一次性委派多组 |
| 15+ 关 | Agent Teams | 多队友网状协作，持续通信 |

---

## 技术架构

```
用户输入 /auto
    ↓
┌──────────────────────────────────┐
│  auto-core（智能路由大脑）         │
│                                  │
│  PHASE 1: DISCOVER（健壮扫描）     │
│    Grep 批量提取 frontmatter        │
│    绿/黄/红健康报告 + 能力清单     │
│                                  │
│  PHASE 2: REASON                │
│    quest-designer 生成 Quest Map  │
│    三段推理日志（透明化）         │
│    文件存在性校验                 │
│                                  │
│  PHASE 3: EXECUTE                │
│    按规模选模式（单/Subagent/Teams）│
│    动态追加能力                   │
│                                  │
│  PHASE 4: VERIFY（全量门禁）      │
│  PHASE 5: COMMIT（Git 提交）      │
│  PHASE 6: LEARN（经验沉淀）      │
└──────────────────────────────────┘
```

### 透明度输出示例

**PHASE 1 健康检查：**
```
📊 能力健康检查:
  🟢 commands: 15 个  🟢 agents: 11 个  🟢 plugins: 17 个
  🟢 skills: 19 个  🟢 rules: 9 个  🟢 hooks: 1 个配置
  🟡 MCP: 19 个模板（5 个即用 / 14 个需 API Key）
```

**PHASE 2 推理日志：**
```
## 🧠 能力匹配分析
| 能力 | 匹配度 | 匹配理由 |
|------|--------|---------|
| quest-designer | ★★★ | 核心职责 |

## 🎯 能力编排决策
| Quest | 选定能力 | 选择理由 |
|------|---------|---------|
| Quest 1.1 | 直接编码 | 简单 UI，无需 Agent |
```

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
重启 Claude Code，检查 `node --version` >= 18。

**Q: 代码会泄露吗？**
不会。所有代码在本地处理。

**Q: `/auto` 和单个命令的区别？**
`/auto` 是超级命令，AI 会自动判断并调用合适的子命令。单个命令（如 `/auto:tdd`）用于精确控制。

---

## 项目起源

基于以下开源项目开发：

- [everything-claude-code](https://github.com/affaan-m/everything-claude-code)
- [ai-max](https://github.com/zhukunpenglinyutong/ai-max)

---

## License

MIT
