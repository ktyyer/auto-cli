# AI MAX v3.0 迁移指南

> **从 v2.0 平滑升级到 v3.0**

## 📊 快速概览

| v2.0 | v3.0 | 变化 |
|------|------|------|
| 15 个命令 | 5 个命令 | **-67%** |
| 需要记忆命令 | 零学习成本 | **更简单** |
| 工具集 | 智能助手 | **更智能** |

## 🔄 命令变化

### 保留的命令

✅ **继续使用**：
- `/auto:auto` - 智能超级命令（唯一入口）
- `/auto:plan` - 规划命令

### 新增的命令

🆕 **新增**：
- `/auto:fix` - 自动修复构建/测试错误
- `/auto:status` - 查看项目状态
- `/auto:help` - 显示帮助

### 删除的命令（已整合到 auto）

❌ **以下命令已整合到 `/auto:auto`**：
```bash
/auto:tdd              # → auto 自动检测 TDD 场景
/auto:code-review      # → auto 第 7 步自动审查
/auto:build-fix        # → /auto:fix
/auto:e2e              # → auto 自动检测 E2E 场景
/auto:test-coverage    # → auto 第 6 步自动检查
/auto:loop             # → 整合到对话状态机
/auto:evolve           # → auto 自动进化
/auto:refactor-clean   # → auto 自动检测清理场景
/auto:init             # → auto 首次使用自动初始化
/auto:update-docs      # → auto 自动更新
/auto:update-codemaps  # → auto 自动更新
/auto:instinct-status  # → /auto:status
/auto:deep-plan        # → /auto:plan 自动切换深度模式
/auto:security-scan    # → auto 第 7 步自动扫描
```

## 🚀 新的使用方式

### v2.0 旧方式

```bash
# 需要记住多个命令
/auto:tdd 实现用户登录
/auto:code-review
/auto:update-docs
```

### v3.0 新方式

```bash
# 只需记住一个命令
/auto:auto 实现用户登录
# 自动完成：TDD + 审查 + 更新文档
```

## ❓ 常见问题

### Q: 习惯用的命令不见了怎么办？

大部分命令已整合到 `/auto:auto`，使用方式更简单。

### Q: 如何查看已学习的编码模式？

使用 `/auto:status` 命令查看项目状态和已学习的模式。

### Q: 构建失败时如何修复？

使用 `/auto:fix` 命令自动修复构建/测试错误。

### Q: 如何恢复 v2.0？

如果不适应 v3.0，可以恢复 v2.0：

```bash
# 恢复所有文件
cp -r .aimax/backup/v2.0/* .

# 提交回滚
git add .
git commit -m "Revert: 恢复到 v2.0"
```

## ✅ 迁移检查清单

- [x] 备份 v2.0 文件（自动完成）
- [ ] 阅读 README.md 了解新特性
- [ ] 尝试使用 `/auto:auto` 完成一个任务
- [ ] 使用 `/auto:status` 查看项目状态
- [ ] 验证所有功能正常工作

## 📚 获取帮助

- [README.md](../README.md) - 项目介绍
- [CHANGELOG.md](../CHANGELOG.md) - 变更日志
- [GitHub Issues](https://github.com/zhukunpenglinyutong/ai-max/issues)

---

**更新时间**：2026-03-03 | **版本**：v3.0.0
