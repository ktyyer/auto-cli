---
name: auto-core
version: 7.0.0
description: 智能路由大脑 - 动态能力发现 + AI 推理编排，自主组合 commands/agents/skills/MCP/hooks 完成任务
author: auto-cli
priority: 100
builtin: true
---

# 智能路由大脑 (auto-core v7.0)

> `/auto:auto` 的核心执行引擎。**不是硬编码路由，是动态能力发现 + AI 推理编排。**

---

## 核心理念

**你不是按预设路由表执行的机器人，你是一个拥有工具箱的智能工程师。**

1. 先发现所有可用能力（commands、agents、skills、MCP、hooks）
2. 分析用户的具体问题
3. 推理出最佳的能力组合
4. 动态组合执行计划
5. 执行过程中发现需要新能力 → 随时追加

---

## 主控执行协议

严格按 **PHASE 1 → 2 → 3 → 4 → 5 → 6** 顺序执行。

---

## PHASE 1: DISCOVER — 发现项目上下文 + 所有可用能力

**目标**：了解项目环境，盘点所有可用的能力。

```
═══ 第 1 步：读取项目上下文 ═══

并行执行：
  Glob("CLAUDE.md")          → 如存在，Read 加载项目规范
  Glob("REPO_MAP.md")        → 如存在，Read 加载符号地图
  Glob(".claude/rules/*.md") → 逐个 Read 加载规则

═══ 第 2 步：检测技术栈 ═══

并行执行：
  Glob("package.json")       → Node/JS/TS 项目 → Read 获取依赖和 scripts
  Glob("pom.xml")            → Java/Maven 项目
  Glob("build.gradle*")      → Java/Gradle 项目
  Glob("go.mod")             → Go 项目
  Glob("requirements.txt")   → Python 项目
  Glob("Cargo.toml")         → Rust 项目

═══ 第 3 步：盘点所有可用能力（关键！）═══

扫描项目中所有已安装的能力，构建能力清单：

  Glob("commands/*.md")      → 读取每个文件的 frontmatter description
                               → 得到所有可用命令列表（如 auto:quest, auto:tdd, auto:plan...）

  Glob("agents/*.md")        → 读取每个文件的 frontmatter name + description + tools
                               → 得到所有可用 Agent 列表（如 quest-designer, code-reviewer...）

  Glob("plugins/**/*.md")    → 读取每个文件的 frontmatter name + description
                               → 得到所有可用插件列表

  Glob("skills/*.md")        → 读取每个文件的 frontmatter name + description
                               → 得到所有可用 Skill 知识库（如 backend-patterns, frontend-patterns...）

  Glob("mcp-configs/*.json") → Read 获取所有已配置的 MCP 服务器
                               → 得到外部能力列表（如 playwright, composio, context7...）
                               → 注意：MCP 是模板配置，实际可用取决于用户是否配置了 API Key

  Glob("hooks/*.json")       → Read 获取所有已配置的 Hook
                               → 了解哪些自动化门禁已在后台运行

将所有发现的能力整理为内部能力清单（不输出给用户，仅供 PHASE 2 推理使用）。

═══ 第 4 步：评估复杂度 ═══

  Bash("find src -type f 2>/dev/null | wc -l") → 文件计数

  根据用户需求 + 文件规模 + 依赖关系，判定：
  complexity = simple | medium | complex | ultra

  复杂度修正：
  - 有外部 API 调用 → +1 级
  - 有数据库 Schema 变更 → +1 级
  - 跨 5+ 文件 → 至少 complex
  - 跨 10+ 文件且需 2+ 角色 → ultra

═══ 第 5 步：记录上下文 ═══

  TodoWrite([
    { content: "任务: [需求摘要]", status: "completed" },
    { content: "复杂度: [level]，技术栈: [tech]", status: "completed" },
    { content: "可用能力: [N] commands, [N] agents, [N] skills, [N] MCP", status: "completed" }
  ])
```

**输出给用户：**
```
🚀 /auto 开始执行

📝 任务: [一句话摘要]
🔍 项目: [语言] + [框架]
🎯 复杂度: [🟢简单 / 🟡中等 / 🔴复杂 / 🔴超复杂]
🧰 可用能力: [N] 个命令 · [N] 个 Agent · [N] 个插件 · [N] 个 Skill · [N] 个 MCP 服务
```

---

## PHASE 2: REASON — AI 推理最佳能力组合 + 产出 Quest 计划

**目标**：基于用户问题和 PHASE 1 发现的全部能力，推理出最优执行方案。

