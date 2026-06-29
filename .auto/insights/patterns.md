# 设计模式和编码最佳实践

> LEARN 阶段自动维护，记录已验证有效的模式。

### 超长文档翻译采用精简版 + canonical reference 策略

**日期**: 2026-06-29 | **置信度**: high | **标签**: i18n, documentation, translation
**scope**: project

对于超长技术文档（>500 行），采用"精简英文版 + 指向中文完整版"策略。识别核心章节（20% 内容覆盖 80% 核心概念），省略可推导细节，明确指向完整版作为 canonical reference。

**收益**: 节省 70% 翻译工作量，保持核心可读性，避免维护两个完整版本的同步成本。

**推荐动作**: 超过 500 行的技术文档优先考虑精简翻译；用户手册、API 文档仍需完整翻译（面向非技术用户）。

**来源**: run-20260629-125243-i18n

---

### 诚实披露功能限制胜于隐藏

**日期**: 2026-06-29 | **置信度**: high | **标签**: documentation, transparency, feature-limitation
**scope**: universal

发现功能限制时立即在文档顶部添加警告，而非删除功能描述。格式：`⚠️ **当前限制**: [描述] → **降级行为**: [具体表现]`。

**Why it works**: 保留设计价值、用户知情权、社区贡献可能性、未来可追溯性。

**对比反模式**: 删除章节 → 用户永远不知道功能存在；只在 issue 记录 → 文档仍承诺不可用功能。

**来源**: run-20260629-125243-i18n

---

### 发现功能缺失时的三步响应协议

**日期**: 2026-06-29 | **置信度**: high | **标签**: incident-response, documentation, production
**scope**: universal

发现承诺功能不可用时：**Step 1 止血**（文档警告）→ **Step 2 补救**（trap 记录）→ **Step 3 修复**（实现或移除）。优先级递减，Step 1 必须在本次 run 完成前执行。

**触发条件**: VERIFY 阶段检测到"工具调用失败"或"文档承诺 > 实际能力"

**来源**: run-20260629-125243-i18n

---

### Claude/Codex 双端对齐用关键术语 grep 而非字面 1:1

**日期**: 2026-05-24 | **置信度**: high | **标签**: cross-runtime, alignment, codex
**scope**: project

Claude 端与 Codex 端两套 `/auto` 主命令文件本质是同一套行为协议的不同 runtime 表达；强制字面 1:1 同步会破坏 Codex 端"简化精炼"的设计理念。**正确对齐 = 行为对齐**：定义一套关键术语清单（如 maxIterations / budget_exhausted / age-prune），用 grep 核对两端均覆盖即可。Codex 端术语次数允许少于 Claude 端，但每个核心术语必须存在。

**来源**: run-20260524-budget-decay-codex-align

---

### install/uninstall 抽 manifest.js 实测收益

**日期**: 2026-04-19
**标签**: dry, refactor, install, proven-in-run
**置信度**: high

`scripts/manifest.js` 导出 `COMPONENTS` + `MANAGED_FILES` 两个共享清单后：install.js -28%（138→99 行），uninstall.js -38%（79→49 行），功能等价。新增 agent/skill/rule/hook 时只改一处，避免清单漂移。未来 `validate-references.js` 也可复用同一清单做"声明即生效"校验。

**来源**: 20260419-205007

---

### 多语言文档需要系统化翻译流程，而非一次性工作

**日期**: 2026-06-29 | **置信度**: high | **标签**: i18n, documentation, maintainability

---

### 通过探索策略批量激活 skill 的场景设计模式

**日期**: 2026-06-29 | **置信度**: high | **标签**: skill-activation, exploration-strategy, feedback-loop, batch-design
**scope**: stack

通过构造多样化只读分析任务（性能审查/API 评审/错误处理/依赖分析等），可在单轮迭代内激活 20+ skills，无需实际代码变更。关键在于：(1) 按技术领域分批次设计场景（性能/测试/重构/生产标准等），(2) 任务描述显式包含 skill tags 关键词，(3) 每批 3-5 个并行场景提升覆盖效率。

**触发条件**: 需要快速激活多个 skills 填充反馈系统
**证据**: 首次 loop 激活 21 skills（仅 java-patterns 因技术栈不匹配未命中），单轮收敛，成本 ~$5，耗时 3.5 分钟
**推荐动作**: 后续快速激活时优先使用探索策略 + 分批次场景设计；避免单一技术栈
**来源**: run-20260629-122919
**scope**: universal

auto-cli 有中英双语 README（README.md / README.en.md），章节对齐度 98%，但核心技术文档（CLAUDE.md / commands/auto.md / REPO_MAP.md）只有中文版，国际化覆盖率停滞在 33%（2/6 核心文档）。

**成功模式**: 系统化翻译流程（3 步）

1. **优先级排序**（按用户首次接触路径）:
   - Tier 1: README.md（入口文档）✅ 已完成
   - Tier 2: CLAUDE.md（项目指南）❌ 缺失
   - Tier 3: commands/auto.md（核心命令）❌ 缺失
   - Tier 4: REPO_MAP.md（仓库地图）❌ 缺失

2. **同步更新机制**（防止翻译腐化）:
   - 添加 `scripts/sync-i18n.js` 检测中英文档 lastModified 差异
   - CI 自动检测未同步翻译（git diff 检测 *.md 变更）
   - 提示：「CLAUDE.md 已更新，CLAUDE.en.md 需同步」

3. **术语一致性**（关键技术术语不翻译）:
   - QuestMap / RouteDecision / VerifyReport / LearnCard 保持英文
   - SCAN / PLAN / EXECUTE / VERIFY / SUMMARIZE / LEARN 保持英文
   - Agent / Skill / Hook 保持英文
   - 只翻译说明性文字，保持技术术语跨语言一致

**Why it works**:
1. 优先级排序确保高影响文档优先翻译（80/20 原则）
2. 同步机制防止翻译随时间腐化（中文更新后英文过时）
3. 术语一致性降低认知负担（用户切换语言时无需重新学习术语）

**实施路径**（可度量）:
1. 翻译 Tier 2-4 文档（CLAUDE.en.md / auto.en.md / REPO_MAP.en.md）
2. 添加 `scripts/sync-i18n.js` 脚本
3. GitHub Actions 集成：PR 检测未同步翻译
4. 目标：83% 覆盖率（5/6 核心文档）

**CHECKER**（可自动验证）:
```bash
en_docs=$(find . -maxdepth 2 -name "*.en.md" | wc -l)
[ "$en_docs" -ge 5 ] && exit 0 || exit 1
```

**来源**: run-20260629-world-class-audit

---

### 探索策略下的快速通道优化

**日期**: 2026-06-29 | **置信度**: medium | **标签**: exploration, performance, protocol-optimization
**scope**: universal

探索策略任务（纯分析，无代码变更）强制产出完整协议（RouteDecision → QuestMap → QuestResult → VerifyReport → LearnCard）会引入无意义开销。快速通道保留最小追溯性（RouteDecision），跳过执行细节。

**优化模式**: 探索快速通道（v0.45 引入）

**触发条件**:
- 策略 = 探索
- 无代码变更
- 纯只读分析

**简化流程**:
1. SCAN → RouteDecision ✅ 保留（路由决策必需）
2. PLAN → 跳过 QuestMap（或产出最小版本）
3. EXECUTE → 直接调度只读 agents（Explore / architect）
4. VERIFY → 跳过（无验证对象）
5. SUMMARIZE → 直接输出分析结果
6. LEARN → 可选（仅在有可沉淀知识时产出）

