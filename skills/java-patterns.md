---
name: java-patterns
description: Spring Boot + MyBatis Plus 编码模式库 — 分层架构模板、分页查询、响应包装、全局异常处理、事务管理等 12 种高频编码模式
version: 1.0.0
author: auto-cli
tags: [java, spring-boot, mybatis-plus, patterns, rest, pagination, transaction, dto, mapper]
---

# Java Patterns — Spring Boot 编码模式库

> quest-designer 在 PHASE 2 设计 Java 项目 Quest 时直接引用。
> build-error-resolver 参考"常见编译错误"一节快速定位问题。

---

## 一、Controller 模板

```java
package com.example.system.controller;

import com.example.common.core.domain.Result;
import com.example.common.core.page.PageInfo;
import com.example.system.domain.dto.UserDTO;
import com.example.system.domain.query.UserQueryRequest;
import com.example.system.service.SysUserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@Tag(name = "用户管理", description = "用户增删改查")
@RestController
@RequestMapping("/system/user")
@RequiredArgsConstructor
public class SysUserController {

    private final SysUserService userService;

    @Operation(summary = "分页查询用户")
    @PreAuthorize("@ss.hasPermi('system:user:list')")
    @GetMapping("/list")
    public Result<PageInfo<UserDTO>> list(UserQueryRequest req) {
        return Result.success(userService.selectList(req));
    }

    @Operation(summary = "根据ID查询用户")
    @GetMapping("/{id}")
    public Result<UserDTO> getById(@PathVariable Long id) {
        return Result.success(userService.selectById(id));
    }

    @Operation(summary = "新增用户")
    @PreAuthorize("@ss.hasPermi('system:user:add')")
    @PostMapping
    public Result<Void> add(@RequestBody @Valid CreateUserRequest req) {
        userService.addUser(req);
        return Result.success();
    }

    @Operation(summary = "修改用户")
    @PreAuthorize("@ss.hasPermi('system:user:edit')")
    @PutMapping
    public Result<Void> edit(@RequestBody @Valid UpdateUserRequest req) {
        userService.updateUser(req);
        return Result.success();
    }

    @Operation(summary = "删除用户")
    @PreAuthorize("@ss.hasPermi('system:user:remove')")
    @DeleteMapping("/{ids}")
    public Result<Void> remove(@PathVariable Long[] ids) {
        userService.deleteByIds(ids);
        return Result.success();
    }
}
```

---

## 二、Service 模板

### 2.1 接口

```java
package com.example.system.service;

import com.example.common.core.page.PageInfo;
import com.example.system.domain.dto.UserDTO;
import com.example.system.domain.query.UserQueryRequest;

public interface SysUserService {
    PageInfo<UserDTO> selectList(UserQueryRequest req);
    UserDTO selectById(Long id);
    void addUser(CreateUserRequest req);
    void updateUser(UpdateUserRequest req);
    void deleteByIds(Long[] ids);
}
```

### 2.2 实现

```java
package com.example.system.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.example.common.core.page.PageInfo;
import com.example.common.exception.ServiceException;
import com.example.system.domain.dto.UserDTO;
import com.example.system.domain.entity.SysUser;
import com.example.system.domain.query.UserQueryRequest;
import com.example.system.mapper.SysUserMapper;
import com.example.system.service.SysUserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.BeanUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class SysUserServiceImpl implements SysUserService {

    private final SysUserMapper userMapper;

    @Override
    public PageInfo<UserDTO> selectList(UserQueryRequest req) {
        LambdaQueryWrapper<SysUser> wrapper = new LambdaQueryWrapper<SysUser>()
                .like(req.getUsername() != null, SysUser::getUsername, req.getUsername())
                .eq(req.getStatus() != null, SysUser::getStatus, req.getStatus())
                .orderByDesc(SysUser::getCreateTime);

        Page<SysUser> page = userMapper.selectPage(
                new Page<>(req.getPageNum(), req.getPageSize()), wrapper);

        return PageInfo.of(page, UserDTO::from);
    }

    @Override
    public UserDTO selectById(Long id) {
        SysUser user = userMapper.selectById(id);
        if (user == null) {
            throw new ServiceException("用户不存在");
        }
        return UserDTO.from(user);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void addUser(CreateUserRequest req) {
        // 检查唯一性
        Long count = userMapper.selectCount(
                new LambdaQueryWrapper<SysUser>()
                        .eq(SysUser::getUsername, req.getUsername()));
        if (count > 0) {
            throw new ServiceException("用户名已存在");
        }

        SysUser user = new SysUser();
        BeanUtils.copyProperties(req, user);
        // 密码加密
        user.setPassword(encryptPassword(req.getPassword()));
        userMapper.insert(user);
        log.info("新增用户: userId={}", user.getId());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void updateUser(UpdateUserRequest req) {
        SysUser existing = userMapper.selectById(req.getId());
        if (existing == null) {
            throw new ServiceException("用户不存在");
        }
        BeanUtils.copyProperties(req, existing);
        userMapper.updateById(existing);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteByIds(Long[] ids) {
        for (Long id : ids) {
            userMapper.deleteById(id);
        }
    }

    private String encryptPassword(String rawPassword) {
        // 使用 BCrypt 或项目已有的加密工具
        return rawPassword; // 实际项目中替换
    }
}
```

