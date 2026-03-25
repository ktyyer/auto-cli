---
description: 智能超级命令 - 动态能力发现 + Quest Map + 按规模自动选择执行模式
---

# /auto — 智能超级命令

> **一个命令，自动完成所有事情**

输入你的需求，`/auto` 会自动完成：上下文扫描 → 能力统筹 + Quest Map 设计 → 逐关执行 → 整合验证 → 提交 → 知识沉淀。

---

## 核心理念

- **零学习成本**：不需要记住其他命令，描述需求即可
- **动态发现**：启动时扫描项目所有可用能力（commands/agents/skills/plugins/MCP/hooks），不预设固定路由
- **统筹设计**：quest-designer 基于完整能力清单自主分析，边分析边设计 Quest Map，不是关键词查表
- **统一流程**：所有任务都走 Quest Map，按规模自动选择执行模式
- **原子化验收**：每个子任务都有 PM 肉眼可见的验收标准
- **按规模执行**：小任务不浪费 token，大任务自动并行加速

---

## 执行流程（6 步）

```
用户输入需求
      ↓
┌─────────────────────────────────────────────────────────┐
│  第1步：上下文扫描 + 能力收集                            │
├─────────────────────────────────────────────────────────┤
│  轻量并行扫描，收集原始数据（不做推理判断）：            │
│                                                          │
│  【技术栈检测】                                          │
│  • Glob("package.json" / "pom.xml" / "go.mod" / ...)   │
│  • Glob("CLAUDE.md") → 如存在，Read 加载项目规范        │
│  • Glob(".claude/rules/*.md") → Read 加载编码规范       │
│  • 检测 Axiom 记忆（.agent/memory/ 或 .claude/memory/） │
│                                                          │
│  【能力清单收集】                                        │
│  • Glob("commands/*.md")  → Read 每个 frontmatter        │
│  • Glob("agents/*.md")    → Read 每个 frontmatter        │
│  • Glob("plugins/**/*.md") → Read 每个 frontmatter       │
│  • Glob("skills/**/*.md") → Read 每个 frontmatter        │
│  • Glob("mcp-configs/*.json") → Read 配置                │
│  • Glob("hooks/*.json")   → Read 配置                   │
│                                                          │
│  • Glob("src/**/*.java" / "src/**/*.ts" / ...)          │
│    → 扫描现有代码文件列表（用于代码风格锚点）            │
│                                                          │
│  产出：原始上下文 + 完整能力清单（未经推理）             │
│  注意：本步不做任何判断，只收集数据                      │
└─────────────────────────────────────────────────────────┘
      ↓
┌─────────────────────────────────────────────────────────┐
│  第2步：能力统筹分析 + Quest Map 设计                    │
├─────────────────────────────────────────────────────────┤
│  将第1步收集的完整数据交给 quest-designer，              │
│  由它自主分析能力、设计闯关大纲（不做预筛选）：          │
│                                                          │
│  Agent({                                               │
│    subagent_type: "quest-designer",                     │
│    prompt: [                                           │
│      "你是 quest-designer。                             │
│       以下是项目完整上下文和能力清单：                   │
│                                                          │
│       【用户需求】                                      │
│       [原始需求描述]                                    │
│                                                          │
│       【技术栈】                                        │
│       [语言+框架，项目规范（CLAUDE.md/rules），Axiom]   │
│                                                          │
│       【完整能力清单】                                  │
│       Commands: [全部命令的 name + description]          │
│       Agents: [全部 Agent 的 name + description + tools] │
│       Plugins: [全部插件的 name + description]          │
│       Skills: [全部 Skill 的 name + description]        │
│       MCP: [全部 MCP 服务配置]                          │
│       Hooks: [全部 Hook 配置]                           │
│                                                          │
│       【现有代码文件】                                  │
│       [src/ 下的文件列表，用于指定代码风格参考]          │
│                                                          │
│       你的任务：                                         │
│       1. 审视完整能力清单，分析哪些能力与需求匹配       │
│       2. 设计 Quest Map，每关标注使用哪些具体能力       │
│       3. 每关指定代码风格参考文件（从现有代码中选取）   │
│       4. 遵循四大原则：原子化、黑盒验收、现代工程化、   │
│          代码风格继承                                   │
│       5. 建议执行模式（单Agent/Subagent/Teams）         │
│                                                          │
│       输出标准 Quest Map 格式，等待用户确认。"           │
│    ]                                                    │
│  })                                                     │
│                                                          │
│  quest-designer 内部统筹分析维度：                       │
│  • 哪些 Agent 的专长与问题匹配？                         │
│  • 哪些 Skill 知识库能提供领域最佳实践？                 │
│  • 哪些 Plugin 能加速某个子步骤？                        │
│  • 哪些 MCP 服务器提供了外部能力？                       │
│  • 哪些 Command 可处理独立子任务？                       │
│  • 已有的 Hooks 会自动做什么？                           │
│                                                          │
│  需求反问（信息齐全则跳过）                             │
│  用户确认大纲（可迭代修改）                             │
│                                                          │
│  产出：Quest Map + 每关能力分配 + 执行模式建议           │
│  注意：执行中可动态追加新能力                             │
└─────────────────────────────────────────────────────────┘
      ↓
┌─────────────────────────────────────────────────────────┐
│  第3步：执行（Quest 逐关推进）                           │
├─────────────────────────────────────────────────────────┤
│  根据 Quest Map 规模自动选择执行模式：                   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │  小规模（1-5 关）→ 单 Agent 直接执行              │   │
│  │  • 无需创建团队，主窗口逐关执行                    │   │
│  │  • 每关：加载能力 → TDD → 验收 → 下一关          │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │  中规模（6-15 关）→ Subagent 并行                  │   │
│  │  • 按阶段/依赖关系分组                              │   │
│  │  • 独立组用 Agent 工具并行启动（一次调用多个）：     │   │
│  │    Agent({ prompt: "[组A的 Quest + 能力分配]" })   │   │
│  │    Agent({ prompt: "[组B的 Quest + 能力分配]" })   │   │
│  │  • 每个 Subagent 负责一组 Quest                     │   │
│  │  • Subagent 内部独立走 TDD + 审查                   │   │
│  │  • 主窗口整合结果 + 按验收标准验证                  │   │
│  │  • 与 Teams 的区别：无共享状态，结果返回主窗口     │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │  大规模（15+ 关）→ Agent Teams 编排执行             │   │
│  │  • 调用 multi-agent-orchestrator agent             │   │
│  │  • TeamCreate 创建团队                              │   │
│  │  • Quest → TaskCreate（含 blocked_by 依赖）        │   │
│  │  • Agent 启动 Teammate 并行执行                     │   │
│  │  • Team Lead 通过 SendMessage 协调阻塞              │   │
│  │  • 每个 Teammate 内部独立走 TDD + 审查             │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  每关执行流程（不论哪种模式）：                           │
│  1. 加载该关标注的能力（Skill 知识库 / Plugin 规范）      │
│  2. TDD：先写测试 → 实现 → 重构                         │
│  3. 按验收标准逐条验证                                   │
│  4. 通过 → 下一关；不通过 → 修复 → 重试（最多 2 次）    │
│  5. 发现需要新能力 → 动态追加                            │
└─────────────────────────────────────────────────────────┘
      ↓
┌─────────────────────────────────────────────────────────┐
│  第4步：整合验证                                         │
├─────────────────────────────────────────────────────────┤
│  所有 Quest 完成后，全量验证（不与每关内部检查重复）：   │
│                                                          │
│  按第1步检测到的技术栈执行：                             │
│  • 编译/构建（npm run build / mvn compile / go build）   │
│  • 全量测试（npm test / mvn test / go test）             │
│  • 覆盖率检查（>= 80%，如有配置）                        │
│                                                          │
│  代码审查（仅审查本轮修改的文件）：                      │
│  • 安全扫描：硬编码密钥、SQL 注入、XSS                   │
│  • 代码质量：命名、结构、复杂度                          │
│  • 最佳实践检查                                          │
│                                                          │
│  失败处理：                                              │
│  • 第1次：分析错误 → 修复 → 重跑                        │
│  • 第2次：尝试替代方案 → 重跑                            │
│  • 第3次：git checkout 回滚 → 报告用户                   │
└─────────────────────────────────────────────────────────┘
      ↓
┌─────────────────────────────────────────────────────────┐
│  第5步：提交                                             │
├─────────────────────────────────────────────────────────┤
│  Bash("git status --porcelain")                          │
│  IF 无变更 → 跳过                                        │
│  ELSE：                                                  │
│  • git add [本轮修改的具体文件]（不使用 git add -A）      │
│  • git commit -m '<type>(<scope>): <description>'        │
│  IF commit 被 pre-commit hook 拦截：                     │
│    • 分析 hook 报错 → 修复问题 → 重试                    │
│    • 如 hook 要求格式化 → 运行格式化 → git add → 重试    │
│  IF 存在未暂存的意外文件：                                │
│    • 只 add 确认属于本轮任务的文件                         │
│    • 意外文件不 add，告知用户                              │
│  • 输出："📦 已提交: [message] ([N] 文件)"               │
└─────────────────────────────────────────────────────────┘
      ↓
┌─────────────────────────────────────────────────────────┐
│  第6步：知识沉淀                                         │
├─────────────────────────────────────────────────────────┤
│  • 更新 Axiom 记忆（如有 .agent/memory/ 或 .claude/memory/） │
│  • 记录新的编码模式                                      │
│  • 提取经验教训                                          │
│  • 沉淀 Quest Map 模板（同类任务可复用）                  │
│  • 如修改了核心架构 → 建议运行 /auto:update-codemaps     │
└─────────────────────────────────────────────────────────┘
      ↓
    完成！
```