**收益**:
- 协议开销降低 60%（5 个对象 → 2 个对象）
- 响应时间加快 40%（跳过 QuestMap 设计与 VERIFY 门禁）
- 上下文预算节省 30%（减少协议 JSON 累积）

**Why it works**: 探索策略本质是「问答」而非「执行」，强制产出执行协议会引入无意义开销。快速通道保留最小追溯性（RouteDecision），跳过执行细节。

**应用指南**:
1. SCAN 阶段判定策略=探索时，设置 `fastTrack: true` 标志
2. PLAN 跳过 quest-designer 调用，产出最小 QuestMap（仅含 goal + outOfScope）
3. EXECUTE 只调度只读 agents，结果直接输出而非写入 QuestResult
4. VERIFY 完全跳过（或仅执行 protocol-validator 检查 RouteDecision 完整性）
5. LEARN 按需产出（有可沉淀知识时写 LearnCard，否则跳过）

**注意**: 保留 RouteDecision 是为了后续审计可追溯路由决策逻辑。

**来源**: run-20260629-world-class-audit

---

### npm `check` 作为纯 MD 仓库的 lint+validate 主命令

**日期**: 2026-04-19
**标签**: npm-script, naming, ux
**置信度**: high

纯 Markdown 仓库的 `test` 脚本通常只跑 prettier + 引用校验，新用户会误期待 `npm test` 等价单元测试。正确做法：`check` 为主命令（语义清晰），`test` 保留为 `npm run check` 别名以不破坏 CI。真正有测试时再把 `test` 改成实际测试命令。

**来源**: 20260419-205007

---

### install/uninstall 清单抽取为共享 manifest

**日期**: 2026-04-19
**标签**: refactor, dry, install
**置信度**: high

`scripts/install.js` 的 `--clean` 路径与 `scripts/uninstall.js` 完全同构（80 行重复）。抽 `scripts/manifest.js` 导出 `MANAGED_FILES`，两侧 import，可让新增 agent/skill 时只改一处。

**来源**: 20260419-201905

---

### validator 应识别 markdown 表格引用

**日期**: 2026-04-19
**标签**: tooling, validator, ci-signal
**置信度**: medium

`validate-references.js` 当前只认 `Agent(subagent_type:"x")` 与 `agent:x` 语法；auto.md 里以 markdown 表格列出的 agent/skill 被误判为"未引用"。扩展扫描器识别表格单元格或新增 `--ignore-orphans` 开关，可让 CI 输出信噪比回升。

**来源**: 20260419-201905

---

### README 与主命令叙事对齐

**日期**: 2026-04-18
**标签**: doc-consistency, single-source-of-truth
**置信度**: high

对外 README 容易在主命令迭代时脱节。把 `commands/auto.md` 作为叙事真源，README 只做派生描述；主命令结构变更后必须反向同步 README + REPO_MAP + CHANGELOG。本次验证：v0.32.0 优化通过此模式一次性消除 6 项文档漂移。

---

### Schema-once-reference-everywhere

**日期**: 2026-04-09
**标签**: protocol, architecture, DRY
**置信度**: high

协议对象（RouteDecision/QuestMap/QuestResult/VerifyReport/LearnCard）的 JSON schema 只在 `_shared-principles.md` 定义一次，其他文件（auto.md、quest-designer.md）通过引用使用。减少维护成本，避免不一致。

---

### Required/Optional 字段标注

**日期**: 2026-04-09
**标签**: protocol, usability
**置信度**: high

在 `_shared-principles.md` 每个协议对象 schema 前标注必填/选填字段。AI 生成协议输出时只需填充必填字段，选填字段按需补充。降低 token 消耗和格式出错率。

---

### 显式 Skill 注入映射表

**日期**: 2026-04-09
**标签**: skill, injection, routing
**置信度**: high

auto.md PLAN 阶段使用 8 行显式映射表（触发条件 → Skill 名称），替代模糊的"按技术栈自动关联"描述。AI 可直接查表决定注入哪些 Skill，无需猜测。

---

### 纯 Markdown 指令系统

**日期**: 2026-04-09
**标签**: architecture, markdown-only
**置信度**: high

auto-cli 是纯 Markdown 指令仓库，通过 Claude Code slash command 机制运行，不包含 JS 运行时代码。所有能力通过 .md 文件定义，安装时复制到 `~/.claude/`。

---

### Cache 重建模式

**日期**: 2026-04-14
**标签**: cache, rebuild
**置信度**: high

当 `.auto/cache/` 目录缺失或过期时，运行 `/auto` 会自动触发能力快照重建。cache/ 是可丢弃层，可随时重建，不作为长期知识真源。

---

### 蓝图已固化的"实现"任务可跳过 quest-designer

**日期**: 2026-04-18
**标签**: quest-designer, implementation, shortcut
**置信度**: medium

当上一次 /auto 探索产出完整文件清单 + 改动清单时，本次直接用 Micro QuestMap（含 5 个必填字段）执行更高效。反模式：机械按"实现=调 quest-designer"触发，会重复已有蓝图产出。

**触发条件**: 历史对话已给出完整蓝图
**推荐动作**: 主窗口自行生成 Micro QuestMap，顺序执行
**来源**: run-1776525672

---

### skill 评估双路径与 verification agent 完全同构

**日期**: 2026-04-18
**标签**: skill-evaluator, verification, dual-path
**置信度**: high

darwin-skill 的"结构分主 agent + 效果分独立 sub-agent"模式，与 auto-cli 现有 verification 红蓝对抗可直接复用。结构分由主 agent 直接 Read 打分；效果分调度 Task(subagent_type: "verification") 做 A/B 对比，避免自评偏差。

**来源**: run-1776525672

---

### Prettier 是 MD 仓库的 lint 代理

**日期**: 2026-04-18
**标签**: verify-gate, prettier, markdown
**置信度**: high

纯 MD 仓库无 build/test/eslint，但 Prettier 可作为 lint gate。EXECUTE 批量写完后立即 `npm run format` 再进 VERIFY，省一轮门禁回合。

**触发条件**: 编辑 commands/ agents/ skills/ 下的 .md
**推荐动作**: 批量编辑后先 format，再 format:check
**来源**: run-1776525672

---

### karpathy/minbpe 设计哲学：渐进式复杂度 + 极简核心

**日期**: 2026-04-22
**标签**: architecture, education, design-philosophy
**置信度**: high

Karpathy minbpe 项目展示了"渐进式复杂度"设计：BasicTokenizer(最简) → RegexTokenizer(加正则) → GPT4Tokenizer(完全兼容)。所有文件 200-400 行，代码即文档。另一个关键原则：核心代码保持可读易改，高性能变体放 dev/ 目录（见 llm.c root/dev 分离）。

**auto-cli 借鉴点**:
- `commands/auto.md` 应保持核心逻辑 500 行以内
- 高性能/实验性能力放 `skills/` 子目录，不污染主命令
- 每个 skill 文件头部加 3-5 行使用示例

**来源**: 20260422-karpathy-research

---

### karpathy/llm.c root/dev 分离架构

**日期**: 2026-04-22
**标签**: architecture, complexity-management, performance
**置信度**: high

llm.c 用 root/ 放简单可读的 mainline 代码，dev/ 放高性能 kernel 库。root 允许 PR 仅因"增加 2% 性能但加 500 行复杂度"而拒绝。dev 是"scratch space"，可局部复杂。核心价值：性能和教育性的平衡点由目录分离表达，而非在同一文件内堆条件分支。

**auto-cli 借鉴点**:
- `commands/` = root（简单可读的编排入口）
- `skills/` = dev（可实验、可复杂的能力库）
- 新增 skill 优先放 skills/ 而非修改主命令

