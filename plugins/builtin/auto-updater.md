---
name: auto-updater
version: 1.0.0
description: 自动更新检查 - 启动时检测 npm registry 是否有新版本，输出更新提示和 changelog 摘要
author: auto-cli
triggers:
  - "status"
  - "version"
  - "update"
priority: 30
builtin: true
---

# Auto Updater -- 自动更新检查

> 让用户始终使用最新版本，不错过任何改进和修复。

## 触发时机

1. 用户运行 `auto status` 或 `/auto:status` 时自动附带版本检查
2. 用户运行 `auto install` 或 `auto update` 时检查是否有更新
3. 用户运行 `auto --version` 或 `auto -v` 时显示当前版本 + 最新版本

## 版本检查逻辑

```bash
# 从 npm registry 获取最新版本号（无需 npm login）
Bash("npm view auto-cli version 2>/dev/null")
  → 如返回值 > 当前版本 → 有更新
  → 如返回值 == 当前版本 → 已是最新
  → 如命令失败 → 跳过检查（可能离线或包名变更）

# 当前版本
Read("package.json") → 提取 version 字段
```

## 输出格式

```markdown
## 版本检查

当前版本: 0.1.0
最新版本: 0.2.0

有新版本可用！更新内容：
  - feat: 新增 auto doctor 命令
  - feat: 支持选择性安装组件
  - fix: 修复 Windows 路径问题

更新命令: npm update -g auto-cli
```

## 与现有命令集成

- `/auto:status` 命令在输出项目状态后，附带版本检查结果
- `auto update` 命令在执行更新前先检查是否有新版本
- 不在每次 `/auto:auto` 执行时检查（避免消耗 token）

## 注意事项

- 版本检查不需要安装任何依赖，只用 `npm view`
- 离线环境下静默跳过，不报错
- 只提示，不自动更新（需用户确认）
