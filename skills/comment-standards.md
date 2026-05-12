---
name: comment-standards
description: 代码注释规范 — 何时必写、何时禁写、注释漂移检测。当用户提到注释、comment、文档注释、JSDoc 时，或 EXECUTE/VERIFY 阶段涉及注释质量检查时，加载此 skill。
tags: [comments, documentation, readability, code-quality]
---

# Comment Standards -- 代码注释规范

> 开发角色（D）在 EXECUTE 阶段、code-reviewer 在审查时加载。

## 快速使用

```
/auto 帮我审查这段代码的注释质量
/auto 这里的注释该不该写
/auto 加 JSDoc 到公共 API
```

## 激活摘要 (Activation Digest)

**检查清单** (checklist):

- [ ] 只写 WHY 注释（业务约束、性能取舍、第三方坑、workaround、副作用）
- [ ] 不写 WHAT 注释（代码已自解释的内容）
- [ ] 使用 WHY/REF/RISK 三段模板写关键注释
- [ ] 检查是否有注释漂移（注释与代码不一致）

**硬约束** (constraints):

- 禁止写 `// 获取用户信息` 类废话注释
- 禁止不写 WHY 的业务约束注释（如"退款 T+3"）
- 魔数/硬编码值必须有注释说明来源

**输出模板** (output):

- `// WHY: <原因>  // REF: <参考>  // RISK: <注意事项>`

**反模式** (anti-patterns):

- 每行都注释 → 信息噪声，真正的关键注释被淹没
- 注释与代码不同步 → 误导维护者

---

## 核心原则

> 好代码自解释。注释只解释「为什么」，不解释「是什么」。

## 1. 必须写注释的场景

| 场景                    | 注释内容                 | 示例                               |
| ----------------------- | ------------------------ | ---------------------------------- |
| 不明显的业务约束        | 为什么这么做，而非做什么 | `// 退款必须在 T+3 后，见 PAY-001` |
| 隐藏的性能约束          | 性能取舍的原因           | `// O(n²) 但 n≤50，可接受`         |
| 第三方 API 的反直觉行为 | API 文档没有说清的坑     | `// Stripe 要求金额为分，非元`     |
| 临时绕过（Workaround）  | 绕过的原因 + 相关 issue  | `// FIXME: 临时禁用，见 #1234`     |
| 非局部性的副作用        | 函数外可观测的行为变化   | `// 此调用会清除缓存`              |
| 魔数/硬编码值           | 值的来源或选择依据       | `// 限流值来自压测 P99 结果`       |
| 并发/线程安全约束       | 为什么需要锁或不需要     | `// 无锁：单线程事件循环`          |
| 向后兼容的妥协          | 保留旧逻辑的原因         | `// 保留 v1 参数兼容旧客户端`      |

### 注释模板

```typescript
// WHY: <为什么这样做，而非那样做>
// REF: <相关链接/issue/文档>（可选）
// RISK: <修改此处时需要注意什么>（可选）
```

```typescript
// WHY: 使用批量插入而非逐条，单次 round-trip 减少 99% 延迟
// REF: https://pgbench-results/batch-insert
// RISK: 批量大小 > 1000 时可能触发 StatementTooLarge
async function batchInsert(items: Item[]) { ... }
```

## 2. 禁止写注释的场景

| 反模式                | 为什么禁止                     | 正确做法                  |
| --------------------- | ------------------------------ | ------------------------- |
| 重复代码逻辑          | 注释与代码同步成本高，容易漂移 | 改善命名自解释            |
| `// set name to name` | 零信息量                       | 删除                      |
| 注释掉的代码块        | Git 已有历史，注释代码是噪音   | 删除，靠 Git 历史         |
| `// TODO: fix later`  | 无期限的 TODO 永远不会 fix     | 要么修要么开 issue 并引用 |
| 变更日志注释          | Git log 更权威                 | 删除                      |
| 分隔线注释 `// -----` | IDE 折叠和大纲替代             | 用函数/文件拆分替代       |

### 反模式示例与修正

```typescript
// ❌ 禁止：重复代码
// increment counter by 1
counter++;

// ✅ 正确：不需要注释，代码自解释
counter++;

// ❌ 禁止：注释掉的代码
// const oldResult = legacyCalc(input)
// if (oldResult > threshold) { ... }

// ✅ 正确：删除，Git 保留历史
// （直接删除）

// ❌ 禁止：无期限 TODO
// TODO: optimize this later

// ✅ 正确：关联 issue
// TODO(perf): 批量替代逐条查询，目标 < 100ms — #456
```