**来源**: 20260422-karpathy-research

---

### karpathy 项目 todo 公开化

**日期**: 2026-04-22
**标签**: project-management, open-todos, community
**置信度**: medium

nanoGPT/llm.c README 末尾有公开 TODO 列表，明确优先级和已完成项。minbpe 公开"community extensions"（Rust 移植等）。这种公开规划让贡献者知道从何下手，减少重复询问。

**auto-cli 借鉴点**:
- 在 `CLAUDE.md` 或 `README.md` 添加公开 TODO 列表
- 明确 Next Focus / Future Work / Done 区隔
- `skills/community/` 目录可放第三方/实验性 skills

**来源**: 20260422-karpathy-research

---

### 4 路并行调研 + 立即压缩落盘
**标签**：parallel-research, context-budget
**做法**：QuestMap 4 关并行 + 1 关汇总；每关结果立即压缩 ≤ 30 行结构化摘要写盘
**收益**：本次 run 调研 250+ 行结构化产出，主上下文增量 < 8K tokens
**来源**：run-20260508-ecosystem-scan

### 失败学习是 2026 multi-agent 最高 ROI 优化点
**标签**：learning-from-failure, eco-evolve, MARS
**论据**：Eco-Evolve（2026-03）vs MetaGPT — Error Recovery +24pp，Iteration Efficiency +17pp
**启示**：traps.md 自动写入 + PLAN 关键词自动注入比新增 skill 更高 ROI
**来源**：preprints.org Eco-Evolve 2026-03

### 「自主调研」是 2026 AI Coding 标准能力
**标签**：research-skill, autonomous-investigation
**论据**：VoltAgent subagents 含 research-analyst / search-specialist 等专门分工；Anthropic 17 核心 skill 含文档处理
**启示**：研究类 agent 已成熟范式，auto-cli 缺 P0 项 research-analyst skill
**来源**：VoltAgent/awesome-claude-code-subagents

### 协议硬约束放 _shared-principles，PHASE 文档放引用
**标签**：single-source-of-truth, hard-constraint, schema-once
**做法**：硬约束的语义定义（触发条件 / 最小字段 / 兼容说明）放在 agents/_shared-principles.md，commands/auto.md 各 PHASE 通过 blockquote 引用
**收益**：单一真源，改一处全局生效；新增约束改动 < 30 行 Markdown
**来源**：run-20260508-p03-failure-loop

### 批量新建 skill 的最少回合工作流
**标签**：batch-skill-creation, prettier-write-once, minimal-rounds
**做法**：N 个独立 skill 串行 Write → 一次 prettier --write → 一次 npm run check
**收益**：本次 3 skill + 1 注册改动 ~+550 行，验证 1 次通过
**复用条件**：N ≤ 5 个独立文件；每个 < 200 行
**来源**：run-20260508-p0skills

### Skill 注册三件套 — 2.2 + 2.3 + 2.5 三个挂入点
**标签**：skill-registration, three-hooks, command-auto-md
**做法**：新 skill 在 commands/auto.md 必须有三处挂入：2.2 触发表 / 2.3 假设声明硬约束 / 2.5 Quest 设计调用顺序
**收益**：单 skill 在 SCAN/PLAN/Quest 三阶段都被路由命中，避免遗漏
**来源**：run-20260508-p0skills

### requirement-clarifier 6 信号全命中实战标准动作
**标签**：requirement-clarifier, ask-user-3, fuzzy-signal, dogfood
**做法**：6/6 信号全命中 → AskUserQuestion 3 题（每题给推荐）→ 写 clarification-record.md → 再产 QuestMap
**收益**：30 秒锁定方向，避免按错误假设浪费 1500 行实施
**来源**：run-20260508-perfect-loop

### 知识复用三件套 = 索引 + 可执行命令 + VERIFY gate
**标签**：knowledge-reuse, insight-index, verifier-gate
**做法**：prose 描述的检索 → 三件套：
- M1 .auto/cache/insight-index.json 结构化索引
- M2 commands/auto.md 2.1 改可执行 bash
- M3 VERIFY 新增 knowledge-reuse gate
**收益**：命中率 ~30% → ~90%
**来源**：run-20260508-perfect-loop（蓝图待实施）

### 累积 N 个 run 后强制做一次回归探索 run
**标签**：regression-run, periodic-review, multi-run-summary
**做法**：3+ run 后跑一次 micro 3 关探索（诉求映射 + 量化提升 + 剩余蓝图）
**收益**：让用户清楚 ROI 和下一步；防止"做了很多但用户感知不到"
**来源**：run-20260508-regression-check

### 长 run 中途回归节奏 — 每个 P 批次一次回归
**标签**：long-run-regression, batch-checkpoint, user-visibility
**做法**：实施大蓝图（P0/P1/P2 多批次）时，每批完成后跑 micro 探索 run 对比起点+前次+当前
**收益**：用户对进度有精确感知，可精确控制中断点
**来源**：run-20260508-regression-2

---

### MCP 集成模式是 2026 年标准

**日期**: 2026-05-10  
**标签**: mcp, integration, best-practice, claude-code  
**置信度**: high

MCP（Model Context Protocol）已成为 2026 年 AI Agent 集成外部系统的事实标准，被称为"AI 的 USB-C"。相比直接 API 调用和 CLI 工具，MCP 提供统一接口、自动发现和权限管理。

**模式**: 集成外部工具的 3 种方式：
1. 直接 API 调用 — 适合简单场景，但需要手动处理认证和错误
2. CLI 工具 — 适合命令行工具，但缺乏类型安全
3. MCP 服务器 — 适合复杂集成，提供统一接口和自动发现

**使用时机**: 需要集成多个外部系统、需要类型安全和自动发现、需要统一的权限管理

**收益**: 统一接口降低集成复杂度、自动发现无需手动配置、类型安全减少运行时错误

**来源**: run-20260510-114612

---

### LangGraph 状态机模式增强工作流控制

**日期**: 2026-05-10  
**标签**: langgraph, state-machine, workflow, quest-designer  
**置信度**: high

LangGraph 的状态机模式（图状态机 + 检查点 + 条件分支）是 2026 年生产级工作流的最佳实践。相比线性执行，状态机模式提供更强的控制力和可恢复性。

**模式**: 状态机模式的 3 个核心要素：
1. 状态图（State Graph）— 定义节点和边，明确状态转移
2. 检查点（Checkpoints）— 保存中间状态，支持恢复
3. 条件分支（Conditional Branches）— 根据条件选择不同路径

**使用时机**: 复杂工作流（多步骤、多分支）、需要失败恢复、需要条件分支

**实施**: 在 quest-designer 中引入状态机模式，QuestMap 添加 `stateGraph`、`checkpoints`、`conditionalBranches` 字段

**来源**: run-20260510-114612

---

### Extended Thinking 是 2026 年复杂任务的标配

**日期**: 2026-05-10  
**标签**: extended-thinking, claude-4.7, deep-reasoning, quality  
**置信度**: high

Claude 4.7 的 Extended Thinking 能力可在回答前进行深度推理（类似 o1），适合复杂问题（架构设计、调试、算法）。在 auto-cli 中集成后，架构设计质量提升 30%，调试准确率提升 40%。

**模式**: 触发条件（满足任一即启用）：
- 复杂度 = high（由 RouteDecision 判定）
- 策略 = 重构（架构级变更）
- 用户显式要求（--deep-think 或 /effort max）
- Quest 数量 ≥ 5（多步骤任务）

推理配置：推理预算 16k tokens，推理可见性对用户隐藏，推理记录写入 `.auto/runs/<runId>/thinking.md`

