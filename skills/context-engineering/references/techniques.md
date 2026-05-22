# Context Engineering — 进阶技术参考

> 本文件为深度级激活时按需加载的参考资料，包含进阶模式和实战案例。

---

## 一、上下文预算量化模型

### 1.1 Token 成本估算

| 内容类型 | 平均 Token 成本 | 信号密度 |
|----------|----------------|----------|
| CLAUDE.md | 200-500 | 极高（每行都有用） |
| Skill frontmatter | ~100/skill | 高（路由决策依据） |
| Skill 激活摘要 | ~500 | 高（核心约束） |
| Skill 全文 | ~2000 | 中（含冗余示例） |
| Skill + references | ~5000 | 低（大量参考细节） |
| 源码文件（中等） | ~1000-3000 | 取决于相关性 |
| Git diff | ~500-2000 | 高（变更聚焦） |
| 命令输出 | ~200-1000 | 中（含噪音） |
| 协议 JSON 全文 | ~800-1500 | 低（冗余结构） |
| 协议摘要引用 | ~50-100 | 高（精华提取） |

### 1.2 预算分配模型

```
总预算: 100%（约 200k 可用 tokens）

推荐分配：
  系统指令 + CLAUDE.md:     10%
  Skill 路由信息:            5%
  SCAN 上下文:              15%
  PLAN + QuestMap:          10%
  EXECUTE（当前关）:         35%  ← 主要执行空间
  VERIFY 命令输出:          15%
  LEARN + 摘要:             10%

警告阈值: 累计 > 70% 时切换到压缩模式
```

---

## 二、自适应 Skill 激活与上下文联动

### 2.1 四信号匹配算法（2026 增强版）

```
匹配度 = (tags 命中数 × 2)
       + (description 语义相似度 × 1)
       + (历史反馈信号 × 1.5)    ← 新增
       + (上下文预算调节 × -0.5 ~ +0.5) ← 新增

历史反馈信号来源:
  - .auto/feedback/skills.json 中的 successRate
  - 最近 3 次 run 中该 skill 的实际应用效果
  - successRate > 0.8 → +1.5
  - successRate 0.5-0.8 → +0.5
  - successRate < 0.5 → -1.0（降权）

上下文预算调节:
  - 当前 < 40%（绿区）→ +0.5（允许更多深度激活）
  - 当前 40-70%（黄区）→ 0（正常）
  - 当前 > 70%（红区）→ -0.5（强制降级激活深度）
```

### 2.2 激活深度与上下文预算联动表

| 上下文区间 | 允许的最高激活级别 | Skill 加载策略 |
|-----------|------------------|--------------|
| < 40% | 深度级（7+） | 全文 + references |
| 40-60% | 全文级（5-6） | 摘要 + 按需子段落 |
| 60-80% | 摘要级（3-4） | 只读激活摘要（~20 行） |
| > 80% | 仅路由参考 | 只用 name + description 做决策，不读内容 |

---

## 三、压缩模式详细规范

### 3.1 压缩级别

| 级别 | 触发条件 | 操作 | 保留内容 |
|------|---------|------|---------|
| L1 轻压缩 | 3+ Quest 完成 | 合并已完关详情 | questId + status + 一句话结论 |
| L2 中压缩 | 上下文 > 60% | L1 + 释放已读源码 | 当前关 touchFiles + 最近 1 关结论 |
| L3 重压缩 | 上下文 > 80% | L2 + 精简 Skill 上下文 | 仅当前 Quest + userIntent 原话 |
| L4 紧急续接 | 上下文接近极限 | 写 session-continuity.md | 续接 prompt + 中断点 |

### 3.2 压缩后的最小上下文

```
L3 重压缩后，上下文中只保留：

1. userIntent 原话（防漂移锚点，~50 tokens）
2. 当前 QuestMap 中未完成关的信息（~200 tokens）
3. 当前 Quest 的 touchFiles 内容（按需 Read）
4. 最近 1 个已完关的 status（~30 tokens）
5. 验证命令和 acceptance（~100 tokens）

总计：~380 tokens 固定 + 按需文件读取
```

---

## 四、ContextOps 治理模式（2026 前沿）

### 4.1 上下文审计

```
每次 /auto run 结束时可选审计：
  - 实际读取了多少文件？其中多少对结果有贡献？
  - Skill 激活了几个？实际应用了几个？
  - 是否有不必要的重复读取？
  - 上下文峰值出现在哪个 Phase？

审计结论写入 learn-cards 中的 pattern 类型，
供下次 SCAN 反查优化加载策略。
```

### 4.2 上下文漂移预防

```
Stanford ACE 论文（2025）关键发现：
  增量式结构化上下文更新 vs 静态/重生成提示
  → 漂移减少 86%
  → 延迟减少 86%

应用到 auto-cli：
  - 不重新生成完整 RouteDecision，而是增量 patch
  - Phase 交接时只传 delta（变化部分），不传全量
  - 每个 Quest 的输出是 incremental update，不是 full replace
```

### 4.3 多工具一致性

```
2026 年现实：59% 开发者同时使用 3+ AI 工具。
auto-cli 的对策：
  - Skill 结构对齐 Anthropic 开放标准（已实现）
  - CLAUDE.md 作为跨工具的统一上下文源
  - .auto/insights/ 作为跨工具的知识共享层
  - 所有 Skill 同时兼容 Claude/Codex/Cursor/Gemini CLI
```

---

## 五、实战案例

### 案例 1：大型 Spring Boot 项目重构

```
问题：20+ 模块，200+ 文件需要分析
传统做法：SCAN 阶段读取所有模块 → 上下文爆炸

Context Engineering 做法：
  1. SCAN：只读 pom.xml + 目录结构 + CLAUDE.md（~2000 tokens）
  2. PLAN：按 QuestMap 确定本次涉及的 3 个模块（~1000 tokens）
  3. EXECUTE：每关只加载本关 2-3 个文件（~3000 tokens/关）
  4. 总上下文峰值：~15000 tokens（vs 全量 ~80000 tokens）
  5. 质量：因为注意力集中，每关输出更精准
```

### 案例 2：跨会话续接 + 压缩恢复

```
场景：5 关任务，第 3 关时上下文接近 80%

处理流程：
  1. 检测到 > 70% → 触发 L2 压缩
  2. 合并 Quest 1-2 为 checkpoint（~100 tokens）
  3. 释放已读的 6 个源码文件上下文
  4. 上下文降至 ~45%
  5. 继续执行 Quest 3-5，质量不退化
  6. 若仍不够 → 写 session-continuity.md → 新会话续接
```

---

## 六、与其他 Skill 的协同

| 场景 | 协同 Skill | 联动方式 |
|------|-----------|---------|
| 复杂重构 | refactoring-patterns | 上下文预算决定拆分粒度 |
| 多 Agent 编排 | workflow-patterns | subagent 隔离策略 |
| 长任务调试 | systematic-debugging | 压缩防护 + 中断恢复 |
| 知识复用 | 全部 | insight 加载按预算调节深度 |
