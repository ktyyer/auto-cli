---
description: 环境诊断 - 检查 Node.js 版本、Claude Code 配置、依赖状态，输出健康报告和修复建议
---

# /auto:doctor -- 环境诊断

> 一键检查开发环境健康状态，发现问题时自动给出修复建议。

## 使用方式

```bash
/auto:doctor              # 只读诊断（默认）
/auto:doctor --fix        # 自动修复可修复的问题
```

## 执行步骤

### 1. Node.js 环境检查

```
Bash("node --version")
  -> >= 18.0.0 -> PASS
  -> < 18.0.0 -> FAIL: "请升级 Node.js 到 18+"

Bash("npm --version")
  -> 存在 -> PASS
  -> 不存在 -> WARN: "npm 未找到，请检查 Node.js 安装"

Bash("git --version")
  -> 存在 -> PASS
  -> 不存在 -> WARN: "git 未安装，版本控制功能受限"
```

### 2. Claude Code 配置检查

```
Bash("test -d ~/.claude && echo EXISTS || echo MISSING")
  -> MISSING -> FAIL: "~/.claude 目录不存在，请先运行 auto install"

Bash("ls ~/.claude/agents/*.md 2>/dev/null | wc -l")
  -> >= 5 -> PASS
  -> < 5 -> WARN: "Agent 文件不完整，建议重新 auto install"

Bash("ls ~/.claude/commands/auto/*.md 2>/dev/null | wc -l")
  -> >= 5 -> PASS
  -> < 5 -> WARN: "Command 文件不完整，建议重新 auto install"

Bash("ls ~/.claude/skills/*.md 2>/dev/null | wc -l")
  -> >= 4 -> PASS
  -> < 4 -> WARN: "Skill 文件不完整，建议重新 auto install"

Bash("test -f ~/.claude/hooks/hooks.json && echo EXISTS || echo MISSING")
  -> EXISTS -> PASS
  -> MISSING -> INFO: "Hooks 未安装（可选）"
```

### 3. 项目配置检查

```
Glob("CLAUDE.md")
  -> 存在 -> PASS
  -> 不存在 -> WARN: "缺少 CLAUDE.md，建议手动创建或由 /auto 在后续工作流中提示补齐"

Glob("REPO_MAP.md")
  -> 存在 -> PASS
  -> 不存在 -> INFO: "缺少 REPO_MAP.md（可选）"
```

### 4. 依赖安装检查

```
Glob("package.json")
  -> 存在 -> Bash("test -d node_modules && echo OK || echo MISSING")
    -> MISSING -> FAIL: "依赖未安装，请运行 npm install"
  -> 不存在 -> INFO: "非 Node.js 项目，跳过"
```

### 5. 输出诊断报告

```markdown
## Auto CLI 环境诊断报告

### 基础环境

- Node.js: v20.11.0 -- PASS
- npm: 10.2.4 -- PASS
- git: 2.43.0 -- PASS

### Claude Code 配置

- ~/.claude 目录: PASS
- Agents (9): PASS
- Commands (6): PASS
- Skills (4): PASS
- Hooks: PASS

### 项目配置

- CLAUDE.md: PASS
- REPO_MAP.md: PASS

### 发现的问题

1. [WARN] 缺少 CLAUDE.md
   -> 修复: 在项目根目录创建 CLAUDE.md

### 总结

- PASS: 8 项
- WARN: 1 项 (非阻塞)
- FAIL: 0 项
```

## 核心原则

1. **默认只读诊断** -- 不带 `--fix` 时只报告状态
2. **分级报告** -- PASS/WARN/FAIL 三级，WARN 不阻塞正常使用
3. **安全修复优先** -- `--fix` 仅执行仓库内已支持、可逆且低风险的修复

## 自动修复模式 (--fix)

使用 `--fix` 时，当前会自动执行以下修复操作：

| 问题                  | 自动修复动作                        | 风险 |
| --------------------- | ----------------------------------- | ---- |
| REPO_MAP.md 缺失      | 调用 RepoIndexer 生成 `REPO_MAP.md` | 安全 |
| hooks/hooks.json 缺失 | 生成最小默认 hooks 配置             | 安全 |
| Claude 组件缺失       | 调用 installer 补齐缺失组件         | 安全 |

以下问题**不会自动修复**（需人工确认）：

- Node.js 版本过低（需要手动升级）
- CLAUDE.md 缺失（需要根据项目内容生成）
- node_modules 缺失（当前只提示，不自动执行 `npm install`）
- 任何需要删除文件、覆盖用户配置或修改 Git 状态的操作

## /auto 自动编排

`/auto` 的 PHASE 1 DISCOVER 会复用同一套诊断结果，并默认保持只读扫描。

显式修复（例如 `doctor --fix`）只使用上述安全修复能力，不会执行依赖安装、删除文件或覆盖用户内容。

## 输出

诊断结果会额外包含：

- `fixRequested`：是否请求自动修复
- `fixesApplied`：已成功应用的修复
- `fixesSkipped`：尝试但跳过/失败的修复
- `changedFiles`：本次修复实际变更的文件

这部分结果既可供 CLI 输出，也可被 `/auto` 后续阶段消费。

## 与 /auto 集成

DISCOVER 阶段产出的 `doctorResult` 会继续传递到后续 PHASE：

- PHASE 2 可消费 `recommendedActions`
- 工作流结果会包含 `doctorResult`
- 自动修复产生的 `changedFiles` 会合并进当前工作流上下文

因此 `doctor` 不只是独立命令，也可以被 `auto` 作为前置健康诊断能力复用。

## 不会做的事

- 不自动执行 `npm install`
- 不删除文件
- 不覆盖已有用户文件
- 不修改 Git 工作区状态
- 不执行需要人工判断的高风险修复

这样可以保证 doctor 既能自动修一点"低成本高收益"的问题，又不会越权。

## 适用场景

- 新项目首次运行 `/auto` 前的环境诊断
- 安装 Auto CLI 后检查 Claude 组件是否缺失
- 显式 `/auto:doctor --fix` 时补齐代码地图或默认 hooks
- 在完整工作流开始前做最小健康检查

这使 `doctor` 成为 `/auto` 的前置守门与自愈能力，而不是单独的诊断工具。

## 示例

```bash
/auto:doctor
/auto:doctor --fix
```

`/auto` 在进入 PHASE 1 时默认复用同一套诊断逻辑；只有显式 `--fix` 才会执行安全修复。

## 实现约束

修复逻辑复用现有文件和工具；不引入新的重型修复子系统。

## 验收

- `/auto:doctor --fix` 可执行安全修复
- `/auto` PHASE 1 默认保持只读诊断
- 显式修复时结果中能看到 applied/skipped/changedFiles
- 不执行高风险操作
- 后续 PHASE 可消费 doctorResult
