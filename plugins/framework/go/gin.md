---
name: go-gin
version: 1.0.0
description: Go / Gin 框架插件 - Gin HTTP框架开发规范，中间件/路由/错误处理/测试最佳实践
author: ai-max
triggers:
  - golang
  - go
  - gin
  - fiber
  - echo
  - gorm
stack: go
priority: 70
---

# Go / Gin 框架插件

> 适用于 Go + Gin / Fiber / Echo 项目的开发最佳实践

## 自动加载条件

检测到以下任一特征时自动激活：
- `go.mod` 存在
- 导入了 `github.com/gin-gonic/gin`、`github.com/gofiber/fiber`、`github.com/labstack/echo`

---

## 项目结构规范

```
myapp/
├── cmd/
│   └── server/
│       └── main.go          # 入口，只做初始化
├── internal/
│   ├── handler/             # HTTP 处理器（Controller 层）
│   ├── service/             # 业务逻辑层
│   ├── repository/          # 数据访问层
│   ├── model/               # 数据模型（ORM 实体）
│   └── middleware/          # 中间件
├── pkg/
│   ├── response/            # 统一响应格式
│   ├── errors/              # 自定义错误类型
│   └── validator/           # 输入校验
├── config/                  # 配置文件和加载
└── go.mod
```

---

## Gin 核心规范

### 路由注册

```go
// ✅ 正确：分层注册，使用路由组
func SetupRoutes(r *gin.Engine, h *handler.Handler) {
    api := r.Group("/api/v1")
    {
        users := api.Group("/users")
        users.Use(middleware.AuthRequired())
        {
            users.GET("", h.User.List)
            users.GET("/:id", h.User.GetByID)
            users.POST("", h.User.Create)
            users.PUT("/:id", h.User.Update)
            users.DELETE("/:id", h.User.Delete)
        }
        
        auth := api.Group("/auth")
        {
            auth.POST("/login", h.Auth.Login)
            auth.POST("/register", h.Auth.Register)
            auth.POST("/refresh", h.Auth.RefreshToken)
        }
    }
}
```

### Handler 设计

```go
// ✅ Handler 只做 HTTP 层处理，不含业务逻辑
type UserHandler struct {
    service service.UserService
}

func (h *UserHandler) GetByID(c *gin.Context) {
    id, err := strconv.ParseInt(c.Param("id"), 10, 64)
    if err != nil {
        response.BadRequest(c, "无效的用户ID")
        return
    }
    
    user, err := h.service.FindByID(c.Request.Context(), id)
    if err != nil {
        if errors.Is(err, ErrNotFound) {
            response.NotFound(c, "用户不存在")
            return
        }
        response.InternalError(c, "查询失败")
        return
    }
    
    response.Success(c, user)
}

// ✅ 统一响应包
package response

type Response[T any] struct {
    Code    int    `json:"code"`
    Message string `json:"message"`
    Data    T      `json:"data,omitempty"`
}

func Success[T any](c *gin.Context, data T) {
    c.JSON(http.StatusOK, Response[T]{Code: 0, Message: "ok", Data: data})
}

func BadRequest(c *gin.Context, msg string) {
    c.JSON(http.StatusBadRequest, Response[any]{Code: 400, Message: msg})
}
```

### 请求绑定和校验

```go
// ✅ 使用 binding tag 进行参数校验
type CreateUserRequest struct {
    Username string `json:"username" binding:"required,min=2,max=50"`
    Email    string `json:"email"    binding:"required,email"`
    Password string `json:"password" binding:"required,min=8"`
    Age      int    `json:"age"      binding:"required,min=0,max=150"`
}

func (h *UserHandler) Create(c *gin.Context) {
    var req CreateUserRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        response.BadRequest(c, formatValidationError(err))
        return
    }
    // ...
}
```

### 中间件规范