---

## 执行模式详解

### 三种执行模式的对比

| 维度 | 单 Agent | Subagent 并行 | Agent Teams |
|------|----------|--------------|-------------|
| **适用规模** | 1-5 关 | 6-15 关 | 15+ 关 |
| **并行方式** | 串行逐关 | 按组并行（一次性委派） | 网状协作（持续通信） |
| **上下文** | 共享主窗口 | 独立窗口，结果返回主窗口 | 每个队友独立窗口 |
| **Token 成本** | 1x | 2-3x | 3-10x |
| **协调机制** | 无 | 主窗口整合 | SendMessage + TaskList |
| **适用场景** | Bug 修复、样式调整 | API 开发、组件开发 | 全栈系统、大型重构 |

### Agent Teams 详细流程（大规模任务）

```
Quest Map 关卡              Teams 任务
─────────────              ──────────
Quest 1.1 (无依赖)    →     Task #1 (priority: high)
Quest 1.2 (依赖 1.1)  →     Task #2 (blocked_by: [1])
Quest 1.3 (依赖 1.1)  →     Task #3 (blocked_by: [1])
Quest 2.1 (依赖 1.2,1.3) → Task #4 (blocked_by: [2, 3])
```

#### 团队规模策略

| Quest Map 规模 | Teammate 数量 | 策略 |
|---------------|---------------|------|
| 15-30 关 | 3 个 | 流水线策略（有依赖链） |
| 30-50 关 | 3-5 个 | 并行 + 流水线混合 |
| 50+ 关 | 4-5 个 + 分批 | 专家策略，按阶段分批编排 |

