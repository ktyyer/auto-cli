# Auto CLI

> Claude Code 超级开发辅助 -- 一条命令，AI 自动编排所有能力完成任务

---

## 这是什么？

Auto CLI 是运行在 Claude Code 中的智能开发辅助工具。输入 `/auto` + 你的需求，AI 会：

1. **扫描项目** -- 检测语言、框架、已有规范
2. **发现能力** -- 盘点所有可用的 commands、agents、skills、hooks
3. **智能推理** -- quest-designer v4 深度分析代码，产出**完整可编译代码蓝图**
4. **Quest 拆解** -- 将任务拆为原子化微步骤，每步含完整代码 + 预判坑点 + 验收标准
5. **逐步执行** -- PHASE 3 直接复制蓝图代码，编译验证，增量提交
6. **自动门禁** -- 构建、测试、安全扫描全量检查
7. **Git 提交** -- 每关通过后增量提交，失败只回滚当前关

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
auto install

# 方式二：从源码安装
npm pack
npm install -g auto-cli-0.24.0.tgz
auto install

# 安装后重启 Claude Code
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

# 项目状态
/auto:status

# 创建 Hook
/auto:create-hook
```

---

## 能力总览

### 命令（6 个）

| 命令 | 用途 |
|------|------|
| `/auto` | 超级命令 -- 说需求，AI 自动编排所有能力完成 |
| `/auto:route` | 智能路由 -- 自动分析意图并推荐最合适的 Agent |
| `/auto:doctor` | 环境诊断 -- 检查 Node.js、Claude Code 配置 |
| `/auto:status` | 查看项目状态和能力 |
| `/auto:create-hook` | 交互式创建 Claude Code Hook |
| `/auto:learn` | 从会话或 Git 历史提取可复用经验并保存为 Skill（双模式） |

### Agent（9 个）

| Agent | 作用 |
|-------|------|
| quest-designer | 闯关大纲设计师 v4 -- PRD -> 完整代码蓝图 |
| architect | 架构设计评审 |
| tdd-guide | TDD 流程指导 |
| code-reviewer | 代码质量审查 |
| security-reviewer | 安全漏洞检查 |
| build-error-resolver | 构建错误修复 |
| e2e-runner | E2E 测试 |
| doc-updater | 文档更新 |
| refactor-cleaner | 死代码清理 |

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

### Skills 知识库（4 个）

| Skill | 领域 |
|-------|------|
| workflow-patterns | 开发工作流模式（Plan Mode + Multi-Agent 编排 + 根因追踪 + 10 维度代码审查清单） |
| unified-memory-system | 统一记忆系统（上下文管理 + 会话恢复 + 知识沉淀） |
| error-patterns | 常见错误模式速查与修复方案 |
| init-project | CLAUDE.md 智能初始化（结构化模板 + 7 板块生成） |

### Hooks 自动化（7 类钩子）

预定义配置覆盖：PreToolUse、PostToolUse、PostCompaction、UserPromptSubmit、TeammateIdle、TaskCompleted、Stop 等 7 类钩子事件。

包含 TDD Guard、自动格式化、密钥检测、大文件警告、console.log 审计等实用 Hook。

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
    |
+------------------------------------------+
|  auto-core（智能路由大脑）                 |
|                                          |
|  PHASE 1: DISCOVER（健壮扫描）            |
|    扫描技术栈、能力清单                   |
|                                          |
|  PHASE 2: REASON                         |
|    quest-designer 生成 Quest Map          |
|    Canonical Router 推荐 Agent            |
|                                          |
|  PHASE 3: EXECUTE                        |
|    按规模选模式（单/Subagent/Teams）      |
|    复制蓝图代码 -> 编译验证 -> 增量提交   |
|                                          |
|  PHASE 4: VERIFY（全量门禁）             |
|  PHASE 5: COMMIT（Git 提交）             |
|  PHASE 6: LEARN（经验沉淀）              |
+------------------------------------------+
```

---

## Canonical Router（权威路由器）

v0.12.0 引入的核心组件，实现中心化 Agent 路由决策：

- **Agent 注册表**：9 个内置 Agent 的完整清单定义
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
auto              # 交互模式（安装/更新/卸载）
auto install      # 安装组件（-y 跳过确认，-f 强制覆盖）
auto update       # 更新已安装组件
auto uninstall    # 卸载组件
auto route <意图> # 智能路由（-d 调试，-j JSON 输出）
auto analyze      # 能力分析（-j JSON 输出）
auto list         # 列出可用组件
auto docs         # 打开文档
auto save insight -c "内容"  # 保存知识条目
auto save list                 # 列出知识条目
auto save search -q "关键词"  # 搜索知识条目
```

---

## 常见问题

**Q: 安装后命令不生效？**
重启 Claude Code，检查 `node --version` >= 18。

**Q: 代码会泄露吗？**
不会。所有代码在本地处理。

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
- **思考** = PHASE 2 REASON（quest-designer 深度分析 + Quest Map）
- **行动** = PHASE 3 EXECUTE（逐关执行蓝图代码）
- **验证** = PHASE 4 VERIFY（全量门禁检查）

---

## 版本历史

### v0.24.0（当前）

**定位精简优化**：
- 聚焦"智能超级命令"核心定位
- Skills 精简：7 -> 5（移除 backend-patterns, frontend-patterns）
- COMPONENTS 清理：6 -> 5（移除冗余 knowledge 定义）
- 核心命令：7 个（auto, route, doctor, status, create-hook, skill-create, learn）
- 项目定位更清晰，维护成本更低

### v0.23.0

**新增能力引入**：
- 新增 `/skill-create` 和 `/learn` 命令

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
