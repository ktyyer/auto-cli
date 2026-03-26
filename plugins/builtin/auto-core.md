---
name: auto-core
version: 7.1.0
description: 智能路由大脑 - 动态能力发现 + AI 推理编排，自主组合 commands/agents/skills/MCP/hooks 完成任务
author: auto-cli
priority: 100
builtin: true
_role: design-doc
---

# 智能路由大脑 (auto-core v7.1) — 设计文档

> **本文档是 `/auto:auto` 命令的设计文档，供人类阅读和开发者理解架构。**
>
> Claude Code 实际执行时加载的是 `commands/auto.md`（用户通过 `/auto` 触发）。
> `commands/auto.md` 是本设计文档的精简执行版本（v7.1 瘦身优化）。
>
> **如果需要修改执行行为，请同时更新 `commands/auto.md`。**

## v7.1 优化说明

`commands/auto.md` 从 34KB（733 行）瘦身至 ~8KB（~170 行），减少 ~75% Token 消耗，解决 30% 处中断问题。

核心变更：
1. **移除参考内容**：使用示例、故障排查、最佳实践、内置能力列表等 → 保留在本设计文档
2. **PHASE 1 扫描优化**：用 `Grep(pattern="^(name|description|tools|model):")` 批量提取 frontmatter，替代逐文件 `Read`（54+ 次 → 4-5 次）
3. **PHASE 2 prompt 精简**：只传元数据（name + description），不传完整 auto.md 正文

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

### ⚠️ 强制规则 — 绝对不可跳过（ALL TASKS, NO EXCEPTIONS）

**无论用户需求看起来多么简单（哪怕只是改一个变量名），必须严格按顺序执行全部 6 个 PHASE。**

1. **禁止跳过 PHASE 1** — 必须扫描项目上下文、技术栈、完整能力清单，输出健康检查报告
2. **禁止跳过 PHASE 2** — 必须调用 quest-designer 生成 Quest Map（即使只有 1 个 Quest），输出透明度摘要和推理日志
3. **禁止"直接动手"** — 任何代码修改都必须在 Quest Map 生成并经用户确认之后进行
4. **禁止"简化流程"** — 不允许因为"任务简单"而合并或省略任何 PHASE

**即使任务只需要 1 步，仍然必须**：
- PHASE 1：扫描项目上下文 + 输出能力健康报告
- PHASE 2：生成 1 个 Quest 的 Quest Map + 输出透明度摘要
- PHASE 3：执行这 1 个 Quest + 按验收标准验证
- PHASE 4-6：门禁、提交、沉淀（按实际情况执行）

**违反此规则的后果**：Quest 设计不准确、代码风格不一致、遗漏验收标准。

---

## PHASE 1: DISCOVER — 发现项目上下文 + 所有可用能力（健壮化）

**目标**：了解项目环境，盘点所有可用的能力。**健壮原则**：目录不存在不崩溃，只输出警告。

```
═══ 第 1 步：读取项目上下文 ═══

并行执行：
  Glob("CLAUDE.md")          → 如存在，Read 加载项目规范
  Glob("REPO_MAP.md")        → 如存在，Read 加载符号地图
  Glob("$HOME/.claude/rules/*.md") → 逐个 Read 加载规则（如存在）
  Glob(".agent/memory/*.md") 或 Glob(".claude/memory/") → Axiom 记忆（如存在）

═══ 第 2 步：检测技术栈 ═══

并行执行：
  Glob("package.json")       → Node/JS/TS 项目 → Read 获取依赖和 scripts
  Glob("pom.xml")            → Java/Maven 项目
  Glob("build.gradle*")      → Java/Gradle 项目
  Glob("go.mod")             → Go 项目
  Glob("requirements.txt")   → Python 项目
  Glob("Cargo.toml")         → Rust 项目

═══ 第 3 步：盘点所有可用能力（健壮化扫描！）═══

健壮扫描原则：每个目录单独扫描，目录不存在或为空时只输出 WARNING，不崩溃。

  Glob("$HOME/.claude/commands/auto/*.md")
    → 如文件数 > 0：Grep 批量提取 frontmatter（仅 name/description）
      Grep(pattern="^(name|description|tools|model):", path="[目录路径]", output_mode="content", type="md")
      → 不读取文件正文，仅提取元数据行
    → 如目录不存在或为空：输出 ⚠️ WARNING "commands 目录为空，跳过"

  Glob("$HOME/.claude/agents/*.md")
    → 同上，Grep 提取 Agent 列表（name + description + tools）

  Glob("$HOME/.claude/plugins/**/*.md")
    → 同上，Grep 提取插件列表（name + description）

  Glob("$HOME/.claude/skills/**/*.md")
    → 同上，Grep 提取 Skill 列表（name + description）

  Glob("$HOME/.claude/mcp-configs/*.json")
    → 读取 JSON，过滤 _comments，统计 mcpServers 条目
    → 含 YOUR_*_HERE 占位符 → 标记 ⚠️ 需配置 API Key
    → 目录不存在 → ⚠️ WARNING "mcp-configs 未安装"

  Glob("$HOME/.claude/hooks/*.json")
    → 读取 JSON，统计 hook 类型数量（PreToolUse/PostToolUse 等）
    → 目录不存在 → ⚠️ WARNING "hooks 未安装"

  Glob("src/**/*.{java,ts,tsx,js,jsx,py,go}")
    → 收集文件路径列表（用于代码风格锚点推荐）

═══ 第 4 步：能力健康检查报告 ═══

扫描完成后输出 Markdown 格式健康报告：

  🟢 绿色：目录存在且有文件
  🟡 黄色：目录存在但为空（不影响核心执行）
  🔴 红色：目录不存在（核心能力可能受影响）

报告示例：
  🟢 commands: 15 个命令
  🟢 agents: 11 个 Agent
  🟡 mcp-configs: 6 个（⚠️ 部分需配置 API Key）
  🔴 hooks: 未安装（不影响核心执行，但门禁自动化不可用）

═══ 第 5 步：能力清单透明输出 ═══

将能力清单以 Markdown 表格输出给用户（不只存于内部）：

  | 类型 | 数量 | 详情 |
  |------|------|------|
  | Commands | 15 | auto:plan, auto:tdd, ... |
  | Agents | 11 | quest-designer, code-reviewer, ... |
  | Plugins | 13 | superpowers, focus-chain, ... |
  | Skills | 17 | tdd-workflow, backend-patterns, ... |
  | MCP | 6 | ⚠️ github(FULL), playwright(READY), ... |
  | Hooks | 7 | PreToolUse, PostToolUse, ... |

MCP 列中标注 ⚠️ 表示需配置 API Key。

═══ 第 6 步：记录上下文 ═══

  TodoWrite([
    { content: "任务: [需求摘要]", status: "completed" },
    { content: "技术栈: [tech]", status: "completed" },
    { content: "可用能力: [N] commands, [N] agents, [N] skills, [N] MCP, [N] hooks", status: "completed" },
    { content: "健康状态: [🟢/🟡/🔴]", status: "completed" }
  ])
```

