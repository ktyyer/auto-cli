# Controller + Service 模板参考

> 由 `java-patterns.md` 主文件按需加载。完整上下文见主文件。

---

## Controller 模板

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

## Service 接口

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

## Service 实现

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
        Long count = userMapper.selectCount(
                new LambdaQueryWrapper<SysUser>()
                        .eq(SysUser::getUsername, req.getUsername()));
        if (count > 0) {
            throw new ServiceException("用户名已存在");
        }

        SysUser user = new SysUser();
        BeanUtils.copyProperties(req, user);
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
        return rawPassword; // 实际项目中替换为 BCrypt
    }
}
```