```go
// ✅ JWT 认证中间件
func AuthRequired() gin.HandlerFunc {
    return func(c *gin.Context) {
        token := c.GetHeader("Authorization")
        if token == "" {
            response.Unauthorized(c, "缺少认证令牌")
            c.Abort()
            return
        }
        
        claims, err := jwt.ParseToken(strings.TrimPrefix(token, "Bearer "))
        if err != nil {
            response.Unauthorized(c, "令牌无效或已过期")
            c.Abort()
            return
        }
        
        c.Set("user_id", claims.UserID)
        c.Set("username", claims.Username)
        c.Next()
    }
}

// ✅ 请求日志中间件
func Logger() gin.HandlerFunc {
    return gin.LoggerWithFormatter(func(param gin.LogFormatterParams) string {
        return fmt.Sprintf("[GIN] %v | %3d | %13v | %15s | %-7s %#v\n",
            param.TimeStamp.Format("2006/01/02 - 15:04:05"),
            param.StatusCode, param.Latency,
            param.ClientIP, param.Method, param.Path,
        )
    })
}
```

### GORM + 仓储模式

```go
// ✅ 仓储接口
type UserRepository interface {
    FindByID(ctx context.Context, id int64) (*model.User, error)
    FindAll(ctx context.Context, params QueryParams) ([]*model.User, int64, error)
    Create(ctx context.Context, user *model.User) error
    Update(ctx context.Context, user *model.User) error
    Delete(ctx context.Context, id int64) error
}

// ✅ GORM 实现（避免 N+1）
func (r *userRepository) FindAll(ctx context.Context, params QueryParams) ([]*model.User, int64, error) {
    var users []*model.User
    var total int64
    
    query := r.db.WithContext(ctx).Model(&model.User{})
    
    if params.Keyword != "" {
        query = query.Where("username LIKE ? OR email LIKE ?", "%"+params.Keyword+"%", "%"+params.Keyword+"%")
    }
    
    query.Count(&total)
    result := query.Preload("Profile").
        Offset((params.Page - 1) * params.PageSize).
        Limit(params.PageSize).
        Order("created_at DESC").
        Find(&users)
    
    return users, total, result.Error
}
```

---

## 错误处理规范

```go
// ✅ 自定义错误类型
var (
    ErrNotFound     = errors.New("resource not found")
    ErrUnauthorized = errors.New("unauthorized")
    ErrForbidden    = errors.New("forbidden")
    ErrConflict     = errors.New("resource already exists")
)

// ✅ 全局 panic 恢复
func Recovery() gin.HandlerFunc {
    return func(c *gin.Context) {
        defer func() {
            if err := recover(); err != nil {
                log.Printf("Panic: %v\n%s", err, debug.Stack())
                response.InternalError(c, "服务器内部错误")
                c.Abort()
            }
        }()
        c.Next()
    }
}
```

---

## 测试规范

```go
// ✅ Handler 单元测试
func TestGetUserByID(t *testing.T) {
    gin.SetMode(gin.TestMode)
    
    mockService := &MockUserService{}
    h := &UserHandler{service: mockService}
    
    mockService.On("FindByID", mock.Anything, int64(1)).Return(&model.User{ID: 1, Username: "test"}, nil)
    
    w := httptest.NewRecorder()
    c, _ := gin.CreateTestContext(w)
    c.Params = gin.Params{{Key: "id", Value: "1"}}
    
    h.GetByID(c)
    
    assert.Equal(t, http.StatusOK, w.Code)
    var resp response.Response[model.User]
    json.Unmarshal(w.Body.Bytes(), &resp)
    assert.Equal(t, "test", resp.Data.Username)
}
```

---

## 代码质量门禁

```bash
# 格式化
gofmt -w .
goimports -w .

# Lint
golangci-lint run

# 测试 + 覆盖率
go test ./... -cover -coverprofile=coverage.out
go tool cover -func=coverage.out | tail -n 1  # 确认总覆盖率 > 80%

# 安全扫描
gosec ./...
```

---

## 开源借鉴

- **everything-claude-code Go/Gin skills** — Gin/Fiber/Echo 最佳实践
- **Go 官方项目布局** — `cmd/` + `internal/` + `pkg/` 结构
- **GORM 官方文档** — 查询优化、预加载规范
