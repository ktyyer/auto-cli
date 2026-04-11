---
name: java-patterns:common-errors
description: 由 java-patterns.md 主文件按需加载。完整上下文见主文件。
---

# Java 常见编译错误速查参考

> 由 `java-patterns.md` 主文件按需加载。完整上下文见主文件。

---

## 错误速查表

| 错误                          | 根因                      | 速修                                           |
| ----------------------------- | ------------------------- | ---------------------------------------------- |
| `Cannot resolve symbol`       | 依赖未同步                | `mvn clean install` 或 IDEA 重新导入           |
| `NullPointerException`        | 未注入 Bean               | 检查 `@Autowired` + `@Service`                 |
| `BeanCreationException`       | 循环依赖                  | `@Lazy` 延迟加载或重构                         |
| `HttpMessageNotReadable`      | JSON 字段类型错误         | 检查 DTO 字段 + `@JsonFormat`                  |
| `DataIntegrityViolation`      | 唯一键冲突                | 检查数据唯一性                                 |
| `MyBatisSystemException`      | XML 与接口不匹配          | 检查 namespace、方法签名                       |
| `InvalidDefinitionException`  | Jackson 序列化失败        | 添加 `@JsonIgnore` 或无参构造器                |
| `TransactionSystemException`  | `@Transactional` 回滚异常 | 检查 `rollbackFor = Exception.class`           |
| `OutOfMemoryError: Metaspace` | 类加载器泄漏或元空间不足  | `-XX:MaxMetaspaceSize=512m`                    |
| `StackOverflowError`          | 递归调用或双向引用序列化  | `@JsonManagedReference` + `@JsonBackReference` |

---

## 分层架构约束

| 层级       | 职责                     | 禁止事项                        |
| ---------- | ------------------------ | ------------------------------- |
| Controller | 接收请求、参数校验、返回 | 禁止直接操作数据库              |
| Service    | 业务逻辑、事务管理       | 禁止直接使用 Mapper（跨层调用） |
| Mapper     | 数据库操作               | 禁止写复杂业务逻辑              |

## 事务管理规则

```java
// ✅ 正确: Service 层加 @Transactional
@Service
@Transactional(rollbackFor = Exception.class)
public class OrderServiceImpl implements OrderService {

    @Override
    public void createOrder(CreateOrderRequest req) {
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

## MyBatis Plus 规范

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
```