#### 验收驱动

- 通过 → TaskUpdate 标记完成，通知下游队友
- 不通过 → SendMessage 反馈问题，Teammate 修复后重新验证

---

## Quest Map 闯关大纲规范

### 四大设计原则

| 原则 | 说明 |
|------|------|
| **原子化递进** | 每关只做一件事，禁止宏大任务。如"渲染购物车静态 UI 骨架"而非"开发购物车模块" |
| **黑盒验收标准** | 考官不看代码，验收条件必须是肉眼可见的物理反馈（终端输出、页面变化、API 响应） |
| **现代工程化** | 优先使用成熟第三方服务，把"接入某 API"单独设计为关卡 |
| **代码风格继承** | 每关必须指定具体的代码参考文件，确保产出与现有代码库浑然一体 |

### Quest Map 标准输出格式

```markdown
# 《[项目名称] 闯关大纲》

## 阶段 [X]：[阶段名称]
> [简述本阶段的学习目标和工程意义]

### Quest [X.1]：[关卡名称]

🎯 **关卡目标**：一句话描述本关要完成的单一任务。

🛠️ **推荐工具/轮子**：本关建议使用的库或命令。

📁 **代码风格参考**：指定本关需要模仿的现有代码文件或目录结构。

🚫 **边界限制（防超纲）**：明确本关不需要关心什么逻辑。

✅ **考官验收标准 (PM Checklist)**：

| # | 测试动作 | 预期结果 |
|---|---------|---------|
| 1 | 在根目录执行 `npm run dev` | 浏览器打开 localhost:3000，看到页面 |
```

