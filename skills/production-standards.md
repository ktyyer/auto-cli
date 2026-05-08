---
name: production-standards
description: 新项目生产就绪标准 — health check、graceful shutdown、cost caps、circuit breaker、tool permissioning、evaluation hooks 的 checklist 模板。当用户提到上线、部署、生产环境、production readiness、新项目初始化时，或 VERIFY 阶段的 operational-readiness gate 时，必须加载此 skill。
tags: [production, deployment, health-check, readiness, operational, checklist]
---

# Production Standards -- 生产就绪标准

> 运维角色（O）在 VERIFY 阶段的 `operational-readiness` gate 自动加载。

## 快速使用

```
/auto 新项目上线前检查生产就绪
/auto 加 health check 和 readiness probe
/auto 帮我写 Dockerfile + 生产配置
```

## 使用时机

**必须加载**：

- 新项目初始化（配合 `init-project` skill）
- VERIFY 阶段 `operational-readiness` gate
- 用户提到 上线/部署/生产/production/发布 时

**按需加载**：

- 已有项目的局部修改 → 只需相关 section
- 纯前端项目 → Section 1-3（健康检查不适用）

## 1. 生产就绪 Checklist

### 必备项（上线前必须全过）

| #   | 检查项             | 验证方式                         | 失败后果                 |
| --- | ------------------ | -------------------------------- | ------------------------ |
| 1   | 健康检查端点       | `curl /health` 返回 200          | 负载均衡无法摘除故障节点 |
| 2   | 就绪探针           | `curl /ready` 检测依赖可用性     | 流量打到未就绪实例       |
| 3   | 优雅关闭           | SIGTERM 后等待进行中请求完成     | 用户请求被截断           |
| 4   | 环境变量配置       | 无硬编码，所有配置走 env         | 无法按环境切换           |
| 5   | 结构化日志         | JSON 格式，含 correlationId      | 排查靠肉眼翻日志         |
| 6   | 错误不泄露内部信息 | 500 响应不含堆栈/路径            | 信息泄露                 |
| 7   | 速率限制           | 公开 API 有 per-user/per-IP 限流 | 被滥用/DDoS              |
| 8   | HTTPS + 安全头     | HSTS / CSP / X-Frame-Options     | 中间人/点击劫持          |

### 推荐项（视项目规模）

| #   | 检查项              | 验证方式                        |
| --- | ------------------- | ------------------------------- |
| 9   | Prometheus 指标埋点 | `/metrics` 端点可访问           |
| 10  | 分布式追踪          | OpenTelemetry 接入，Span 可关联 |
| 11  | 熔断器              | 依赖故障时快速失败而非级联超时  |
| 12  | 数据库迁移可回滚    | `down` 迁移脚本存在且测试通过   |

## 2. Health Check 标准

```typescript
// /health — 存活探针（Liveness）
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// /ready — 就绪探针（Readiness）
app.get('/ready', async (_req, res) => {
  const checks = {
    db: await checkDbConnection(),
    redis: await checkRedisConnection(),
    externalApi: await checkExternalApi()
  };
  const allHealthy = Object.values(checks).every(Boolean);
  res.status(allHealthy ? 200 : 503).json({ status: allHealthy ? 'ready' : 'degraded', checks });
});
```

| 端点      | 用途 | 检查内容              | 失败行为     |
| --------- | ---- | --------------------- | ------------ |
| `/health` | 存活 | 进程在运行            | K8s 重启容器 |
| `/ready`  | 就绪 | DB/Redis/外部依赖可用 | K8s 摘除流量 |

**原则**：

- `/health` 只检查进程自身，不查外部依赖（避免误杀）
- `/ready` 检查所有必需依赖（DB、缓存、外部 API）
- 超时设置 5s，避免阻塞探针

## 3. 环境变量管理

### 必需环境变量

```bash
# 运行时
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# 依赖连接
DATABASE_URL=postgresql://...
REDIS_URL=redis://...

# 安全
JWT_SECRET=<from-vault>
API_KEY=<from-vault>

# 可选增强
CORRELATION_ID_HEADER=x-correlation-id
CIRCUIT_BREAKER_TIMEOUT=30000
RATE_LIMIT_PER_MINUTE=100
```

