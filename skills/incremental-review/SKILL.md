---
name: incremental-review
description: 增量代码审查 — 根据当前 run 的已确认改动做必要评审。当用户希望会话结束前 review、降低评审成本或提交前审查时使用。已绑定的 PostToolUse 可辅助累积 dirty 清单；当前执行者负责核对最终 diff 与验收，不能把 Stop 提示视为自动完成评审。
tags: [code-review, incremental, post-tool-use, stop-hook, dirty-files, ci-light, methodology]
---

# Incremental Review — 增量代码审查

> 借鉴 [O'Reilly: Auto-Reviewing Claude's Code](https://www.oreilly.com/radar/auto-reviewing-claudes-code/) 与 Nick Tune (Medium) 的 Stop-hook critical-reviewer 模式。
> 核心原则：按当前 run 的实际变更确定评审范围，与 VERIFY gate 体系互补。dirty 清单是辅助记录，最终范围还需核对 Git diff、用户既有修改与必要的调用关系。

## 激活摘要

**何时激活**：

- 用户希望 Claude Code 在会话结束前自动跑一遍代码审查
- 当前任务的改动需要独立视角或最终 diff 核对
- 团队规范要求每次提交前必须经过 review

**检查清单**：

1. 当前 run、宿主、角色和 prompt/绑定代际是否已确认？不能选择最近修改的 run。
2. `.auto/runs/<runId>/dirty.txt` 与实际 diff 是否一致？未归属的 hook 不代表没有改动。
3. Review 结果是否落盘到 `.auto/runs/<runId>/incremental-review.md`？
4. 发现的严重问题是否修复并核验，或在结果中明确标记尚未完成？

**机制三件套**：

- **已归属改动累积**：确认 session/worktree/actor/prompt 后，将 Write/Edit 的 `tool_input.file_path` 追加到绑定 run 的 `dirty.txt`（去重）。字段缺失、失效或冲突时保持 `unattributed`。
- **最终 diff 核对**：当前执行者按变更风险做评审。只有已有委派授权且存在独立子任务时才调用可用 reviewer；不从 Stop 自动拉起团队。
- **结果落盘**：报告记录问题、修复和实际验证。Stop 提示不能替代评审，也不能自动把报告记为 passed。

**反模式（禁止）**：

- 无依据地扩大到全项目，或仅因文件不在 dirty 清单就跳过必要的依赖检查
- 只凭 hook 退出码或提醒，声称已完成 review / 已阻止所有严重问题
- 按目录 mtime 选择 run、共用跨 run 清单，或把缺少 `agent_id` 当作 controller 证明

## Hook 接线与显式回退

实际接线以 [hooks.json](../../hooks/hooks.json) 为准，身份登记见 [Claude 宿主适配](../production-governance/references/host-adapters.md)。安装时沿用受管配置，不复制选择“最新 run”的 shell 模板。

```text
node <helper> record --root <project> --binding <bindingId> --generation <generation> --proof <controller-proof> --kind dirty --file <changed-file>
```

占位符替换为实际参数；`<helper>` 是仓库或安装后的 `hooks/lib/run-bindings.cjs`。controller 在已绑定后可显式记录自己的改动；可用时补 `--prompt <bound-prompt-id>`。无可靠身份时直接按已明确的 run 路径保存人工核对结果，不伪造 receipt 或宿主字段。

已登记 worker 的原生 tool 事件仍需有效的 agent/prompt 证据。worker 不触发主 run 的 Stop 汇总、不读写 controller pending；控制器的 proof 不传给 worker。当前没有安装自动 reviewer Stop 链，不能承诺一个提示 hook 会执行审查或阻止会话结束。

## 与现有 gate 的关系

| Gate / 机制            | 触发时机                 | 关系                             |
| ---------------------- | ------------------------ | -------------------------------- |
| 17 类 VERIFY gate      | 按当前任务风险选择       | 关注适用契约、独立期望与执行证据 |
| **incremental-review** | **冻结本次最终 diff 后** | **核对变更范围、正确性与维护性** |
| reviewer               | 有授权且确有独立任务时   | 可选执行者；默认由当前执行者完成 |
| TDD Guard              | PreToolUse               | 文件级别守卫                     |

## 何时不用

- 低影响、可逆的小改动，已有必要核对足以满足验收
- 探索策略（无代码变更）
- 已有 PR 评审流程的项目（避免重复）

## 参考

- [Auto-Reviewing Claude's Code — O'Reilly](https://www.oreilly.com/radar/auto-reviewing-claudes-code/)
- [Stop-hook critical-mindset review — Medium / Nick Tune](https://medium.com/nick-tune-tech-strategy-blog/auto-reviewing-claudes-code-cb3a58d0a3d0)
