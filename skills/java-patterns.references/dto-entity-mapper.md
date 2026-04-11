---
name: java-patterns:dto-entity-mapper
description: 由 java-patterns.md 主文件按需加载。完整上下文见主文件。
---

# DTO + Entity + Mapper 模板参考

> 由 `java-patterns.md` 主文件按需加载。完整上下文见主文件。

---

## Entity

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

## DTO（返回前端）

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

## QueryRequest（查询参数）

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

## CreateRequest（创建参数）

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

## Mapper 接口

```java
@Mapper
public interface SysUserMapper extends BaseMapper<SysUser> {
    // 复杂查询写在 XML 中
    List<UserDTO> selectUserList(@Param("req") UserQueryRequest req);
}
```

## Mapper XML

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