### 质量检查清单

- [ ] 每个 Quest 只做一件事（原子化）
- [ ] 每个 Quest 有边界限制（防超纲）
- [ ] 每个 Quest 有代码风格参考（风格继承）
- [ ] 每个 Quest 的验收标准是肉眼可见的（黑盒）
- [ ] 后端 Quest 有 API 测试脚本或终端日志验收
- [ ] 关卡之间严格递进，不跳跃

---

## 上下文感知 + 能力发现（第1步）详解

### 技术栈检测

| 语言 | 检测文件 | 框架插件 | 匹配 Skill 知识库 |
|------|---------|---------|-----------------|
| Java | pom.xml, build.gradle | spring-helper | backend-patterns |
| JavaScript/TypeScript | package.json | react-helper | frontend-patterns |
| Python | requirements.txt, pyproject.toml | python-django | backend-patterns |
| Go | go.mod | go-gin | backend-patterns |
| Rust | Cargo.toml | — | — |

### 能力发现扫描范围

| 扫描目标 | 扫描路径 | 获取信息 |
|---------|---------|---------|
| **命令** | `commands/*.md` | frontmatter description → 可用命令列表 |
| **Agent** | `agents/*.md` | frontmatter name + description + tools → 可用 Agent |
| **插件** | `plugins/**/*.md` | frontmatter name + description → 插件能力 |
| **Skill** | `skills/**/*.md` | frontmatter name + description → 领域知识库 |
| **MCP** | `mcp-configs/*.json` | 已配置的外部服务 |
| **Hook** | `hooks/*.json` | 已配置的自动化门禁 |

### Axiom 记忆检测

```
.agent/memory/ 或 .claude/memory/
├── project_decisions.md   # 架构决策
├── coding_patterns.md     # 编码模式
└── lessons_learned.md     # 经验教训
```

---

## quest-designer 统筹分析维度（第2步）

quest-designer 收到完整能力清单后，自主分析以下维度：

| 分析维度 | 问题 | 示例 |
|---------|------|------|
| Agent 匹配 | 哪些 Agent 的专长与问题匹配？ | 安全相关 → security-reviewer |
| Skill 匹配 | 哪些知识库能提供最佳实践？ | 后端 API → backend-patterns |
| Plugin 加速 | 哪些插件能加速某个子步骤？ | TDD 流程 → superpowers |
| MCP 外部能力 | 哪些外部服务是必需的？ | 浏览器操作 → playwright MCP |
| Command 委派 | 哪些子任务可委派给单命令？ | 单独 TDD → auto:tdd |
| Hook 自动化 | 已有 Hook 会自动做什么？ | PostToolUse 自动格式化 |

**关键区别**：分析由 quest-designer 完成（看到完整数据），不是主窗口预筛选后传结论。

---

## 输出格式

### 开始执行

```markdown
🚀 **/auto 开始执行**

📝 **任务**: [用户需求描述]

🔍 **上下文**:
  • 技术栈: [Java/TypeScript/...]
  • 框架: [Spring Boot/React/...]
  • Axiom: ✅/❌

🧰 **能力**: [N] commands · [N] agents · [N] plugins · [N] skills · [N] MCP · [N] hooks

📋 **执行计划**:
  1. ✅ 上下文扫描 + 能力收集
  2. ⏳ 能力统筹 + Quest Map 设计（quest-designer）
  3. ⏸ 逐关执行（[单Agent/Subagent/Teams]）
  4. ⏸ 整合验证
  5. ⏸ 提交
  6. ⏸ 知识沉淀
```