**输出给用户：**
```
🚀 /auto 开始执行

📝 任务: [一句话摘要]
🔍 项目: [语言] + [框架]
🧰 可用能力: [N] 个命令 · [N] 个 Agent · [N] 个插件 · [N] 个 Skill · [N] 个 MCP 服务 · [N] 个 Hook

📊 能力健康检查:
  🟢 commands: [N] 个  🟢 agents: [N] 个  🟢 plugins: [N] 个
  🟢 skills: [N] 个  🟡 mcp: [N] 个(⚠️需配置)  🟢 hooks: [N] 个
💡 运行 `auto install` 补全所有能力
```

---

## PHASE 2: REASON — quest-designer 统筹分析 + 产出 Quest 计划

**目标**：将 PHASE 1 收集的完整能力清单交给 quest-designer，由它自主分析并设计 Quest Map。

**关键**：quest-designer 看到的是完整原始数据，不是主窗口预筛选后的结论。分析和设计由同一个 Agent 完成，避免信息损耗。

**透明度要求**：输出顺序必须为 → 透明度摘要 → 推理日志三段 → Quest Map → 文件校验结果

```
═══ 第 1 步：调用 quest-designer ═══

将 PHASE 1 收集的全部数据传给 quest-designer：

  Agent({
    subagent_type: "quest-designer",
    prompt: "你是 quest-designer。
     以下是项目完整上下文和能力清单：

     【用户需求】[原始需求描述]
     【技术栈】[语言+框架，项目规范，Axiom 记忆]
     【完整能力清单】
       Commands: [全部命令的 name + description]
       Agents: [全部 Agent 的 name + description + tools]
       Plugins: [全部插件的 name + description]
       Skills: [全部 Skill 的 name + description]
       MCP: [全部 MCP 服务配置，含占位符的标记 ⚠️]
       Hooks: [全部 Hook 配置]
     【现有代码文件】[src/ 下文件列表，用于代码风格锚点]

     你的任务（必须按顺序执行）：
     0. 【透明度摘要】输出能力发现统计表（能力总数、高匹配数）
     1. 【推理日志·段一】输出能力匹配分析（★评级 + 匹配理由）
     2. 【推理日志·段二】输出 Quest 拆分推理（复杂度评估 + 拆分理由）
     3. 【推理日志·段三】输出能力编排决策（每个 Quest 为什么选这个能力）
     4. 【Quest Map】输出标准格式（含 💡 选择理由 字段）
     5. 【文件校验】对每个 📁 代码风格参考执行 Bash('test -f 路径') 存在性检查，输出结果
     6. 遵循五大原则：原子化、黑盒验收、现代工程化、代码风格继承、能力编排透明
     7. 建议执行模式（单Agent/Subagent/Teams）
     输出标准 Quest Map 格式，等待用户确认。"
  })

═══ 第 2 步：quest-designer 内部分析维度 ═══

quest-designer 自主审视能力清单，分析维度：
  - 哪些 Agent 的专长与问题匹配？（读 agent 的 description 判断）
  - 哪些 Skill 知识库能提供领域最佳实践？（如后端架构 → backend-patterns）
  - 哪些 Plugin 能加速某个子步骤？（读 plugin 的 description 判断）
  - 哪些 MCP 服务器提供了外部能力？（如需要浏览器操作 → playwright MCP）
  - 哪些 Command 可以处理某个独立子任务？（如需要 TDD → auto:tdd）
  - 已有的 Hooks 会自动做什么？（如 PostToolUse 自动格式化）
  - 为什么这个 Quest 选 Agent X 而不选 Skill Y？（选择理由必须透明）

═══ 第 3 步：产出 Quest 执行计划 ═══

⚡ Quest 设计 5 大原则（所有任务都必须遵循）：

  原则 1 — 原子化递进：每个 Quest 只做一件事，禁止混合（如前后端混写）
  原则 2 — 黑盒验收：每个 Quest 的验收标准必须是 PM 肉眼可见的物理反馈
           （运行命令 X → 看到输出 Y / 点击按钮 A → 看到变化 B / curl 返回 JSON）
           后端 Quest 没有界面时，必须提供 API 测试命令或终端日志验收
  原则 3 — 防超纲：每个 Quest 必须标注"本步禁止做什么"，防止越界
  原则 4 — 代码风格继承：每个 Quest 必须指定参考的现有代码文件
           （Glob 扫描项目，找到最接近的现有代码作为参考锚点）
  原则 5 — 能力编排透明：每个 Quest 必须说明选择该能力的理由

统一产出原子化 Quest 清单，每条 6 字段：
  ① 🎯 任务目标（一句话，只做一件事）
  ② 🛠️ 选定的能力（从能力清单中挑选：Agent/Skill/MCP/Plugin/直接编码）
  ③ 💡 选择理由（为什么选这个能力，而非其他）
  ④ 📁 代码风格参考（Glob 扫描现有代码，指定参考文件）
  ⑤ 🚫 边界限制（本步禁止做什么）
  ⑥ ✅ 验收标准（PM 肉眼可见的操作 → 预期结果）
  第三方 API 接入必须单独成为一个 Quest（胶水编程原则）
  TodoWrite 创建所有子任务

根据 Quest Map 规模自动选择执行模式（PHASE 3 使用）：
  1-5 关   → 单 Agent 直接执行
  6-15 关  → Subagent 并行
  15+ 关   → Agent Teams 编排
```

