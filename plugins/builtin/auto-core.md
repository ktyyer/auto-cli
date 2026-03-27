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

### ⚠️ 不可绕过的硬性约束（HARD CONSTRAINTS — 无例外）

**以下约束不可协商、不可"灵活解读"、不可以"任务简单"为由绕过。**

#### 约束 1：顺序锁定
PHASE 1 → 2 → 3 → 4 → 5 → 6，不可跳过、不可合并、不可重排。
- IF 你没有输出能力健康检查报告 → 你不在 PHASE 1，不可进入 PHASE 2
- IF 你没有调用 `Agent({ subagent_type: "quest-designer" })` → 你没有完成 PHASE 2，不可进入 PHASE 3
- IF 你没有 Quest Map → 你不可编辑任何代码文件

#### 约束 2：quest-designer 必须被调用
PHASE 2 的唯一合法操作是调用 `Agent({ subagent_type: "quest-designer", ... })`。
- 不可用"我自己分析一下"替代 quest-designer
- 不可用"这个任务太简单不需要 Quest Map"跳过
- 即使只有 1 个 Quest，也必须调用 quest-designer 生成标准格式

#### 约束 3：代码修改的前置条件
在满足以下全部条件之前，禁止使用 Edit/Write 修改任何项目源代码：
1. PHASE 1 健康检查报告已输出
2. quest-designer Agent 已被调用并返回 Quest Map
3. Quest Map 已展示给用户

#### 约束 4：没有"简单任务"豁免
哪怕任务是改一个变量名，完整流程仍然是：
- PHASE 1：扫描 + 健康报告
- PHASE 2：quest-designer 生成 Quest Map（1 个 Quest 也是 Quest Map）
- PHASE 3：执行 Quest + 验收
- PHASE 4：门禁检查
- PHASE 5：提交（如有变更）
- PHASE 6：沉淀（如有经验）

**自检指令**：在每个 PHASE 开始前，检查上一个 PHASE 的产出是否存在。如果不存在，回退执行。

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

  🔒 GATE CHECK: PHASE 1 → 2
    ✓ 健康检查报告已输出
    ✓ 能力清单已收集
    → 下一步: 调用 Agent({ subagent_type: "quest-designer" })
    ⛔ 此时不可: 编辑代码、直接实现、跳到 PHASE 3
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

## PHASE 2: REASON — quest-designer v3 统筹分析 + 产出 Quest 计划

**目标**：将 PHASE 1 收集的完整能力清单交给 quest-designer v3，由它自主分析并设计 Quest Map。

**关键**：quest-designer 看到的是完整原始数据，不是主窗口预筛选后的结论。分析和设计由同一个 Agent 完成，避免信息损耗。

**v3 核心升级**：
- **合约驱动**：先定义跨 Quest 的接口契约（CONTRACT），确保类型一致性
- **实现蓝图**：每个 Quest 包含方法签名/类骨架，消除执行歧义
- **风险分层**：🔴高/🟡中/🟢低风险分类，高风险 Quest 配额外护栏
- **代码片段锚定**：3-5 行实际代码作为复制模板，不只是文件引用
- **反模式警告**：基于代码分析的"不要做 X"（如"不要用 @Builder，项目其他 DTO 没用"）
- **回滚方案**：每个 Quest 带 git 回滚命令

```
═══ 第 1 步：调用 quest-designer v3 ═══

将 PHASE 1 收集的全部数据传给 quest-designer v3：

  Agent({
    subagent_type: "quest-designer",
    prompt: "你是 quest-designer v3。
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

     v3 关键要求：
     - 第2步分层读取 3-8 个核心文件，提取代码片段锚点
     - 第3步先定义合约(CONTRACT)再拆分 Quest
     - 第4步每个 Quest 必须包含：实现蓝图(🧩) + 反模式警告 + 风险等级 + 回滚方案
     - 第5步合约一致性校验 + 15项自验证 >= 10/15
     - 第6步路径即时校验
     严格按 7 步工作流执行。输出标准 Quest Map 格式，等待用户确认。"
  })

═══ 第 2 步：quest-designer 内部分析维度 ═══

quest-designer v3 自主审视能力清单和项目代码，分析维度：
  - 哪些 Agent 的专长与问题匹配？（读 agent 的 description 判断）
  - 哪些 Skill 知识库能提供领域最佳实践？（如后端架构 → backend-patterns）
  - 哪些 Plugin 能加速某个子步骤？（读 plugin 的 description 判断）
  - 哪些 MCP 服务器提供了外部能力？（如需要浏览器操作 → playwright MCP）
  - 哪些 Command 可以处理某个独立子任务？（如需要 TDD → auto:tdd）
  - 已有的 Hooks 会自动做什么？（如 PostToolUse 自动格式化）
  - 为什么这个 Quest 选 Agent X 而不选 Skill Y？（选择理由必须透明）

═══ 第 3 步：产出 Quest 执行计划 ═══

⚡ Quest 设计 v3 五大原则：

  原则 1 — 合约驱动（v3 新增）：先定义跨 Quest 的接口合约，所有类型在合约中锁定
  原则 2 — 零歧义目标：目标描述具体到字段名+类型+注解，不含抽象描述
  原则 3 — 代码片段锚定（v3 强化）：每个风格参考包含 3-5 行实际代码可复制
  原则 4 — 风险分层（v3 新增）：🔴高/🟡中/🟢低风险分类，高风险配备额外护栏
  原则 5 — 可逆性：每个 Quest 包含 git 回滚命令

统一产出原子化 Quest 清单，每条 10 个字段：
  ① 🎯 目标（具体到代码动作级别）
  ② 🛠️ 选定的能力（Agent/Skill/MCP/Plugin/直接编码）
  ③ 💡 选择理由（为什么选 + 为什么不选其他）
  ④ ⚠️ 风险等级（🔴高/🟡中/🟢低）
  ⑤ 📁 代码风格参考（文件路径 + 3-5 行可复制代码片段）
  ⑥ 🚫 边界限制（具体禁止的文件/模块/模式/技术）
  ⑦ 📦 变更清单（[+]新增/[~]修改/[−]删除的具体文件）
  ⑧ 🧩 实现蓝图（方法签名或类骨架 + 反模式警告）
  ⑨ ✅ 验收标准（语义级验证命令 + 预期结果）
  ⑩ 🔗 合约（本 Quest 产出/消费的合约） + 🔙 回滚方案

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

## 全局信息
技术栈: [语言] + [框架]
建议执行模式: [单Agent / Subagent并行 / Agent Teams]
关键合约: CONTRACT-1 (...), CONTRACT-2 (...)

---

# 《项目闯关大纲》
[Quest Map 内容，含 v3 的 10 个字段]

## 合约一致性校验结果
✅ 所有合约类型一致
（或 ❌ CONTRACT-X 字段类型不匹配：产出方 Long vs 消费方 String）

## 自验证评分
| Quest | 评分 | 状态 |
|-------|------|------|
| 1.1   | 14/15 | ✅ |
| 1.2   | 12/15 | ✅ |

## 风险汇总
🔴 高风险: Quest 2.1 (修改共享工具类)
🟡 中风险: Quest 1.2 (新增 Service 方法)
🟢 低风险: Quest 1.1 (新增 DTO)
```

```
🔒 GATE CHECK: PHASE 2 → 3
  ✓ Agent({ subagent_type: "quest-designer" }) 已调用并返回
  ✓ Quest Map 已展示给用户
  → 下一步: 按 Quest Map 逐关执行
  ⛔ 如果 quest-designer 未被调用，回退到 PHASE 2 开头
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
