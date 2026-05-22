---
name: context-engineering
description: 上下文工程方法论 — 管理 AI Agent 的上下文窗口，实现"对的 token 在对的时间"。当任务涉及长会话管理、上下文接近极限、多文件复杂编排、Skill 按需加载、压缩策略、跨会话续接、或 Agent 产出质量下降时，必须加载此 skill。
tags:
  - context
  - token
  - compression
  - progressive-disclosure
  - lazy-loading
  - budget
  - compaction
  - multi-agent
  - context-window
---

# Context Engineering — 上下文工程方法论

> 2026 年 AI Agent 质量的第一瓶颈不是模型能力，而是上下文管理。本 Skill 教会 Agent 如何管理自己的注意力预算。

## 快速使用

```
/auto 这个任务很复杂，帮我拆解并高效完成（触发上下文预算管理）
/auto 上次中断了，续接上次的工作（触发会话续接 + 上下文重建）
/auto 项目很大，帮我分析核心架构（触发渐进式加载）
```

---

## 激活摘要 (Activation Digest)

**核心原则**：上下文窗口是有限的注意力预算，不是无限的存储空间。性能在 ~1M token 后急剧退化（"1M Token Wall"）。目标是找到最小化 token 数同时最大化输出质量的平衡点。

**检查清单** (checklist):

- [ ] 上下文预算感知：当前会话已消耗多少？剩余多少？
- [ ] 渐进式加载：只加载当前 Phase 需要的信息，不预加载一切
- [ ] 写重读轻：协议对象写盘后只保留路径引用，不在上下文中累积
- [ ] 压缩触发：连续 3+ Quest 或上下文 > 60% 时启动主动压缩
- [ ] Subagent 隔离：每个子 agent 只获得完成其任务所需的最小上下文
- [ ] 文件选择策略：排除 node_modules、构建产物、锁文件等噪音

**硬约束** (constraints):

- 禁止在上下文中累积多个完整协议 JSON
- 禁止预加载所有 Skill 全文（启动时只读 name + description，~100 tokens/skill）
- 禁止把已写盘的完整内容重复展开到上下文
- 上下文 > 70% 时必须启动压缩防护
- 每个 Phase 交接只传摘要（status + 一句话 + 文件路径）

**输出模板** (output):

- 上下文状态报告：已用/剩余估算 → 当前加载策略 → 压缩建议

**反模式** (anti-patterns):

- "全量加载"：把整个代码库灌入上下文 → 注意力稀释、幻觉增加
- "累积上下文"：不压缩已完成的 Quest → token 耗尽导致后续 Quest 质量骤降
- "重复展开"：多次读取并保留同一文件全文 → 浪费 token
- "上下文污染"：subagent 的中间过程泄漏回主对话 → 无关噪音干扰决策

---

## 使用时机

**必须加载**：复杂任务（Quest ≥ 3）| 上下文接近极限 | 跨会话续接 | 多 Agent 编排
**按需加载**：长文件分析 → Section 1 | 压缩策略 → Section 2 | Subagent 模式 → Section 3

---

## 一、渐进式加载（Progressive Disclosure）

### 1.1 启动时加载最小集

```
启动时加载（~100 tokens/项）：
  - 每个 Skill 的 name + description（frontmatter）
  - 每个 Agent 的名称 + 一句话职责
  - 项目 CLAUDE.md（仅 gotchas 和 commands）

命中时按需加载：
  - Skill 全文（按三级激活：摘要 → 全文 → 深度）
  - Agent 完整指令
  - 相关源码文件
```

### 1.2 Just-in-Time Context（即时加载）

```
反模式（预加载一切）：
  SCAN 阶段读取 30 个文件 → 大部分无关 → 上下文浪费 80%

正模式（即时加载）：
  1. SCAN：只读 package.json + git status + CLAUDE.md（3 文件）
  2. PLAN：按 QuestMap.touchFiles 只读涉及文件
  3. EXECUTE：每关开始时只加载本关需要的 2-3 个文件
  结果：同样任务，上下文占用减少 60-80%
```

### 1.3 文件选择策略

```
高信号文件（优先加载）：
  - 用户直接提及的文件
  - QuestMap.touchFiles 中的文件
  - 测试文件（验证依据）
  - 配置文件（约束来源）

低信号文件（延迟或跳过）：
  - node_modules/、dist/、build/
  - *.lock 文件（用命令而非文件读取）
  - 大型生成文件
  - 与当前 Quest 无关的模块
```