---

## 三、DTO + Entity 模板

### 3.1 Entity

```java
@Data
@TableName("sys_user")
public class SysUser {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String username;
    private String password;    // 不返回给前端
    private String email;
    private String phone;
    private Integer status;     // 0-禁用 1-正常
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
}
```

### 3.2 DTO（返回前端）

```java
@Data
public class UserDTO {
    private Long id;
    private String username;
    private String email;
    private String phone;
    private String statusName;  // 翻译后的状态名

    public static UserDTO from(SysUser user) {
        UserDTO dto = new UserDTO();
        BeanUtils.copyProperties(user, dto);
        dto.setStatusName(user.getStatus() == 1 ? "正常" : "禁用");
        return dto;
    }
}
```

### 3.3 QueryRequest（查询参数）

```java
@Data
public class UserQueryRequest {
    private String username;
    private Integer status;
    @RequestParam(defaultValue = "1")
    private Integer pageNum;
    @RequestParam(defaultValue = "10")
    private Integer pageSize;
}
```

### 3.4 CreateRequest（创建参数）

```java
@Data
public class CreateUserRequest {
    @NotBlank(message = "用户名不能为空")
    @Length(min = 2, max = 50, message = "用户名长度2-50")
    private String username;

    @NotBlank(message = "密码不能为空")
    @Length(min = 6, max = 100, message = "密码长度6-100")
    private String password;

    @NotBlank(message = "邮箱不能为空")
    @Email(message = "邮箱格式不正确")
    private String email;
}
```

---

## 四、Mapper 模板

### 4.1 接口

```java
@Mapper
public interface SysUserMapper extends BaseMapper<SysUser> {
    // 复杂查询写在 XML 中
    List<UserDTO> selectUserList(@Param("req") UserQueryRequest req);
}
```

### 4.2 XML

```xml
<?xml version="1.0" encoding="UTF-8" ?>
<!DOCTYPE mapper PUBLIC "-//mybatis.org//DTD Mapper 3.0//EN"
    "http://mybatis.org/dtd/mybatis-3-mapper.dtd">
<mapper namespace="com.example.system.mapper.SysUserMapper">

    <select id="selectUserList" resultType="com.example.system.domain.dto.UserDTO">
        SELECT u.id, u.username, u.email, u.phone, u.status, u.create_time
        FROM sys_user u
        <where>
            <if test="req.username != null and req.username != ''">
                AND u.username LIKE CONCAT('%', #{req.username}, '%')
            </if>
            <if test="req.status != null">
                AND u.status = #{req.status}
            </if>
        </where>
        ORDER BY u.create_time DESC
    </select>

</mapper>
```

---

## 五、全局异常处理

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

## 六、常见编译错误速查

| 错误 | 根因 | 速修 |
|------|------|------|
| `Cannot resolve symbol` | 依赖未同步 | `mvn clean install` 或 IDEA 重新导入 |
| `NullPointerException` | 未注入 Bean | 检查 `@Autowired` + `@Service` |
| `BeanCreationException` | 循环依赖 | `@Lazy` 延迟加载或重构 |
| `HttpMessageNotReadable` | JSON 字段类型错误 | 检查 DTO 字段 + `@JsonFormat` |
| `DataIntegrityViolation` | 唯一键冲突 | 检查数据唯一性 |
| `MyBatisSystemException` | XML 与接口不匹配 | 检查 namespace、方法签名 |
| `InvalidDefinitionException` | Jackson 序列化失败 | 添加 `@JsonIgnore` 或无参构造器 |

---

## 七、与 auto-cli 集成

- **quest-designer**: Java 项目 Quest 直接使用模板生成完整代码
- **build-error-resolver**: 参考"常见编译错误"速修表
- **tdd-guide**: Service 层测试使用 Mock Mapper 模式
- **code-reviewer**: 检查分层架构约束和命名规范
