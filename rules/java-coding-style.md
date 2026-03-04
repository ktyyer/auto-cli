# Java / Spring Boot 编码规范

## 强制规则

### 1. 响应格式（Spring Boot 项目）

所有 RESTful API 必须使用统一响应包装：

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

### 2. 分层架构（严格遵守）

```
Controller  →  Service Interface  →  ServiceImpl  →  Mapper  →  Database
   ↑不可跨层调用↑
```

- Controller 只调用 Service，不直接使用 Mapper
- Service 只调用 Mapper，不调用其他 Service 的 Mapper
- 公共逻辑放 Service 层，不放 Controller
- 复杂查询逻辑放 Mapper XML，不写在 Service 中

### 3. 事务管理

```java
// ✅ 正确: Service 层加 @Transactional
@Service
@Transactional(rollbackFor = Exception.class)
public class OrderServiceImpl implements OrderService {
    
    @Override
    public void createOrder(CreateOrderRequest req) {
        // 多个数据库操作在同一事务中
        orderMapper.insert(order);
        orderItemMapper.batchInsert(items);
        inventoryService.deduct(items);
    }
}

// ❌ 错误: Controller 层管理事务
@PostMapping("/orders")
@Transactional  // 不要在 Controller 加事务注解
public Result<Void> createOrder(@RequestBody CreateOrderRequest req) { ... }
```

### 4. 异常处理

```java
// ✅ 全局异常处理器
@RestControllerAdvice
public class GlobalExceptionHandler {
    
    @ExceptionHandler(ServiceException.class)
    public Result<Void> handleServiceException(ServiceException e) {
        return Result.fail(e.getCode(), e.getMessage());
    }
    
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public Result<Void> handleValidationException(MethodArgumentNotValidException e) {
        String message = e.getBindingResult().getFieldErrors()
            .stream().map(FieldError::getDefaultMessage)
            .collect(Collectors.joining(", "));
        return Result.fail(400, message);
    }
}

// ✅ 业务异常使用自定义异常
if (user == null) {
    throw new ServiceException("用户不存在");  // 不要返回 null
}

// ❌ 不要捕获后忽略异常
try {
    userService.delete(id);
} catch (Exception e) {
    // 空 catch 块!
}
```

### 5. 参数校验

```java
// ✅ 使用 Bean Validation 注解
@PostMapping("/users")
public Result<UserDTO> createUser(@RequestBody @Valid CreateUserRequest req) { ... }

// DTO 上的校验注解
public class CreateUserRequest {
    @NotBlank(message = "用户名不能为空")
    @Length(min = 2, max = 50, message = "用户名长度2-50")
    private String username;
    
    @NotBlank(message = "邮箱不能为空")
    @Email(message = "邮箱格式不正确")
    private String email;
    
    @NotNull(message = "年龄不能为空")
    @Min(value = 0, message = "年龄不能小于0")
    @Max(value = 150, message = "年龄不能大于150")
    private Integer age;
}
```

### 6. MyBatis Plus 规范

```java
// ✅ 使用 LambdaQueryWrapper 避免字段名硬编码
List<User> users = userMapper.selectList(
    new LambdaQueryWrapper<User>()
        .eq(User::getStatus, 1)
        .like(User::getUsername, keyword)
        .orderByDesc(User::getCreateTime)
);

// ❌ 不要使用字符串字段名（易出错、重构不安全）
QueryWrapper<User> wrapper = new QueryWrapper<>();
wrapper.eq("status", 1).like("username", keyword);

// ✅ 分页查询
Page<User> page = new Page<>(pageNum, pageSize);
IPage<User> result = userMapper.selectPage(page, wrapper);
PageInfo<UserDTO> pageInfo = PageInfo.of(result, UserDTO::from);
```

### 7. DTO 与实体分离

