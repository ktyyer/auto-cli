# Auto CLI

> Claude Code 超级开发辅助 — 一条命令，AI 自动编排所有能力完成任务

---

## 这是什么？

Auto CLI 是运行在 Claude Code 中的智能开发辅助工具。输入 `/auto` + 你的需求，AI 会：

1. **扫描项目** — 检测语言、框架、已有规范
2. **发现能力** — 盘点所有可用的 commands、agents、skills、MCP、hooks
3. **智能推理** — 根据你的具体问题，动态选择最佳能力组合
4. **Quest 拆解** — 将任务拆为原子化微步骤，每步带验收标准
5. **逐步执行** — 编码、测试、审查，每步可验证
6. **自动门禁** — 构建、测试、安全扫描全量检查
7. **Git 提交** — 门禁通过后自动提交

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
| `/auto:quest` | 输入 PRD，输出 PM 可验收的闯关大纲 |
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

### Skill 知识库（5 个）

| Skill | 领域 |
|-------|------|
| backend-patterns | 后端架构最佳实践 |
| frontend-patterns | 前端组件模式 |
| clickhouse-io | ClickHouse 查询优化 |
| coding-standards | 编码规范 |
| project-guidelines-example | 项目规范模板 |

### 插件（18 个）

包含 8 大能力插件（TDD、前端设计、代码清理、HTML 工具、浏览器自动化、代码审查、演进闭环、状态机）+ 4 框架插件（Spring/React/Django/Gin）+ 6 基础设施插件。

### MCP 外部服务（20 个）

GitHub、Supabase、Vercel、Railway、Cloudflare、ClickHouse、Playwright、Composio、Brave Search、Tavily、Context7 等。

### Hooks 自动化（7 事件 13 条规则）

PreToolUse、PostToolUse、PostCompaction、UserPromptSubmit、TeammateIdle、TaskCompleted、Stop。

---

## 复杂度自动路由

| 复杂度 | 触发条件 | AI 策略 |
|--------|---------|---------|
| 简单 | 1 文件、修复类 | 直接实现 |
| 中等 | 2-5 文件、模块级 | TDD + 审查 |
| 复杂 | 5-10 文件、系统级 | 规划 + TDD + 审查 + 记忆 |
| 超复杂 | >10 文件 + >2 角色 | Agent Teams 并行编排 |

---

## 技术架构

```
用户输入 /auto
    ↓
┌──────────────────────────────────┐
│  auto-core v7.0（智能路由大脑）    │
│                                  │
│  PHASE 1: DISCOVER               │
│    扫描 commands/agents/skills/  │
│    plugins/MCP/hooks 全部能力     │
│                                  │
│  PHASE 2: REASON                 │
│    AI 推理最佳能力组合            │
│    产出 Quest 计划（4 大原则）     │
│                                  │
│  PHASE 3: EXECUTE                │
│    逐条执行 Quest                │
│    动态追加能力                   │
│                                  │
│  PHASE 4: VERIFY（全量门禁）      │
│  PHASE 5: COMMIT（Git 提交）     │
│  PHASE 6: LEARN（经验沉淀）      │
└──────────────────────────────────┘
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