---

## 二、压缩与预算管理

### 2.1 上下文预算三阶段

| 阶段 | 上下文使用率 | 策略 |
|------|-------------|------|
| 绿区 | < 40% | 正常加载，允许全文级 Skill 激活 |
| 黄区 | 40-70% | 切换摘要级激活，Phase 交接只传路径引用 |
| 红区 | > 70% | 强制压缩，写 session-continuity.md，提示续接 |

### 2.2 压缩策略

```
主动压缩触发条件（满足任一）：
  - 已完成 3+ Quest
  - 上下文估算 > 60%
  - 单个 Quest 执行超过 5 轮工具调用

压缩操作：
  1. 已完成 Quest 的详情 → 合并为 1 行 checkpoint（questId + status）
  2. 已写盘的协议对象 → 只保留文件路径引用
  3. 已读取但不再需要的源码 → 从上下文释放
  4. 中间调试输出 → 只保留最终结论
```

### 2.3 Git Commit 作为 Checkpoint

```
长任务中的最佳实践：
  - 每 2-3 个 Quest 完成后建议用户 commit
  - Commit message 作为压缩后的状态恢复锚点
  - 新会话可通过 git log + git diff 重建上下文
  - 比 session-continuity.md 更持久（不依赖 .auto/ 存在）
```

---

## 三、Subagent 上下文隔离

### 3.1 隔离原则

```
主 Agent（编排者）：
  - 持有：CLAUDE.md、任务计划、高层进度
  - 不持有：子任务的文件级细节

搜索 Subagent：
  - 获得：代码库访问 + 搜索工具
  - 返回：只返回相关结果摘要
  - 隔离：其搜索历史不污染主对话

执行 Subagent：
  - 获得：精确 3 件上下文：指令 + 代码 + 验收标准
  - 返回：执行结果 + 变更摘要
  - 隔离：无规划上下文、无无关文件
```

### 3.2 隔离收益

```
无隔离：所有中间过程在主上下文累积
  → 第 5 个 Quest 时上下文 > 80%
  → 输出质量显著退化

有隔离：每个 subagent 独立上下文窗口
  → 主对话保持 30-40% 使用率
  → 第 10 个 Quest 输出质量仍稳定
```

---

## 四、上下文漂移防护

### 4.1 漂移检测信号

```
AI 可能已经"忘记"用户原始意图的信号：
  - 开始做 outOfScope 里列过的事
  - 使用扩张词（"顺手""既然""一并"）
  - 输出与前几个 Quest 风格不一致
  - 开始猜测而非引用文件
```

### 4.2 防漂移策略

```
Echo the Ask（复读原话）：
  - 每 3 个 Quest 完成后，复读 RouteDecision.userIntent 原话
  - 成本：~50 tokens
  - 收益：拉回主线，防止"只记得最近 Quest，忘了用户原话"

Reverse Diff（反向翻译）：
  - 每关 diff 反向翻译成需求描述
  - 与 objective 对比
  - 不匹配 = 偏移
```

---

## 五、跨会话续接

### 5.1 续接上下文重建

```
新会话启动时的最小上下文重建：
  1. 读 session-continuity.md → 了解中断点
  2. 读 quest-status.json → 了解进度
  3. 读最近 2 个已完成 Quest 的 result → 了解上下文
  4. 读当前 Quest 的 touchFiles → 重新加载
  总成本：~2000 tokens（vs 重新 SCAN 全量 ~10000 tokens）
```

### 5.2 续接质量保证

```
续接后必须验证：
  - 能否不依赖上个会话的记忆完成当前 Quest
  - interruptPoint.contextSnapshot 中的文件是否仍存在
  - 代码状态是否与 quest-status.json 一致
```

---

## 验收标准

- [ ] 复杂任务（≥ 3 Quest）执行中未因上下文耗尽而质量骤降
- [ ] 每个 Phase 交接只传摘要，不重复完整 JSON
- [ ] 上下文 > 70% 时有明确压缩动作或续接提示
- [ ] Subagent 调度时明确了上下文隔离边界

## 与 auto-cli 集成

- **auto.md SCAN**: 启动时的上下文预算初始化
- **auto.md EXECUTE**: 压缩防护触发判断
- **auto.md PLAN**: Skill 激活级别与上下文预算联动
- **_shared-principles.md**: Phase 交接的"写重读轻"原则
- **session-continuity**: 跨会话上下文最小重建
