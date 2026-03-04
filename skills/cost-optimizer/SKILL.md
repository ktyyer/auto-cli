---
name: cost-optimizer
version: 1.0.0
description: Token 成本优化策略 - OpusPlan策略、模型路由、上下文精简、批处理，将 AI 成本降低 50-80%
author: ai-max
tags: [cost, token, optimization, model-routing, budget]
---

# Cost Optimizer — Token 成本优化

> 在不降低质量的前提下，将 AI 使用成本降低 50-80%

## 核心策略

### 1. OpusPlan 模型路由策略（推荐）

不同阶段使用不同模型，在质量和成本之间取得最优平衡：

```
规划阶段 → Claude Opus（慢但深度思考，只用一次）
执行阶段 → Claude Sonnet（速度快、成本低，反复迭代）
简单任务 → Claude Haiku（超低成本，适合格式化/摘要）
```

**实际成本对比**（同一复杂任务）：

| 策略 | 成本 | 质量 |
|------|------|------|
| 全程 Opus | $$$$ | ✅ 最好 |
| OpusPlan + Sonnet执行 | $$ | ✅ 接近最好 |
| 全程 Sonnet | $$ | ✅ 良好 |
| 全程 Haiku | $ | ⚠️ 简单任务 |

**在 `CLAUDE.md` 中配置 OpusPlan**：

```markdown
## 模型使用策略

- `/aimax:deep-plan` — 使用 Opus（规划专用，最多 2 轮）
- `/aimax:tdd` 执行阶段 — 使用 Sonnet
- 格式化/摘要/生成注释 — 使用 Haiku
- `/aimax:code-review` — 使用 Sonnet（Opus 仅用于安全审计）
```

### 2. 上下文精简（最高效的降本方法）

**避免上下文膨胀的关键规则**：

```markdown
# 必须遵守的上下文规则

1. CLAUDE.md 保持 100 行以内
   - 详细规范放 .claude/rules/（按需加载，不占初始上下文）
   - REPO_MAP.md 单独文件，AI 读地图而非逐文件扫描

2. 对话长度控制
   - 单个任务完成后，开新会话（避免上下文污染）
   - 使用 /clear 清除与当前任务无关的历史

3. 善用子 Agent（上下文隔离）
   - 复杂任务分解给子 Agent（各自独立上下文窗口）
   - 子 Agent 将结果浓缩后汇报，不带原始上下文

4. 技能按需加载
   - Skills 在触发时才加载（而非全部预加载）
   - 每次只加载与当前任务相关的技能
```

### 3. 提示工程精简

```markdown
# ❌ 低效提示（浪费 token）
"请你仔细阅读以下代码，然后对其进行完整全面的分析，
包括代码质量、可读性、维护性、扩展性、安全性等各个方面，
并给出详细的改进建议..."

# ✅ 高效提示（同等质量，节省 60% token）
"代码审查：关注安全性和性能，输出问题列表和修复建议"
```

### 4. 批处理减少往返

```markdown
# ❌ 逐步询问（多次往返，多次计费）
- Q: 帮我写 UserService
- A: [写代码]
- Q: 再加测试
- A: [写测试]
- Q: 加注释
- A: [加注释]

# ✅ 一次完整任务（单次往返）
"实现 UserService，包含：
1. CRUD 方法（含分页）
2. 每个方法的 JUnit 测试（覆盖正常+异常）
3. Javadoc 注释
使用 Spring Boot + MyBatis Plus 风格"
```

### 5. 自动上下文压缩

当对话接近上下文窗口限制时，触发压缩（参见 `skills/context-compression/SKILL.md`）：

```
触发条件: 上下文使用 > 70%
动作: 锚定迭代摘要 → 压缩历史 → 保留关键决策
效果: 上下文使用降至 ~30%，任务继续
```

---

## 成本监控

### 查看当前会话成本

```bash
# Claude Code 内置命令
/cost

# 输出示例:
# Input tokens:  45,230 (~$0.14)
# Output tokens: 8,940  (~$0.12)
# Total:         $0.26
```

### 高成本警告信号

| 信号 | 原因 | 解决方案 |
|------|------|----------|
| 对话轮次 > 20 | 上下文积累过多 | 开新会话 |
| 单次回复 > 2000 tokens | 输出过于冗长 | 限制输出格式 |
| 重复解释相同代码 | 上下文未清理 | /clear 后重述任务 |
| 让 AI 读大文件 | 大量 token 消耗 | 用 Repo Map 替代 |

---

## 按任务的成本参考

| 任务类型 | 推荐模型 | 预计成本 |
|----------|----------|----------|
| 简单 bug 修复 | Sonnet | < $0.05 |
| 新增单个功能 | Sonnet | $0.10-0.30 |
| 复杂重构（深度规划） | Opus(规划) + Sonnet(执行) | $0.50-1.50 |
| 全量代码审查 | Sonnet | $0.20-0.80 |
| 生成注释/文档 | Haiku | < $0.05 |
| 多 Agent 并行（5任务） | Sonnet | $0.50-2.00 |

---

## 团队成本控制

### 设置工作区预算

在 Claude Code 管理控制台：

```
Settings → Usage → Workspace Spend Limit
建议: 个人 $50/月，团队 $500/月
超出预警阈值: 80%（提前通知）
```

### 每月成本优化检查清单

```markdown
- [ ] 查看上月 token 消耗排名（哪些操作最贵）
- [ ] CLAUDE.md 是否超出 100 行（精简）
- [ ] 是否有可以用 Haiku 替代 Sonnet 的任务
- [ ] 是否有可以批处理的重复性任务
- [ ] Repo Map 是否最新（减少代码扫描 token）
```

---

## 实战经验

> **最大的成本陷阱**：让 AI 在同一个长对话中同时做规划和执行，会导致执行阶段携带大量规划对话历史，将成本放大 3-5 倍。
> 
> **最高性价比操作**：使用 `/aimax:deep-plan` 生成精炼计划后，开新会话执行，成本可降低 60-70%。

---

## 开源借鉴

- **Claude Code 官方 `/cost` 命令** — 实时成本监控
- **everything-claude-code Token Optimization** — 成本控制最佳实践
- **LiteLLM** — 多模型路由策略（OpusPlan 理念来源）
- **Anthropic 批处理 API** — Message Batches API，异步处理降低 50% 成本