**这不是查表，是推理。** 你要回答："在我拥有的所有能力中，哪些组合最适合解决这个具体问题？"

```
═══ 第 1 步：能力匹配推理 ═══

审视 PHASE 1 盘点的能力清单，对每个能力思考：
  "这个能力对解决用户当前问题有帮助吗？帮助程度如何？"

推理维度：
  - 哪些 Agent 的专长与问题匹配？（读 agent 的 description 判断）
  - 哪些 Skill 知识库能提供领域最佳实践？（如后端架构 → backend-patterns）
  - 哪些 Plugin 能加速某个子步骤？（读 plugin 的 description 判断）
  - 哪些 MCP 服务器提供了外部能力？（如需要浏览器操作 → playwright MCP）
  - 哪些 Command 可以处理某个独立子任务？（如需要 TDD → auto:tdd）
  - 已有的 Hooks 会自动做什么？（如 PostToolUse 会自动格式化 JS/TS）

产出：选定的能力组合（仅选真正需要的，不贪多）

═══ 第 2 步：产出 Quest 执行计划 ═══

⚡ Quest 设计 4 大原则（所有复杂度都必须遵循）：

  原则 1 — 原子化递进：每个 Quest 只做一件事，禁止混合（如前后端混写）
  原则 2 — 黑盒验收：每个 Quest 的验收标准必须是 PM 肉眼可见的物理反馈
           （运行命令 X → 看到输出 Y / 点击按钮 A → 看到变化 B / curl 返回 JSON）
           后端 Quest 没有界面时，必须提供 API 测试命令或终端日志验收
  原则 3 — 防超纲：每个 Quest 必须标注"本步禁止做什么"，防止越界
  原则 4 — 代码风格继承：每个 Quest 必须指定参考的现有代码文件
           （Glob 扫描项目，找到最接近的现有代码作为参考锚点）

按复杂度决定 Quest 粒度：

IF complexity == simple:
  产出 1-3 条 Quest，每条包含：
  🎯 目标 + 🚫 边界 + ✅ 验收标准（必须是肉眼可见的）+ 使用的能力
  TodoWrite 记录

IF complexity == medium 或 complex:
  产出原子化 Quest 清单，每条 5 字段：
  ① 🎯 任务目标（一句话，只做一件事）
  ② 🛠️ 选定的能力（从能力清单中挑选：Agent/Skill/MCP/直接编码）
  ③ 📁 代码风格参考（Glob 扫描现有代码，指定参考文件）
  ④ 🚫 边界限制（本步禁止做什么）
  ⑤ ✅ 验收标准（PM 肉眼可见的操作 → 预期结果）
  第三方 API 接入必须单独成为一个 Quest（胶水编程原则）
  TodoWrite 创建所有子任务

IF complexity == ultra:
  AI 判断最优路径：

  路径 A — 需要 PM 审核的大型项目：
    Agent({ prompt: "你是 quest-designer，为以下需求设计 Quest Map..." })
    → 输出给用户审核 → 用户可提意见要求重新拆分 → 确认后逐条执行

  路径 B — 子任务独立可并行：
    Agent({ prompt: "你是 multi-agent-orchestrator，创建 Team 并行执行..." })
    → orchestrator 内部完成 → 跳到 PHASE 5
```

**输出给用户：**
```
📋 执行计划（[N] 个 Quest）：

  🧰 选用能力：
    • Agent: [选定的 agent 列表]
    • Skill: [选定的 skill 列表]
    • MCP: [选定的 MCP 服务列表]

  Quest 清单：
  1. ⏸ [Quest 1 目标] — 使用 [能力]
  2. ⏸ [Quest 2 目标] — 使用 [能力]
  ...
```

---

## PHASE 3: EXECUTE — 逐条执行，动态追加能力

**目标**：按 Quest 逐个执行。执行过程中如果发现需要新能力，随时追加。