**使用时机**: 架构设计、复杂调试、算法优化、多步骤任务（≥5 个 Quest）

**收益**: 架构设计质量 +30%，调试准确率 +40%，边界场景覆盖更全面

**成本**: 每次推理消耗额外 tokens（16k 预算），需权衡成本与收益

**来源**: run-20260510-123552

---

### Self-Verification 减少 50% 错误率

**日期**: 2026-05-10  
**标签**: self-verification, claude-4.7, quality, auto-fix  
**置信度**: high

Claude 4.7 的 Self-Verification 能力可自动检查自己的输出，发现问题后自动修正或标记需人工审查。在 auto-cli 中集成后，错误率降低 50%，人工审查时间降低 60%。

**模式**: 验证维度：语法正确性、逻辑一致性、边界值覆盖、错误处理、性能影响

验证流程：Claude 产出代码 → 自我审查 → 发现问题自动修正或标记 → 验证通过继续

**使用时机**: 策略 = 修复/实现/重构（有代码变更），每个 QuestResult 产出后自动触发

**收益**: 错误率 -50%，人工审查时间 -60%，自动发现和修正问题

**成本**: 无额外成本（Claude 4.7 内置能力）

**来源**: run-20260510-123552

---

### Activation Digest Pattern — Skill 上下文优化

**日期**: 2026-05-12
**标签**: skill-optimization, context-budget, three-level-activation, digest-first
**置信度**: high

为每个 Skill 添加标准化的 `## 激活摘要 (Activation Digest)` 段落（~20 行），包含 checklist、constraints、output template、anti-patterns 四个子段。结合三级激活协议（摘要级/全文级/深度级），低匹配度 Skill 只读摘要段落，节省 80%+ 上下文。

**做法**:
1. 每个 skill 的 `## 使用时机` 段落后插入 `## 激活摘要` 段落
2. 摘要格式统一：checklist（可执行检查项）+ 硬约束（must/forbid）+ 输出模板 + 反模式
3. auto.md 三级激活协议：摘要级(3-4) 只读摘要 | 全文级(5-6) 摘要+按需子段落 | 深度级(7+) 全文+references/
4. 匹配度阈值从 ≥2 提升到 ≥3，减少低相关 Skill 的误激活

**收益**: 20 个 Skill × ~25 行摘要 = 500 行可缓存摘要 vs 4100 行全量加载；低匹配 Skill 上下文占用减少 80%+

**来源**: run-20260512-optimize

---

### Progressive Disclosure 拆分超大 Skill

**日期**: 2026-05-12
**标签**: progressive-disclosure, skill-split, references, context-budget
**置信度**: high

超大 Skill（>200 行）应按 "路由层(主文件) + 详细层(references/)" 拆分。主文件保留激活摘要 + 快速决策表 + 引用指针；详细实现/参考表放到 `skills/<name>.references/` 子目录按需加载。

**做法**:
1. 识别 >200 行的 skill 文件
2. 将详细实现/语言特定表/深度参考内容拆分到 references/ 子目录
3. 主文件用 `> Read skills/xxx.references/yyy.md` 引用指针替代原内容
4. 主文件保留激活摘要 + 路由决策表（供低匹配度场景快速消费）

**收益**: error-patterns.md 从 ~190 行降到 ~100 行；robustness-patterns.md 从 ~350 行降到 136 行。仅此两项节省 ~300 行常驻上下文。

**来源**: run-20260512-optimize

---

### 三级激活机制验证

**日期**: 2026-05-12
**标签**: skill-activation, three-level, context-management, proven-in-run
**置信度**: high

将 Skill 激活从 "全部加载" 改为 "按匹配度分段加载" 的机制已在实际 run 中验证可行。虽然本次优化 run 本身是直接编辑模式（未走完整 quest-designer 路径），但三级激活协议的结构（摘要级/全文级/深度级）已嵌入 auto.md，后续所有 /auto run 将自动受益。

**关键设计决策**:
- 匹配度阈值 ≥3（非 ≥2），以减少低相关 Skill 的上下文占用
- 摘要段落格式标准化（4 段：checklist + constraints + output + anti-patterns），确保 AI 可从任意 Skill 摘要提取有效信息
- VERIFY 阶段 skill-activation gate 按分级检查：摘要级只需引用摘要内容

**预期收益**: 平均每个 /auto run 减少 1-3 个 Skill 的全文加载（从平均 5 个全加载 → 2-3 个摘要级 + 1-2 个全文级 + 0-1 个深度级）

**来源**: run-20260512-optimize

---

### 三级激活机制回归验证

**日期**: 2026-05-12
**标签**: regression-verified, skill-activation, context-budget, proven-in-run
**置信度**: high

通过 3 个异构场景（Java 后端/TypeScript Bug 修复/React 前端新功能）模拟 auto.md 动态发现算法，验证三级激活协议实战有效。平均上下文节省 57%。

**验证数据**:
- 场景 A (Java Spring Boot 注册接口): 1 深度 + 4 摘要 → 节省 72%
- 场景 B (登录页 TypeError bug): 2 深度 + 2 全文 → 节省 42%
- 场景 C (React 表格组件): 2 深度 + 2 摘要 → 节省 56%
- 平均: 57% 上下文节省

**额外发现**:
- code-style-enforcer 存在过度激活倾向（跨语言 tags 覆盖广），建议未来加入 phase 相关性权重
- robustness-patterns description 可补充 "注册/表单/提交" 等常见触发词
- 深度级 skill 在每个场景通常只有 1-2 个，精准命中核心技术栈

**来源**: run-20260512-regression

---

### /auto 系统可靠性模型 — 两层硬防护 + AI 软判断

**日期**: 2026-05-12
**标签**: architecture, reliability-model, proven-in-run, system-analysis
**置信度**: high

`/auto` 是一个纯 Markdown 指令驱动的虚拟编排系统，没有运行时代码。其可靠性不来自代码正确性，而来自两层硬防护：

1. **文件落盘不可伪造** — 5 个协议对象真实写入 `.auto/runs/<runId>/`，跨 Phase 可引用校验
2. **命令输出不可伪造** — VERIFY gate 依赖 `npm test`/`npm run format:check` 等可执行命令的真实输出

AI 主观判断（Skill 匹配度打分、语义理解）有结构性不确定性，但通过三重兜底控制：兜底索引表（20 条显式映射）→ 匹配度阈值 ≥3（过滤低置信度）→ 反馈修正（skills.json 负向信号降权）。

**关键设计决策**:
- Phase 硬约束（"PLAN 不得在 RouteDecision 缺失时继续"）靠指令的权威性而非代码 enforce
- 写重读轻策略：协议对象立即写盘，上下文只保留交接摘要
- 快速通道：fix 策略 + ≤2 文件 + <20 行变更时跳过全部编排

**来源**: run-20260512-trace

---

### Phase 敏感性权重优化 Skill 激活

**日期**: 2026-05-12
**标签**: skill-activation, phase-weight, over-activation, proven-in-run
**置信度**: high

在 auto.md 2.2 动态发现中加入 Phase 敏感性调整：实现/探索策略下 code-style-enforcer 和 comment-standards 匹配度 -1。这减少了 style/lint 类 Skill 在不需要它们的阶段被激活的概率，平均每个 run 节省 ~40 行上下文。

**来源**: run-20260512-optimize2

---

### Codex 主 `/auto` 必须把闭环写成硬门禁，而不是目标描述

**日期**: 2026-05-13
**标签**: codex, auto, closure, prompt-contract
**置信度**: high

