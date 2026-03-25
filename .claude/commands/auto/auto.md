---
description: 智能超级命令 - 动态能力发现 + Quest Map + 按规模自动选择执行模式
---

# /auto — 智能超级命令

> 一个命令，自动完成所有事情。设计文档见 `plugins/builtin/auto-core.md`，详细示例和故障排查见该文件。

输入你的需求，`/auto` 会自动完成：上下文扫描 → 能力统筹 + Quest Map 设计 → 逐关执行 → 整合验证 → 提交 → 知识沉淀。

## 核心理念

- **动态发现**：扫描所有可用能力（commands/agents/skills/plugins/MCP/hooks），不预设路由
- **统筹设计**：quest-designer 基于完整能力清单自主分析，不是关键词查表
- **按规模执行**：1-5 关单 Agent / 6-15 关 Subagent 并行 / 15+ 关 Agent Teams
- **原子化验收**：每关有 PM 肉眼可见的验收标准

---

## PHASE 1: DISCOVER — 扫描项目上下文 + 能力清单

**健壮原则**：目录不存在不崩溃，只输出 WARNING。

### 1.1 技术栈检测（并行 Glob + 按需 Read）

```
并行执行：
  Glob("package.json") / Glob("pom.xml") / Glob("go.mod") / Glob("requirements.txt") / Glob("Cargo.toml")
  → 匹配任一即确定技术栈
  → Read 获取依赖和 scripts（仅匹配到的文件）

  Glob("CLAUDE.md") → Read（如存在）
  Glob("$HOME/.claude/rules/*.md") → Read（如存在）
  Glob(".agent/memory/*.md") 或 Glob(".claude/memory/") → Read（如存在）
```

### 1.2 能力清单收集（Grep 提取 frontmatter，禁止 Read 完整文件）

```
并行 Glob 收集路径：
  Glob("$HOME/.claude/commands/auto/*.md")
  Glob("$HOME/.claude/agents/*.md")
  Glob("$HOME/.claude/plugins/**/*.md")
  Glob("$HOME/.claude/skills/**/*.md")

→ 对每个目录执行 Grep 批量提取 frontmatter（仅 name/description/tools/model）：
  Grep(pattern="^(name|description|tools|model):", path="[目录路径]", output_mode="content", type="md")
  → 不读取文件正文，仅提取元数据行
  → Grep 输出按文件分组：连续的 name + description 行属于同一能力
```

### 1.3 配置文件 + 项目代码

```
  Glob("$HOME/.claude/mcp-configs/*.json")
  → Read JSON，统计 mcpServers，含 YOUR_*_HERE 标记 ⚠️

  Glob("$HOME/.claude/hooks/*.json")
  → Read JSON，统计 hook 类型数量

  Glob("src/**/*.{java,ts,tsx,js,jsx,py,go}")
  → 仅收集路径列表，不读取内容（用于代码风格锚点）
```

### 1.4 输出

```
能力健康检查报告（🟢绿/🟡黄/🔴红） + 能力清单表格 + MCP ⚠️ 标记

TodoWrite([
  { content: "任务: [需求摘要]", status: "completed" },
  { content: "技术栈: [tech]", status: "completed" },
  { content: "可用能力: [N] commands, [N] agents, [N] plugins, [N] skills, [N] MCP, [N] hooks", status: "completed" }
])
```

---

## PHASE 2: REASON — quest-designer 统筹分析 + Quest Map

将 PHASE 1 收集的**完整原始数据**交给 quest-designer（不做预筛选）：

```
Agent({
  subagent_type: "quest-designer",
  prompt: "你是 quest-designer。以下是项目完整上下文和能力清单：

【用户需求】[一行描述]

【技术栈】[语言+框架] | 项目规范: [有/无 CLAUDE.md] | Axiom: [有/无]

【完整能力清单】
Commands: [name + description，每行一个]
Agents: [name + description + tools，每行一个]
Plugins: [name + description，每行一个]
Skills: [name + description，每行一个]
MCP: [服务名 + 状态(READY/⚠️需配置)，每行一个]
Hooks: [类型数量 + 摘要]

【现有代码文件】[src/ 下文件路径，每行一个]

按 quest-designer 标准流程执行：
0. 透明度摘要（能力总数、高匹配数）
1. 能力匹配分析（★评级 + 匹配理由）
2. Quest 拆分推理（复杂度评估 + 拆分理由）
3. 能力编排决策（每关为什么选这个能力）
4. 输出标准 Quest Map（含 💡 选择理由 字段）
5. 代码风格参考文件校验（Bash test -f 验证存在性）
6. 建议执行模式（单Agent/Subagent/Teams）

输出 Quest Map，等待用户确认。"
})
```