### 第2步完成后（quest-designer 输出）

```markdown
🧠 **quest-designer 统筹分析结果**:

📜 **Quest Map**: [X] 关，[Y] 阶段
🤖 **执行模式**: [单Agent / Subagent并行(x个) / Teams(x个Teammate)]

📋 **关卡概览**:
  • 阶段 1: Quest 1.1 ~ 1.3
  • 阶段 2: Quest 2.1 ~ 2.5
  • ...

🧠 **每关能力分配**:
  • Quest 1.1 → 直接编码 + Skill: backend-patterns
  • Quest 1.2 → Agent: tdd-guide + Plugin: superpowers
  • ...

⏳ 请确认大纲，确认后开始执行...
```

### 第3步执行中

```markdown
📊 **执行进度**:

  • Quest 1.1 ✅ 已通过验收
  • Quest 1.2 ⏳ 执行中（使用 tdd-guide + superpowers）
  • Quest 1.3 ⏸ 等待 1.2 完成
  • Quest 2.1 ⏸ 等待 1.2, 1.3 完成
```

### 完成报告

```markdown
✅ **任务完成！**

📝 **任务**: [任务描述]
🤖 **执行模式**: [单Agent / Subagent / Teams]

📊 **执行摘要**:

| 步骤 | 状态 | 详情 |
|------|------|------|
| 上下文扫描 | ✅ | [技术栈] + [N] 能力 |
| 能力统筹 + Quest Map | ✅ | [X] 关，[Y] 阶段 |
| 逐关执行 | ✅ | [X]/[Y] 关通过 |
| 整合验证 | ✅ | 构建✅ 测试✅ 覆盖率[N]% 安全✅ |
| 提交 | ✅ | [commit message] |
| 知识沉淀 | ✅ | [更新内容] |

📜 **Quest 验收**: [X] / [Y] 关通过，[N] 个测试用例
📁 **文件**: [文件列表]
💡 **建议**: [优化建议]
```

---

## 使用示例

### 示例 1：修复 Bug（3 关 → 单 Agent）

```markdown
用户：/auto 修复登录按钮样式问题

🚀 **/auto 开始执行**
📝 **任务**: 修复登录按钮样式问题
🔍 **上下文**: TypeScript + React
🧰 **能力**: 12 commands · 9 agents · 8 plugins · 6 skills · 5 MCP

📜 **Quest Map**: 3 关，1 阶段
🤖 **执行模式**: 单 Agent（关卡少，无需并行）

🧠 **quest-designer 能力分配**:
  • Quest 1.1 → Read 现有代码定位样式（Skill: frontend-patterns）
  • Quest 1.2 → 修复按钮样式（Plugin: frontend-design）
  • Quest 1.3 → 验证修复不影响其他页面

✅ **任务完成！**
📊 3 关全部通过，覆盖率 85%
📦 已提交: fix(login): 修复登录按钮样式问题 (1 文件)
```

### 示例 2：API 开发（8 关 → Subagent 并行）

```markdown
用户：/auto 用 Spring Boot 实现用户搜索 API

🚀 **/auto 开始执行**
📝 **任务**: 用 Spring Boot 实现用户搜索 API
🔍 **上下文**: Java + Spring Boot
🧰 **能力**: 12 commands · 9 agents · 8 plugins · 6 skills · 5 MCP

📜 **Quest Map**: 8 关，3 阶段
🤖 **执行模式**: Subagent 并行（2 个）

🧠 **quest-designer 能力分配**:
  • 阶段 1: Quest 1.1~1.3 → 项目骨架 + 实体定义
    选用: Plugin: spring-helper, Skill: backend-patterns
  • 阶段 2: Quest 2.1~2.3 → 核心业务实现
    选用: Agent: tdd-guide, Plugin: superpowers + spring-helper
  • 阶段 3: Quest 3.1~3.2 → 测试 + 审查
    选用: Agent: code-reviewer, Plugin: pr-review-toolkit

✅ **任务完成！**
📊 8 关全部通过，覆盖率 87%，安全检查通过
📦 已提交: feat(user): 实现用户搜索 API (6 文件)
```