### 校验启动

```typescript
const requiredEnvVars = ['NODE_ENV', 'PORT', 'DATABASE_URL', 'JWT_SECRET'] as const;

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Missing required env var: ${envVar}`);
    process.exit(1);
  }
}
```

## 4. Docker 生产配置

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
RUN addgroup -g 1001 appgroup && adduser -u 1001 -G appgroup -s /bin/sh -D appuser
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
USER appuser
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://localhost:3000/health || exit 1
CMD ["node", "dist/server.js"]
```

**要点**：

- 多阶段构建，最终镜像不含 dev 依赖和源码
- 非 root 用户运行
- 内置 HEALTHCHECK 指令
- Alpine 最小化攻击面

## 5. 错误响应标准

```typescript
// 生产环境错误响应
function handleError(err: unknown, req: Request, res: Response) {
  const correlationId = req.correlationId;
  const isOperational = err instanceof AppError;

  // 内部日志：完整信息
  logger.error({
    event: 'unhandled_error',
    correlationId,
    error: serializeError(err),
    stack: err instanceof Error ? err.stack : undefined
  });

  // 外部响应：最小信息
  res.status(isOperational ? (err as AppError).statusCode : 500).json({
    error: isOperational ? (err as AppError).message : 'Internal Server Error',
    correlationId
  });
}
```

**原则**：

- 生产环境 500 响应不暴露堆栈、文件路径、SQL
- 所有错误响应含 `correlationId`，方便用户反馈后溯源
- 业务错误（4xx）可含具体消息；系统错误（5xx）统一消息

## 6. SDK 生产必备 5 项

| #   | 能力               | 实现方式                                                           | 检查方式             |
| --- | ------------------ | ------------------------------------------------------------------ | -------------------- |
| 1   | Durable State      | 数据库持久化关键状态，不靠内存                                     | 重启后状态恢复       |
| 2   | Cost Caps          | 每次 run 文件操作上限（见 `_shared-principles.md` Cost-Caps 协议） | 超限自动停止         |
| 3   | Circuit Breakers   | 外部调用熔断（见 robustness-patterns）                             | 依赖故障时快速失败   |
| 4   | Tool Permissioning | 工具调用白名单 + 审批                                              | 未授权工具调用被拒绝 |
| 5   | Evaluation Hooks   | 关键节点自动评估输出质量                                           | 输出偏离时告警       |

### Tool Permissioning 示例

```typescript
const ALLOWED_TOOLS = new Set(['read_file', 'write_file', 'run_test', 'git_diff']);
const BLOCKED_PATHS = ['.env', 'credentials', 'secrets'];

function checkToolPermission(tool: string, args: Record<string, unknown>): boolean {
  if (!ALLOWED_TOOLS.has(tool)) return false;
  if (BLOCKED_PATHS.some((p) => JSON.stringify(args).includes(p))) return false;
  return true;
}
```

### Evaluation Hooks 示例

```typescript
// 关键节点后自动评估
async function afterToolUse(tool: string, result: unknown): Promise<void> {
  if (tool === 'write_file') {
    const lintResult = await runLint(result as { path: string });
    if (lintResult.errors > 0) {
      logger.warn({ event: 'eval_hook_triggered', tool, issues: lintResult.errors });
    }
  }
}
```

## 7. 与 auto-cli 集成

- `/auto init-project` 时注入本 checklist 作为上线前验证
- VERIFY 阶段：O 角色按 Section 1 checklist 逐项验证
- LEARN 阶段：上线后问题对照 checklist 找遗漏项
- security-reviewer 检查「错误不泄露内部信息」
- logging-patterns 检查「结构化日志 + correlationId」

## 验收标准

- [ ] `/health` 和 `/ready` 端点正常响应
- [ ] SIGTERM 优雅关闭（进行中请求完成 + 资源释放）
- [ ] 零硬编码配置（全走环境变量 + 启动校验）
- [ ] Docker 镜像非 root 运行 + 多阶段构建
- [ ] 500 响应不暴露堆栈/路径/SQL
- [ ] 公开 API 有限流配置
- [ ] SDK 5 项必备至少 3 项已实现