> **关键**：quest-designer 看到完整原始数据，分析由它完成，主窗口不做预筛选。
> 产出后等待用户确认，可迭代修改。

---

## PHASE 3: EXECUTE — 逐关执行

| 规模 | 模式 | Token 成本 | 说明 |
|------|------|-----------|------|
| 1-5 关 | 单 Agent | 1x | 主窗口逐关串行 |
| 6-15 关 | Subagent 并行 | 2-3x | 按依赖分组，Agent() 一次性委派多组 |
| 15+ 关 | Agent Teams | 3-10x | multi-agent-orchestrator 编排 |

每关执行流程（不论模式）：
0. 如 Quest Map > 5 关，激活 Focus Chain：`mkdir -p .auto/state`
1. 加载该关标注的能力：
   - Skill 知识库：`Read("$HOME/.claude/skills/[skill-name].md")`
   - Plugin 规范：`Read("$HOME/.claude/plugins/[category]/[plugin-name].md")`
2. TDD：先写测试 → 实现 → 重构
3. 按验收标准逐条验证
4. 通过 → 下一关；不通过 → 修复 → 重试（最多 2 次）
5. 发现需要新能力 → 动态追加

> Agent Teams 模式：调用 `multi-agent-orchestrator` agent，它内置完整的 TeamCreate/TaskCreate/SendMessage 编排逻辑。

---

## PHASE 4: VERIFY — 全量门禁

按技术栈执行：编译/构建 → 全量测试 → 覆盖率 >= 80% → 安全扫描（硬编码密钥、SQL注入、XSS）

失败处理：第1次修复重跑 → 第2次替代方案 → 第3次 `git checkout -- .` 回滚

---

## PHASE 5: COMMIT — Git 提交

`git status --porcelain` → 无变更跳过 → `git add [具体文件]`（不使用 `git add -A`）→ `git commit`

被 pre-commit hook 拦截时修复后重试。意外文件不 add，告知用户。

---

## PHASE 6: LEARN — 知识沉淀

更新 Axiom 记忆（如有 `.agent/memory/` 或 `.claude/memory/`）。记录架构决策、编码模式、经验教训。如修改了核心架构 → 建议运行 `/auto:update-codemaps`。

---

## 输出模板

### 开始执行

```
🚀 /auto 开始执行

📝 任务: [需求描述]
🔍 技术栈: [语言] + [框架]
🧰 能力: [N] commands · [N] agents · [N] plugins · [N] skills · [N] MCP · [N] hooks

📊 能力健康检查:
  🟢 commands: [N]  🟢 agents: [N]  🟢 plugins: [N]
  🟢 skills: [N]  🟡 mcp: [N]  🟢 hooks: [N]

📋 执行计划:
  1. ✅ 上下文扫描 + 能力收集
  2. ⏳ 能力统筹 + Quest Map 设计
  3. ⏸ 逐关执行（[单Agent/Subagent/Teams]）
  4. ⏸ 整合验证
  5. ⏸ 提交
  6. ⏸ 知识沉淀
```

### 执行中

```
📊 执行进度:
  • Quest 1.1 ✅ 已通过验收
  • Quest 1.2 ⏳ 执行中（使用 tdd-guide + superpowers）
  • Quest 1.3 ⏸ 等待 1.2 完成
```

### 完成报告

```
✅ 任务完成！

📊 执行摘要:
| 步骤 | 状态 | 详情 |
|------|------|------|
| 能力统筹 + Quest Map | ✅ | [X] 关，[Y] 阶段 |
| 逐关执行 | ✅ | [X]/[Y] 关通过 |
| 整合验证 | ✅ | 构建✅ 测试✅ 覆盖率[N]% 安全✅ |
| 提交 | ✅ | [commit message] |

📜 Quest 验收: [X]/[Y] 关通过 | 📁 文件: [文件列表]
```

---

## 核心原则

1. **一个入口** — `/auto` 完成所有事情
2. **动态发现** — 扫描所有可用能力，不预设路由
3. **统筹设计** — quest-designer 基于完整能力清单自主分析
4. **按规模执行** — 小任务不浪费 token，大任务自动并行
5. **原子化验收** — 每关有 PM 肉眼可见的验收标准
6. **风格继承** — 编码严格继承项目既有风格
7. **动态追加** — 执行中发现新能力，随时追加
8. **可回溯** — 每步 Git Commit，失败可回滚
9. **知识沉淀** — 经验持续积累，越用越强