### 示例 3：完整系统（22 关 → Agent Teams）

```markdown
用户：/auto 实现用户认证系统

🚀 **/auto 开始执行**
📝 **任务**: 实现用户认证系统
🧰 **能力**: 12 commands · 9 agents · 8 plugins · 6 skills · 5 MCP

📜 **Quest Map**: 22 关，4 阶段
🤖 **执行模式**: Agent Teams（3 个 Teammate）

🧠 **quest-designer 能力分配**:
  • 阶段 1 (Quest 1.1~1.4): 基础设施
    选用: Plugin: spring-helper, Agent: architect, Skill: backend-patterns
  • 阶段 2 (Quest 2.1~2.6): 认证核心
    选用: Agent: tdd-guide + security-reviewer, Skill: security-review
  • 阶段 3 (Quest 3.1~3.5): 前端集成
    选用: Plugin: frontend-design + react-helper
  • 阶段 4 (Quest 4.1~4.7): 测试 + 安全 + 文档
    选用: Agent: e2e-runner + code-reviewer, Plugin: pr-review-toolkit

✅ **任务完成！**
📊 22 关全部通过，覆盖率 89%，安全检查通过
📦 已提交: feat(auth): 实现用户认证系统 (16 文件)
```

---

## 内置能力

### 框架插件

由第1步上下文扫描自动检测，由第2步 quest-designer 统筹分析选用：

| 插件 | 适用场景 | 核心能力 |
|------|---------|---------|
| spring-helper | Java/Spring 项目 | Spring Boot 代码规范 |
| react-helper | React 项目 | React 组件规范 |
| python-django | Python/Django 项目 | DRF 开发最佳实践 |
| go-gin | Go/Gin 项目 | Gin HTTP 框架规范 |
| tdd-templates | 任何项目 | 多语言测试模板 |

### 通用插件

由第2步 quest-designer 统筹分析选用（不是关键词匹配）：

| 插件 | 适用问题特征 | 核心能力 |
|------|------------|---------|
| **Superpowers** | 需要结构化 TDD 或系统化调试时 | TDD 红绿重构 + 系统化调试 |
| **Frontend Design** | 涉及 UI 组件视觉设计时 | 字体/间距/配色/组件规范 |
| **Code Simplifier** | 代码可读性或复杂度需要优化时 | 魔法值提取、条件简化、去重 |
| **Playground** | 需要生成独立可视化工具时 | 零依赖单文件 HTML 生成 |
| **Chrome Automation** | 需要浏览器操作或数据抓取时 | Playwright 浏览器自动化 |
| **PR Review Toolkit** | 需要代码质量审查时 | 多维度代码审查 |
| **Architect Editor** | 需要架构与编辑角色分离时 | 双模型协同（逻辑推理 + 精确编辑） |
| **Diff First** | 需要编辑大规模文件时 | 精确替换代替全文重写，节省 Token |
| **Focus Chain** | 长任务或多步骤任务时 | 定期注入 TODO 防止偏离目标 |
| **Smart Guardrails** | 涉及危险操作时 | 安全操作自动执行，危险操作自动确认 |

### 自动调度的 Agent

| Agent | 触发时机 | 作用 |
|-------|---------|------|
| planner | 需要深度分析时 | 实施规划（复杂功能、重构分析），非流程内自动调度，由 quest-designer 或用户按需调用 |
| quest-designer | 第2步（核心） | 基于完整能力清单，统筹分析 + 设计 Quest Map，每关分配能力 |
| multi-agent-orchestrator | 第3步（大规模任务） | 创建 Agent Teams 并行编排 |
| tdd-guide | 每关内部 | TDD 流程指导 |
| code-reviewer | 第4步（整合验证） | 代码质量审查 |
| security-reviewer | 敏感功能关卡 | 安全漏洞检查 |
| architect | 架构相关关卡 | 架构设计评审 |
| build-error-resolver | 构建/编译失败 | 最小差异修复构建错误 |
| e2e-runner | E2E 测试关卡 | Playwright E2E 测试 |
| doc-updater | 文档同步需求 | 代码地图和文档更新 |
| refactor-cleaner | 代码清理关卡 | 死代码检测和安全移除 |

