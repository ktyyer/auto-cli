# 踩坑经验和问题排查

> LEARN 阶段自动维护，记录已验证的踩坑经验。

### .auto/cache/ legacy 文件描述已删除运行时

**日期**: 2026-04-19
**标签**: cache, stale-data, scan-pollution
**置信度**: high

`.auto/cache/knowledge-runtime-v1.md` 仍引用 `src/hooks/*` JS 文件（v0.31.0 已删除），`.auto/cache/optimization-lessons.md` 不在 canonical 清单。cache 层是可丢弃缓存，但 legacy 残留会被 SCAN 误读为"当前事实"。

**触发条件**: 架构迁移后 cache/ 未同步清理
**推荐动作**: cache/ 按 canonical 白名单（capability-snapshot.json、pattern-cards.json）保留，其余归档或删除
**反模式**: cache/ 堆积历史文件当"知识"使用
**来源**: 20260419-201905

---

### REPO_MAP 与 README 能力计数漂移

**日期**: 2026-04-19
**标签**: doc-drift, single-source-of-truth
**置信度**: high

REPO_MAP.md 写 skills "11 个"、hooks "17 个"；实际 12 / 18（skill-evaluator 新增未录入，PostToolUse 从 6 加到 7）。README 已更新但 REPO_MAP 落后一次迭代。

**触发条件**: 新增 agent/skill/hook 时只改 README 未改 REPO_MAP
**推荐动作**: 发布前 checklist 强制 REPO_MAP + README 计数一致；或写 `scripts/sync-counts.js` 自动校验
**反模式**: 把 README 当唯一真源，REPO_MAP 自生自灭
**来源**: 20260419-201905

---

### 空目录污染：skills/ 下 12 个历史试验残留

**日期**: 2026-04-18
**标签**: dir-hygiene, skills, git-tracking
**置信度**: high

skills/ 下残留 12 个空子目录（architect / backend / ceo / data / data-patterns / devops / frontend / qa / security / security-patterns / super-nexus-engineering / project-development-quality-maintainability）。git 不跟踪空目录，所以 CI、引用校验、commit diff 都看不到，但 `ls skills/` 让外部看到"23 个 skill"（实际只有 11 个）。

**触发条件**: 历史实验创建目录后未清理
**推荐动作**: 定期 `find <dir> -maxdepth 1 -type d -empty` 扫描并 rmdir；CI 加目录卫生检查
**反模式**: 依赖 git 追踪来发现目录漂移

---

### Agent subagent 上下文溢出

**日期**: 2026-04-09
**标签**: agent, context-window, quest-designer
**置信度**: high

quest-designer.md 曾达 746 行，作为 subagent 加载时挤占上下文窗口，导致 50+ 次 agent 调度全部失败（成功率 0%）。

**触发条件**: agent .md 文件超过 400 行
**推荐动作**: 将 JSON schema 引用 `_shared-principles.md`，移除项目特定示例，保持 agent .md < 450 行
**反模式**: 在 agent .md 中内联完整 JSON schema 和大段示例代码

---

### store.json 脏数据污染 SCAN

**日期**: 2026-04-09
**标签**: memory, scan, stale-data
**置信度**: high

store.json 残留旧 JS 运行时的路径引用（`src/router/canonical-router.js` 等已删除文件）和 100% 失败的 agent_result 记录。SCAN 阶段读取后被误导。

**触发条件**: 项目架构大幅变更后未重置 store.json
**推荐动作**: 架构迁移后清理 store.json，只保留 canonical 格式数据
**反模式**: 在 store.json 中累积永不清理的历史记录

---

### 协议 schema 多处重复导致不一致

**日期**: 2026-04-09
**标签**: protocol, duplication, maintenance
**置信度**: high

QuestMap/QuestResult/VerifyReport/LearnCard 的 JSON schema 曾同时出现在 auto.md、_shared-principles.md、quest-designer.md 三处，修改一处忘记同步其他导致字段不一致。

**触发条件**: 协议对象定义出现在多个文件中
**推荐动作**: schema 只在 `_shared-principles.md` 定义一次，其他文件用引用
**反模式**: 在多个 .md 文件中复制粘贴完整 JSON schema

---

### 纯 MD 仓库 VERIFY 要按可执行子集调整 gate

**日期**: 2026-04-18
**标签**: verify-gate, markdown-repo, strategy-adaptation
**置信度**: high

