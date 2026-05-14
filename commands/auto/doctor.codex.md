---
name: auto:doctor
description: Codex 版环境诊断 - 检查 Codex prompt/skills 安装、项目结构和 .auto 工作流落盘前提
---

# /auto:doctor — Codex 环境诊断

> 目标：确认 Codex 侧 `/auto` 真正能跑起来，而不是只看见一个 prompt 文件。

---

## 使用方式

```bash
/auto:doctor
/auto:doctor --fix
```

默认只读。只有显式 `--fix` 时，才允许做低风险补齐。

---

## 检查范围

### 1. 基础环境

检查：

- `node --version`
- `npm --version`
- `git --version`

### 2. Codex 安装状态

检查以下路径是否存在：

- `~/.codex/prompts/auto.md`
- `~/.codex/prompts/auto/`
- `~/.codex/skills/`

重点确认：

- `/auto` 主 prompt 已安装
- Codex skills 数量是否合理
- 关键 skills 是否存在
  - `workflow-patterns`
  - `systematic-debugging`
  - `test-plan-writer`
  - `requirement-clarifier`
  - `skill-evaluator`

### 3. 项目上下文

检查：

- `README.md`
- `CLAUDE.md`
- `REPO_MAP.md`
- `.auto/`
- `package.json` / `pom.xml` / `go.mod` / `requirements.txt` / `Cargo.toml`

### 4. 工作流前提

检查：

- `.auto/cache/capability-snapshot.json`
- `.auto/cache/`
- `.auto/runs/`
- `.auto/insights/`
- `.auto/feedback/`
- `.auto/memory/`

如果存在 `.auto/runs/` 和 `scripts/validate-run-completeness.js`，还要检查最近一个 run 的完整度：

- 完整 → `PASS`
- 缺少基础工件但仍可读 → `PARTIAL`
- run 目录不存在或关键工件严重缺失 → `FAIL`

### 5. 依赖状态

如果是 Node 项目，检查 `node_modules` 是否存在。
其他技术栈则只给出对应依赖目录或锁文件状态，不做越权安装。

---

## `--fix` 允许做的事

仅允许低风险修复：

- 重新执行安装脚本，补齐 `~/.codex/prompts` / `~/.codex/skills`
- 在缺失时创建 `.auto/` 目录骨架
- 在缺失时创建空的 `.auto/insights`、`.auto/feedback`、`.auto/cache` 子目录

不允许自动做的事：

- 自动安装业务依赖
- 自动删除文件
- 自动覆盖用户已有 `.auto` 内容
- 自动生成带虚假内容的 run 工件

---

## 输出格式

至少输出以下分组：

```markdown
## Codex 环境诊断

### 基础环境

- Node.js: PASS / WARN / FAIL
- npm: PASS / WARN / FAIL
- git: PASS / WARN / FAIL

### Codex 安装

- ~/.codex/prompts/auto.md: PASS / FAIL
- ~/.codex/prompts/auto/: PASS / WARN
- ~/.codex/skills/: PASS / FAIL
- 核心 skills: PASS / PARTIAL / FAIL

### 项目上下文

- README.md: EXISTS / MISSING
- CLAUDE.md: EXISTS / MISSING
- REPO_MAP.md: EXISTS / MISSING
- .auto/: EXISTS / MISSING

### 工作流前提

- capability snapshot: OK / STALE / MISSING
- cache: OK / MISSING
- runs: OK / MISSING
- insights: OK / PARTIAL / MISSING
- feedback: OK / PARTIAL / MISSING
- latest run completeness: PASS / PARTIAL / FAIL / UNKNOWN

### 建议

- 只列真正阻断 `/auto` 效果的问题
```

---

## 成功标准

- 能区分“Codex 没装好”和“项目上下文不完整”
- 能区分“能力快照缺失/过期”和“Codex runtime 缺失”
- 能识别“Codex 装好了，但最近一次 `/auto` run 闭环不完整”
- 诊断结果直接服务于 `/auto` 的可用性
- 不再把 Claude 专属目录当成 Codex 的必备条件
