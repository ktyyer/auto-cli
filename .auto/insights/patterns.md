# 设计模式和编码最佳实践

> LEARN 阶段自动维护，记录已验证有效的模式。

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
