---
description: 生成 Claude Code Hook 模板建议。基于项目配置（TypeScript, Prettier, ESLint）返回可复制的 Hook 配置片段。
---

# /auto:create-hook — Hook 模板助手

此命令用于生成 Hook 模板建议，返回当前运行时可消费的结构化结果，便于你据此手动补全实际配置。

## 当前命令能力

1. **模板占位输出** - 返回 `type`、`name`、`template`、`recommendedLocation`
2. **参数透传** - 支持通过 CLI 指定 hook 类型与名称
3. **手动落地参考** - 给出推荐配置位置，便于后续手动实现

> 当前版本不会进行交互式问答，不会自动生成完整 hooks JSON，也不会直接安装到项目中。

## 何时使用

在以下情况使用 `/auto:create-hook`：
- 想要在特定操作前/后执行自定义脚本
- 需要强制执行代码规范（如 TDD）
- 想要阻止某些危险操作
- 需要在项目事件发生时执行自动化任务

## Hook 类型

支持以下 Hook 类型：

| Hook 类型 | 触发时机 | 用途 |
|-----------|---------|------|
| **PreToolUse** | 工具调用前 | 验证、修改输入、阻止操作 |
| **PostToolUse** | 工具调用后 | 自动格式化、检查、通知 |
| **PostCompaction** | 上下文压缩后 | 重新注入关键上下文 |
| **UserPromptSubmit** | 用户提交提示后 | 验证提示、注入上下文 |
| **TeammateIdle** | 队友空闲时 | 分配新任务 |
| **TaskCompleted** | 任务完成时 | 质量门禁、验证 |
| **Stop** | 会话结束时 | 最终检查、清理 |

## 使用示例

### 示例 1：生成默认模板占位

```bash
/auto:create-hook
```

输出会返回类似下面的结构化结果：

```json
{
  "type": "template",
  "name": "custom-hook",
  "template": "template:custom-hook",
  "recommendedLocation": ".claude/settings.json"
}
```

### 示例 2：指定类型与名称

```bash
auto create-hook --type PreToolUse --name tdd-guard --json
```

输出示例：

```json
{
  "type": "PreToolUse",
  "name": "tdd-guard",
  "template": "PreToolUse:tdd-guard",
  "recommendedLocation": ".claude/settings.json"
}
```

### 示例 3：手动落地模板

1. 运行 `/auto:create-hook` 或 `auto create-hook --json`
2. 根据返回的 `type` / `name` / `template` 手动编写真实 Hook 配置
3. 将最终配置写入推荐位置并自行校验

> 当前版本只负责返回模板占位信息，不会自动修改项目文件。

## 可扩展方向

当前命令本身不内置完整模板内容，但适合拿来作为这些 Hook 的命名与落地起点：

- TDD Guard Hook
- Auto-Format Hook
- Secret Detection Hook
- Dev Server Blocker Hook
- Git Push Review Hook
- Console.log Warning Hook
- Large File Warning Hook

## Hook 匹配器 (Matcher) 语法

```
# 匹配特定工具
tool == "Bash"
tool == "Write"
tool == "Edit"

# 匹配命令模式
tool_input.command matches "npm run dev"
tool_input.command matches "(npm|pnpm|yarn) install"

# 匹配文件路径
tool_input.file_path matches "\\.js$"
tool_input.file_path matches "(src/|lib/).*\\.ts$"

# 组合条件
(tool == "Write" || tool == "Edit") && tool_input.file_path matches "\\.js$"
tool == "Bash" && tool_input.command matches "git push"
```

## Hook 命令格式

Hook 命令是接收 JSON 输入的 bash 脚本：

```bash
#!/bin/bash
# 读取 JSON 输入
input=$(cat)

# 提取字段
file_path=$(echo "$input" | jq -r '.tool_input.file_path // ""')
command=$(echo "$input" | jq -r '.tool_input.command // ""')

# 执行逻辑
if [ some_condition ]; then
  echo "[Hook] Warning message" >&2
  # 阻止操作
  exit 1
fi

# 传递原始输入
echo "$input"
```

## 退出代码

- **0** - 允许操作继续
- **1** - 阻止操作（PreToolUse）
- **2** - 拒绝并显示错误

## 与其他功能的集成

- 使用 `/auto` 配合 quest-designer 实现 TDD 工作流
- 使用 `/auto` 配合 code-reviewer Agent 进行代码审查
- 使用 `/auto:status` 查看已安装的 Hooks

## 现有 Hooks 参考

项目中的 `hooks/hooks.json` 包含多个现成的 Hook 示例，可以作为参考。