```java
// ✅ 永远不要直接返回实体对象（暴露数据库结构）
// Entity（对应数据库表）
@Data
@TableName("sys_user")
public class SysUser {
    private Long id;
    private String username;
    private String password;  // 敏感字段！
    private Integer status;
    private LocalDateTime createTime;
}

// DTO（返回给前端）
@Data
public class UserDTO {
    private Long id;
    private String username;
    // 注意: 没有 password, 没有内部字段
    private String statusName;
    
    public static UserDTO from(SysUser user) {
        UserDTO dto = new UserDTO();
        BeanUtils.copyProperties(user, dto);
        dto.setStatusName(user.getStatus() == 1 ? "正常" : "禁用");
        return dto;
    }
}
```

---

## 命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| 类名 | UpperCamelCase | `UserController`, `OrderServiceImpl` |
| 方法名 | lowerCamelCase | `findByUsername`, `createOrder` |
| 常量 | UPPER_SNAKE_CASE | `MAX_RETRY_COUNT`, `DEFAULT_PAGE_SIZE` |
| 数据库表 | lower_snake_case | `sys_user`, `eco_order` |
| 包名 | 全小写 | `com.eco.system.controller` |
| Controller | `XxxController` | `SysUserController` |
| Service | `XxxService` (接口) | `SysUserService` |
| Impl | `XxxServiceImpl` | `SysUserServiceImpl` |
| Mapper | `XxxMapper` | `SysUserMapper` |
| DTO | `XxxDTO` / `XxxRequest` / `XxxResponse` | `UserDTO`, `CreateUserRequest` |

---

## SQL 安全规范（防注入）

```java
// ✅ MyBatis 参数化查询（#{}）
<select id="findByUsername" resultType="SysUser">
    SELECT * FROM sys_user WHERE username = #{username}
</select>

// ❌ SQL 拼接（注入风险！）
<select id="findByUsername" resultType="SysUser">
    SELECT * FROM sys_user WHERE username = '${username}'
</select>

// ✅ 动态排序字段需要白名单校验
private static final Set<String> ALLOWED_SORT_COLUMNS = Set.of("create_time", "update_time", "username");

public List<User> findAll(String sortColumn, String sortOrder) {
    if (!ALLOWED_SORT_COLUMNS.contains(sortColumn)) {
        throw new ServiceException("不支持的排序字段: " + sortColumn);
    }
    // 此时才安全使用 ${}
}
```

---

## 日志规范

```java
// ✅ 使用 Slf4j 注解
@Slf4j
@Service
public class OrderServiceImpl implements OrderService {
    
    public void createOrder(CreateOrderRequest req) {
        log.info("创建订单: userId={}, productId={}", req.getUserId(), req.getProductId());
        try {
            // 业务逻辑
            log.debug("订单创建成功: orderId={}", order.getId());
        } catch (Exception e) {
            log.error("订单创建失败: userId={}, error={}", req.getUserId(), e.getMessage(), e);
            throw new ServiceException("订单创建失败");
        }
    }
}

// ❌ 不要使用 System.out.println
System.out.println("创建订单: " + req.getUserId());
```

---

## Swagger 注解规范

```java
@Tag(name = "用户管理", description = "用户的增删改查接口")
@RestController
@RequestMapping("/system/user")
public class SysUserController {

    @Operation(summary = "分页查询用户", description = "支持按用户名、状态过滤")
    @GetMapping("/list")
    public Result<PageInfo<UserDTO>> pageList(UserQueryRequest req) { ... }

    @Operation(summary = "根据ID查询用户")
    @GetMapping("/{id}")
    public Result<UserDTO> getById(@PathVariable @Parameter(description = "用户ID") Long id) { ... }
}
```

---

## 代码质量检查清单

提交前确认：
- [ ] 无 `System.out.println`（使用 Slf4j）
- [ ] 无硬编码密码/密钥
- [ ] 所有 SQL 使用 `#{}` 参数化（无 `${}`）
- [ ] Controller 不直接返回 Entity
- [ ] Service 方法加了 `@Transactional`（多步操作）
- [ ] 参数校验注解完整（`@Valid` + `@NotNull` 等）
- [ ] 异常被正确处理（不空 catch）
- [ ] API 有 Swagger 注解
