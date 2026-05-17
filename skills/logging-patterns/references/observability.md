# 可观测性三支柱 + 告警阈值

> 从 logging-patterns 主文件拆分。按需加载。

## 可观测性三支柱

| 支柱 | 工具推荐                 | 关键指标                                 |
| ---- | ------------------------ | ---------------------------------------- |
| 日志 | Pino / Winston / Datadog | ERROR 率、P99 延迟、correlationId 命中率 |
| 指标 | Prometheus + Grafana     | 请求量、错误率、延迟分布、饱和度         |
| 追踪 | OpenTelemetry / Jaeger   | Span 耗时、跨服务调用链、瓶颈定位        |

## 必埋指标

```
http_requests_total{method, path, status}
http_request_duration_seconds{method, path}          # histogram
db_query_duration_seconds{operation, table}          # histogram
error_total{type, service}
circuit_breaker_state{service}                       # 0=closed, 1=open, 2=half-open
rate_limit_hits_total{endpoint, user_tier}
```

## 告警阈值参考

| 指标            | 警告阈值 | 严重阈值    |
| --------------- | -------- | ----------- |
| ERROR 率        | > 1%     | > 5%        |
| P99 延迟        | > 2s     | > 5s        |
| DB 慢查询       | > 500ms  | > 2s        |
| 外部 API 失败率 | > 3%     | > 10%       |
| 熔断器打开      | 任意服务 | 2+ 服务同时 |
| 限流触发率      | > 10%    | > 30%       |

## 敏感信息过滤

在日志框架层统一过滤：

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

## 脱敏规则

- 禁止日志输出：密码、token、API Key、PII（邮箱/手机号/身份证）
- 脱敏方式：`password: "***"`，`email: "u***@domain.com"`
