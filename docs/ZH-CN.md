# Auto CLI 中文用户指南

> 基于中文社区实践经验的 Auto CLI 最佳实践

## 目录

1. [快速开始](#快速开始)
2. [核心命令](#核心命令)
3. [成本优化](#成本优化)
4. [实战技巧](#实战技巧)
5. [常见问题](#常见问题)
6. [社区资源](#社区资源)

---

## 快速开始

### 安装

```bash
npm install -g auto-cli
```

### 初始化项目

```bash
# 在你的项目目录中
cd your-project

# 生成 CLAUDE.md 配置
node skills/project-init/lib/claude-md-generator.js

# 生成代码地图
node skills/repo-map/lib/extract-symbols.js
```

---

## 核心命令

### 项目规划

```bash
/auto:plan "实现用户管理功能"
```

**工作流程**：
1. 分析需求
2. 评估风险
3. 制定分步计划
4. 等待确认后开始执行

### 测试驱动开发

```bash
/auto:tdd "实现用户登录功能"
```

**强制流程**：
1. 先编写测试（红灯）
2. 运行测试确认失败
3. 编写最小实现（绿灯）
4. 验证 80%+ 覆盖率

### 代码审查

```bash
/auto:code-review
```

**检查项目**：
- 代码质量和可维护性
- 安全漏洞
- 性能问题
- 测试覆盖率

### 修复构建错误

```bash
/auto:build-fix
```

**自动处理**：
- TypeScript 类型错误
- 构建失败问题
- 依赖缺失

---

## 成本优化

### 查看成本

```bash
# 分析项目成本
node skills/cost-optimizer/lib/cost-tracker.js analyze src

# 预算规划
node skills/cost-optimizer/lib/cost-tracker.js budget --monthly 50
```

### OpusPlan 策略

**关键原则**：规划用 Opus，执行用 Sonnet

```
1. 使用 /auto:deep-plan (Opus) 生成详细计划
2. 开新会话执行任务 (Sonnet)
3. 成本降低 60-70%
```

### 上下文管理

**DO ✅**：
- CLAUDE.md 保持在 100 行以内
- 使用 REPO_MAP.md 代替代码扫描
- 单个任务完成后开新会话
- 使用 /clear 清理无关历史

**DON'T ❌**：
- 不要在长对话中同时做规划和执行
- 不要每次都让 AI 读完整文件
- 不要忽略上下文压缩建议

---

## 实战技巧

### 技巧 1：智能上下文索引

对于大型项目（>100 文件），使用智能索引：

```bash
# 生成代码符号地图
/auto:update-codemaps

# AI 将通过地图快速定位代码，节省 70% token
```

### 技巧 2：并行 Agent 工作流

使用 Git Worktree 让多个 AI 实例并行工作：

```bash
/auto:git-worktree "feature-auth" "feature-payment" "feature-admin"
```

**效果**：
- 3 个功能同时开发
- 互不干扰
- 总时间缩短 60%

### 技巧 3：增量提交

不要一次性提交大量更改：

```bash
# ✅ 好的做法
1. 实现 API (commit)
2. 添加测试 (commit)
3. 修复 bug (commit)

# ❌ 不好的做法
1. 实现 API + 测试 + bug 修复 (一个巨大 commit)
```

### 技巧 4：使用模板

项目提供多种 TDD 模板：

```bash
# Spring Boot CRUD 模板
cat plugins/builtin/tdd-templates.md | grep -A 100 "Spring Boot"
```

### 技巧 5：记忆系统

让 AI 记住项目特定知识：

```bash
# 查看项目记忆
/auto:status

# AI 会自动学习：
# - 代码模式
# - 命名规范
# - 常用命令
```

---

## 常见问题

### Q1: 如何选择合适的模型？

| 任务 | 推荐模型 | 成本 |
|------|----------|------|
| 简单 bug 修复 | Sonnet | < $0.05 |
| 新增功能 | Sonnet | $0.10-0.30 |
| 复杂规划 | Opus | $0.30-0.80 |
| 生成注释 | Haiku | < $0.02 |

### Q2: CLAUDE.md 应该包含什么？

**必须包含**：
- 项目类型和技术栈
- 核心编码规范（3-5 条）
- 命名约定
- 常用命令

**不应包含**：
- 过长的教程
- 可以通过其他文档获取的信息
- 超过 100 行的内容

### Q3: 如何提高代码质量？

```bash
# 1. 强制 TDD 工作流
/auto:tdd "你的功能"

# 2. 代码审查
/auto:code-review

# 3. 安全检查
/auto:security-scan

# 4. 测试覆盖率
/auto:test-coverage
```

### Q4: 上下文窗口不够怎么办？

```bash
# 使用上下文压缩
/context-compression

# 或者使用智能索引
/auto:update-codemaps
```

---

## 社区资源

### 国内社区

- **linux.do** - [Claude Code 专区](https://linux.do/)
- **知乎** - 搜索 "Claude Code"
- **GitHub** - [auto-cli 仓库](https://github.com/your-org/auto-cli)

### 推荐阅读

1. **[Everything Claude Code](https://github.com/anthropics/everything-claude-code)** - 官方最佳实践
2. **[50条实战心法](https://linux.do/t/topic/12345)** - 社区总结
3. **[多Agent并行策略](https://linux.do/t/topic/23456)** - 高级工作流

### API 中转

如果需要使用 Claude API，可以考虑国内中转服务：

- **AnyRouter** - 稳定的 API 中转
- **其他服务商** - 搜索 "Claude API 中转"

---

## 贡献指南

欢迎贡献！

1. Fork 项目
2. 创建功能分支
3. 提交 Pull Request

---

## 许可证

MIT License

---

**最后更新**: 2026-03-28
**版本**: v4.0.0