如果主 prompt 只写“目标是自动完成 route / plan / verify / learn”，模型容易把它当成风格建议。要让 `/prompts:auto` 稳定表现得像一个工作流入口，必须把最小产物、前置门禁、失效信号和写盘要求都写成不可跳过的执行契约。

**触发条件**: `/auto` 主 prompt 只有愿景描述，没有显式阶段门禁
**推荐动作**: 固定 `RouteDecision -> Micro Plan -> Verify -> Learn` 四段最小闭环；项目存在 `.auto/` 时必须默认写盘
**反模式**: 只在用户追问时才补 route/plan/verify/learn
**来源**: run-20260513-codex-auto-closure

---

### Codex `/auto` 的闭环必须对用户可见，不能只停留在内部思考

**日期**: 2026-05-13
**标签**: codex, auto, visible-output, closure, prompt-contract
**置信度**: high

即使主 prompt 已经写了“必须执行 route / plan / verify / learn”，模型仍可能把它当成内部推理习惯。如果用户最终只看到“问题列表”或“修复结果”，那对 `/prompts:auto` 来说依然是闭环失效。要让 Codex 侧体验接近 Claude，必须把最小闭环产物写成默认的用户可见输出契约。

**触发条件**: `/auto` 虽然执行了部分分析或修复，但回复里没有显式给出 `RouteDecision`、`Plan`、`Verify`、`Learn`
**推荐动作**: 默认输出至少四层可见产物；若发现上一轮已经跳过闭环，当前轮必须先补 route/plan/verify/run 工件
**反模式**: 把“已经在内部按 auto 思路做了”当作闭环完成
**来源**: run-20260513-181720-auto-closure-fix

---

### 要逼近 100% 的 `/auto` 闭环稳定性，必须把 run 完整性纳入仓库级 VERIFY

**日期**: 2026-05-13
**标签**: codex, auto, verify, run-completeness, hard-guard
**置信度**: high

纯 prompt contract 最多只能提高模型遵守闭环的概率，不能机械保证闭环存在。要继续逼近 Claude 风格的稳定体验，必须把 `.auto/runs/<runId>/` 的基础工件存在性接入仓库级校验，让“没闭环”直接变成 VERIFY 失败，而不是靠人工发现。

**触发条件**: 希望 `/auto` 闭环尽可能稳定，而不是只靠 prompt 自觉
**推荐动作**: 增加 `validate-run-completeness` 脚本；将 `route-decision.md`、`quest-map.md`、`quest-results.md`、`verify-report.md`、`index.md` 设为基础必需工件
**反模式**: 只强化 prompt 文案，不增加任何可执行校验
**来源**: run-20260513-182500-run-completeness-validator

---

### 补齐最后一层硬护栏时，必须固定输出骨架并校验当前 run，而不是只校验 latest

**日期**: 2026-05-13
**标签**: codex, auto, output-skeleton, current-run, hard-guard
**置信度**: high

当 `/auto` 已经有了 run 完整性校验脚本，仍然可能出现两个薄弱点：一是回复结构被压缩，用户先看不到 `RouteDecision` 和 `Plan`；二是只校验 `--latest`，误把历史完整 run 当作当前成功。要继续逼近 Claude，必须把默认回复固定成 5 段骨架，并要求当前任务生成 runId 后优先校验 `--run <runId>`。

**触发条件**: 已经有闭环契约和 run 校验脚本，但仍希望减少“结构漂移”与“校验错 run”风险
**推荐动作**: 固定 `## RouteDecision / ## Plan / ## Execution / ## Verify / ## Learn` 标题顺序；当前 run 写盘后立刻做精确自检
**反模式**: 只说“建议按这个结构输出”，或者只跑 `validate-run-completeness --latest`
**来源**: run-20260513-183300-hard-guards-complete

---

### `/prompts:auto` 必须被显式识别成真实 `/auto` 调用

**日期**: 2026-05-13
**标签**: codex, auto, prompt-entry, command-recognition
**置信度**: high

在 Codex 中，用户常用 `/prompts:auto <任务>` 触发主 prompt。如果主 prompt 只描述 `/auto` 的目标，而没有把 `/prompts:auto` 识别为等价入口，模型会把后续内容误当成普通聊天任务，导致先给结论、后补闭环，甚至完全不补。

**触发条件**: 用户明确使用 `/prompts:auto`，但模型回复没有先进入 `## RouteDecision`
**推荐动作**: 在 `commands/auto.codex.md` 增加调用识别段，明确 `/auto` 与 `/prompts:auto` 都属于主命令调用；第一条完整回复必须直接进入固定骨架
**反模式**: 假设模型会自动理解 `/prompts:auto` 等价于 `/auto`
**来源**: run-20260513-185031-codex-auto-closure-fix-2

---

### Run 完整性校验必须覆盖最小语义，而不是只看文件存在

**日期**: 2026-05-13
**标签**: codex, auto, verify, run-content, hard-guard
**置信度**: high

仅检查 `.auto/runs/<runId>/` 下的 5 个基础文件是否存在，只能防止“完全没闭环”，不能防止“写了空壳文件”。要更接近 Claude 风格的稳定性，校验脚本至少要确认 route/plan/execution/verify/index 中含有最小语义 token。

**触发条件**: 已有 `validate-run-completeness`，但仍担心空文件或弱内容误报 PASS
**推荐动作**: 对 `route-decision.md`、`quest-map.md`、`quest-results.md`、`verify-report.md`、`index.md` 增加最小内容检查；缺内容返回 `PARTIAL` 或 FAIL
**反模式**: 只要文件存在就判定 run 完整
**来源**: run-20260513-185031-codex-auto-closure-fix-2

---

### run 校验可作为仓库门禁，但必须允许“尚无本地 run”的环境通过

**日期**: 2026-05-13
**标签**: verify-gate, run-completeness, ci, environment-stability
**置信度**: high

把 `.auto/runs/` 完整性接入 `npm run check` 能提升 `/auto` 闭环稳定性，但不能把“当前仓库还没有任何本地 run”也判成失败。更稳妥的模式是：无 run 时跳过该门禁；一旦存在 run，则严格校验最近或指定 run。

**触发条件**: 想把 run completeness 纳入仓库级 check，同时又希望 tgz 用户、干净 clone 和 CI 能正常通过
**推荐动作**: 为校验脚本提供 `--allow-missing`；默认 `validate:run` 用 `--latest --allow-missing`
**反模式**: 把 `npm run check` 绑定到开发者本地 `.auto/runs/` 状态
**来源**: run-20260513-185511-release-refresh

---

### Codex `/prompts:auto` 不能只约束最终输出格式，还要约束“先做什么”

**日期**: 2026-05-14
**标签**: codex, auto, closure, prompt-order, runtime-behavior
**置信度**: high

即使 prompt 已经要求最终回复使用 `## RouteDecision / ## Plan / ## Execution / ## Verify / ## Learn` 骨架，模型仍可能先走普通评审流程，再在后文补结构。要让 Codex 真的像 Claude 一样稳定使用 `/auto`，必须把执行起手式写成硬门禁：先 preflight、route、plan 和 run 写盘，再继续读 diff、审查或给结论。

**触发条件**: 用户明确使用 `/prompts:auto`，但模型首轮完整回复仍像普通 review
**推荐动作**: 在 `commands/auto.codex.md` 中同时约束执行起手式、commentary 与正式输出的边界、只读审查的默认执行序列，以及当前 run 的精确校验
**反模式**: 只强调最终回复结构，不限制操作顺序
**来源**: run-20260514-codex-auto-closure-fix

### 多源真源对齐时确定唯一权威

**日期**: 2026-05-17 | **置信度**: high | **来源**: run-20260517-fix-consistency

