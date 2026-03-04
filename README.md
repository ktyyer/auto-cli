# Auto CLI

> Claude Code 能力增强工具

---

## 这是什么？

Auto CLI 是一个运行在 Claude Code 中的编程助手。它能帮你：

- **写代码**：描述需求，自动生成代码
- **修 Bug**：粘贴错误信息，自动修复
- **写测试**：自动生成测试用例
- **代码审查**：自动检查代码质量
- **重构优化**：自动优化代码结构

**一句话**：像说话一样编程，只需要描述你想要什么，它来帮你实现。

---

## 环境要求

- **Node.js**：版本 >= 16（检查方法：终端输入 `node --version`）
- **Claude Code**：已安装并可用

---

## 安装

### 步骤 1：全局安装

```bash
npm install -g auto-cli
```

### 步骤 2：安装组件

```bash
auto install
```

按照提示选择要安装的组件（推荐全选），输入 `y` 确认。

### 步骤 3：重启 Claude Code

重启后即可使用。

---

## 使用方法

在 Claude Code 对话框中输入：

```bash
/auto [你的需求]
```

例如：

```bash
/auto 写一个用户登录功能
/auto 修复登录失败的 bug
/auto 优化 UserService 的代码
```

---

## 核心功能

### 1. 智能任务执行

输入需求后，工具会自动完成：

1. **检测项目** - 识别语言、框架、项目规范
2. **评估复杂度** - 简单任务直接写，复杂任务规划后写
3. **编写代码** - 按照你的需求生成代码
4. **生成测试** - 自动生成测试用例
5. **运行验证** - 确保代码能编译、测试通过
6. **代码审查** - 检查安全和质量
7. **自动提交** - Git 自动提交保存

### 2. 支持的语言和框架

- Java / Spring Boot
- Python / Django / Flask
- JavaScript / TypeScript / React / Vue
- Go
- 其他主流语言

### 3. 安全保护

- 读取文件 → 自动执行
- 编辑代码 → 默认自动
- 删除文件 → 需要你确认

---

## 常用命令

| 命令 | 用途 |
|------|------|
| `/auto` | 说需求，让它自动完成 |
| `/auto:plan` | 只规划，不写代码 |
| `/auto:tdd` | 用测试驱动开发 |
| `/auto:code-review` | 审查代码质量 |
| `/auto:build-fix` | 修复编译错误 |
| `/auto:e2e` | 写端到端测试 |
| `/auto:status` | 查看学习情况 |

---

## 常见问题

### Q1: 安装后命令不生效？

1. 重启 Claude Code
2. 检查 Node.js 是否安装成功：`node --version`

### Q2: 支持哪些语言？

支持主流编程语言：Java、Python、JavaScript、TypeScript、Go 等。

### Q3: 代码会泄露吗？

不会。所有代码都在本地处理，不会上传。

---

## 项目起源

本项目基于以下开源项目开发：

- [everything-claude-code](https://github.com/affaan-m/everything-claude-code) - Claude Code 扩展合集
- [ai-max](https://github.com/zhukunpenglinyutong/ai-max) - Claude Code 能力增强工具

---

## License

MIT
