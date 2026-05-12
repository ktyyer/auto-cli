---
name: logging-patterns
description: 结构化日志规范与可观测性模式 — correlation-id、级别策略、错误堆栈、日志溯源。当用户提到日志、log、logging、tracing、可观测性、correlation-id、debug 排查时，或 EXECUTE/VERIFY 阶段涉及运维角色（O）时，必须加载此 skill。
tags: [logging, observability, tracing, correlation-id, structured-logging, debugging]
---

# Logging Patterns -- 结构化日志规范

> 运维角色（O）在 EXECUTE/VERIFY 阶段自动加载此知识库。

## 快速使用

```
/auto 给 API 加结构化日志和 correlation-id
/auto 日志里找不到错误源头，帮我规范日志
/auto 加 Prometheus 指标埋点
```

## 使用时机

**必须加载**：

- EXECUTE 阶段涉及 I/O 操作（HTTP、DB、文件、消息队列）
- VERIFY 阶段的 `operational-readiness` gate
- 用户提到日志/log/tracing/debug/排查/定位 时

**按需加载**：

- 纯前端 UI 变更 → 只需 Section 1（级别策略）
- 后端 API → Section 1-3（结构化 + correlation-id）
- 微服务 → 全部章节

## 激活摘要 (Activation Digest)

**检查清单** (checklist):

- [ ] 生产环境默认 INFO 级别, DEBUG/TRACE 通过 `LOG_LEVEL` 环境变量控制
- [ ] ERROR 必须含完整堆栈 (`error.stack`)，不截断
- [ ] 所有 I/O 操作记录 INFO 日志（请求开始/结束 + 耗时）
- [ ] 日志用 JSON 格式输出, 含 `correlationId` 字段
- [ ] 关键业务节点记录 INFO（状态变更、支付、定时任务）

**硬约束** (constraints):

- ERROR 级别日志不得省略堆栈
- catch 块不允许静默吞错（至少 `logger.warn`）
- 禁止在循环中同步写日志（用批量或异步）
- 禁止日志中打印密钥/密码/PII

**输出模板** (output):

- `{ "level": "INFO", "correlationId": "xxx", "message": "...", "duration": 200, "timestamp": "..." }`

**反模式** (anti-patterns):

- `console.log` 代替结构化日志 → 无 correlationId, 排查困难
- 异常只 log message 不含 stack → 定位不到根因
- 生产环境开 DEBUG → 日志爆炸, 性能下降

---

## 1. 日志级别策略

| 级别  | 何时使用                                   | 示例                                  |
| ----- | ------------------------------------------ | ------------------------------------- |
| ERROR | 影响业务的失败，需要人工介入               | DB 连接断开、支付超时                 |
| WARN  | 可恢复的异常，不影响主流程但需关注         | 重试成功、降级到缓存、限流触发        |
| INFO  | 关键业务节点，生产环境默认级别             | 请求开始/结束、状态变更、定时任务启动 |
| DEBUG | 开发调试信息，生产环境关闭                 | 函数参数、中间变量、SQL 语句          |
| TRACE | 极细粒度调用链，仅在排查特定问题时临时开启 | 框架内部调用、序列化细节              |

**原则**：

- 生产环境默认 INFO；DEBUG/TRACE 通过环境变量 `LOG_LEVEL` 控制
- ERROR 必须含完整错误堆栈（`error.stack`），不截断
- WARN 不允许静默吞错：`catch` 块里至少 `logger.warn`

## 2. 结构化日志格式

所有日志输出为 JSON，禁止纯文本拼接：

```typescript
// 错误：纯文本拼接
console.log(`User ${userId} login failed: ${err.message}`);

// 正确：结构化 JSON
logger.error({
  event: 'user_login_failed',
  userId,
  error: serializeError(err),
  correlationId,
  timestamp: new Date().toISOString()
});
```

### 必需字段

| 字段            | 类型   | 说明                                   |
| --------------- | ------ | -------------------------------------- |
| `timestamp`     | string | ISO 8601，UTC 时区                     |
| `level`         | string | ERROR / WARN / INFO / DEBUG / TRACE    |
| `event`         | string | 事件名，snake_case，如 `order_created` |
| `correlationId` | string | 请求链路唯一 ID                        |
| `service`       | string | 当前服务名                             |

### 按场景附加字段