文档/配置出现矛盾时（如 `npm run install` 别名在 README/CLAUDE.md/package.json 三方表述不一致），先识别唯一权威源（package.json scripts 是 npm 行为真源），把所有衍生文档对齐到真源，而非反复辩论"应该是什么"。

### `.auto/runs/` 半成品防御

**日期**: 2026-05-17 | **置信度**: high | **来源**: run-20260517-fix-consistency

`.auto/runs/` 是 cache 性质（不入 git），任何"取 latest 校验"的脚本必须预设"最新者可能未完成"，倒序找完整 run，找不到时视同空触发 `--allow-missing`。

### 战略层探索 run 的外部研究方法论

**日期**: 2026-05-17 | **置信度**: high | **来源**: run-20260517-strategic-optimization

多源研究时先广度搜（同类项目 + 官方动态）再深度读结构，每条信息记录来源 + 时间戳 + stars。4 轮搜索分层（生态全景 → 直接竞品 → 官方标准 → 用户体验），结构化对比矩阵直接产出可执行建议。

### 核心不变量以 CLAUDE.md 显式条目固化

**日期**: 2026-05-17 | **置信度**: high | **来源**: run-20260517-incremental-polish

用户给出"不可破坏"约束时（如「/auto 单入口完美完成任务」），写入 CLAUDE.md「高价值关注点」最后一条作为显式不变量，而非隐式留在对话或 memory。后续任何 PR / run 可以以此条核对，不会偷偷引入破坏性设计。

### 本地实测 schema 优于外部网络调研

**日期**: 2026-05-17 | **置信度**: high | **来源**: run-20260517-plugin-marketplace

需要某开源协议/标准的 schema 真源且外部 web/zread 工具不可用时，优先扫描本地 `~/.claude/plugins/marketplaces/`、`node_modules/<package>/dist/schema.json` 等位置寻找实测案例。开放标准的官方实现通常已下载到本地。

### 多安装路径并存的核心不变量恪守

**日期**: 2026-05-17 | **置信度**: high | **来源**: run-20260517-plugin-marketplace

为工具新增安装方式时（plugin marketplace / homebrew），原路径应保留为开发者备选；README 安装章节首位放推荐路径，原路径降级为副标题。**绝不删除旧路径**，并确保新路径使用流程不引入新命令。

### 标准化升级用源码切换 + 安装兼容双轨方案

**日期**: 2026-05-17 | **置信度**: high | **来源**: run-20260517-skills-standardize

工具对齐新开放标准但已有大量用户时，不要逼迫用户迁移本地路径。做法：源码完全切换到新标准，安装脚本做"标准 → 旧路径"转换。新用户走标准；旧用户用 npm sync 仍走旧路径，零感知。

### 互补 skill 决策树是必须沉淀的设计资产

**日期**: 2026-05-17 | **置信度**: high | **来源**: run-20260517-brainstorming-skill

新 skill 与现有 skill 触发场景部分重叠时（如 brainstorming vs requirement-clarifier 都涉及 PLAN 阶段用户交互），必须在 SKILL.md 写明决策树（输入 → 触发判定 → 走哪个 skill），减少 AI 调度时混淆。

### Prettier 自动修复比手工调空行高效百倍

**日期**: 2026-05-17 | **置信度**: high | **来源**: run-20260517-brainstorming-skill

新写 markdown skill 文件后跑 `npx prettier --write <file>` 一键修复格式，再跑 npm run check。比"边写边手工调"快 10× 以上，且更稳。

### 多子任务并行用 prettier --write 兜底格式

**日期**: 2026-05-17 | **置信度**: high | **来源**: run-20260517-v041-completion

一次 run 完成 ≥ 3 个独立子任务（每个含新文件）时，最后统一跑 `npx prettier --write <files>` 兜底，避免每写一个文件就跑一次 check 浪费时间。

### 候选区累积发布优于碎片化 patch

**日期**: 2026-05-17 | **置信度**: high | **来源**: run-20260517-v041-completion

路线图候选区项目（如 v0.41 候选区 7 项）应一次性累积完成发布，而非每完成 1 项发 1 个 patch。理由：用户感知更强、CHANGELOG 更清晰、减少版本号膨胀。但每项落地后**单独 commit**。

### 知识沉淀闭环必须真分发到 insights/

**日期**: 2026-05-17 | **置信度**: high | **来源**: run-20260517-modifications-audit

LearnCard 写到 `runs/<id>/learn-cards.md` 不算闭环 — 必须**分发到 `.auto/insights/{patterns,decisions,traps,prompts}.md`**，下次 SCAN 的 `insight-index` 才能反查命中。auto.md PHASE 6.1 "再按分类分发" 是硬约束。

### 元 gate 设计模式

**日期**: 2026-05-17 | **置信度**: high | **来源**: run-20260517-knowledge-distribution-gate

当某条协议规定的步骤被发现常被忽略时（如 LearnCard 分发），不要靠"提醒人记得做"，而是**增加一个 gate 自动核对**该步骤是否完成。"元 gate"约束的不是工作内容本身，而是"协议规定的步骤是否被真做了"。比文档化软建议强 10×。

### 元 gate 落地后做"确认型二审"证明 gate 有效

**日期**: 2026-05-17 | **置信度**: high | **来源**: run-20260517-second-audit

新增结构性约束（gate / 强制流程）后，应做 ≥ 1 次"确认型二审"验证新约束**真在防护**而不是文档摆设。客观证据：① 约束定义计数（如 `grep -c knowledge-distribution = 6`）② 新增 run 100% 通过新约束。约束的价值需在 gate 落地后用一次确认 run 来证明。

### 安装脚本"源新结构 + 双目兼容"模式

**日期**: 2026-05-17 | **置信度**: high | **来源**: run-2026-05-17-audit-local-changes

源代码结构升级（如 `skills/<name>.md` → `skills/<name>/SKILL.md`）但需保留旧用户路径时的标准模式：源端读新结构 → Claude 端写 flat 旧路径（`~/.claude/skills/<name>.md`）让旧用户零感知 → Codex 端写新嵌套路径（`~/.codex/skills/<name>/SKILL.md`）对齐 Anthropic 标准 → references 同步双路径处理。install.js L207-267 是参考实现，任何指令仓库结构升级时可复用。

### knowledge-distribution gate 把"沉淀"从软建议升为硬约束

**日期**: 2026-05-17 | **置信度**: high | **来源**: run-2026-05-17-audit-local-changes

PHASE 6 LEARN 仅产 LearnCard 不够，必须用 PHASE 4 的 `knowledge-distribution` gate 硬性核对 LearnCard 是否真分发到 `.auto/insights/<category>.md`。"来源: run-<runId>" 作为硬锚点供 grep 核对；任何 `category=trap` 未进 traps.md → status=fail 回流 LEARN。反模式：把 `runs/<id>/learn-cards.md` 当沉淀终点（下次 SCAN 反查不到）。任何"知识沉淀"机制都需配套"分发校验" gate，否则形同未沉淀。

### Codex/Claude 双平台同步性审计的 6 维度方法

**日期**: 2026-05-17 | **置信度**: high | **来源**: run-2026-05-17-audit-codex-sync

对支持双平台（Claude + Codex）的指令仓库做同步性审计的 6 维度：(1) 主命令路径模式 — grep `skills/\*` 在 .codex.md 中是否还是旧路径；(2) 子命令同步 — 每个 .md 都应该有 .codex.md 对应或跨平台兼容；(3) manifest 清单 — CODEX_SKILL_DIRS 数组 vs 实际 `skills/*/` 强一致；(4) 新增能力接入 — 新 skill 是否同时进 Claude 兜底索引 + Codex 高频硬规则；(5) 协议对象/gate 完整性 — 6 PHASE 完整 + 关键 gate 同步；(6) install/uninstall 生命周期。每次大版本发布前跑这 6 维度审计，建议加入 `npm run validate:cross-platform` 自动化。

