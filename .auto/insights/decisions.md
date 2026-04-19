# 架构决策和技术选型记录

> LEARN 阶段自动维护，记录关键架构决策及理由。

### `npm run install` 让位于 `npm run sync` 作为主入口

**日期**: 2026-04-19
**标签**: onboarding, ux, install-ergonomics
**置信度**: medium

`npm run install` 与 `npm install` 语义重叠，新用户易误以为 `npm install` 就已部署。决策：README 与 CONTRIBUTING 主推 `npm run sync`；`install` 脚本保留向后兼容但不宣传。

**备选方案**: 删除 `install` 脚本 → 放弃，会破坏已有用户；作别名即可。
**来源**: 20260419-201905

---

### 从 JS 运行时迁移到纯 Markdown 指令系统

**日期**: 2026-04-04
**标签**: architecture, migration
**置信度**: high

v0.31.0 删除 72% 代码（-6683 行），移除 `src/`、`tests/` 等 JS 运行时代码。原因：Claude Code slash command 机制本身就是执行引擎，不需要额外的 JS 编排层。Markdown 指令直接驱动 AI 行为，更简单、更可维护。

**备选方案**: 保留 JS 运行时作为编排层 → 放弃，因为增加了不必要的复杂度且与 Claude Code 原生能力重复。

---

### 6-PHASE 流水线设计

**日期**: 2026-04-04
**标签**: architecture, workflow
**置信度**: high

SCAN → PLAN → EXECUTE → VERIFY → SUMMARIZE → LEARN 六阶段单向流动。每阶段产出标准协议对象，下游消费上游产物。设计理由：强制结构化交接，避免 AI 跳步或遗漏验证。

**备选方案**: 自由形式执行（无固定阶段）→ 放弃，因为缺乏可追溯性和质量门禁。

---

### .auto/ 作为项目级知识存储

**日期**: 2026-04-09
**标签**: architecture, knowledge, persistence
**置信度**: high

`.auto/` 目录分为 5 层：`cache/`（可丢弃）、`runs/`（单次运行真源）、`insights/`（长期知识）、`memory/`（项目记忆索引）、`feedback/`（结构化反馈）。设计理由：分离关注点，cache 可随时重建，insights/feedback 是长期积累。

---

### 外部 skill 治理项目按"契合度 × 协议对齐度"分级借鉴

**日期**: 2026-04-18
**标签**: external-project, integration, skill-governance
**置信度**: high

SkillCompass 依赖 Node.js、有 4 个平行 /eval-* 入口；darwin-skill 纯 MD 但用独立 results.tsv。决策：只吸收"方法论 + schema 字段清单"，用 LearnCard/.auto/feedback 统一承载，不引入运行时与平行入口。落地产物：skills/skill-evaluator.md（纯 MD）+ .auto/feedback/skills.json 扩展字段。

**备选方案**: 整包 fork + 保留独立数据格式 → 放弃，会造成协议碎片化与架构漂移
**来源**: run-1776525672

---