---

## 与单个命令的关系

`/auto` 是**超级命令**，内部会自动调用其他能力。如果你需要精细控制，可以直接使用单个命令：

| 单个命令 | 用途 | 何时使用 |
|---------|------|---------|
| `/auto:quest` | 只出闯关大纲 | 需要 PM 可验收的任务拆解 |
| `/auto:plan` | 只规划不编码 | 只需要设计方案 |
| `/auto:tdd` | 只 TDD 开发 | 已有明确方案 |
| `/auto:code-review` | 只审查代码 | 代码已写好 |
| `/auto:build-fix` | 只修复构建 | 构建失败时 |
| `/auto:e2e` | 只写 E2E 测试 | 需要端到端测试 |
| `/auto:test-coverage` | 只分析覆盖率 | 检查测试覆盖 |
| `/auto:loop` | 只做状态机编排 | 需要中断恢复与可控重试 |
| `/auto:evolve` | 只做持续迭代优化 | 需要评估门禁与回归防护 |
| `/auto:refactor-clean` | 只清理代码 | 代码需要优化 |
| `/auto:update-docs` | 只更新文档 | 文档需要同步 |
| `/auto:update-codemaps` | 只更新架构图 | 架构图需要同步 |
| `/auto:status` | 查看项目状态 | 检查项目概况 |
| `/auto:help` | 显示帮助 | 查看使用说明 |

---

## 最佳实践

### ✅ 推荐用法

```bash
# 描述清晰的需求
/auto 用 Spring Boot 实现用户分页查询接口

# 包含技术栈信息
/auto 在 React 项目中实现可复用的表单组件

# 描述业务场景
/auto 实现购物车功能，支持添加、删除、修改数量
```

### ❌ 不推荐用法

```bash
# 太模糊
/auto 写代码

# 缺少上下文
/auto 修一下那个 bug
```

---

## 故障排查

### 关卡执行失败

```markdown
❌ **关卡执行失败**

📍 **失败关卡**: Quest [X.Y]
🔍 **错误详情**: [具体错误信息]

💡 **重试中**（最多 2 次）:
  1. 分析错误 → 修复 → 重跑
  2. 尝试替代方案 → 重跑
  3. git checkout 回滚 → 报告用户
```

### 整合验证失败

```markdown
❌ **整合验证失败**

🔍 **失败项**: [构建/测试/安全扫描]
🔍 **错误详情**: [具体错误信息]

💡 **自动修复中**...
  第 1 次：Read 错误 → 分析 → Edit 修复 → 重跑
  第 2 次：尝试替代方案 → 重跑
  第 3 次：git checkout -- . 回滚 → 报告用户
```

### 验收未通过

```markdown
⚠️ **关卡验收未通过**

📍 **失败关卡**: Quest [X.Y]
🔍 **未通过项**: PM Checklist 第 [N] 条
   • 测试动作: [具体动作]
   • 预期结果: [期望输出]
   • 实际结果: [实际输出]

💡 **修复后重新验证...**
```

---

**核心原则**：
1. **一个入口** - `/auto` 完成所有事情
2. **动态发现** - 启动时扫描所有可用能力，不预设固定路由
3. **统筹设计** - quest-designer 基于完整能力清单自主分析，边分析边设计，不是关键词查表
4. **按规模执行** - 小任务不浪费 token，大任务自动并行加速
5. **原子化验收** - 每个关卡都有 PM 肉眼可见的验收标准
6. **风格继承** - 每关编码严格继承项目既有风格和结构
7. **动态追加** - 执行中发现需要新能力，随时追加
8. **可回溯** - 每步 Git Commit，失败可回滚
9. **知识沉淀** - 经验持续积累，越用越强
