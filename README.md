# Auto CLI

> Claude Code 能力增强 CLI 工具

---

## 项目起源

本项目基于以下两个开源项目开发：

- **[everything-claude-code](https://github.com/affaan-m/everything-claude-code)** - Claude Code 扩展合集
- **[ai-max](https://github.com/zhukunpenglinyutong/ai-max)** - Claude Code 能力增强工具

感谢原始作者的开源贡献。

---

## 功能特性

- **智能任务执行**：输入需求，自动完成需求分析、编码实现、测试验证
- **复杂度评估**：根据任务复杂度自动选择合适的执行策略
- **TDD 支持**：支持测试驱动开发流程
- **代码审查**：内置代码质量审查和安全检查
- **框架插件**：支持 Java/Spring、React、Django 等多种框架

---

## 安装

```bash
npm install -g auto-cli
```

---

## 使用方法

在 Claude Code 中输入：

```bash
/auto 实现一个用户登录功能
```

---

## 命令

| 命令 | 用途 |
|------|------|
| `/auto` | 智能超级命令，自动完成需求到实现 |
| `/auto:plan` | 需求规划 |
| `/auto:tdd` | TDD 开发流程 |
| `/auto:code-review` | 代码审查 |
| `/auto:build-fix` | 构建修复 |
| `/auto:e2e` | E2E 测试 |
| `/auto:test-coverage` | 覆盖率分析 |
| `/auto:loop` | 任务状态机编排 |
| `/auto:evolve` | 持续迭代优化 |
| `/auto:refactor-clean` | 代码清理 |

---

## 配置

项目根目录下的 `CLAUDE.md` 文件会被自动读取作为项目规范。

---

## License

MIT