| 场景      | 附加字段                                      |
| --------- | --------------------------------------------- |
| HTTP 请求 | `method`, `path`, `statusCode`, `durationMs`  |
| DB 操作   | `query`（脱敏）, `durationMs`, `rowsAffected` |
| 外部 API  | `upstream`, `statusCode`, `retryCount`        |
| 错误      | `error.name`, `error.message`, `error.stack`  |

## 3. Correlation-ID

每个请求入口生成唯一 `correlationId`，贯穿整条调用链：

```
Client Request → API Gateway (生成 x-correlation-id)
  → Service A (透传)
    → Service B (透传)
      → DB / External API (透传)
```

**规则**：

- 入口层（Gateway / Controller）生成：`crypto.randomUUID()`
- 下游透传：HTTP Header `x-correlation-id`，消息队列 Message Attribute
- 所有日志条目必须携带 `correlationId` 字段
- 响应头返回 `x-correlation-id`，方便用户反馈时提供

```typescript
// Express 中间件示例
app.use((req, res, next) => {
  const correlationId = req.headers['x-correlation-id'] || crypto.randomUUID();
  req.correlationId = correlationId;
  res.setHeader('x-correlation-id', correlationId);
  logger.info({ event: 'request_started', correlationId, method: req.method, path: req.path });
  next();
});
```

## 4. 错误堆栈与溯源

错误日志必须满足「1 分钟定位到代码行」：

| 信息          | 来源                     | 目的                   |
| ------------- | ------------------------ | ---------------------- |
| 错误类型+消息 | `error.name` + `message` | 快速分类               |
| 完整堆栈      | `error.stack`            | 定位到源码行号         |
| 调用上下文    | 函数参数（脱敏）         | 复现场景               |
| correlationId | 透传                     | 关联同一请求的所有日志 |

**脱敏规则**：

- 禁止在日志中输出密码、token、API Key、PII（邮箱/手机号/身份证）
- 脱敏方式：`password: "***"`，`email: "u***@domain.com"`

## 5. 敏感信息过滤

在日志框架层统一过滤，不依赖开发者逐条检查：

```typescript
const sensitiveKeys = ['password', 'token', 'apiKey', 'secret', 'creditCard', 'ssn'];

function redact(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (sensitiveKeys.some((k) => key.toLowerCase().includes(k))) {
      result[key] = '***REDACTED***';
    } else if (typeof value === 'object' && value !== null) {
      result[key] = redact(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}
```

## 6. 可观测性三支柱集成

| 支柱 | 工具推荐                 | 关键指标                                 |
| ---- | ------------------------ | ---------------------------------------- |
| 日志 | Pino / Winston / Datadog | ERROR 率、P99 延迟、correlationId 命中率 |
| 指标 | Prometheus + Grafana     | 请求量、错误率、延迟分布、饱和度         |
| 追踪 | OpenTelemetry / Jaeger   | Span 耗时、跨服务调用链、瓶颈定位        |

### 必埋指标

```
http_requests_total{method, path, status}
http_request_duration_seconds{method, path}  // histogram
db_query_duration_seconds{operation, table}  // histogram
error_total{type, service}
```

### 告警阈值参考

| 指标            | 警告阈值 | 严重阈值 |
| --------------- | -------- | -------- |
| ERROR 率        | > 1%     | > 5%     |
| P99 延迟        | > 2s     | > 5s     |
| DB 慢查询       | > 500ms  | > 2s     |
| 外部 API 失败率 | > 3%     | > 10%    |

## 7. 日志与 auto-cli 集成

- EXECUTE 阶段：D 角色检查「每个 I/O 操作有对应日志」
- VERIFY 阶段：O 角色检查「关键路径有 correlationId + 指标埋点」
- LEARN 阶段：O 角色复盘「哪个生产问题值得固化为 hook」→ 落盘到 `.auto/insights/patterns.md`
- security-reviewer 检查「日志不含敏感信息」

## 验收标准

- [ ] 所有日志为 JSON 结构化格式
- [ ] ERROR 级别包含完整堆栈
- [ ] correlationId 贯穿请求全链路
- [ ] 敏感信息已脱敏（密码/token/PII）
- [ ] 关键路径有 Prometheus 指标埋点
- [ ] `LOG_LEVEL` 通过环境变量控制
