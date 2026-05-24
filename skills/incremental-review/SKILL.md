---
name: incremental-review
description: 增量代码审查 — 只审本次会话改动的文件而非全量项目。当用户希望「会话结束前自动跑一遍 review」「降低 review 成本」或「确保每次提交前已被审查过」时使用。配合 PostToolUse 累积 dirty 清单与 Stop hook 触发 code-reviewer subagent，实现「只审改了的，没改的跳过」。
tags: [code-review, incremental, post-tool-use, stop-hook, dirty-files, ci-light, methodology]
---

# Incremental Review — 增量代码审查

> 借鉴 [O'Reilly: Auto-Reviewing Claude's Code](https://www.oreilly.com/radar/auto-reviewing-claudes-code/) 与 Nick Tune (Medium) 的 Stop-hook critical-reviewer 模式。
> 核心原则：**全量审太贵，全跳过又漏**。只审 dirty files，由 hook 自动驱动，与 13 个 gate 互补。

## 激活摘要

**何时激活**：

- 用户希望 Claude Code 在会话结束前自动跑一遍代码审查
- 项目已有 code-reviewer agent 但缺触发链
- 团队规范要求每次提交前必须经过 review

**检查清单**：

1. 是否存在 `.auto/runs/<runId>/dirty.json` 累积清单？（由 PostToolUse hook 维护）
2. Stop 阶段是否对 dirty 文件触发了 code-reviewer subagent？
3. Review 结果是否落盘到 `.auto/runs/<runId>/incremental-review.md`？
4. 严重问题（critical/high）是否阻塞会话结束？

**机制三件套**：

- **PostToolUse 累积**：每次 Write/Edit 完成后追加 `tool_input.file_path` 到 `.auto/runs/<latest>/dirty.json`（去重）
- **Stop 触发**：会话结束前读取 dirty 清单，仅对清单内文件传给 code-reviewer subagent
- **结果落盘**：review 报告写入 `.auto/runs/<runId>/incremental-review.md`，critical 问题以 exit 2 阻塞

**反模式（禁止）**：

- 把整个项目目录传给 code-reviewer（违背"增量"初衷）
- review 失败但不阻塞 Stop（沦为装饰，无强制力）
- dirty 清单累积跨 run 不清理（导致下次 run 审错文件）

## Hook 配置（参考模板）

将以下两段加入 `hooks/hooks.json`：

```jsonc
// PostToolUse — 累积 dirty 清单
{
  "matcher": "(tool == \"Write\" || tool == \"Edit\") && tool_input.file_path matches \"\\\\.(ts|tsx|js|jsx|java|py|go|rs)$\"",
  "hooks": [{
    "type": "command",
    "command": "#!/bin/bash\ninput=$(cat)\nfp=$(echo \"$input\" | node -e \"const d=require('fs').readFileSync(0,'utf8');const j=JSON.parse(d);process.stdout.write(j.tool_input?.file_path||'')\")\nif [ -z \"$fp\" ]; then echo \"$input\"; exit 0; fi\nlatest_run=$(ls -1t .auto/runs 2>/dev/null | head -1)\nif [ -n \"$latest_run\" ]; then\n  mkdir -p .auto/runs/$latest_run\n  echo \"$fp\" >> .auto/runs/$latest_run/dirty.txt\nfi\necho \"$input\""
  }],
  "description": "Accumulate dirty file list per run for incremental review"
}

// Stop — 触发增量 review
{
  "matcher": "*",
  "hooks": [{
    "type": "command",
    "command": "#!/bin/bash\nlatest_run=$(ls -1t .auto/runs 2>/dev/null | head -1)\nif [ -z \"$latest_run\" ] || [ ! -f \".auto/runs/$latest_run/dirty.txt\" ]; then exit 0; fi\nfiles=$(sort -u .auto/runs/$latest_run/dirty.txt | tr '\\n' ' ')\nif [ -z \"$files\" ]; then exit 0; fi\necho \"[Hook] Incremental review pending for run $latest_run:\" >&2\necho \"  Files: $files\" >&2\necho \"  Run: claude /review or invoke code-reviewer subagent on listed files\" >&2"
  }],
  "description": "Stop hook: prompt incremental review of dirty files (no auto-block; informational)"
}
```

> **注**：完整阻塞型实现需 Claude Code 支持 Stop hook 调用 subagent，目前以"提示"形式启用；阻塞版可在团队需要强制时升级。

## 与现有 gate 的关系

| Gate / 机制            | 触发时机              | 关系                                  |
| ---------------------- | --------------------- | ------------------------------------- |
| 13 个 VERIFY gate      | PHASE 4 每个 Quest 后 | 关注 contract 合规、质量门禁          |
| **incremental-review** | **Stop hook，会话末** | **关注"全局视角下的可读性 / 维护性"** |
| code-reviewer agent    | 主动调度              | 增量 review 的执行者                  |
| TDD Guard              | PreToolUse            | 文件级别守卫                          |

## 何时不用

- 单文件、< 20 行的快速通道任务（增量审本身比改动还大）
- 探索策略（无代码变更）
- 已有 PR 评审流程的项目（避免重复）

## 参考

- [Auto-Reviewing Claude's Code — O'Reilly](https://www.oreilly.com/radar/auto-reviewing-claudes-code/)
- [Stop-hook critical-mindset review — Medium / Nick Tune](https://medium.com/nick-tune-tech-strategy-blog/auto-reviewing-claudes-code-cb3a58d0a3d0)