```
FOR EACH quest IN plan:

  ── 步骤 A：标记开始 ──
  TodoWrite: 标记该 quest 为 in_progress
  输出："⏳ 正在执行 Quest [N]: [目标]"

  ── 步骤 B：按选定能力执行 ──
  根据 PHASE 2 为该 quest 选定的能力，执行对应操作：

  【直接编码】（最常见）：
    Read 目标文件 → Edit/Write 应用变更

  【调用 Agent】（当 quest 需要专业角色时）：
    Agent({
      subagent_type: "general-purpose",
      prompt: "[基于该 agent 的 description 构造 prompt]：[quest 目标]"
    })

  【调用 Skill】（当 quest 精确匹配某个 Skill 时）：
    Skill("[skill-name]")

  【调用 MCP】（当 quest 需要外部服务时）：
    例：需要浏览器操作 → 通过 playwright MCP 的工具执行
    例：需要搜索文档 → 通过 context7 MCP 查询
    例：需要 SaaS 集成 → 通过 composio MCP 操作

  【加载 Skill 知识库】（当 quest 涉及特定领域时）：
    Read("skills/[matched-skill].md") → 加载领域最佳实践作为上下文
    例：后端 API 设计 → Read("skills/backend-patterns.md")
    例：React 前端 → Read("skills/frontend-patterns.md")
    例：ClickHouse 查询 → Read("skills/clickhouse-io.md")

  ── 步骤 C：动态能力追加 ──
  IF 执行过程中发现计划外的需求：
    重新审视能力清单，追加新能力到当前 quest
    例："实现过程中发现需要数据库迁移 → 追加 Supabase MCP"
    例："发现代码有安全漏洞 → 追加 security-reviewer Agent"

  ── 步骤 D：遵守边界限制 ──
  严格遵守该 quest 的 🚫 边界限制

  ── 步骤 E：迷你验证 ──
  执行该 quest 的 ✅ 验收标准：
    Bash 运行相关测试或编译命令
    IF 通过：
      TodoWrite: 标记 completed
      输出："✅ Quest [N] 完成"
    IF 失败：
      分析错误 → Edit 修复 → 重跑（最多 2 次）
      IF 仍失败：停止，向用户报告

NEXT quest
```

---

## PHASE 4: VERIFY — 全量门禁

**目标**：所有 Quest 完成后，全量门禁。

```
按 PHASE 1 检测到的技术栈执行：

── Node/JS/TS ──
Bash("npm run build 2>&1")           → 必须 exit 0
Bash("npm test 2>&1")                → 必须全部通过
Bash("npm run test:coverage 2>&1")   → 覆盖率 >= 80%（如有）

── Java/Maven ──
Bash("mvn compile -q 2>&1")          → 必须 exit 0
Bash("mvn test 2>&1")                → 必须全部通过

── Java/Gradle ──
Bash("./gradlew build 2>&1")         → 必须 exit 0

── Python ──
Bash("python -m pytest 2>&1")        → 必须全部通过

── Go ──
Bash("go build ./... 2>&1")          → 必须 exit 0
Bash("go test ./... 2>&1")           → 必须全部通过

── 通用安全扫描 ──
Grep(pattern="(sk-[a-zA-Z0-9]{20,}|AKIA[0-9A-Z]{16}|password\\s*=\\s*['\"][^'\"]+['\"])", path="src/")
→ 如有匹配 → 安全警告

── 失败处理 ──
IF 任一门禁失败：
  第 1 次：Read 错误 → 分析 → Edit 修复 → 重跑
  第 2 次：尝试替代方案 → 重跑
  第 3 次：Bash("git checkout -- .") 回滚 → 报告用户
```

---

## PHASE 5: COMMIT — Git 提交

```
Bash("git status --porcelain")

IF 无变更 → 跳过
ELSE：
  Bash("git add [本轮修改的具体文件]")
  Bash("git commit -m '<type>(<scope>): <description>'")
  输出："📦 已提交: [message] ([N] 文件)"
```

---

## PHASE 6: LEARN — 经验沉淀

```
IF complexity >= complex：
  Glob(".agent/memory/*.md") 或 Glob(".claude/memory/*.md")
  IF 存在 → Read + Edit 追加：
    - 架构决策
    - 新编码模式
    - 踩坑记录

  IF 修改了核心架构 →
    输出："💡 建议运行 /auto:update-codemaps 更新架构地图"

输出完成报告：
"✅ 任务完成！
📊 执行摘要：
  • 复杂度: [level]
  • Quest: [N] 个（全部通过）
  • 使用能力: [列出实际调用的 agents/skills/MCP]
  • 门禁: 构建✅ 测试✅ 安全✅
  • 提交: [commit message]"
```

---

## 核心原则

1. **动态发现** — 启动时扫描所有可用能力，不预设固定路由
2. **AI 推理** — 根据具体问题推理最佳能力组合，不查表
3. **Quest 驱动** — 所有任务输出 Quest 格式，可验收
4. **动态追加** — 执行中发现新需求，随时追加能力
5. **安全底线** — 危险操作等用户确认，门禁不可跳过
6. **可回溯** — 每轮 Git Commit，失败可回滚
