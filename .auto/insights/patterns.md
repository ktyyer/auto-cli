# 设计模式和编码最佳实践

> LEARN 阶段自动维护，记录已验证有效的模式。

### install/uninstall 抽 manifest.js 实测收益

**日期**: 2026-04-19
**标签**: dry, refactor, install, proven-in-run
**置信度**: high

`scripts/manifest.js` 导出 `COMPONENTS` + `MANAGED_FILES` 两个共享清单后：install.js -28%（138→99 行），uninstall.js -38%（79→49 行），功能等价。新增 agent/skill/rule/hook 时只改一处，避免清单漂移。未来 `validate-references.js` 也可复用同一清单做"声明即生效"校验。

**来源**: 20260419-205007

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