**输出给用户：**
```
📋 执行计划（[N] 个 Quest）：

## 📊 能力发现摘要
| 类型 | 发现数 | 高匹配 |
|------|--------|--------|
| Commands | N | M |
| Agents | N | M |
| Plugins | N | M |
| Skills | N | M |
| MCP | N | M |
| Hooks | N | M |

## 🧠 能力匹配分析（推理日志·段一）
| 能力 | 匹配度 | 匹配理由 |
|------|--------|---------|
| quest-designer | ★★★ | 核心职责 |
...

## 📋 Quest 拆分推理（推理日志·段二）
...

## 🎯 能力编排决策（推理日志·段三）
| Quest | 选定能力 | 选择理由 |
|------|---------|---------|
| Quest 1.1 | 直接编码 | 简单 UI，无需 Agent |
...

## ⚠️ 代码风格参考文件校验
✅ 所有参考文件已验证存在
（或 ⚠️ [N] 个文件不存在）

---

# 《项目闯关大纲》
[Quest Map 内容，含 💡 选择理由 字段]
```

---

## PHASE 3: EXECUTE — 逐条执行，动态追加能力

**目标**：按 Quest 逐个执行。执行过程中如果发现需要新能力，随时追加。

```
根据 PHASE 2 确定的执行模式：

IF Quest Map <= 5 关 → 单 Agent 直接执行（主窗口逐关串行）
IF Quest Map 6-15 关 → Subagent 并行（按依赖分组，一次性 Agent() 委派多组）
IF Quest Map 15+ 关  → Agent Teams 编排（调用 multi-agent-orchestrator）

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
    Read("$HOME/.claude/skills/[matched-skill].md") → 加载领域最佳实践作为上下文
    例：后端 API 设计 → Read("$HOME/.claude/skills/backend-patterns.md")
    例：React 前端 → Read("$HOME/.claude/skills/frontend-patterns.md")
    例：ClickHouse 查询 → Read("$HOME/.claude/skills/clickhouse-io.md")

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
Glob(".agent/memory/*.md") 或 Glob(".claude/memory/*.md")
  → 如存在，Read + Edit 追加（路径为用户项目根目录下的相对路径，无需修改）
IF 存在 → Read + Edit 追加：
  - 架构决策
  - 新编码模式
  - 踩坑记录

IF 修改了核心架构 →
  输出："💡 建议运行 /auto:update-codemaps 更新架构地图"

输出完成报告：
"✅ 任务完成！
📊 执行摘要：
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