"实现"策略默认要求 build+test+lint+coverage，但 auto-cli 是纯 MD 指令仓库，仅 `format:check` 与 JSON 合法性可跑。

**触发条件**: 在无 build/test 的仓库跑 /auto 实现任务
**推荐动作**: VerifyReport 明确标记 skipped gate 与原因；必须 pass 的是 format + JSON + 引用一致性
**反模式**: 机械按"实现=必须过 build+test"，在纯 MD 仓库会导致 VERIFY 误判失败
**来源**: run-1776525672

---

### Explore agent 网络调研：中转网关 500 时立即降级主窗口 WebSearch
**标签**：agent-failure, network-research, fallback-path
**触发条件**：Agent 任务返回含 `API Error: 500 Panic detected (Calcium-Ion/new-api)`
**症状**：4 路并行 Explore agent 全部约 3 分钟后报 500 失败
**反应**：
1. 立即 TaskStop 任何同类 agent（避免 same_path 重试）
2. 主窗口直接 WebSearch / WebFetch（alternative_path）
3. 每搜一次立即结构化压缩 ≤ 30 行写盘
**来源**：run-20260508-ecosystem-scan

### 新建 markdown 文件后必须立即 prettier --write
**标签**：prettier, format-check, new-file, lint-flow
**触发条件**：format:check 报 Code style issues found in N files
**症状**：Write 工具不套 Prettier，新文件首次必然挂 lint
**反应**：先 npx prettier --write 文件路径，再跑 npm run check
**根因**：Prettier 是 lint 代理（已记录），但 Write 工具首次走原始内容
**来源**：run-20260508-p0skills

