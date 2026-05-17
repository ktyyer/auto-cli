---
name: logging-patterns
description: 结构化日志规范与可观测性模式 — correlation-id、级别策略、错误堆栈、日志溯源。当用户提到日志、log、logging、tracing、可观测性、correlation-id、debug 排查时，或 EXECUTE/VERIFY 阶段涉及运维角色（O）时，必须加载此 skill。
tags: [logging, observability, tracing, correlation-id, structured-logging, debugging]
---

# Logging Patterns — 结构化日志规范

> 运维角色（O）在 EXECUTE/VERIFY 阶段自动加载。

## 快速使用

```
/auto 给 API 加结构化日志和 correlation-id
/auto 日志里找不到错误源头，帮我规范日志
/auto 加 Prometheus 指标埋点
```

---

## 激活摘要 (Activation Digest)

**检查清单** (checklist):

- [ ] 生产默认 INFO 级别，DEBUG/TRACE 通过 `LOG_LEVEL` 环境变量控制
- [ ] ERROR 必须含完整堆栈 (`error.stack`)，不截断
- [ ] 所有 I/O 操作记录 INFO 日志（请求开始/结束 + 耗时）
- [ ] 日志用 JSON 格式输出，含 `correlationId` 字段
- [ ] 关键业务节点记录 INFO（状态变更、支付、定时任务）

**硬约束** (constraints):

- ERROR 日志不得省略堆栈
- catch 块不允许静默吞错（至少 `logger.warn`）
- 禁止循环中同步写日志（用批量或异步）
- 禁止日志中打印密钥/密码/PII

**输出模板** (output):

- `{ "level": "INFO", "correlationId": "xxx", "message": "...", "duration": 200 }`

**反模式** (anti-patterns):

- `console.log` 代替结构化日志 → 无 correlationId
- 异常只 log message 不含 stack → 定位不到根因
- 生产环境开 DEBUG → 日志爆炸

---

## 使用时机

**必须加载**：EXECUTE 涉及 I/O 操作 | VERIFY 阶段 operational-readiness gate | 用户提到日志/log/tracing/debug
**按需加载**：纯前端 → Section 1 | 后端 API → Section 1-3 | 微服务 → 全部

---

## 1. 日志级别策略

| 级别  | 何时使用                   | 示例                              |
| ----- | -------------------------- | --------------------------------- |
| ERROR | 影响业务的失败，需人工介入 | DB 连接断开、支付超时             |
| WARN  | 可恢复异常，不影响主流程   | 重试成功、降级到缓存、限流触发    |
| INFO  | 关键业务节点，生产默认级别 | 请求开始/结束、状态变更、定时任务 |
| DEBUG | 开发调试，生产关闭         | 函数参数、中间变量、SQL           |
| TRACE | 极细粒度调用链，临时开启   | 框架内部调用、序列化细节          |

---

## 2. 结构化日志格式

```typescript
// 正确：结构化 JSON
logger.error({
  event: 'user_login_failed',
  userId,
  error: serializeError(err),
  correlationId
});
```

### 必需字段

| 字段            | 类型   | 说明                        |
| --------------- | ------ | --------------------------- |
| `timestamp`     | string | ISO 8601, UTC               |
| `level`         | string | ERROR/WARN/INFO/DEBUG/TRACE |
| `event`         | string | 事件名, snake_case          |
| `correlationId` | string | 请求链路唯一 ID             |
| `service`       | string | 当前服务名                  |

### 按场景附加字段

| 场景      | 附加字段                                     |
| --------- | -------------------------------------------- |
| HTTP 请求 | `method`, `path`, `statusCode`, `durationMs` |
| DB 操作   | `query`(脱敏), `durationMs`, `rowsAffected`  |
| 外部 API  | `upstream`, `statusCode`, `retryCount`       |
| 错误      | `error.name`, `error.message`, `error.stack` |

---

## 3. Correlation-ID

```
Client → API Gateway (生成 x-correlation-id)
  → Service A (透传) → Service B (透传) → DB/External API (透传)
```

**规则**：入口生成 `crypto.randomUUID()` / 下游透传 HTTP Header `x-correlation-id` / 所有日志必须携带 / 响应头返回方便用户反馈

```typescript
app.use((req, res, next) => {
  const correlationId = req.headers['x-correlation-id'] || crypto.randomUUID();
  req.correlationId = correlationId;
  res.setHeader('x-correlation-id', correlationId);
  next();
});
```

---

## 4. 错误堆栈与溯源

错误日志必须满足「1 分钟定位到代码行」：

| 信息          | 来源                     | 目的                 |
| ------------- | ------------------------ | -------------------- |
| 错误类型+消息 | `error.name` + `message` | 快速分类             |
| 完整堆栈      | `error.stack`            | 定位源码行号         |
| 调用上下文    | 函数参数(脱敏)           | 复现场景             |
| correlationId | 透传                     | 关联同一请求所有日志 |

---

## 按需加载

> 可观测性三支柱（日志/指标/追踪）、必埋指标、告警阈值、敏感信息过滤实现
> → `logging-patterns.references/observability.md`

---

## 与 auto-cli 集成

- EXECUTE 阶段：D 角色检查每处 I/O 有对应日志
- VERIFY 阶段：O 角色检查关键路径有 correlationId + 指标埋点
- security-reviewer 检查日志不含敏感信息

---

## 验收标准

- [ ] 所有日志为 JSON 结构化格式
- [ ] ERROR 级别包含完整堆栈
- [ ] correlationId 贯穿请求全链路
- [ ] 敏感信息已脱敏
- [ ] `LOG_LEVEL` 通过环境变量控制
