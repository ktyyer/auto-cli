---
description: 环境诊断 - 检查 Node.js 版本、Claude Code 配置、依赖状态，输出健康报告和修复建议
---

# /auto:doctor -- 环境诊断

> 一键检查开发环境健康状态，发现问题时自动给出修复建议。

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
  -> 不存在 -> WARN: "缺少 CLAUDE.md，建议运行 /auto:init 生成"

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

1. **只读诊断** -- doctor 不修改任何文件，只报告状态
2. **分级报告** -- PASS/WARN/FAIL 三级，WARN 不阻塞正常使用
3. **修复建议** -- 每个问题附带具体修复命令