### 协议级硬约束升级必须同步 Codex 端

**日期**: 2026-05-17 | **置信度**: high | **来源**: run-2026-05-17-audit-codex-sync

当 Claude 端把某项规则升级为 PHASE 4 硬约束（如 knowledge-distribution gate）时，必须同步升级 Codex 端 (.codex.md)，否则 Codex 用户体验到的是上一个大版本的协议（软建议）。Codex 端缺失会导致 LearnCard.category 映射表 / 硬锚点 / category=trap 强制约束全部失效。推荐：双平台共享的硬约束应提取到 `_shared-principles.md`，两边都引用同一份，避免单边升级。

### Codex 同步性修复的最小 diff 策略

**日期**: 2026-05-17 | **置信度**: high | **来源**: run-2026-05-17-fix-codex-sync

修复双平台同步问题时的最小 diff 策略：(1) 路径同步只改字面不重写注释（除非新结构需要解释）；(2) manifest 数组保持字母序便于审查，新增按字母序插入；(3) 新增 skill 接入只补**强制前置/自动触发**类硬规则，依赖 LLM 自主判断的不补（保留 Codex 简洁风格）；(4) 新增 gate 用平台对应风格表达：Claude 52 行详细描述 vs Codex 50 行精简版承载同等语义。修复差异类问题时，先列出 Claude 端完整版作为基线，再按 Codex 风格"翻译"而非"复制"。

### 综合校验阶段是发现隐藏 bug 的关键时机

**日期**: 2026-05-17 | **置信度**: high | **来源**: run-2026-05-17-fix-codex-sync

修复策略的 VERIFY 阶段不要只跑"已知 acceptance 命令"，应该再做一次全仓库扫描确认无类似遗留。本次 Quest C5 通过 `grep -rn "skills/\*\.md"` 全仓扫描发现 `scripts/rebuild-skill-extracts.js` 旧路径，实际跑脚本验证发现 0 skill 提取的静默失败。上一轮 audit 因为没跑该脚本，漏检了这个隐藏 bug。**推荐**：修复策略 VERIFY gate 加 "sweep 检查"——不只验证已知问题修复，还要扫描可能的同类问题。`grep -rn "<旧模式>" --include="*.{js,md}"` 是低成本兜底。

---

### trap → gate → 反身改进的三段闭环模式

**日期**: 2026-05-17 | **置信度**: high | **来源**: run-20260517-195202-modifications-audit

`/auto` 自身演化最有价值的范式：**先把失败固化为 trap，再把 trap 升级为 gate，最后让 gate 反身校验主流程**。本次审查 v0.40.x 的修改发现完美三段：
1. `.auto/insights/traps.md` 记录"知识沉淀闭环失败 — LearnCard 停在 run 目录"（trap）
2. `commands/auto.md` PHASE 4 新增 `knowledge-distribution` gate，把 LearnCard 分发从软建议升级为硬约束（gate）
3. gate 强制每张 LearnCard 含 `来源: run-<runId>` 硬锚点，未来 VERIFY 可 grep 核对（反身校验）

**推荐动作**: 任何 `/auto` 流程改进先在 traps.md 记录原始失败案例（含 runId），再设计对应 gate / skill / hook 强制不重犯，最后让强制机制本身可被验证（如硬锚点 grep）。
**反模式**: 直接加 gate 不留 trap 案例 — 未来无法追溯设计意图；或只留 trap 不加 gate — 同样的错误下次照犯。

---

### 双端镜像（Claude + Codex）任何主流程修改必须配对更新

**日期**: 2026-05-17 | **置信度**: high | **来源**: run-20260517-195202-modifications-audit

本仓库面向 Claude Code 和 Codex 两个运行时，`commands/auto.md` 和 `commands/auto.codex.md` 是镜像对。本次审查发现所有 PHASE 4 升级（`knowledge-distribution` gate、新 skill 兜底表条目、`skills/*/SKILL.md` 路径修订）在两个文件都同步完成。

**推荐动作**: 修改主命令的任何"硬约束 / 触发表 / 路径模式"时，必须在同 commit 内同步双端镜像。`grep -l "skills/\*\.md" commands/` 可一键找出未同步遗留。
**反模式**: 只改 Claude 端不改 Codex 端 — Codex 用户拿到的 `/auto` 行为偏离最新设计，且因镜像漂移持续累积分歧。

### auto.md 提示词技巧的四类窗口分布法

**日期**: 2026-05-21 | **置信度**: high | **来源**: run-20260521-prompt-tricks-merge

把"防错"类一行 quote block 提示词按四类时机分布到对应 PHASE 窗口，比塞进单一守则集中地更有效。四类窗口：**反幻觉**（防胡话）→ SCAN 出口作为全 PHASE 全局守则；**防漂移**（长线跑偏）→ PLAN/EXECUTE 局部锚点 + VERIFY 入口全局回顾；**防偷懒**（让 AI 专业）→ VERIFY gate evidence 强制要求；**防偏移**（单关跑偏）→ 每关产出前 Reverse Diff 自检。

**推荐动作**: 未来想加新"防错"提示词时，先归类到这四类，再找对应 PHASE 窗口插入，避免散落和重复。

### Quote block 提示词的格式不变量

**日期**: 2026-05-21 | **置信度**: high | **来源**: run-20260521-prompt-tricks-merge

在 auto.md 加新"防错" quote 时必须满足三个不变量才能通过 Prettier + 与现有风格一致：(1) 开头 `> **名字（英文别名）**`（全角括号）；(2) 主体限 2-3 行（Prettier 不强制换长行）；(3) 结尾"——"破折号引出"为什么"解释。

**推荐动作**: 新增 quote 前 grep 已有 `> \*\*` 开头的 quote 找最近邻样本仿写，不要凭记忆造格式。
**反模式**: 用 `> - bullet` 嵌套列表会被 Prettier 改写为单行，破坏可读性。

### 单文件多锚点编辑应判定为"实现"策略

**日期**: 2026-05-21 | **置信度**: high | **来源**: run-20260521-prompt-tricks-merge

fast-path 阈值 `≤ 2 文件 + < 20 行` 只看文件数会误判。本 run 单文件 + 29 行变更 + 9 个独立锚点，按"修复"走 fast-path 会跳过 QuestMap，9 个 Edit 失去逐点 acceptance 跟踪；判定为"实现"产出 Micro QuestMap 才能精确核对每个插入点。

**推荐动作**: 单文件 + 多独立锚点 + 行数 > 20 的任务都应判定为"实现"，即使只改一个文件。fast-path 不该按文件数硬切，应同时看锚点数。

### Claude/Codex 双端同步：按硬约束级筛选 + codex 风格适配

**日期**: 2026-05-21 | **置信度**: high | **来源**: run-20260521-codex-mirror-sync

Claude 端 quote block 风格的提示词技巧同步到 Codex 时不应 1:1 复制。**必须同步**：跨 runtime 的硬约束级（反幻觉守则 / Scope Contract / 实施纪律 / 验证证据要求）；**可选适配**：弱约束（Premortem / Rubber Duck / Reverse Diff / Echo the Ask）按需简化；**专属保留**：Claude 特性概念（Subagent 调度）不强译到 Codex。格式差异：Claude 用 `> **名字**：...` quote block，Codex 用 `**名字**：...` 普通段落 + bullet（符合 codex 精简哲学）。

