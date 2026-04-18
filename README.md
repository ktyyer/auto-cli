# Auto CLI

> Claude Code `/auto` 超级命令 -- 一条指令，AI 自动编排所有能力完成任务

---

## 这是什么？

Auto CLI 是运行在 Claude Code 中的纯 Markdown 智能开发辅助工具。输入 `/auto` + 你的需求，AI 会：

1. **扫描项目** -- 检测语言、框架、已有规范
2. **发现能力** -- 盘点可用的 commands、agents、skills、hooks
3. **智能推理** -- 结合 Router、Skills、历史经验生成 Quest 计划
4. **逐步执行** -- 按规模自动选择执行模式，拆解为可验证的执行步骤
5. **自动门禁** -- 构建验证、测试、lint 与安全检查
6. **知识沉淀** -- 执行经验自动保存，越用越强

**核心理念**：纯 Markdown 指令驱动，无需额外运行时。Phase-Skill 自动映射 + Agent 反馈闭环，经验持续沉淀并自动检索复用。

---

## 环境要求

- **Node.js** >= 18（仅用于安装脚本，运行时零依赖）
- **Claude Code** 已安装并可用

---

## 安装

### 从源码安装

```bash
git clone https://github.com/ktyyer/auto-cli.git
cd auto-cli
npm run install        # 安装到 ~/.claude/
```

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

| 命令 | 用途 |
|------|------|
| `/auto` | 超级命令 -- 说需求，AI 自动编排所有能力完成 |
| `/auto:route` | 智能路由 -- 自动分析意图并推荐最合适的 Agent |
| `/auto:doctor` | 环境诊断 -- 健康检查与安全范围内的自动修复 |
| `/auto:status` | 项目状态 -- 输出 runtime、能力、健康度 |
| `/auto:create-hook` | 生成 Hook 模板建议 |
| `/auto:learn` | 分析 Git 历史模式并返回结构化结果 |

### 四级执行模式

| 条件 | 执行模式 | 说明 |
|------|---------|------|
| 0 文件变更（纯探索） | 探索模式 | PHASE 1 → 2 → 展示 Quest → 回答 → 5 → 6 |
| 1 文件且 <=10 行变更 | 微型模式 | PHASE 1 → 2 → 执行 → 4 → 5 → 6 |
| <=3 文件且无架构变更 | 轻量模式 | PHASE 1 → 2 → 执行 → 4 → 5 → 6 |
| >3 文件或存在架构变更 | 完整模式 | 完整 6 PHASE（含自检 + 门禁） |

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
| quest-designer | 闯关大纲设计师 |
| shared-principles | Agent 公共原则和交接协议 |

### Rules 编码规范

位于 `rules/` 目录，安装后配置在 `~/.claude/rules/`：
- agents、coding-style、git-workflow、hooks
- performance、security、testing

### Skills 知识库（11 个）

| Skill | 领域 |
|-------|------|
| init-project | CLAUDE.md 智能初始化 |
| workflow-patterns | 开发工作流模式 |
| code-style-enforcer | TS/JS + Java 代码风格规则 |
| git-workflow | Git 分支策略 + 约定式提交 |
| dependency-analyzer | 依赖安全分析 |
| performance-patterns | 性能优化模式 |
| java-patterns | Spring Boot + MyBatis Plus 模板 |
| error-patterns | 错误模式速查 |
| skill-creator | Skill 编写方法论（意图捕获 → SKILL.md 编写 → 测试迭代） |
| systematic-debugging | 系统化调试方法论（4 阶段强制流程） |
| prd-writer | PRD 需求文档写作（两阶段：概念版 → 落地板） |

### Hooks 自动化

位于 `hooks/hooks.json`，包含 17 个 Hook：
- PreToolUse (6): TDD Guard、Dev Server Blocker、Git Push Review、Doc Blocker、Large File Warning、TDD Guard CLI
- PostToolUse (6): Prettier + ESLint、TypeScript Check、Coverage Check、Console.log Warning、Frequent Commit Reminder、PR Creation Log
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
PHASE 2: PLAN      -- 知识检索 + Quest Map + Agent 路由 + Skill 注入（Phase-Skill 自动映射）
PHASE 3: EXECUTE   -- 逐关执行（串行/并行/Teams，每关输出进度卡片）
PHASE 4: VERIFY    -- 按模式门禁（编译/测试/lint/安全）
PHASE 5: SUMMARIZE -- 完成阶段总结（不自动提交）
PHASE 6: LEARN     -- 知识沉淀（踩坑/模式/决策/Agent反馈）→ 下次自动检索复用
```

每个 PHASE 均有自检机制（检查上一阶段产出）和门禁（输出后才能进入下一阶段）。

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
重启 Claude Code。

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
