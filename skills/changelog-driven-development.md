---
name: changelog-driven-development
description: 变更日志驱动开发 - 先写 CHANGELOG 条目再写代码，确保每个功能都有用户可读的变更记录，与 /auto:auto 的 PHASE 5 (COMMIT) 阶段集成
version: 1.0.0
author: auto-cli
tags: [changelog, release, commit, documentation, workflow]
---

# Changelog-Driven Development -- 变更日志驱动开发

> 灵感来源: [Keep a Changelog](https://keepachangelog.com/) + [Conventional Commits](https://www.conventionalcommits.org/) + GitHub Changelog Generator

## 核心理念

传统流程: 写代码 -> 写 commit message -> 发布时写 changelog
CLDD 流程: 写 changelog 条目 -> 写代码验证条目 -> commit message 即 changelog

**好处**:
1. 功能描述在编码前就被精确化（减少需求偏差）
2. commit message 天然规范（不需要事后整理）
3. CHANGELOG.md 始终是最新状态
4. 发布时零成本生成 release notes

## 工作流

### 在 /auto:auto 中集成

```
PHASE 2 (REASON):
  quest-designer 在设计 Quest Map 时，为每个 Quest 附加:
    changelog_entry: "feat: 新增订单导出 Excel 功能，支持按日期范围和状态筛选"

PHASE 3 (EXECUTE):
  每个 Quest 完成后，将 changelog_entry 写入 CHANGELOG.md 的 [Unreleased] 区域

PHASE 5 (COMMIT):
  commit message 直接使用 changelog_entry
```

### CHANGELOG.md 格式

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- 订单导出 Excel 功能，支持按日期范围和状态筛选

### Fixed
- 用户列表分页查询在最后一页返回空数据的问题

### Changed
- 登录接口返回值从 `{ token }` 改为 `{ token, expiresIn }`

### Removed
- (空)

## [0.1.0] - 2026-03-28
### Added
- 初始版本发布
```

### Commit Message 规范

```
<type>(<scope>): <description>

[optional body]

类型:
  feat: 新功能
  fix: 修复
  refactor: 重构
  docs: 文档
  test: 测试
  chore: 构建/工具
  perf: 性能
  ci: CI/CD

示例:
  feat(order): 新增订单导出 Excel 功能
  fix(user): 修复分页查询最后一页返回空数据
  refactor(auth): JWT token 结构优化
```

### 与 PHASE 6 (LEARN) 集成

```
PHASE 6 结束时:
  1. 检查 CHANGELOG.md [Unreleased] 是否有内容
  2. 如有 → 提示用户: "发现未发布的变更，是否更新版本号?"
  3. 用户确认 → 自动:
     a. 更新 package.json version
     b. 将 [Unreleased] 改为 [x.y.z] - YYYY-MM-DD
     c. 新增空的 [Unreleased] 区域
     d. git commit -m "chore: release v0.2.0"
```

## 分类标准

| 类型 | 含义 | CHANGELOG 区域 |
|------|------|---------------|
| feat | 新功能 | Added |
| fix | 修复 bug | Fixed |
| refactor | 代码重构（不改行为） | Changed |
| docs | 文档更新 | (不记录) |
| test | 测试 | (不记录) |
| chore | 构建/工具 | (不记录) |
| perf | 性能优化 | Changed |
| ci | CI/CD 配置 | (不记录) |

## 反模式

1. 不要把所有变更都放进 Added（修复应放 Fixed）
2. 不要写技术性描述（"重构了 UserService 的 DI"），写用户可读描述（"优化了用户查询性能"）
3. 不要在 [Unreleased] 中写版本号
4. 不要跳过空类型区域（保持格式一致性）

## 与 auto-cli 的集成

- quest-designer 在 Quest Map 中为每个 Quest 生成 changelog_entry
- PHASE 5 的 commit message 直接使用 changelog_entry
- PHASE 6 检查是否有未发布变更
- `/auto:update-docs` 可自动更新 CHANGELOG.md
