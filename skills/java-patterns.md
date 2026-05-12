---
name: java-patterns
description: Spring Boot + MyBatis Plus 编码模式库 — 分层架构模板（Controller/Service/Mapper）、DTO + Entity 转换规范、全局异常处理、事务管理规范。适用于 Java/Spring Boot 项目的 PHASE 2 Quest 设计阶段。当用户提到 Java 项目开发、Spring Boot、MyBatis Plus、分层架构、REST API 设计时，必须加载此 skill。
tags: [java, spring-boot, mybatis-plus, patterns, rest, pagination, transaction, dto, mapper]
---

# Java Patterns — Spring Boot 编码模式库

> quest-designer 在 PHASE 2 设计 Java 项目 Quest 时直接引用。
> build-error-resolver 参考"常见编译错误"速查表。

## 快速使用

```
/auto 用 Spring Boot 实现用户分页查询接口
/auto 为 Order 实体创建完整的 CRUD 分层代码
/auto 修复 MyBatis Plus 分页查询返回空结果
```

---

## 激活摘要 (Activation Digest)

**检查清单** (checklist):

- [ ] Controller: 参数校验 + 调用 Service + 返回 `Result<T>` 包装
- [ ] Service: 接口+实现分离, 业务逻辑不跨层调 Mapper
- [ ] Mapper: 只做数据库操作, MyBatis Plus 复杂查询用 XML
- [ ] DTO: 与 Entity 分离, 使用 MapStruct 转换
- [ ] 统一异常: `@RestControllerAdvice` + `ServiceException`
- [ ] 事务: `@Transactional` 用于写操作, 读操作不加

**硬约束** (constraints):

- Controller 禁止直接操作数据库（跨层调用）
- ServiceImpl 禁止写 SQL（应通过 Mapper）
- 禁止返回裸 Entity（必须 DTO 包装）
- 所有 API 返回 `Result<T>` 统一格式

**输出模板** (output):

- 参考 `java-patterns.references/controller-service.md` 完整模板

**反模式** (anti-patterns):

- 在 Controller 写业务逻辑 → 分层混乱
- Entity 直接返回给前端 → 暴露数据库结构
- 不用 MapStruct 手写转换 → 样板代码多

---

## 核心分层原则

```
Controller → Service 接口 → ServiceImpl → Mapper → Database
↑不可跨层调用↑
```

| 层级       | 职责                     | 禁止事项                        |
| ---------- | ------------------------ | ------------------------------- |
| Controller | 接收请求、参数校验、返回 | 禁止直接操作数据库              |
| Service    | 业务逻辑、事务管理       | 禁止直接使用 Mapper（跨层调用） |
| Mapper     | 数据库操作               | 禁止写复杂业务逻辑              |

## 响应格式规范

```java
// ✅ 正确: 使用 Result<T> 包装
@GetMapping("/users/{id}")
public Result<UserDTO> getUser(@PathVariable Long id) {
    return Result.success(userService.findById(id));
}

// ❌ 错误: 直接返回对象
@GetMapping("/users/{id}")
public UserDTO getUser(@PathVariable Long id) {
    return userService.findById(id);
}
```

## 全局异常处理模板

```java
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ServiceException.class)
    public Result<Void> handleServiceException(ServiceException e) {
        log.warn("业务异常: {}", e.getMessage());
        return Result.fail(e.getCode(), e.getMessage());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public Result<Void> handleValidationException(MethodArgumentNotValidException e) {
        String message = e.getBindingResult().getFieldErrors().stream()
                .map(FieldError::getDefaultMessage)
                .collect(Collectors.joining(", "));
        return Result.fail(400, message);
    }

    @ExceptionHandler(Exception.class)
    public Result<Void> handleException(Exception e) {
        log.error("系统异常: ", e);
        return Result.fail(500, "系统内部错误");
    }
}
```

---

## 按需加载：详细代码模板

### Controller + Service 完整模板

接口定义、Service 实现、事务管理：
→ 读取 `java-patterns.references/controller-service.md`

### DTO + Entity + Mapper 模板

Entity 定义、DTO 转换、QueryRequest、Mapper XML：
→ 读取 `java-patterns.references/dto-entity-mapper.md`

### 常见编译错误速查

错误关键词 → 根因 → 速修方案，以及分层架构约束：
→ 读取 `java-patterns.references/common-errors.md`

---

## 与 auto-cli 集成

| 集成点               | 内容                                     |
| -------------------- | ---------------------------------------- |
| quest-designer       | Java 项目 Quest 直接使用模板生成完整代码 |
| build-error-resolver | 参考"常见编译错误"速修表                 |
| tdd-guide            | Service 层测试使用 Mock Mapper 模式      |
| code-reviewer        | 检查分层架构约束和命名规范               |

## 使用时机

**必须加载**（PHASE 2 PLAN）：

- 用户提到 Java/Spring Boot 项目开发
- quest-designer 为 Java 项目生成代码模板
- build-error-resolver 处理 Java 编译错误

**按需加载**（具体模板）：

- REST API 设计 → 加载 Controller 模板
- 数据库操作 → 加载 DTO + Entity + Mapper 模板
- 错误修复 → 加载常见编译错误速查

## 验收标准

- [ ] Java 项目 Quest 的代码模板符合分层架构（Controller → Service → Mapper）
- [ ] 所有 REST API 使用 `Result<T>` 统一包装
- [ ] Service 层方法使用 `@Transactional(rollbackFor = Exception.class)`
- [ ] Mapper 查询使用 `LambdaQueryWrapper`，无字符串字段名硬编码
- [ ] DTO 不暴露 Entity 的敏感字段（如 password）