## 3. 公共 API 文档注释

公共 API（export 的函数/类/接口）必须有文档注释：

### TypeScript / JSDoc

```typescript
/**
 * 计算订单折扣金额
 * @param order - 订单对象，需包含 items 和 totalAmount
 * @param strategy - 折扣策略：'percentage' | 'fixed' | 'tiered'
 * @returns 折扣后金额（非负数）
 * @throws {ValidationError} order.totalAmount ≤ 0 时
 *
 * @example
 * const discounted = applyDiscount(order, 'percentage') // order.total * 0.9
 */
export function applyDiscount(order: Order, strategy: DiscountStrategy): number { ... }
```

### Python / Docstring

```python
def apply_discount(order: Order, strategy: str) -> float:
    """计算订单折扣金额.

    Args:
        order: 订单对象，需包含 items 和 total_amount.
        strategy: 折扣策略，'percentage' | 'fixed' | 'tiered'.

    Returns:
        折扣后金额（非负数）.

    Raises:
        ValidationError: order.total_amount ≤ 0 时.
    """
```

### Go / godoc

```go
// ApplyDiscount calculates the discounted amount for an order.
//
// Use percentage strategy for standard promotions, tiered for volume discounts.
// Returns a non-negative float64.
func ApplyDiscount(order Order, strategy string) (float64, error) {
```

### 文档注释必含

| 元素       | 必须 | 说明                     |
| ---------- | ---- | ------------------------ |
| 一句话摘要 | 是   | 描述功能，不是实现       |
| @param     | 是   | 每个参数的约束和含义     |
| @returns   | 是   | 返回值类型和范围         |
| @throws    | 条件 | 可能抛出的异常及触发条件 |
| @example   | 推荐 | 典型用法                 |

## 4. 注释漂移检测

### 什么是注释漂移

代码变更后注释未同步更新，导致注释与实际行为不一致。漂移的注释比没注释更危险。

### 漂移检测规则

| 触发条件                        | 检查动作                       |
| ------------------------------- | ------------------------------ |
| 函数签名变更（参数增删改）      | 检查对应 JSDoc/@param 是否同步 |
| return 类型变更                 | 检查 @returns 是否同步         |
| 函数行为变更（新增副作用/分支） | 检查 WHY 注释是否仍准确        |
| 删除或重命名变量                | 检查引用该变量的注释           |
| 修改常量/魔数                   | 检查引用该值的注释             |

### 检测命令

```bash
# 检测函数签名与 JSDoc 参数不一致
grep -rn "@param" --include="*.ts" src/ | while read line; do
  param=$(echo "$line" | grep -oP '(?<=@param )\w+')
  file=$(echo "$line" | cut -d: -f1)
  if ! grep -q "$param" "$file"; then
    echo "DRIFT: $line (param not found in function)"
  fi
done
```

## 5. 注释与重构

### 重构时的注释处理

| 重构操作   | 注释处理                                |
| ---------- | --------------------------------------- |
| 提取函数   | 原处 WHY 注释移到新函数；新函数加 JSDoc |
| 内联函数   | 合并两处注释，去重                      |
| 重命名     | 注释中的旧名称同步更新                  |
| 删除死代码 | 对应注释一并删除                        |
| 合并分支   | 检查两分支的 WHY 注释是否矛盾           |

### 原则

- 重构后先跑测试，再检查注释
- 注释审查是 code-review 的必要项
- 漂移的注释优先删除而非"可能还需要"

## 与 auto-cli 集成

- EXECUTE 阶段：D 角色按「Section 1 必写清单」检查；按「Section 2 禁止清单」清理
- VERIFY 阶段：code-reviewer 检查注释质量 + 漂移检测
- LEARN 阶段：注释相关问题沉淀到 `.auto/insights/patterns.md`
- Hook 支持：PostToolUse 检测注释掉的代码块并警告

## 验收标准

- [ ] 所有公共 API 有文档注释（含 @param/@returns）
- [ ] WHY 注释解释「为什么」而非「是什么」
- [ ] 无注释掉的代码块
- [ ] 无无信息量注释（`// set x to 5`）
- [ ] 无无期限 TODO（必须有 issue 引用或日期）
- [ ] 函数签名变更后对应注释已同步
