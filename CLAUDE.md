# Auto CLI

> Claude Code `/auto` 超级命令。本仓库的目标是让 `/auto` 统一发现、推理、编排并复用各类能力。

## 定位

纯 Markdown 指令仓库，通过 Claude Code 的 slash command 机制运行。不包含 JS 运行时代码。

## 项目结构
- `commands/auto.md`：`/auto` 主命令，定义 6 PHASE 工作流
- `commands/auto/`：子命令（doctor、learn、status、route、create-hook、dashboard）
- `agents/`：内置 agent 清单与说明
- `skills/`：可复用技能知识
- `rules/`：编码规范
- `hooks/`：默认 hooks 配置

## 架构约束
- `/auto` 是唯一编排入口，新增能力优先接入 auto.md，不新增平行入口。
- 文档必须以当前真实行为为准，不能承诺尚未实现的功能。
- PHASE 1 SCAN 默认只读；只有显式 `--fix` 才允许执行安全自动修复。
- 子命令是自包含的 Markdown 指令，不依赖外部 JS 运行时。

## 编码规范
- 修改 Markdown 文件时保持最小 diff。
- 不顺手重构与当前需求无关的内容。
- 不新增无根据的兜底或兼容说明。

## 验证
- 修改后运行 `npm run format:check` 确保格式一致。
- 修改子命令后检查内部引用是否一致。

## 安装与卸载
- `npm run sync` — 复制 commands/agents/skills/hooks 到 ~/.claude/（主推路径）
- `npm run uninstall` — 移除已安装的文件

## Git 与发布
- 提交信息遵循 conventional commits：`feat: ...` / `fix: ...` / `docs: ...`
- 仅在用户明确要求时提交 commit。

## AI 工作方式
- 先读相关文件再改，不猜实现。
- 多文件或有多种实现路径的任务先规划再动手。
- 对删除文件、git 提交等可见操作要谨慎，按用户请求范围执行。
- 如果发现文档与实际行为冲突，优先修文档到一致。

## 架构分层（root/dev 模式）

借鉴 karpathy/llm.c 的 root/dev 分离设计：

| 层 | 目录 | 职责 | 复杂度容忍度 |
|----|------|------|-------------|
| **root** | `commands/` | 用户可直接调用的入口，简单可读 | 低 — 拒绝无显著收益的复杂度 |
| **dev** | `skills/` | 被 commands 调用的能力库，可实验 | 中 — 允许局部复杂 |
| **infra** | `agents/` | Agent 定义与协议 | 低 — 保持 < 450 行 |
| **guard** | `rules/` + `hooks/` | 编码规范与自动化 | 低 — 声明式为主 |

新增能力时优先放 `skills/`，不修改主命令。主命令只做路由和编排。

## 路线图

### 进行中

- [ ] 社区 skills 机制：`skills/community/` 目录支持第三方扩展

### 计划中（v0.52 候选）

- Agent Teams 双模执行：并行 Quest 在 git-worktrees 之外提供原生 Agent Teams 模式（含分层模型成本指引）
- OpenSpec delta specs：`spec-driven` skill 吸收 ADDED/MODIFIED/REMOVED 标记与 proposal→apply→archive 状态机
- hook `agent_id`/`agent_type` 字段利用 + 重评 PostToolUseFailure
- agentless-repair 撤下过时 SWE-bench 分数表述（保留方法论）

### 已完成

- [x] v0.52.0: **loop-engineering skill（/auto 自主循环引擎）**：新增 `skills/loop-engineering/SKILL.md`，把 `/auto` 从单次流水线升级为按 interval 参数（`5m`/`30m`/`2h`）触发的 DOER+CHECKER 自主循环。理论依据 2026 loop engineering 范式（Boris Cherny "My job is to write loops"）+ Anthropic 官方 DOER/CHECKER 模型 + Ralph Loop + Agent SDK budget caps + 非退化性收敛。落地：`commands/auto.md` 新增「Loop 模式（正交于策略）」节 + SCAN 1.8 Loop 参数解析（含持续型/收敛型语义自动触发）+ 兜底索引触发项 + LEARN 6.6 跨迭代回灌；`commands/auto.codex.md` 双端对齐（Codex 无原生调度工具 → 外部 cron/schtasks 或人手触发降级，严禁伪造后台运行）；RouteDecision 增 `loopBudgets`（maxIterations 20 / maxBudgetUsd 10 / maxWallClock 72h / noProgressLimit 3）；收敛判据硬门禁（无可度量 CHECKER 不开 loop）；skills 从 37 升为 38（顺带补 predict-verify 入 README 表，修正长期计数滞后）

- [x] v0.51.0: **自动 run 清理机制**：SessionStart Hook 自动归档超过 30 天（可配置）的历史 run，保持 SCAN 性能；新增 `hooks/lib/auto-clean-runs.sh` 跨平台脚本（支持 Linux/macOS/Windows Git Bash/Node.js/Python 降级）；`hooks/hooks.json` SessionStart Hook 集成（< 50ms 开销）；`commands/auto.md` PHASE 6.4 补充配置/手动触发/恢复说明；`commands/auto.codex.md` LEARN 章节同步（标注 Codex 暂无 Hook）；`rules/hooks.md` SessionStart 章节补充；`skills/community/README.md` 顶部显式声明组织目录身份；`scripts/validate-references.js` 白名单补齐

