---
name: systematic-debugging:condition-based-waiting
description: 由 systematic-debugging.md 主文件按需加载。完整上下文见主文件。
---

# 条件轮询等待

> 由 `systematic-debugging.md` 主文件按需加载。完整上下文见主文件。
> 基于 [obra/superpowers/condition-based-waiting](https://github.com/obra/superpowers/blob/main/skills/systematic-debugging/condition-based-waiting.md) 适配。

---

## 核心原则

不稳定的测试经常用任意延时猜测时间。这制造了竞态条件——快速机器通过，负载下或 CI 中失败。

**核心原则：等待你关心的实际条件，而不是猜测需要多长时间。**

---

## 使用时机

**使用条件等待：**

- 测试有任意延时（`setTimeout`、`sleep`、`time.sleep()`）
- 测试不稳定（有时通过，负载下失败）
- 测试在并行运行时超时
- 等待异步操作完成

**使用任意延时的唯一场景：**

- 测试实际的定时行为（防抖、节流间隔）
- 必须文档说明为什么需要任意延时

---

## 核心模式

```typescript
// 错误：猜测时间
await new Promise((r) => setTimeout(r, 50));
const result = getResult();
expect(result).toBeDefined();

// 正确：等待条件
await waitFor(() => getResult() !== undefined);
const result = getResult();
expect(result).toBeDefined();
```

---

## 快速模式

| 场景     | 模式                                                 |
| -------- | ---------------------------------------------------- |
| 等待事件 | `waitFor(() => events.find(e => e.type === 'DONE'))` |
| 等待状态 | `waitFor(() => machine.state === 'ready')`           |
| 等待数量 | `waitFor(() => items.length >= 5)`                   |
| 等待文件 | `waitFor(() => fs.existsSync(path))`                 |
| 复合条件 | `waitFor(() => obj.ready && obj.value > 10)`         |

---

## 通用实现

```typescript
async function waitFor<T>(
  condition: () => T | undefined | null | false,
  description: string,
  timeoutMs = 5000
): Promise<T> {
  const startTime = Date.now();

  while (true) {
    const result = condition();
    if (result) return result;

    if (Date.now() - startTime > timeoutMs) {
      throw new Error(`Timeout waiting for ${description} after ${timeoutMs}ms`);
    }

    await new Promise((r) => setTimeout(r, 10)); // 每 10ms 轮询
  }
}
```

---

## 常见错误

| 错误                             | 修复                           |
| -------------------------------- | ------------------------------ |
| 轮询太快：`setTimeout(check, 1)` | 每 10ms 轮询                   |
| 没有超时：条件不满足时无限循环   | 始终包含超时和清晰错误信息     |
| 过期数据：循环前缓存状态         | 在循环内调用 getter 获取新数据 |

---

## 任意延时的正确用法

```typescript
// 工具每 100ms tick 一次 - 需要 2 个 tick 验证部分输出
await waitForEvent(manager, 'TOOL_STARTED'); // 先等待触发条件
await new Promise((r) => setTimeout(r, 200)); // 再等待定时行为
// 200ms = 2 个 tick × 100ms 间隔 - 已记录且有理由
```

**要求：**

1. 先等待触发条件
2. 基于已知时序（不是猜测）
3. 注释说明为什么

---

## 实战效果

- 修复 3 个文件中 15 个不稳定测试
- 通过率：60% → 100%
- 执行时间：快 40%
- 消除了所有竞态条件