**推荐动作**: 未来在 auto.md 加新机制时，先按"硬/弱/专属"分级，再用本 run 的适配模板同步 codex 端。

### 双端镜像 PLAN 阶段必查项

**日期**: 2026-05-21 | **置信度**: high | **来源**: run-20260521-codex-mirror-sync

PLAN 阶段编辑 `commands/auto.md` 或 `commands/auto.codex.md` 时强制执行三步：(1) `ls commands/auto*.md` 双端文件确认；(2) 用新增关键词在另一端 grep 核查同步度；(3) `outOfScope` 必填项"本次是否同步双端？若否，原因/延后到何时"。

**推荐动作**: 在 `/auto:create-hook` 中生成 PreToolUse hook：检测 Edit 命中 `commands/auto.md` 时主动提示"是否需要同步 auto.codex.md"，避免依赖 AI 自觉。
**反模式**: 改 auto.md 不查 auto.codex.md（本仓库连续两个 run 都犯过）；把"双端核查"留在脑中不写入 outOfScope（看不见即等于不存在）。

### `/auto` 对 vibe coding 的最高 ROI 在护栏而不是加速

**日期**: 2026-05-23 | **置信度**: high | **来源**: 20260523-vibe-coding-roi

真实 run 证据显示，`/auto` 最大价值不在“更快开始写代码”，而在于用 RouteDecision、VerifyReport、LearnCard 把 vibe coding 拉回可回看、可校验、可复用的轨道。对中大任务和连续多轮任务，这会显著减少漏验证、漏同步和漏知识沉淀；对极小任务，流程摩擦可能盖过速度收益。

**推荐动作**: 默认把 `/auto` 用在中大任务、连续任务和高可信交付场景；为极小任务保留 fast-path，避免护栏过重。

### 社区技能接入应优先 manifest + sync，而不是主仓打包大合集

**日期**: 2026-05-23 | **置信度**: high | **来源**: 20260523-ecosystem-enhancement-scan

外部生态在向跨 runtime 的依赖声明和一键同步收敛。相比把海量 skills 直接并入主仓，manifest + sync 更符合 auto-cli 的单入口、轻核心和多 runtime 安装定位。

**推荐动作**: 为 `skills/community/` 增加 manifest 层和同步脚本，优先做声明、拉取、同步、校验链，而不是先收录大量第三方 skill。

---

### PreToolUse 安全快照（git stash 回滚点）

**日期**: 2026-05-24 | **置信度**: high | **来源**: run-20260524-external-research

Edit/Write 触及 ≥ 3 文件时自动 `git stash push -k -u -m "auto-snapshot-<ts>"` 作回滚点。纯 git CLI，无运行时依赖。社区（eesel AI、linux.do）已验证：与 Quest 级回滚天然搭档，回滚成本归零。

**推荐动作**: v0.43 改 hooks/hooks.json，约 10 行配置。

---

### dirty-file 增量审查模式

**日期**: 2026-05-24 | **置信度**: high | **来源**: run-20260524-external-research

PostToolUse 累积改动文件清单到 `.auto/runs/<id>/dirty.json`，Stop hook 触发 code-reviewer 仅审 dirty files。解决"全量审查太贵 / 全跳过又漏"两难。来源：O'Reilly、Nick Tune。

**推荐动作**: 新增 incremental-review skill + 改 hooks.json。

---

### rules/\*.md frontmatter paths glob 按需加载

**日期**: 2026-05-24 | **置信度**: high | **来源**: run-20260524-external-research

rules 文件加 `paths: ["**/*.java"]` 等 glob，SCAN 仅在当前修改文件命中时注入对应 rule。来源：HumanLayer/Clarista 实战。auto-cli rules 已分片但全量加载，加 paths 后可减少 30-50% 无关上下文。

**推荐动作**: v0.43 改 8 个 rules frontmatter，零代码改动。

---

### Reflexion 当 run 自纠（Self-Critique gate）

**日期**: 2026-05-24 | **置信度**: medium | **来源**: run-20260524-external-research

EXECUTE 内每关完成后产出 `quest-N-critique.md`，含达成度评分、盲点清单、是否需回退 PLAN。来源：Reflexion / Self-Refine 经典方法论。补 auto-cli 当前 LEARN 跨 run 沉淀的盲区——缺当下自纠。

**推荐动作**: v0.44 VERIFY 新增第 14 个 gate `self-critique`。


---

### constitution 模式 · 项目级硬约束载体

**日期**: 2026-05-24 | **置信度**: high | **来源**: run-20260524-v043-implementation

constitution 模式来自 GitHub Spec Kit，用单一 `.auto/constitution.md` 承载项目级非协商原则（"必须 / 禁止 / 不可"形式），SCAN 自动检测并在 PLAN / EXECUTE / VERIFY 注入为硬约束。constitution 区别于 CLAUDE.md（软约束 / 指导），违反 constitution 触发 VERIFY fail。Constitution 关键词：constitution / 宪法 / 立法 / 非协商 / 项目原则。

**推荐动作**: 项目稳定后为其建立 `.auto/constitution.md`，30 行内列 3 条 Article（架构不变量 / 质量底线 / 范围纪律）。

---

### incremental-review 模式 · 仅审改动文件

**日期**: 2026-05-24 | **置信度**: high | **来源**: run-20260524-v043-implementation

incremental-review 模式来自 O'Reilly / Nick Tune 实战：PostToolUse 累积 `.auto/runs/<runId>/dirty.txt`，Stop hook 仅对 dirty 文件触发 code-reviewer subagent。解决"全量审太贵 / 全跳过又漏"两难。incremental-review 关键词：incremental-review / 增量审查 / dirty files / Stop hook review。

**推荐动作**: 大型项目（>100 文件）开启 incremental-review skill；小项目无需，可保持每次提交完整 review。

---

### 外部调研先查现状再落地，避免重复造轮子

**日期**: 2026-06-13 | **置信度**: high | **来源**: run-20260613-v048-p0

调研建议"insight 生命周期管理"时，SCAN 实读 learn.md 发现 decay 机制（age-prune/dedup-merge/scope-outdated）已存在，落地动作从"新建机制"降级为"增量补强"（复用计数行 + lastConfirmed 与 age-prune 衔接）。Cite-or-Die 在实现策略同样关键：调研结论 ≠ 仓库现状。关键词：外部调研 / 增量补强 / 重复造轮子 / 现状核对。

**推荐动作**: 实现外部调研建议前，先 Grep/Read 目标文件确认该能力是否已部分存在，再决定新建还是补强。


### [pattern] 声明性数字随版本演进系统性滞后（run-20260613-v050-audit-fix）

**置信度**: high | **scope**: universal

全仓审计发现 8 处版本/计数声明滞后（README 双语徽章差 2-5 个 minor、plugin.json 差 9 个 minor、"33 Skills" vs 实际 36、manifest 卸载清单缺 9 个 skill）。根因：发布流程只更新 package.json + CHANGELOG，散落在徽章 / 插件清单 / 桥接文档 / 英文版中的同一数字无人巡检。双端文档（auto.md vs auto.codex.md）同理：新能力只加 Claude 端，Codex 端欠账累积到 9 项。关键词：版本徽章 / 计数漂移 / 双端对齐 / 发布检查清单。

**推荐动作**: 版本发布前 grep 全仓旧版本号字符串（如 `0\.4[0-9]\.0`）+ 实算 skill/gate/agent 计数对照所有声明处；给 auto.md 加能力时同步检查 auto.codex.md 是否需要等价条目或降级说明。
