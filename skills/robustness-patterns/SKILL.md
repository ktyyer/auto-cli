---
name: robustness-patterns
description: 生产级健壮性模式 — 边界值、并发、幂等、熔断、限流、重试退避、降级。当用户提到高可用、稳定性、并发、重试、熔断、限流、降级、幂等、超时、resilience、输入验证、注册、表单、提交、支付、订单 时，或 EXECUTE/VERIFY 阶段涉及健壮性检查时，必须加载此 skill。
tags:
  [
    robustness,
    resilience,
    retry,
    circuit-breaker,
    rate-limit,
    idempotency,
    concurrency,
    degradation,
    timeout
  ]
---

# Robustness Patterns -- 生产级健壮性模式

> 测试角色（T）和运维角色（O）在 EXECUTE/VERIFY 阶段自动加载此知识库。

## 快速使用

```
/auto 给 API 加重试 + 熔断 + 降级
/auto 支付接口需要幂等，帮我设计
/auto 并发写入有竞态，怎么修
```

## 使用时机

**必须加载**：

- 涉及外部服务调用（HTTP API、DB、消息队列）
- 涉及并发操作（共享状态、分布式锁、事务）
- 涉及金融/支付/订单等不可丢失操作
- 用户提到 重试/超时/熔断/限流/降级/幂等/并发 时

**按需加载**：

- 纯前端无副作用操作 → 只需 Section 1（输入校验）
- 后端 API → Section 1-5
- 分布式系统 → 全部章节

## 激活摘要 (Activation Digest)

**检查清单** (checklist):

- [ ] 外部输入一律校验（API 参数、消息队列消息、文件上传）
- [ ] 边界值检查：数值(min/max/NaN)、字符串(空/超长/注入)、数组(空/超大)、日期(时区)
- [ ] 涉及外部调用 → 加重试+退避+超时
- [ ] 涉及写操作 → 加幂等键
- [ ] 涉及支付/订单 → 加分布式锁或乐观锁
- [ ] 高并发读 → 考虑缓存+熔断+降级

**硬约束** (constraints):

- 外部输入不校验不得进入业务逻辑
- 支付/金融操作必须有幂等
- 禁止 catch 后静默吞错

**输出模板** (output):

- 风险点 → 模式（重试/熔断/限流/幂等/降级）→ 实现要点 → 配置项

**反模式** (anti-patterns):

- 所有异常统一 catch + log → 该重试的没重试
- 无超时控制 → 线程/连接耗尽
- 无幂等的支付接口 → 重复扣款

---

## 1. 输入校验与边界值

### 边界值清单

| 参数类型 | 边界检查                                     |
| -------- | -------------------------------------------- |
| 数值     | min/max、NaN、Infinity、负数、零             |
| 字符串   | 空串、超长、特殊字符、Unicode、SQL/HTML 注入 |
| 数组     | 空数组、超大数组、重复元素、嵌套深度         |
| 日期     | 过去/未来、时区、闰秒、格式                  |
| 文件     | 大小上限、类型白名单、文件名路径遍历         |

### 校验原则

- 外部输入一律校验（API 参数、消息队列消息、文件上传）
- 内部可信调用可跳过（性能热点），但需注释说明
- 校验失败返回明确错误码，不暴露内部结构

```typescript
import { z } from 'zod';

const OrderSchema = z.object({
  items: z.array(z.string().min(1)).min(1).max(100),
  totalAmount: z.number().positive().max(1_000_000),
  currency: z.enum(['USD', 'CNY', 'EUR'])
});
```

---

## 2-8. 实现模式详情

> 按需加载完整实现（重试/熔断/限流/幂等/并发/超时/优雅关闭）
> Read `skills/robustness-patterns.references/implementation-patterns.md`
> 仅在需要编码实现时加载，日常检查看激活摘要 checklist 即可。

### 快速决策表

| 场景               | 模式              | 关键配置                           |
| ------------------ | ----------------- | ---------------------------------- |
| 外部 HTTP 调用     | 重试+退避+超时    | maxRetry=3, backoff=exponential    |
| 关键依赖(DB/Cache) | 熔断器            | failureThreshold=50%, cooldown=30s |
| 公开 API           | 限流(滑动窗口)    | per-user: 100/min                  |
| 支付/扣款/退款     | 幂等Key+状态机    | DB唯一索引                         |
| 并发扣减           | 乐观锁/DB行锁     | version字段 / SELECT FOR UPDATE    |
| 进程关闭           | 优雅关闭(SIGTERM) | drain timeout=30s                  |

## 与 auto-cli 集成

- EXECUTE 阶段：D 角色按「本 skill checklist 逐项检查」
- VERIFY 阶段：T 角色验证边界值/并发测试覆盖，O 角色验证熔断/限流/超时配置
- LEARN 阶段：生产故障复盘时对照本 skill 找遗漏项
- quest-designer：涉及外部调用/并发/支付的 Quest 自动注入本 skill

## 验收标准

- [ ] 外部调用有重试 + 退避（指数 + jitter）
- [ ] 关键依赖有熔断器（错误率阈值 + 冷却时间）
- [ ] 公开 API 有限流（维度 + 算法已选择）
- [ ] 支付/订单操作保证幂等（幂等 Key + 去重）
- [ ] 并发写入有锁/CAS 保护
- [ ] 每层超时 < 上层超时
- [ ] 进程支持 SIGTERM 优雅关闭
