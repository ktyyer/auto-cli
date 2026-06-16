---
name: predict-verify
description: 执行影响性命令前预测结果，预测错=理解错，停下重新思考
tags: [verification, self-check, anti-hallucination, reflexion]
---

# Predict-Then-Verify Skill

## 激活摘要

1. **触发时机**：执行任何影响性命令前（git commit / npm publish / Edit 超 50 行 / 删除文件）
2. **预测格式**：`[PREDICT] 预期: <具体输出前 3 行> | 预期返回码: <0/非 0>`
3. **执行后对比**：实际输出 vs 预期输出，若偏差 > 30% → 触发 self-critique
4. **适用场景**：非幂等操作、修改关键文件、发布类命令

## 核心理论

基于 **Reflexion 论文**（NeurIPS 2023, arXiv:2303.11366）的核心洞察：

> AI 在执行前预测结果，预测错误暴露理解偏差，强制停下重新思考。

### 为什么有效？

1. **防止"执行前不想、执行后不看"** — 强制 AI 在执行前形成明确预期
2. **预测错 = 理解错** — 如果预测的输出与实际偏差大，说明对上下文理解有误
3. **自动触发自纠** — 偏差大时自动进入 Reflexion 循环，而非继续盲目执行

---

## 详细流程

### Step 1: 命令前预测（Predict）

在执行前，必须先写出预期结果：

**预测维度**：

- 命令输出的前 3 行应该是什么？
- 返回码应该是 0 还是非 0？
- 会修改哪些文件？（对于 Write/Edit）
- 副作用是什么？（对于 git/npm 命令）

**格式示例**：

```markdown
[PREDICT]
命令: git commit -m "feat: 新增用户导出功能"
预期输出前 3 行:
[main abc1234] feat: 新增用户导出功能
3 files changed, 45 insertions(+)
create mode 100644 src/dto/ExportUserRequest.java
预期返回码: 0
预期副作用: 本地仓库新增 1 个 commit，尚未推送到远程
```

### Step 2: 执行并对比（Verify）

执行后立即对比：

```markdown
[ACTUAL]
命令: git commit -m "feat: 新增用户导出功能"
实际输出前 3 行:
error: pathspec 'src/dto/ExportUserRequest.java' did not match any file(s) known to git
实际返回码: 128
```

**偏差计算**：

- 返回码不匹配 → 偏差 = 100%
- 输出前 3 行差异 > 50% → 偏差 = 60%
- 文件修改数量不符 → 偏差 += 20%

### Step 3: 触发自纠（Self-Critique）

**触发条件**：偏差 > 30%

**自纠动作**：

1. 停止后续操作
2. 触发 `self-critique` skill
3. 重新理解上下文：
   - 文件是否已创建？
   - 路径是否正确？
   - 前置依赖是否满足？
4. 修正理解后重新预测 + 执行

---

## 适用命令类型

| 命令类型        | 是否需要预测 | 预测重点                       |
| --------------- | ------------ | ------------------------------ |
| `git commit`    | ✅ 必须      | 返回码、修改文件数             |
| `git push`      | ✅ 必须      | 是否有冲突、远程分支状态       |
| `npm publish`   | ✅ 必须      | 版本号、是否已存在             |
| `Edit` 超 50 行 | ✅ 必须      | 修改行数、是否影响其他函数     |
| `Write` 新文件  | ✅ 必须      | 文件路径是否正确、目录是否存在 |
| `Bash rm -rf`   | ✅ 必须      | 删除文件数、是否误删关键文件   |
| `Read` 文件     | ❌ 不需要    | 幂等操作，读错不会造成破坏     |
| `Grep` 搜索     | ❌ 不需要    | 幂等操作                       |

---

## 实战示例

### 示例 1：Git Commit 预测错误

**场景**：准备提交新增的 DTO 文件

**预测**：

```markdown
[PREDICT]
命令: git commit -m "feat: 新增导出 DTO"
预期: 3 files changed, 45 insertions(+)
预期返回码: 0
```

**实际**：

```markdown
[ACTUAL]
实际输出: error: pathspec 'ExportUserRequest.java' did not match any file(s)
实际返回码: 128
偏差: 100%（返回码不匹配）
```

