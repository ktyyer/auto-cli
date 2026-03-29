---
description: 显示帮助和使用示例
---

# /auto:help — 帮助文档

> **显示 Auto CLI 的使用帮助和示例**

## 快速开始

```bash
# 唯一入口，自动完成所有事情
/auto [任务描述]

# 示例
/auto 实现用户查询 API
/auto 修复登录 bug
/auto 重构 UserService
```

## 核心命令

| 命令 | 用途 | 示例 |
|------|------|------|
| `/auto` | 智能超级命令（唯一入口） | `/auto 实现功能` |
| `/auto:tdd` | 测试驱动开发 | `/auto:tdd 用户登录` |
| `/auto:code-review` | 代码质量审查 | `/auto:code-review` |
| `/auto:build-fix` | 修复构建错误 | `/auto:build-fix` |
| `/auto:route` | 智能路由推荐 | `/auto:route 重构系统` |
| `/auto:e2e` | E2E 测试 | `/auto:e2e 登录流程` |
| `/auto:refactor-clean` | 死代码清理 | `/auto:refactor-clean` |
| `/auto:doctor` | 环境诊断 | `/auto:doctor` |
| `/auto:save` | 保存知识条目 | `/auto:save 记录踩坑` |
| `/auto:status` | 项目状态查看 | `/auto:status` |
| `/auto:test-coverage` | 测试覆盖率分析 | `/auto:test-coverage` |
| `/auto:update-codemaps` | 更新代码地图+文档 | `/auto:update-codemaps` |
| `/auto:help` | 显示此帮助 | `/auto:help` |

## 常见任务

### 功能开发
```bash
/auto 实现用户认证功能
/auto 添加订单查询接口
/auto 创建商品管理模块
```

### Bug 修复
```bash
/auto 修复登录超时问题
/auto 解决支付失败 bug
/auto 修复数据不一致
```

### 代码优化
```bash
/auto 重构 UserService
/auto 优化查询性能
/auto 清理重复代码
```

### 测试相关
```bash
/auto 编写单元测试
/auto 提高 test coverage
/auto 添加集成测试
```

## 高级功能

### 项目记忆
Auto CLI 会自动学习项目的编码模式，越用越聪明。

### 自我进化
- Self-Aware：理解项目模式
- Self-Improving：从反馈中学习
- Self-Fixing：自动修复错误
- Self-Building：自动构建技能

### 统一执行流程
`/auto` 不区分复杂度，所有任务统一走 6 步流程：
1. 上下文感知 + 能力发现
2. AI 推理 + Quest Map 设计
3. 逐关执行（按规模自动选择：单Agent / Subagent / Teams）
4. 整合验证（构建 + 测试 + 安全审查）
5. 提交
6. 知识沉淀

## 获取帮助

- GitHub: https://github.com/zhukunpenglinyutong/auto-cli
- 问题: https://github.com/zhukunpenglinyutong/auto-cli/issues
