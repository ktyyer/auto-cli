# 生产环境实现详情

> Docker 配置、错误响应标准、SDK 5 项必备的完整实现代码。主 skill 保留 checklist + 原则，此处为详细实现。

## Docker 生产配置

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

**要点**：多阶段构建 / 非 root 用户 / 内置 HEALTHCHECK / Alpine 最小化攻击面

## 错误响应标准

```typescript
function handleError(err: unknown, req: Request, res: Response) {
  const correlationId = req.correlationId;
  const isOperational = err instanceof AppError;

  logger.error({
    event: 'unhandled_error',
    correlationId,
    error: serializeError(err),
    stack: err instanceof Error ? err.stack : undefined
  });

  res.status(isOperational ? (err as AppError).statusCode : 500).json({
    error: isOperational ? (err as AppError).message : 'Internal Server Error',
    correlationId
  });
}
```

**原则**：生产 500 不暴露堆栈/路径/SQL / 所有错误含 correlationId / 4xx 可含具体消息，5xx 统一

## SDK 生产必备 5 项

| #   | 能力               | 实现方式              | 检查方式           |
| --- | ------------------ | --------------------- | ------------------ |
| 1   | Durable State      | 数据库持久化关键状态  | 重启后状态恢复     |
| 2   | Cost Caps          | 每次 run 文件操作上限 | 超限自动停止       |
| 3   | Circuit Breakers   | 外部调用熔断          | 依赖故障时快速失败 |
| 4   | Tool Permissioning | 工具调用白名单 + 审批 | 未授权工具被拒绝   |
| 5   | Evaluation Hooks   | 关键节点自动评估      | 输出偏离时告警     |

### Tool Permissioning

```typescript
const ALLOWED_TOOLS = new Set(['read_file', 'write_file', 'run_test', 'git_diff']);
const BLOCKED_PATHS = ['.env', 'credentials', 'secrets'];

function checkToolPermission(tool: string, args: Record<string, unknown>): boolean {
  if (!ALLOWED_TOOLS.has(tool)) return false;
  if (BLOCKED_PATHS.some((p) => JSON.stringify(args).includes(p))) return false;
  return true;
}
```

### Evaluation Hooks

```typescript
async function afterToolUse(tool: string, result: unknown): Promise<void> {
  if (tool === 'write_file') {
    const lintResult = await runLint(result as { path: string });
    if (lintResult.errors > 0) {
      logger.warn({ event: 'eval_hook_triggered', tool, issues: lintResult.errors });
    }
  }
}
```
