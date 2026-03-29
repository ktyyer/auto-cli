---
description: 更新代码架构地图 + 生成 REPO_MAP.md 持久化符号表
---

# 更新代码地图

分析代码库结构并更新架构文档 + REPO_MAP.md：

## 步骤

### 1. 检测技术栈

```
Glob("package.json") / Glob("pom.xml") / Glob("go.mod") / Glob("requirements.txt")
→ 确定语言和框架
```

### 2. 提取符号表

根据技术栈选择提取方式：

```bash
# 优先使用 tldr（如已安装）
tldr structure . --lang [lang]

# 备选：ast-grep
ast-grep --pattern 'class $NAME { $$$ }' --lang [lang] src/ -l

# 备选：grep 提取
# Java: grep -rn "^public (class|interface|enum)" src/
# TS/JS: grep -rn "^export (class|interface|function|const)" src/
# Python: grep -rn "^(class |def )" src/
# Go: grep -rn "^(func |type )" src/
```

### 3. 生成 REPO_MAP.md（根目录）

```markdown
# REPO_MAP.md

> 自动生成于 [日期] | 技术栈: [lang] + [framework]
> 运行 `/auto:update-codemaps` 更新此文件

## 技术栈
- 语言: [lang]
- 框架: [framework]
- 构建: [build tool]

## 模块结构

### [模块名]
| 符号 | 文件 | 类型 | 描述 |
|------|------|------|------|
| `ClassName` | path/to/file | class | 一句话描述 |

## 关键依赖关系
- A → B → C

## API 端点速查（如有）
| 端点 | 方法 | 处理器 | 功能 |
|------|------|--------|------|
```

### 4. 生成详细代码地图（docs/codemaps/）

```
docs/codemaps/
  architecture.md  — 整体架构
  backend.md       — 后端结构
  frontend.md      — 前端结构
  data.md          — 数据模型
```

### 5. 漂移检测

- 如果 REPO_MAP.md 已存在，对比变更百分比
- 变更 > 30% → 请求用户确认后再覆盖
- 添加时效性时间戳

### 6. 输出

```
✅ REPO_MAP.md 已更新（[N] 个符号，[M] 个模块）
📁 docs/codemaps/ 已更新
📊 与上次差异: [X]%
```

## REPO_MAP.md 的作用

`/auto` PHASE 1 会优先读取 REPO_MAP.md：
- 如果存在 → 直接加载，跳过大部分项目扫描（节省 30-50% token）
- 如果不存在 → 正常执行完整扫描
- 建议在项目初始化后运行一次 `/auto:update-codemaps`

## 与 /auto:update-docs 的关系

`/auto:update-docs` 的功能已整合到本命令。除代码地图外，本命令同时处理：

1. **脚本参考表** — 从 package.json 的 scripts 部分生成
2. **环境变量文档** — 从 .env.example 提取
3. **过时文档检测** — 查找超过 90 天未修改的文档

使用 `/auto:update-codemaps` 替代 `/auto:update-docs`。
