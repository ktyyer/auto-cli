# Robustness Patterns — 实现模式详情

> 从 `robustness-patterns.md` 拆分。按需加载对应 section。

## 2. 重试与退避

### 重试策略

| 场景             | 最大重试 | 退避策略          | 不可重试信号           |
| ---------------- | -------- | ----------------- | ---------------------- |
| 网络 fluctuation | 3        | 指数退避 + jitter | —                      |
| HTTP 4xx         | 0        | —                 | 客户端错误，重试无意义 |
| HTTP 429         | 3        | 按 Retry-After 头 | —                      |
| HTTP 5xx         | 3        | 指数退避          | —                      |
| DB 死锁          | 3        | 固定间隔 100ms    | 死锁日志需记录         |
| DB 连接超时      | 2        | 指数退避          | 连接池耗尽时直接失败   |

### 指数退避 + Jitter

```typescript
function backoffWithJitter(attempt: number, baseMs = 200): number {
  const delay = baseMs * Math.pow(2, attempt);
  const jitter = delay * 0.4 * Math.random() - delay * 0.2; // ±20% jitter
  return delay + jitter;
}
```

**原则**：

- 重试必须有上限（默认 3 次）
- 每次重试记录 WARN 日志（含重试次数、错误类型、下次间隔）
- 总重试时间不能超过请求超时

## 3. 熔断器（Circuit Breaker）

### 三状态模型

```
CLOSED ──(错误率>阈值)──→ OPEN ──(冷却时间到)──→ HALF_OPEN
   ↑                                                  │
   └──────────(探测成功)──────────────────────────────┘
   └──────────(探测失败)──→ OPEN (重置冷却)
```

| 参数             | 推荐值     | 说明                           |
| ---------------- | ---------- | ------------------------------ |
| failureThreshold | 50% / 5 次 | 触发熔断的错误率或连续失败次数 |
| cooldownMs       | 30s        | OPEN → HALF_OPEN 冷却时间      |
| halfOpenRequests | 3          | 半开状态允许的探测请求数       |
| monitoringWindow | 60s        | 统计错误率的时间窗口           |

### 熔断降级

| 降级类型 | 适用场景                 | 示例                |
| -------- | ------------------------ | ------------------- |
| 缓存降级 | 读多写少，数据可容忍过期 | 返回 Redis 缓存     |
| 默认值   | 非核心数据               | 推荐 → 热门列表     |
| 快速失败 | 核心链路无法降级         | 返回 503 + 明确提示 |
| 异步队列 | 写操作可延迟             | 投入 MQ，稍后重试   |

## 4. 限流（Rate Limiting）

### 算法选择

| 算法     | 特点             | 适用场景         |
| -------- | ---------------- | ---------------- |
| 固定窗口 | 简单，有突发问题 | 低精度限流       |
| 滑动窗口 | 平滑，精度高     | API 限流         |
| 令牌桶   | 允许突发         | 用户级限流       |
| 漏桶     | 恒定速率         | 下游处理能力固定 |

### 限流维度

```
全局: 10,000 req/s (保护服务)
用户: 100 req/min (防滥用)
IP:  1,000 req/min (防 DDoS)
API: 按端点粒度 (关键接口更严格)
```

### 限流响应

```typescript
if (isRateLimited(req)) {
  res.setHeader('Retry-After', String(retryAfterSeconds));
  res.status(429).json({ error: 'rate_limit_exceeded', retryAfter: retryAfterSeconds });
  return;
}
```

## 5. 幂等性（Idempotency）

### 幂等保证策略

| 操作类型  | 幂等方案               | 存储        |
| --------- | ---------------------- | ----------- |
| 支付/扣款 | 幂等 Key + 状态机      | DB 唯一索引 |
| 订单创建  | 请求 ID 去重           | Redis SET   |
| 消息消费  | 消息 ID + offset 提交  | 消息队列    |
| 文件写入  | 版本号 / ETag 条件更新 | 对象存储    |

### 幂等 Key 设计

```typescript
const idempotencyKey = `pay:${userId}:${orderId}`;
const exists = await redis.get(idempotencyKey);
if (exists) {
  return { status: 'already_processed', result: JSON.parse(exists) };
}
await redis.set(idempotencyKey, JSON.stringify(result), 'EX', 86400);
```

### 必须幂等的操作

- 支付、退款、转账
- 订单创建、状态变更
- 消息发送（避免重复推送）

## 6. 并发控制

| 问题       | 检测方式              | 解法                       |
| ---------- | --------------------- | -------------------------- |
| 竞态条件   | 多线程/协程写共享状态 | 锁 / CAS / 单线程化        |
| 超卖/超扣  | 并发扣减同一余额      | DB 行锁 / 乐观锁           |
| 双写不一致 | 同时写 DB 和缓存      | 先 DB 后缓存 + 延迟双删    |
| 丢失更新   | 读-改-写无锁          | SELECT FOR UPDATE / 版本号 |

### 分布式锁

```typescript
const lock = await redis.set(key, token, 'NX', 'PX', 30000);
if (!lock) throw new ConflictError('资源被占用');

try {
  await doCriticalSection();
} finally {
  await redis.eval(unlockScript, [key, token]);
}
```

## 7. 超时策略

### 超时层级

```
Client Timeout (30s)
  > Service Timeout (25s)
    > DB Timeout (10s)
    > External API — 同机房 (5s) / 跨网络 (10s)
```

**原则**：

- 每一层超时 < 上层超时（留缓冲给重试/清理）
- 超时后必须清理资源（连接归还、锁释放）
- 超时日志含 correlationId + 总耗时

### 超时推荐值

| 操作          | 超时 | 说明           |
| ------------- | ---- | -------------- |
| 内部 API 调用 | 5s   | 同机房         |
| 外部 API 调用 | 10s  | 跨网络         |
| DB 查询       | 5s   | 单查询         |
| DB 事务       | 10s  | 含多步操作     |
| 消息队列发送  | 3s   | 非阻塞         |
| 文件 I/O      | 30s  | 视文件大小调整 |

## 8. 优雅关闭（Graceful Shutdown）

```typescript
const server = app.listen(port);

process.on('SIGTERM', async () => {
  logger.info({ event: 'shutdown_started' });
  server.close();
  await drainConnections();
  await closeDbConnections();
  await flushLogs();
  logger.info({ event: 'shutdown_completed' });
  process.exit(0);
});
```

**原则**：

- SIGTERM 后等待进行中请求完成（上限 30s）
- 不接受新请求，但已接收的必须处理完
- 关闭顺序：HTTP → 消息队列 → DB → 日志
