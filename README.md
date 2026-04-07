# Auto CLI

> Claude Code `/auto` 超级命令 -- 一条指令，AI 自动编排所有能力完成任务

---

## 这是什么？

Auto CLI 是运行在 Claude Code 中的智能开发辅助工具。输入 `/auto` + 你的需求，AI 会：

1. **扫描项目** -- 检测语言、框架、已有规范
2. **发现能力** -- 盘点可用的 commands、agents、skills、hooks
3. **智能推理** -- 结合 Router、Skills、当前上下文生成 Quest 计划
4. **逐步执行** -- 按规模自动选择执行模式，拆解为可验证的执行步骤
5. **自动门禁** -- 构建验证、测试、lint 与安全检查
6. **知识沉淀** -- 执行经验自动保存，越用越强

**核心理念**：不是硬编码路由，是 AI 动态发现 + 推理编排。

---

## 环境要求

- **Node.js** >= 18（用于安装脚本）
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
# 产物: auto-cli-0.30.0.tgz（~83KB）
```

将 tgz 文件拷贝到目标电脑，然后：

```bash
# macOS / Linux / Git Bash
tar -xzf auto-cli-0.30.0.tgz
cd package
bash scripts/install.sh

# Windows
# 解压 auto-cli-0.30.0.tgz，进入 package 目录
# 双击 scripts\install.bat
```

### 一键重装（开发机用）

```bash
# macOS / Linux / Git Bash
npm run reinstall

# Windows 双击运行
scripts\reinstall.bat
```

该脚本自动完成：打包 → 卸载旧版全局包 → 解压安装新版 → 清理临时文件。

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
| 0 文件变更（纯探索） | 探索模式 | PHASE 1 → 2 → 直接回答 → 6 |
| 1 文件且 <=10 行变更 | 微型模式 | PHASE 1 → 2 → 执行 → 4 → 6 |
| <=3 文件且无架构变更 | 轻量模式 | PHASE 1 → 2 → 执行 → 4 → 6 |
| >3 文件或存在架构变更 | 完整模式 | 完整 6 PHASE |

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

位于 `rules/` 目录，在 `~/.claude/rules/` 中配置：
- agents、coding-style、git-workflow、hooks
- java-coding-style、performance、security、testing

### Skills 知识库（8 个）

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

### Hooks 自动化

位于 `hooks/hooks.json`，包含 16 个 Hook：
- PreToolUse: TDD Guard、Dev Server Blocker、Git Push Review、Doc Blocker 等
- PostToolUse: Prettier + ESLint、TypeScript Check、Coverage Check 等
- PostCompaction、UserPromptSubmit、TaskCompleted、Stop 等

---

## 6 PHASE 工作流

```
/auto 用户需求
    |
PHASE 1: DISCOVER -- 扫描技术栈、能力清单、环境快检
PHASE 2: REASON   -- Quest Map + Agent 路由 + Skill 注入
PHASE 3: EXECUTE  -- 逐关执行（串行/并行/Teams）
PHASE 4: VERIFY   -- 按模式门禁（编译/测试/lint/安全）
PHASE 5: COMMIT   -- 自动提交
PHASE 6: LEARN    -- 知识沉淀 + 经验持久化
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