- [x] v0.50.0: **全仓审计修复（27 项）**：Codex 双端对齐（constitution / self-critique / VERIFY gate 集补齐 + adversarial 降级模式 / LEARN 反馈真实化 / Curator 完整化 / Session Continuity / Portable Patterns）；版本计数全链路统一（README 双语徽章 / plugin.json / marketplace.json / REPO_MAP）；幽灵引用清除（doctor.md `auto install`/`RepoIndexer`、community README 未实现承诺改为"开发中"）；CHANGELOG 补回 0.46/0.47 条目；quest-designer 瘦身 464→440 行；knowledge-management + quality-gates 补激活摘要。审计方法：2 个并行 Explore agent（文档一致性 / 双端对齐）+ 机械检查，清单见 `.auto/runs/run-20260613-top-down-audit/index.md`
- [x] v0.49.0: **plan-ensemble skill（视角集成规划）**：新增 `skills/plan-ensemble/SKILL.md`，PLAN 阶段对高复杂度任务（重构 / 实现+high / brainstorming 后 trade-off 不明 / 用户显式要求）并行派出 2-3 个异质视角只读 subagent 隔离出计划草案（≤30 行/个，零共享上下文防锚定），再以分歧点清单（喂 QuestMap.pitfalls）+ 四维评分矩阵合成唯一 QuestMap；理论依据 NeurIPS 2025 多 agent 辩论评审（arXiv:2510.12697）+ ChatEval 视角多样性 + ACL 2026 受控研究（一轮异质出案即获大部分收益）；`brainstorming` 加升级路由；`auto.md` + `auto.codex.md`（含 Codex 降级模式）+ README 同步；skill 实际计数修正为 36（旧文档"36"虚高一位，实际为 35 + 新增 plan-ensemble）
- [x] v0.48.0: **知识闭环演化升级（ACE + AWM）**：`knowledge-management` 新增 Curator 检查（查重 / 矛盾检测 / merge-or-append，来源 ACE arXiv:2510.04618）+ Insight 复用计数（helpful/harmful/lastConfirmed 反馈环）；`/auto:learn` 新增 `--workflows` 工作流归纳（≥3 个同策略 run 归纳子任务粒度 Quest 序列模板，来源 AWM arXiv:2409.07429）；`skill-evaluator` 新增触发率评估（正/反例语料 60/40 切分量化 D2，对抗 skill debt）；`auto.md` + `auto.codex.md` + `learn.codex.md` 同步
- [x] v0.47.0: **feedback-loop + agentless-repair skill**：新增 `skills/feedback-loop/SKILL.md`（I/O 系统自验证闭环，融合 SWE-agent ACI / Reflexion / 非退化性理论，含生产级退化防护）+ `skills/agentless-repair/SKILL.md`（两阶段 Bug 修复流水线，来源 Agentless 论文 arXiv:2407.01489，SWE-bench Lite 27.33%）；`refactoring-patterns` 追加维度驱动收敛节；`auto.md` + `auto.codex.md` + README 同步更新；skills 从 34 升为 36
- [x] v0.46.0: **production-governance skill**：新增 `skills/production-governance/SKILL.md`，引入第 15 个 VERIFY gate，覆盖目标收敛 / 产物真源 / run 状态 / 成本质量 / skill 健康度；`/auto:status` 增加治理状态字段；`skill-evaluator` 增加 `evidence_missing_count` / `governance_fail_count` 反馈信号；安全敏感路由硬约束补齐；skills 从 31 升为 32
- [x] v0.45.0: **auto.md 精简 + 细节下沉**：1007 行 → 499 行；新增 `skills/quality-gates/SKILL.md`（14 Gate 定义 + Phase 交接自检表）+ `skills/knowledge-management/SKILL.md`（LEARN 全流程）；探索快速通道 / Skill 分层 / 知识注入简化 / Feedback 真实化 / Run 归档 / 编号修复 / 7 项断档补回
- [x] v0.44.0: **B5 收尾 · PHASE 3.3 self-critique 触发钩子**：`commands/auto.md` PHASE 3.3 QuestResult 节追加每关 self-critique 强制触发说明，达成度 < 70 阻断进入下一关。补足 v0.43 留下的 EXECUTE 触发链
- [x] v0.44.0: **C2 · SessionStart hook**：新会话冷启动时提示 Read `CLAUDE.md` / `.auto/constitution.md` / 最新 run 的 `session-continuity.md`，零阻塞项目知识唤醒。PostToolUseFailure / SubagentStart 待 Claude Code 官方 schema 稳定再补
- [x] v0.44.0: **C3 · agent tools 字段标准化**：确认 10 个 agents 已声明 `tools:` 字段（`_shared-principles.md` 为公共原则非独立 agent，不含 tools；Claude Code 中等价于 Anthropic Agent SDK 的 `allowedTools`）；`agents/_shared-principles.md` 边界约束章节新增 tools 字段规范条目
- [x] v0.43.0: **B1 · Constitution skill**：新增 `skills/constitution/SKILL.md`（仿 Spec Kit），SCAN 自动检测 `.auto/constitution.md` 注入为项目级硬约束；PLAN/EXECUTE/VERIFY 三 phase 强制遵守
- [x] v0.43.0: **B2 · PreToolUse 自动快照 hook**：工作树已有 ≥ 3 dirty 文件时，Write/Edit 前用 `git stash create -u` 创建非破坏性 ref `refs/auto-snapshots/<ts>`，落 `.auto/snapshots.log`，零工作树侵入
- [x] v0.43.0: **B3 · incremental-review skill + dirty hook**：新增 `skills/incremental-review/SKILL.md`，PostToolUse 累积 `.auto/runs/<latest>/dirty.txt` 供会话末按需触发增量审查
- [x] v0.43.0: **B4 · rules paths glob frontmatter**：5 个 rules（coding-style / commands / hooks / markdown-authoring / version-and-release）加 `paths` glob，SCAN 按当前文件类型按需注入，减少无关上下文
- [x] v0.43.0: **B5 · self-critique gate**：新增 `skills/self-critique/SKILL.md` 与 VERIFY 第 14 个 gate `self-critique`，实现/重构策略下每关完成强制 Reflexion 自纠，防主线漂移