**自纠**：

- 停止后续操作
- 检查：`git status` 发现文件未 `git add`
- 修正：先执行 `git add src/dto/ExportUserRequest.java`
- 重新预测并执行 commit

---

### 示例 2：Edit 大文件预测偏差

**场景**：修改 OrderServiceImpl.java，预计改 20 行

**预测**：

```markdown
[PREDICT]
命令: Edit OrderServiceImpl.java（修改 exportOrders 方法）
预期修改行数: 20 行
预期影响: 仅 exportOrders 方法内部
```

**实际**：

```markdown
[ACTUAL]
实际修改行数: 65 行
影响范围: exportOrders + 新增 3 个私有方法 + 修改 import
偏差: 45%（修改行数偏差 225%，影响范围扩大）
```

**自纠**：

- 偏差 > 30%，触发自纠
- 检查：为什么修改行数超预期？
- 发现：新增了 buildExcelHeader / writeExcelRow / closeWorkbook 3 个辅助方法
- 判断：这是否符合"变更洁癖（Surgical Changes）"原则？
- 决策：如果这 3 个方法是必需的，则接受；否则回退到单方法修改

---

## 与其他 Skill 的关系

| Skill                  | 关系 | 交互方式                               |
| ---------------------- | ---- | -------------------------------------- |
| `self-critique`        | 下游 | 偏差 > 30% 时触发 self-critique        |
| `quality-gates`        | 平级 | 在 VERIFY gate 中检查是否执行了预测    |
| `systematic-debugging` | 互补 | 预测失败时，debugging 提供诊断路径     |
| `context-engineering`  | 平级 | 预测需要足够上下文，红区时降级预测粒度 |

---

## 反模式（不要这样用）

### ❌ 反模式 1：预测过于笼统

```markdown
[PREDICT]
命令: npm run build
预期: 构建成功
预期返回码: 0
```

**问题**：预期太模糊，无法判断偏差

**正确做法**：

```markdown
[PREDICT]
命令: npm run build
预期输出前 3 行:

> tsc --build
> webpack --mode production
> Build completed in 12s
> 预期返回码: 0
> 预期产物: dist/ 目录包含 5 个 .js 文件
```

---

### ❌ 反模式 2：预测后不对比

```markdown
[PREDICT] 预期返回码: 0
[执行命令]
[继续下一步，未对比]
```

**问题**：预测了但不对比，等于没预测

**正确做法**：

```markdown
[PREDICT] 预期返回码: 0
[执行命令]
[ACTUAL] 实际返回码: 1，偏差 100% → 触发自纠
```

---

## 成本与收益

| 维度             | 评估                                      |
| ---------------- | ----------------------------------------- |
| **Token 成本**   | +5-10% per 执行命令（需要写预测文本）     |
| **时间成本**     | +2-5 秒 per 命令（对比计算）              |
| **幻觉降低**     | -20-30%（预测错误强制停下，防止盲目执行） |
| **错误修复成本** | -50%（早发现早修复，避免后续连锁错误）    |

**净收益**：对于影响性命令，收益远大于成本。

---

## 参考文献

1. **Reflexion: Language Agents with Verbal Reinforcement Learning**  
   Shinn et al., NeurIPS 2023, arXiv:2303.11366

2. **SELF-REFINE: Iterative Refinement with Self-Feedback**  
   Madaan et al., 2023, arXiv:2303.17651

3. **ReAct: Synergizing Reasoning and Acting in Language Models**  
   Yao et al., ICLR 2023

---

## 实施清单

在 EXECUTE 阶段集成此 Skill：

- [ ] 检测到影响性命令 → 激活 predict-verify
- [ ] 执行前强制输出 `[PREDICT]` 块
- [ ] 执行后立即输出 `[ACTUAL]` 块
- [ ] 计算偏差，偏差 > 30% → 调用 `self-critique`
- [ ] 在 QuestResult.validations 记录预测准确率

---

## 元信息

- **版本**: v1.0
- **作者**: Auto-CLI Team
- **最后更新**: 2026-06-16
- **理论基础**: Reflexion (NeurIPS 2023)
- **适用策略**: 修复 / 实现 / 重构（探索策略不适用，因为是只读分析）
