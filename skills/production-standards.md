---
name: production-standards
description: 新项目生产就绪标准 — health check、graceful shutdown、环境变量、结构化日志、速率限制、安全头、Docker 多阶段构建。当用户提到上线、部署、生产环境、production readiness、新项目初始化时，或 VERIFY 阶段的 operational-readiness gate 时，必须加载此 skill。
tags: [production, deployment, health-check, readiness, operational, checklist]
---

# Production Standards — 生产就绪标准

> 运维角色（O）在 VERIFY 阶段的 `operational-readiness` gate 自动加载。

## 快速使用

```
/auto 新项目上线前检查生产就绪
/auto 加 health check 和 readiness probe
/auto 帮我写 Dockerfile + 生产配置
```

---

## 激活摘要 (Activation Digest)

**检查清单** (checklist):

- [ ] 健康检查端点: `GET /health` 返回 200
- [ ] 就绪探针: `GET /ready` 检测所有依赖可用性
- [ ] 优雅关闭: SIGTERM 后等待进行中请求完成
- [ ] 环境变量: 所有配置通过 env 注入，无硬编码
- [ ] 结构化日志: JSON 格式，含 correlationId
- [ ] 错误不泄露: 500 响应不含堆栈/内部路径
- [ ] 速率限制: 公开 API 有 per-user/IP 限流
- [ ] HTTPS + 安全头: HSTS/CSP/X-Frame-Options

**硬约束** (constraints):

- 缺少健康检查不得上线
- 配置不得硬编码（必须走环境变量）
- 生产日志必须 JSON 格式 + correlationId

**输出模板** (output):

- 检查项 → 验证命令 → 结果(pass/fail) → 修复建议

**反模式** (anti-patterns):

- 健康检查返回 200 但不查 DB 连接 → 假健康
- SIGTERM 直接杀进程 → 请求被截断

---

## 使用时机

**必须加载**：新项目初始化 | VERIFY 阶段 operational-readiness gate | 用户提到上线/部署/生产/production
**按需加载**：已有项目局部修改 → 只需相关 section | 纯前端 → Section 1-3

---

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

### 推荐项

| #   | 检查项              | 验证方式                        |
| --- | ------------------- | ------------------------------- |
| 9   | Prometheus 指标埋点 | `/metrics` 端点可访问           |
| 10  | 分布式追踪          | OpenTelemetry 接入，Span 可关联 |
| 11  | 熔断器              | 依赖故障时快速失败              |
| 12  | 数据库迁移可回滚    | `down` 迁移脚本存在且测试通过   |

---

## 2. Health Check 标准

```typescript
// /health — 存活探针
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// /ready — 就绪探针
app.get('/ready', async (_req, res) => {
  const checks = {
    db: await checkDbConnection(),
    redis: await checkRedisConnection()
  };
  const allHealthy = Object.values(checks).every(Boolean);
  res.status(allHealthy ? 200 : 503).json({ status: allHealthy ? 'ready' : 'degraded', checks });
});
```

| 端点      | 用途 | 检查内容              | 失败行为     |
| --------- | ---- | --------------------- | ------------ |
| `/health` | 存活 | 进程在运行            | K8s 重启容器 |
| `/ready`  | 就绪 | DB/Redis/外部依赖可用 | K8s 摘除流量 |

**原则**：`/health` 只检查进程自身（避免误杀）；`/ready` 检查所有必需依赖；超时 5s

---

## 3. 环境变量管理

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
```

启动校验：

```typescript
const requiredEnvVars = ['NODE_ENV', 'PORT', 'DATABASE_URL', 'JWT_SECRET'] as const;
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Missing required env var: ${envVar}`);
    process.exit(1);
  }
}
```

---

## 按需加载

> 完整 Docker 配置、错误响应标准代码、SDK 5 项必备实现细节
> → `production-standards.references/implementation-details.md`

---

## 与 auto-cli 集成

- `/auto init-project` 时注入本 checklist 作为上线前验证
- VERIFY 阶段：O 角色按 Section 1 checklist 逐项验证
- LEARN 阶段：上线后问题对照 checklist 找遗漏项
- security-reviewer 检查「错误不泄露内部信息」
- logging-patterns 检查「结构化日志 + correlationId」

---

## 验收标准

- [ ] `/health` 和 `/ready` 端点正常响应
- [ ] SIGTERM 优雅关闭（进行中请求完成 + 资源释放）
- [ ] 零硬编码配置（全走环境变量 + 启动校验）
- [ ] Docker 镜像非 root 运行 + 多阶段构建
- [ ] 500 响应不暴露堆栈/路径/SQL
- [ ] 公开 API 有限流配置
