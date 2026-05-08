---
name: research-analyst
description: 自主调研 Skill — 在动手实现前主动收集外部资料、官方文档、社区共识与现有代码上下文。当用户需求涉及不熟悉的库 / 新框架 / 新技术栈、未见过的第三方 API、版本兼容、最佳实践争议，或显式带 `--research` 时，必须加载此 skill。即使用户没说"调研"，只要触及"我们以前没做过的领域"就要触发。先调研再动手，避免基于猜测开发。
tags: [research, web-search, knowledge-collection, external-docs, methodology]
---

# Research Analyst — 自主调研方法论

> 借鉴 [VoltAgent/awesome-claude-code-subagents](https://github.com/VoltAgent/awesome-claude-code-subagents) 的 research-analyst / search-specialist pattern。
> 核心原则：**不熟悉的事先查，再动手。** 基于猜测开发是 bug 的主要源头。

## 快速使用

```
/auto 用 LangGraph 实现一个 supervisor-worker agent
/auto 集成 Stripe Connect，支持平台分账
/auto --research 这个项目的 traefik 配置最佳实践
```

---

## 使用时机

**必须加载**：

- 需求涉及当前项目未引入的库 / 框架 / SDK
- 触及不熟悉的第三方 API、协议、规范（OAuth / OIDC / WebRTC / gRPC 等）
- 涉及版本兼容、breaking change、migration 路径
- 需求里出现"最佳实践"、"业界标准"、"主流做法"
- 用户显式带 `--research` 或 `调研一下`

**不要触发**：

- 项目内已有相同模式的实现（先 Grep 找现成参考）
- 纯文档修改、格式化、注释更新
- bug 修复且根因已明确（用 `systematic-debugging`）

---

## 核心流程（4 步）

### 第一步：识别调研维度

从需求里提取需要查证的事实点：

| 维度             | 例子                                      | 调研对象                             |
| ---------------- | ----------------------------------------- | ------------------------------------ |
| **库/框架选型**  | "用 LangGraph 还是 CrewAI"                | GitHub stars / 官方文档 / 维护活跃度 |
| **API 规范**     | "Stripe Connect 分账接口"                 | 官方 docs / changelog / 已废弃接口   |
| **版本兼容**     | "React 19 + Next.js 15 兼容性"            | release notes / migration guide      |
| **最佳实践**     | "JWT 短 token + refresh token 的安全实践" | OWASP / 官方建议 / 社区共识          |
| **本项目上下文** | "我们当前怎么做认证"                      | Grep + Read 现有代码                 |

每个维度产出 1-2 个具体调研问题，不超过 5 个。

### 第二步：分层调研

按优先级执行，**先内后外**：

1. **本项目上下文**（最高优先）
   - `Glob` 找相关文件 / `Grep` 找相关符号
   - `Read` CLAUDE.md / REPO_MAP.md / 已有 insight
   - 现有 `traps.md` 是否有相关坑

2. **官方文档**
   - `WebSearch` 关键词带 `site:<official-domain>` 限定
   - `WebFetch` 抓官方 docs / changelog / migration guide
   - 注意发布日期，跳过过时内容

3. **社区共识**
   - `WebSearch` 关键词带年份（如 `2026 best practices`）
   - 优先 GitHub README / 官方 blog / 维护者 talks
   - 警惕大龄博文（>2 年）

4. **失败案例**
   - `WebSearch` 关键词带 `pitfall / trap / antipattern / migration issue`
   - 这些会直接喂给后续 PHASE 的 `pitfalls`

### 第三步：交叉验证

- 至少 2 个独立来源印证一个事实点（官方 + 社区）
- 出现矛盾时记录两边证据 + 倾向，让 PLAN 阶段决策
- 已经过时的资料显式标注 deprecated

### 第四步：产出 research-brief.md

强制结构化输出，写入 `.auto/runs/<runId>/research-brief.md`：

```markdown
# Research Brief

## 需要回答的问题

- Q1: ...
- Q2: ...

## 关键事实（每条带来源）

- F1: <事实> — source: <url> · 日期: <YYYY-MM>
- F2: ...

## 选型对比（如适用）

| 选项 | 维护活跃 | 学习曲线 | 与项目契合度 | 已知坑 |
| ---- | -------- | -------- | ------------ | ------ |
| ...  | ...      | ...      | ...          | ...    |

## 推荐决策

<结论 + 一句话理由>

## 已知陷阱（注入下一 Phase pitfalls）

- T1: ...（标签：tag1, tag2）
- T2: ...

## 来源

- [标题](url)
```

---

## 输出格式硬约束

`research-brief.md` 最小字段：

- **关键事实** ≥ 3 条，每条带来源
- **来源** ≥ 3 个独立链接
- **已知陷阱** ≥ 1 条（即使是"暂未发现明显陷阱"也要显式说明）
- **推荐决策** ≤ 50 字

不允许只出"看起来 X 不错"这种无来源结论。

---

## 反模式

| 反模式                             | 后果                         |
| ---------------------------------- | ---------------------------- |
| 跳过「本项目上下文」直接 WebSearch | 重复造轮子；与现有约定冲突   |
| 只查最新博客不读官方 docs          | 抄到错误示例                 |
| 复制大段网页正文到调研报告         | 上下文爆炸；下游难消费       |
| 无来源凭印象写结论                 | 等同于猜测，违反 skill 初衷  |
| 调研超过 30 分钟还没产出 brief     | 应缩减问题范围或先做最小验证 |

---

## 与 auto-cli 集成

| 注入时机      | 说明                                                                           |
| ------------- | ------------------------------------------------------------------------------ |
| PHASE 1 SCAN  | route 检出"不熟悉关键词"或显式 `--research` 时挂入 `selection.selectedSkills`  |
| PHASE 2 PLAN  | 在调用 quest-designer 之前先产出 research-brief.md，作为 quest-designer 上下文 |
| PHASE 6 LEARN | research-brief.md 中的「已知陷阱」自动转写为 `LearnCard(category=trap)`        |

触发关键词（PHASE 2.2 表格）：
不熟悉的库 / 新技术栈 / 显式 `--research` / 版本兼容 / 最佳实践

---

## 与 skill-creator 的边界

| skill-creator        | research-analyst         |
| -------------------- | ------------------------ |
| 帮你**写一个 skill** | 帮你**调研一个未知领域** |
| 输出 SKILL.md        | 输出 research-brief.md   |
| 触发：写/创建 skill  | 触发：调研/不熟悉/新库   |

两者可串联：先用 research-analyst 调研，再用 skill-creator 把结论沉淀为新 skill。

---

## 验收标准

- [ ] research-brief.md 至少有 3 条带来源的关键事实
- [ ] 至少 2 个独立来源印证（官方 + 社区）
- [ ] 已知陷阱 ≥ 1 条，每条带 tags
- [ ] 推荐决策 ≤ 50 字，无含糊措辞
- [ ] 本项目上下文（已有代码 / CLAUDE.md / insights）已被检索
- [ ] 调研产出后，pitfalls 被注入到 QuestMap

## 来源

- VoltAgent research-analyst pattern：<https://github.com/VoltAgent/awesome-claude-code-subagents>
- Anthropic 官方 17 核心 skill 中的「文档处理」基础能力