### Bash heredoc 写大文件遇反引号 + 复杂表格撞 EOF 解析
**标签**：bash-heredoc, large-write, backtick-eof
**触发条件**：cat > file << 'EOF' ... EOF 内容含 ` 反引号代码块 + 多表格时偶发 EOF 提前关闭
**症状**：unexpected EOF while looking for matching ' (line N)
**反应**：拆成多个独立 cat heredoc 分批 append，每段 < 80 行
**来源**：run-20260508-perfect-loop

---

### tree-sitter 需要 C 编译器

**日期**: 2026-05-10  
**标签**: tree-sitter, c-compiler, environment, code-analyzer  
**置信度**: high

tree-sitter CLI 依赖 C 编译器（gcc 或 clang）。用户环境如果缺少 C 编译器，tree-sitter 安装会失败。

**触发条件**: 使用 code-analyzer skill，环境中没有 gcc 或 clang  
**推荐动作**: 
- 在 `/auto:doctor` 中检查 C 编译器
- 缺失时提示安装：Linux `sudo apt-get install build-essential`，Mac `xcode-select --install`
- 提供降级方案：使用 grep 或 ctags

**反模式**: 假设所有环境都有 C 编译器  
**来源**: run-20260510-114612

---

### LLM 生成的测试需要人工审查

**日期**: 2026-05-10  
**标签**: test-generation, llm, quality, ai-generated-code  
**置信度**: high

使用 AI 生成单元测试时，LLM 可能遗漏特定领域的边界值或包含逻辑错误。直接运行未审查的测试可能导致误报或漏报。

**触发条件**: 使用 AI 生成测试代码，跳过人工审查步骤  
**推荐动作**:
- 强制要求人工审查：检查可编译运行、补充边界值、验证断言、调整风格
- 与 code-reviewer agent 协同，自动检查测试质量

**反模式**: 盲目信任 LLM 生成的测试  
**来源**: run-20260510-114612

---

### 向量数据库成本随规模爆炸

**日期**: 2026-05-10  
**标签**: vector-db, cost, scaling, mcp-knowledge  
**置信度**: high

向量数据库成本随向量数量呈非线性增长。pgvector 在 10M 向量时约 $45/月，但 Pinecone 在 100M 向量时可达 $700+/月。

**触发条件**: 向量数超过 10M，选择托管向量数据库  
**推荐动作**:
- MVP 阶段使用 pgvector（本地 PostgreSQL）
- 生产级再迁移到 Pinecone（零运维、自动扩展）
- 提前规划成本预算，设置告警阈值

**反模式**: 一开始就用 Pinecone，导致 MVP 阶段成本过高  
**来源**: run-20260510-114612

---

### Codex 覆盖安装不能只替换主命令，还要处理 Claude-only 子命令泄漏

**日期**: 2026-05-13
**标签**: codex-runtime, install, command-leak, runtime-boundary
**置信度**: high

当仓库开始使用 `commands/*.codex.md` 为 Codex 提供覆盖 prompt 时，如果安装脚本仍默认复制所有未覆盖的子命令，就会把 `create-hook` 这类 Claude-only 命令继续暴露到 Codex，形成 README/Prompt 叙事与实际安装产物不一致。

**触发条件**: 为 Codex 引入覆盖版 prompt，但 `copyCommands` 仍按“无覆盖则原样复制”处理子命令
**推荐动作**: 为 Codex 增加 allowlist 或显式 denylist；至少把 `create-hook` 排除，或补 `create-hook.codex.md` 声明不支持
**反模式**: 只修主 `/auto`，忽略同目录子命令的运行时边界
**来源**: run-20260513-review-codex-runtime

---

### 发布链路命令不能并行执行

**日期**: 2026-05-13
**标签**: release, install, race-condition, verification
**置信度**: high

`uninstall`、`pack`、`install` 之间存在明确依赖关系。即使三个命令各自成功，并行执行也会造成安装结果被卸载覆盖、目录状态短暂为空，最后把“执行顺序错误”误诊成“安装脚本损坏”。

**触发条件**: 使用并行工具同时运行卸载、打包、安装或重装相关命令
**推荐动作**: 发布回归只允许串行执行：先卸载，再打包，再安装，最后核对落盘产物
**反模式**: 把发布链路视为可并行的独立命令
**来源**: run-20260513-185511-release-refresh

### validator "取最新者" 不区分 in-progress 与 broken run

**日期**: 2026-05-17
**标签**: validator, scripts, cache-runs, ci-stability
**置信度**: high

`validate-run-completeness.js` 原 `resolveRunId` 用 mtime 取最新目录，永远命中 in-progress 或半成品 run，导致 `npm run check` 在任何一次 /auto 中断后红。`.auto/runs/` 是 cache 性质（不入 git），半成品自然累积。

**触发条件**: 中断 /auto 留下半成品 run；历史协议升级遗留旧 run；用户手动放笔记到 .auto/runs/ 下
**推荐动作**: 任何"取最新者校验"的脚本预设"最新者可能未完成"，倒序找完整对象，找不到则视同空触发 --allow-missing
**反模式**: 简单返回 `runs[runs.length - 1]` 当作"权威 latest"
**来源**: run-20260517-fix-consistency

### 工具能力强但脱离生态等于隐形

**日期**: 2026-05-17 | **置信度**: high | **来源**: run-20260517-strategic-optimization

评估开源工具时不仅看功能完备性，更要看"是否在用户安装/发现路径上"：未被 awesome 列表收录 + 未上 plugin marketplace + 无英文文档 → 等同隐形。优化生态接入比新增功能 ROI 更高。
**反模式**: 把工具内部能力对标当成竞品评估的全部维度

### validate 通过不等于校验完整

**日期**: 2026-05-17 | **置信度**: high | **来源**: run-20260517-skills-standardize

改造扫描函数后立即跑 validate 并**核对"可用 X: N"计数**。如果计数变成 0 但 EXIT=0，说明 validate 静默失去了对该类资源的覆盖（failed=0 因为根本没扫到东西）。本仓库重组 skills 时 validate-references 一度报"可用 Skills: 0 / 通过: 20 / 失败: 0 / EXIT=0"，误导性极强。
**反模式**: 仅看 EXIT code 不看计数

### 知识沉淀闭环失败 — LearnCard 停在 run 目录

**日期**: 2026-05-17 | **置信度**: high | **来源**: run-20260517-modifications-audit

`/auto` PHASE 6.1 规定 LearnCard 必须**分发到 `.auto/insights/{patterns,decisions,traps,prompts}.md`**，但实际本会话 7 个 run 一度仅 1/7 真分发。AI 容易把"learn-cards.md 已写"误判为"知识已沉淀"。
**触发条件**: 连续多 run 任务时主流程焦虑于推进，忽略 LEARN phase 的"再分发"步骤
**推荐动作**: VERIFY 阶段新增 `knowledge-distribution` 子检查，确认 LearnCard 真 append 到 insights/
**反模式**: 把 `runs/<id>/learn-cards.md` 视为知识沉淀的终点

### 大版本结构迁移时漏掉 .codex.md 镜像同步

**日期**: 2026-05-17 | **置信度**: high | **来源**: run-2026-05-17-audit-codex-sync

源代码结构升级（如 `skills/<name>.md` → `skills/<name>/SKILL.md`）时，开发者通常只更新 Claude 主命令（commands/auto.md），**遗漏 Codex 镜像**（commands/auto.codex.md + 4 个子命令 .codex.md + manifest.js 的 CODEX_SKILL_DIRS 数组）。结果 Codex 端 glob `skills/*.md` 在新结构下找不到任何文件，skill 动态发现彻底失效。
**触发条件**: Codex 端配置分散在 5+ 文件，手动同步易漏
**推荐动作**:
1. 任何 skill 结构变更必须**同时**修改所有 5 个 .codex.md 文件 + manifest.js
2. 推荐写 `validate-codex-sync.js` 自动核对路径一致性
3. 大版本变更后必须跑 `grep -rn "skills/\*\.md" commands/` 确认无旧路径残留
**反模式**: 只验证 Claude 端通过就发布；以为 install.js 正确就万事大吉（实际是命令文件内嵌的 Glob 模式也要同步）

### 跨平台脚本的"静默失败" — exit 0 + 0 产出

**日期**: 2026-05-17 | **置信度**: high | **来源**: run-2026-05-17-fix-codex-sync

`scripts/rebuild-skill-extracts.js` 在 skill 结构从 flat 迁移到 nested 后旧逻辑 `readdirSync(SKILLS_DIR).filter(f => f.endsWith('.md'))` 在新结构下匹配 0 个文件，但脚本仍 exit 0 + 输出 "0 extracted, 0 placeholder, 0 total"。看起来"成功"但实际完全失败。同类反模式：validate-references 显示 "0 通过 0 失败 EXIT 0" 也算成功。
**触发条件**: 枚举型脚本统计字段为 0 不触发告警
**推荐动作**:
1. 脚本若预期产出数 > 0，应主动检查并 exit 1 告警
2. 在 CI 中加 `[ "$(ls $DIR | wc -l)" -ge $EXPECTED ] || exit 1`
3. 注释中明确"预期产出数 ≈ 实际 skill 目录数"
**反模式**: 任何"枚举 → 处理"型脚本可以"成功完成 0 工作"

### auto.md 存在两个 2.4 节标题冲突（历史遗留）

**日期**: 2026-05-21 | **置信度**: medium | **来源**: run-20260521-prompt-tricks-merge

`commands/auto.md` 行 329 与行 343 同时使用 `### 2.4` 标题（"假设声明" 与 "推理摘要"），属历史遗留 bug。本 run 在 Scope Contract 中显式延后修复（用户原话只要求加提示词技巧，不含编号修复），符合"变更洁癖"。

**推荐动作**: 下次有人触及 PHASE 2 章节时顺手把第二个 `2.4` 改为 `2.5`，并将后续 `2.5 Quest 设计` 重编号至 `2.6`、`2.6 Micro QuestMap` 至 `2.7`。或将 `2.4 假设声明` 合并到 `2.3`。最小 diff 优先。
**反模式**: 在不相关的 PR 里"顺手修"——会扩大 diff 范围，违反变更洁癖；正确做法是单独开一个 chore PR 处理编号统一。

### 已沉淀的知识不被自动复用——knowledge-reuse gate 在元任务上失效

**日期**: 2026-05-21 | **置信度**: high | **来源**: run-20260521-codex-mirror-sync

上一个 run（`run-20260521-prompt-tricks-merge`）违反了 patterns.md 已沉淀的"auto.md / auto.codex.md 双端镜像必须同步"硬约束——而那条 pattern 就是同 run 自己沉淀的。证明现有 `knowledge-reuse` gate 只检查 `[insight:xxx]` 标记数 ≥ 期望，**不检查最相关 pattern 是否被真正读到并应用**。根因：SCAN 没用关键词 "codex/双端/sync" 触发检索；PLAN `outOfScope` 没显式列双端核查；EXECUTE 只改了 claude 端。

**推荐动作**:
1. `knowledge-reuse` gate 增加"语义相关性检查"——不只看注入数，还要看是否覆盖了"与本次 touchFiles 高度相关"的已有 pattern
2. PLAN 阶段加入"双端核查清单"：若 touchFiles 含 `commands/auto*.md` → 强制 grep 另一端确认对齐
3. 在 `outOfScope` 模板中加入"双端镜像"作为默认提醒项

**反模式**: 把 `[insight:xxx]` 标记数 ≥ N 当作"知识已复用"——可能只复用了 N 条不相干的，最关键那条仍然缺席。