- [x] v0.40.x: **`knowledge-distribution` gate 落地**：PHASE 4 新增第 13 个 gate，把"LearnCard 分发到 .auto/insights/"从软建议升为硬约束。所有策略（探索/修复/实现/重构）必检；不分发或 `category=trap` 未进 traps.md → VERIFY status=fail 回流 LEARN 补分发
- [x] v0.40.x: **O4 · Git Worktree 多 Agent 并行**：新增 `skills/using-git-worktrees/SKILL.md`，触发条件为 Quest 数 ≥ 3 + 无 touchFiles 交集 + 独立可测试，5 步流程含创建 worktree / 并行实施 / 顺序合并 / 清理
- [x] v0.40.x: **多语言 README（英文版）**：新增 `README.en.md` 核心翻译（标题 + USP + 安装 + 使用 + Agent Skills 标准），README.md 顶部加语言切换
- [x] v0.40.x: **Agent 效果分自动化**：agents/verification.md 加 quest-designer 产出质量评估章节（6 维度评分 → 写入 `.auto/feedback/agents.json` → 影响下次路由）
- [x] v0.40.x: **跨平台扩展**：新增 `.cursor-plugin/plugin.json` + `.opencode/plugin.json` 实验性桥接占位（标注 experimental，等 Cursor/OpenCode 公开 schema 后完善）
- [x] v0.40.x: **O3 · Brainstorming 强制前置**：新增 `skills/brainstorming/SKILL.md`（仿 Superpowers），实现/重构策略下强制 Socratic 提问 2-3 种方案。`requirement-clarifier` 仍作为歧义触发兜底
- [x] v0.40.x: **O1 · Skills 结构对齐 Anthropic 开放标准**：`skills/<name>.md` → `skills/<name>/SKILL.md` + `references/`。install.js 适配新源结构，Claude 端仍写 flat `~/.claude/skills/<name>.md` 兼容旧用户路径，Codex 端 `<name>/SKILL.md` 与源结构一致
- [x] v0.40.x: **O2 · Plugin Marketplace 发布**：新增 `.claude-plugin/marketplace.json` + `.claude-plugin/plugin.json`，用户可 `/plugin marketplace add ktyyer/auto-cli` + `/plugin install auto-cli@auto-cli` 一键安装，与 npm 路径并存
- [x] v0.40.x: README 加「为什么 auto-cli 用过回不去」专章 + 示例 runs 章节（v0.40 增量打磨）
- [x] v0.40.x: `.auto/runs/` 示例索引：通过 README 引用本仓库历次 run 实现使用教程
- [x] v0.40.x: `validate-run-completeness.js` 健壮化：跳过 in-progress / 内容不达标 run，文案精确反映"N 个已跳过"
- [x] skills 自动发现：SCAN 阶段按 frontmatter tags + description 动态匹配，硬编码映射表降级为兜底
- [x] v0.32.0: scripts 抽 manifest + validator 识别表格
- [x] v0.32.0: skill-evaluator skill 集成
- [x] v0.31.0: 从 JS 运行时迁移到纯 Markdown 指令系统

## 当前仓库高价值关注点
- `commands/auto.md` 是统一动作入口。
- 子命令 md 中的能力描述需要持续与实际行为同步。
- 包产物只保留当前需要的版本，旧 tgz 可在确认无用后删除。
- **核心不变量**：用户只使用 `/auto` 一个命令就能完美完成任务。所有新增能力优先以 skill 形式被 `/auto` 自动激活，不引入并列入口。
