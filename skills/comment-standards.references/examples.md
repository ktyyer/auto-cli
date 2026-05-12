# 多语言文档注释示例

> TypeScript/Python/Go 的公共 API 文档注释完整示例。主 skill 只保留原则和模板。

## TypeScript / JSDoc

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

### 文档注释必含元素

| 元素       | 必须 | 说明                 |
| ---------- | ---- | -------------------- |
| 一句话摘要 | 是   | 描述功能，不是实现   |
| @param     | 是   | 每个参数的约束和含义 |
| @returns   | 是   | 返回值类型和范围     |
| @throws    | 条件 | 异常及触发条件       |
| @example   | 推荐 | 典型用法             |

## Python / Docstring

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

## Go / godoc

```go
// ApplyDiscount calculates the discounted amount for an order.
//
// Use percentage strategy for standard promotions, tiered for volume discounts.
// Returns a non-negative float64.
func ApplyDiscount(order Order, strategy string) (float64, error) {
```

## 注释漂移检测命令

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

## 重构时的注释处理

| 重构操作   | 注释处理                           |
| ---------- | ---------------------------------- |
| 提取函数   | WHY 注释移到新函数；新函数加 JSDoc |
| 内联函数   | 合并两处注释，去重                 |
| 重命名     | 注释中的旧名称同步更新             |
| 删除死代码 | 对应注释一并删除                   |
| 合并分支   | 检查两分支的 WHY 注释是否矛盾      |
