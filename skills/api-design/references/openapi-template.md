# OpenAPI 3.0 完整模板

> API 文档标准模板。主 skill 保留设计原则，此处为完整可复用模板。

## 基础模板

```yaml
openapi: 3.0.3
info:
  title: { API Name }
  version: 1.0.0
  description: { Description }
  contact:
    name: API Support
    email: api@example.com

servers:
  - url: https://api.example.com/v1
    description: Production
  - url: https://staging-api.example.com/v1
    description: Staging

paths:
  /users:
    get:
      summary: List users
      operationId: listUsers
      tags: [Users]
      parameters:
        - name: page
          in: query
          schema: { type: integer, default: 1 }
        - name: size
          in: query
          schema: { type: integer, default: 20, maximum: 100 }
        - name: sort
          in: query
          schema: { type: string, example: 'createdAt:desc' }
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/UserListResponse'
        '401':
          $ref: '#/components/responses/Unauthorized'

    post:
      summary: Create user
      operationId: createUser
      tags: [Users]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateUserRequest'
      responses:
        '201':
          description: Created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/UserResponse'
        '400':
          $ref: '#/components/responses/BadRequest'

  /users/{id}:
    get:
      summary: Get user by ID
      operationId: getUserById
      tags: [Users]
      parameters:
        - name: id
          in: path
          required: true
          schema: { type: string, format: uuid }
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/UserResponse'
        '404':
          $ref: '#/components/responses/NotFound'

components:
  schemas:
    UserResponse:
      type: object
      properties:
        code: { type: integer, example: 200 }
        data: { $ref: '#/components/schemas/User' }

    UserListResponse:
      type: object
      properties:
        code: { type: integer, example: 200 }
        data:
          type: object
          properties:
            items: { type: array, items: { $ref: '#/components/schemas/User' } }
            page: { type: integer }
            size: { type: integer }
            total: { type: integer }
            totalPages: { type: integer }

    User:
      type: object
      properties:
        id: { type: string, format: uuid }
        name: { type: string }
        email: { type: string, format: email }
        createdAt: { type: string, format: date-time }

    CreateUserRequest:
      type: object
      required: [name, email]
      properties:
        name: { type: string, minLength: 1, maxLength: 100 }
        email: { type: string, format: email }

    ErrorResponse:
      type: object
      properties:
        code: { type: integer }
        errorCode: { type: string }
        message: { type: string }
        details: { type: array, items: { type: object } }

  responses:
    BadRequest:
      description: Bad Request
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
    Unauthorized:
      description: Unauthorized
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
    NotFound:
      description: Not Found
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'

  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

security:
  - bearerAuth: []
```

## 认证方案选择

| 方案          | 适用场景              | 复杂度 |
| ------------- | --------------------- | ------ |
| Bearer JWT    | SPA / Mobile App      | 低     |
| OAuth2 + PKCE | 第三方集成 / 公开 API | 中     |
| API Key       | 服务间调用 / Webhook  | 低     |
| mTLS          | 高安全场景            | 高     |
