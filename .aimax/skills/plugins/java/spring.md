---
name: spring-helper
version: 1.1.0
description: Spring Boot 开发助手 - 严格遵循项目现有代码风格
author: aimax
triggers:
  - "Spring"
  - "spring"
  - "SpringBoot"
  - "Controller"
  - "Service"
  - "Repository"
  - "Mapper"
  - "Entity"
  - "@RestController"
  - "@Service"
  - "@Repository"
priority: 50
language: java
framework: spring
---

# Spring Boot 开发助手（项目风格优先）

> 第一原则：**沿用项目已有风格**，不要凭空套用“想象中的规范”。

## 规则优先级

1. **项目现有代码**（最高优先级）
2. **项目内文档和约定**（README、CONTRIBUTING、架构文档）
3. **构建与格式化配置**（Checkstyle、Spotless、EditorConfig）
4. **本插件默认建议**（仅兜底）

## 执行流程

### Step 1: 先探测，再编码

在生成任何代码前，先从当前项目提取风格：

- 构建工具：`pom.xml` / `build.gradle`
- 数据访问：JPA / MyBatis / MyBatis-Plus / 其他
- 分层结构：按领域分包 or 按技术分层
- 命名方式：`XxxController`、`XxxService`、`XxxMapper`、`XxxDO/Entity`
- API 返回：`ResponseEntity` / `Result<T>` / `R<T>` / 直接返回对象
- 异常处理：`@ControllerAdvice`、业务异常类型、错误码风格
- Lombok 使用：`@Data` / `@Getter`+`@Setter` / 不使用 Lombok
- 测试风格：JUnit5、MockMvc、Testcontainers、命名习惯

### Step 2: 基于样本对齐

至少参考同层 2-3 个已有文件（Controller、Service、Repository/Mapper、DTO）。

输出新代码时必须对齐：

- 包路径与目录结构
- 注解风格和顺序
- 方法命名和参数顺序
- 日志与异常处理模式
- 返回值封装方式

### Step 3: 最小增量改动

- 只实现当前需求，不顺手“全面重构风格”
- 不把项目从一种技术栈强行改成另一种
- 不引入项目未使用的库和约定

## 强制约束（不可违反）

1. 项目使用 MyBatis/MyBatis-Plus 时，禁止擅自改写为 JPA。
2. 项目使用 JPA 时，禁止擅自改写为 Mapper 风格。
3. 项目未使用统一 `Result<T>` 时，禁止强制新增统一响应包装。
4. 项目未使用 Lombok 时，禁止默认引入 Lombok。
5. 项目已有异常体系时，禁止新建并行冲突的异常体系。

## 输出格式要求

在实现说明中明确：

- 参考了哪些现有文件来对齐风格
- 新代码沿用了哪些项目约定
- 哪些地方无法判断并需要用户确认（如果有）

## 兜底模板（仅在项目无可参考样例时）

仅当项目是空白 Spring Boot 脚手架，且没有任何业务代码可对齐时，才可使用如下默认建议：

- 分层：Controller -> Service -> Repository
- 事务：Service 写操作加 `@Transactional`
- 验证：`@Valid` + Bean Validation
- 异常：`@RestControllerAdvice` 统一处理

> 注意：一旦项目内出现真实代码，立即切换为“项目风格优先”。
