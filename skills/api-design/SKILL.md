---
name: api-design
description: API 设计规范 — RESTful 资源命名、分页/排序/筛选标准、版本管理、错误码体系、限流策略、OpenAPI 文档规范。当用户提到 API 设计、REST API、接口规范、写接口、文档规范、OpenAPI/Swagger、分页设计时，或 PHASE 2 设计涉及对外契约（API/事件）时，必须加载此 skill。
tags: [api, rest, design, pagination, versioning, error-codes, openapi, swagger]
---

# API Design — API 设计规范

> 借鉴 Google API Design Guide + Microsoft REST API Guidelines。核心原则：**API 是给调用方用的，不是给数据表用的。**

## 快速使用

```
/auto 设计一个用户管理 REST API
/auto 给现有 API 添加分页和排序
/auto 写 OpenAPI 3.0 文档
```

---

## 激活摘要 (Activation Digest)

**检查清单** (checklist):

- [ ] 资源命名: 名词复数 + kebab-case (`/api/users/{id}/orders`)
- [ ] 分页: `?page=1&size=20`，返回 `{ items[], page, size, total, totalPages }`
- [ ] 错误码: 4xx 客户端错误 + 5xx 服务端错误，带 errorCode 和 message
- [ ] 版本管理: URL 前缀 `/api/v1/` 或 Header `Accept-Version`
- [ ] 认证: Bearer Token (Authorization Header)
- [ ] 文档: 每个公开 API 有 OpenAPI 描述

**硬约束** (constraints):

- URL 禁止动词（`/getUser` → `GET /users/{id}`）
- 响应格式必须统一（`{ code, data, message }` 或 `{ success, data, error }`）
- POST/PUT/PATCH 必须校验请求体
- 列表接口必须有分页（防止 OOM）

**输出模板** (output):

- `{ code: 200, data: {...}, message: "success" }`

**反模式** (anti-patterns):

- URL 里加动词 (`/createOrder`) → 应 `POST /orders`
- 数据库表结构直接暴露到 API → 应 DTO 包装
- 所有错误返回 200 + body 里写 error → 应用 HTTP 状态码

---

## 使用时机

**必须加载**：PHASE 2 涉及对外契约 | 用户提到 API 设计/REST/接口规范/OpenAPI
**按需加载**：纯前端、修 bug、改配置 → 不触发

---

## 1. URL 设计

### 资源命名

```
GET    /api/v1/users              # 列表
POST   /api/v1/users              # 创建
GET    /api/v1/users/{id}         # 详情
PUT    /api/v1/users/{id}         # 全量更新
PATCH  /api/v1/users/{id}         # 部分更新
DELETE /api/v1/users/{id}         # 删除

# 子资源
GET    /api/v1/users/{id}/orders  # 某用户的订单
POST   /api/v1/orders/{id}/refund # 订单退款（动词作 action）
```

### 命名规则

- 全部小写 + 中划线 (kebab-case)
- 资源名用名词复数 (`/users` 非 `/user`)
- 避免深层嵌套 (>3 层)
- 特殊操作用动词 (`/orders/{id}/cancel`)

---

## 2. 分页、排序、筛选

### 请求

```
GET /api/v1/users?page=1&size=20&sort=createdAt:desc&status=active
```

| 参数   | 示例             | 说明                          |
| ------ | ---------------- | ----------------------------- |
| `page` | `1`              | 页码（从 1 开始）             |
| `size` | `20`             | 每页条数（默认 20, 最大 100） |
| `sort` | `createdAt:desc` | 字段:方向，多字段用逗号分隔   |
| 筛选   | `status=active`  | 命名与资源字段一致            |

### 响应

```json
{
  "code": 200,
  "data": {
    "items": [...],
    "page": 1,
    "size": 20,
    "total": 156,
    "totalPages": 8
  }
}
```

---

## 3. 错误码体系

| HTTP 状态码 | 场景         | 示例 errorCode                         |
| ----------- | ------------ | -------------------------------------- |
| 400         | 请求参数错误 | `INVALID_PARAM`, `MISSING_REQUIRED`    |
| 401         | 未认证       | `UNAUTHORIZED`, `TOKEN_EXPIRED`        |
| 403         | 无权限       | `FORBIDDEN`, `INSUFFICIENT_PERMISSION` |
| 404         | 资源不存在   | `USER_NOT_FOUND`, `ORDER_NOT_FOUND`    |
| 409         | 资源冲突     | `DUPLICATE_EMAIL`, `VERSION_CONFLICT`  |
| 422         | 业务逻辑错误 | `INSUFFICIENT_BALANCE`, `ORDER_LOCKED` |
| 429         | 触发限流     | `RATE_LIMITED`                         |
| 500         | 服务内部错误 | `INTERNAL_ERROR`                       |

### 错误响应格式

```json
{
  "code": 422,
  "errorCode": "INSUFFICIENT_BALANCE",
  "message": "账户余额不足，当前余额 100.00，需要 250.00",
  "details": [{ "field": "amount", "reason": "must be ≤ balance" }]
}
```

---

## 4. 版本管理

| 策略     | 示例                 | 适用场景             |
| -------- | -------------------- | -------------------- |
| URL 前缀 | `/api/v1/users`      | 简单直观，推荐新项目 |
| Header   | `Accept-Version: v1` | URL 干净，复杂场景   |
| Query    | `?version=1`         | 不推荐（污染参数）   |

---

## 5. 统一响应格式

```json
// 成功
{ "code": 200, "data": { ... }, "message": "success" }

// 列表
{ "code": 200, "data": { "items": [...], "page": 1, "size": 20, "total": 156, "totalPages": 8 } }

// 失败
{ "code": 422, "errorCode": "INSUFFICIENT_BALANCE", "message": "...", "details": [...] }
```

Java 项目使用 `Result<T>` 包装（参考 `java-patterns`），前端项目使用 `ApiResponse<T>` 接口（参考 `performance-patterns` 中的 pattern）。

---

## 6. 安全要求

- 所有 API 通过 HTTPS
- 认证使用 Bearer Token (JWT / OAuth2)
- 输入校验 > 参数化查询防注入 > CORS 白名单
- 敏感操作（支付、删除）需二次确认

---

## 按需加载

> OpenAPI 3.0 完整模板、认证方案详解 → `api-design.references/openapi-template.md`

---

## 与 auto-cli 集成

| 注入时机        | 说明                                    |
| --------------- | --------------------------------------- |
| PHASE 2 PLAN    | test-plan-writer 检测对外契约时必须加载 |
| PHASE 3 EXECUTE | 涉及 API 变更的 Quest 执行前参考        |
| PHASE 4 VERIFY  | security gate 检查安全要求              |

---

## 验收标准

- [ ] URL 无动词（GET/POST/PUT/DELETE 表达动作）
- [ ] 列表接口有分页
- [ ] 错误码遵循 HTTP 标准
- [ ] 响应格式统一
- [ ] 有版本策略
