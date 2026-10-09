# 宿主适配与安装工具

共享语义见 [workflow-contract.md](workflow-contract.md)。这里的工具是安装/校验辅助，不是业务调度 runtime。
先读取当前运行时工具说明并检查版本/权限，再标 supported / unavailable / unknown。社区配置或在线新版本文档不能证明本机支持。

## 路径解析

在本仓库：共享文件位于 skills/production-governance/references/；校验工具位于 scripts/。
安装后两端技能都保持 skills/<name>/SKILL.md 与 references/ 结构：
Claude 使用 ~/.claude/skills/；Codex 使用 ~/.codex/skills/。从当前入口文件位置解析同级宿主根，不把调用项目的 skills/ 当作已安装库。
安装工具位于 <host-root>/auto-cli/scripts/，同目录层级含 package.json。工作目录始终选择用户目标项目；显式传 --root，避免误校验安装包。
优先仓库本地同版本工具，否则用安装清单对应工具；两者均不可用则人工说明协议字段检查，不能声称运行过脚本。

## 最小可执行验证

以下示例中的 <host-root>、<project>、<runId> 是需替换的参数，不是实际路径。传递独立参数，不拼接用户提供的 shell 代码。

```text
node <host-root>/auto-cli/scripts/validate-run-completeness.js --root <project> --run <runId>
```

Node 内置 test runner 的实际执行记录（当前支持 --cwd / --run-dir / --quest / --id / 可重复的 --test）：

```text
node <host-root>/auto-cli/scripts/evidence-collect.js --cwd <project> --run-dir <project>/.auto/runs/<runId> --quest Q1 --id tests-final --test tests/scripts/example.test.js
```

在 <project> 下运行 collector；--test 只给真实存在的测试文件。记录输出、测试自身退出码、真实计数和绑定状态。收集之后又改了相关文件必须重新运行。
每次采集使用新的 --id，原记录不会覆盖。绑定 cwd 文件树但排除 .git / .auto / node_modules；外部依赖与环境不在绑定范围；符号链接仅绑定链接目标字符串与模式，不读取或绑定外部目标内容。测试入口及其祖先不得经过链接。严格完整 pass 拒绝任何 skip/TODO；合法跳过需另行解释验证边界。
VerifyReport 启用 evidencePolicy: local-execution-v1，test gate 引用 evidenceRefs；其他 test gate 可明确 evidenceKind: test。严格校验采用 --require-evidence。
此 adapter 只对支持的 Node TAP 运行结果作机械判定；其他测试框架不会凭一行 passed 被接纳。不支持适配但有必要验收时标 warning/skipped并保留实际外部证据，不能写 not_applicable 掩盖缺测。
本地 evidence 文件可由同权限进程改写，保证为 local consistency。它不提供对恶意执行者的可信证明，也不能证明业务期望正确。

## Claude

- /auto 由 commands/auto.md 调度；用原生 skills/工具完成工作。后台、worktree、权限和取消均以当前实际能力为准。
- Hooks 按事件协议消费 stdin；支持的事件用结构化 additionalContext 或该事件允许的 stdout 反馈。stderr+exit0 不当作模型可见提醒。
- 不可注入模型的事件只作用户提示/记录，不承诺模型已读。无法撤销已执行动作的事件不得宣传为事前阻断。
- Stop 补救必须有界并处理 stop_hook_active；缺证据允许失败总结。不要用“存在修改”强制无限继续。
- 快照用于恢复材料，先确认创建成功与覆盖范围；恢复到独立空目录校验，不在用户树盲目 apply。用户既有修改归属保护仍优先。
- 只有本机版本和开关满足条件时才采用原生 plugin eval / skill-doctor / prompt-audit；这些不能替代独立业务验收。

### Claude 身份登记

身份由实际 SessionStart / UserPromptSubmit / SubagentStart 的 stdin 生产，`Auto host identity` 上下文里的 receipt 是本地关联凭据，不是模型猜的 ID。helper 位于仓库 `hooks/lib/run-bindings.cjs` 或 `<host-root>/auto-cli/hooks/lib/run-bindings.cjs`。使用实际独立参数，下面占位符不可原样执行：

```text
node <helper> bind-controller --root <project> --run <runId> --receipt <latest-native-receipt>
node <helper> register-delegation --root <project> --binding <bindingId> --generation <generation> --proof <controller-proof> --quest <questId> --worker-root <allowed-worktree>
node <helper> bind-worker --root <controller-project> --worker-root <actual-worker-worktree> --receipt <worker-native-receipt> --delegation <delegationId> --ticket <delegation-ticket>
```

控制器先创建 run，再用当前提示的 receipt 登记；若同一 run 接收新提示，再次登记该提示的 receipt。原生 UserPromptSubmit 不替尚未绑定的新 prompt 选择旧 run；再次显式绑定原 run 后，读取返回的非空 `pendingContext`（锁内一次性消费）。一次原生 prompt 不映射两个 run。返回的 bindingId/generation/proof 留给控制器；委派任务只携带第二条命令返回的 root/runId/questId/workerRoot/delegationId/ticket。SubagentStart 本身不能推断父任务，worker 使用自己真实事件的 receipt 完成第三条命令；不按 agent_type、最近委派或父子 session_id 恒等绑定。

`<project>/.auto/runs/<runId>/host-bindings.json` 是真源，`.auto/cache/host-sessions/` 仅放可丢弃索引、短期原生 receipt 和有限的 unattributed 诊断。路径按 canonical worktree 归一化，不合并 Git common-dir。绑定生成后才能归属；重复/失效/冲突/缺提示代际的事件不写其他 run，不回退 mtime。worker 可记录自己的 dirty/tool 观测，不能消费 controller pending 或生成主 run metrics。

第一版仅凭明确的原生生命周期角色（SessionStart、UserPromptSubmit、Stop）及已登记的 session/prompt 恢复控制器；**通用 tool/compact 事件缺 agent_id 时不据此推断 controller**。未获宿主可靠角色证明的该自动模式为 `unattributed`，通过显式控制器记录保留必要结果：

```text
node <helper> record --root <project> --binding <bindingId> --generation <generation> --proof <controller-proof> --kind dirty --file <changed-file>
node <helper> record --root <project> --binding <bindingId> --generation <generation> --proof <controller-proof> --kind continuity
node <helper> rebuild --root <project>
node <helper> close --root <project> --binding <bindingId> --generation <generation> --proof <controller-proof>
```

显式 record 以 bindingId/generation/proof 确认当前 run；可用时补 `--prompt <bound-prompt-id>`，若提供则必须匹配绑定，不得填造。显式 dirty 接受工作区内的合法文件路径（含配置、纯文本和已删除文件），缺路径或含控制字符时报错，实际记录后才返回 recorded。原生事件缺少必要 prompt 字段仍为 `unattributed`。worker 恢复后用新 SubagentStart receipt 重做原委派握手，只有相同已登记 worker 才能追加新 prompt；不能将旧 ticket 改派其他 worker。

明确登记的 continuity 提醒和宿主 compact 提醒分别标记来源；PreCompact/PostCompact 不能保存模型尚未落盘的内容，验收需检查实际 pending 文件、一次性消费与后续上下文。pending 按 worktree/session/run/binding/generation 隔离并在锁内消费，旧项目级 hook-context.json 不读取也不删除。resume/compact 只恢复唯一有效绑定；startup/clear/fork 使本 session 旧绑定失效，不能继承旧 run。未知 source 不恢复。

缓存丢失后同 worktree 从 run 真源重建；跨 worktree 索引必须显式 `rebuild --root <worker-worktree> --owner-root <controller-project>`，没有已验证关联就不自动搜索别的目录。失效/遗失的未消费 receipt 由新原生事件重建，不伪补历史身份。锁冲突保持未知，不擅自抢删旧锁。该 helper 提供同权限本地一致性，不是防恶意模型的安全隔离。

容量边界为一次解析最多扫描 2048 个 run 目录项与 16 MiB 绑定数据、每 run 256 个绑定/委派、单绑定最多 256 个 prompt、JSON/dirty 文件 1 MiB、可选工具日志 16 MiB；超过上限给出诊断，不截断或归属到其他 run。未消费 receipt 只接受过去 24 小时内的原生事件；已登记的 run 真源不因 receipt 过期而丢失。

可选 `hooks/lib/log-metrics.sh` 同样走此解析器，仅追加 `host-tool-events.jsonl` 原始工具观测（包含角色、binding、prompt、tool_use_id；未知 tokens/cost 为 null），不新建或覆盖 run 的业务 metrics.json。非原生任务或字段缺失不计为已成功调用；完整宿主成本仍需独立观测记录。

## Codex

- /auto 与 /prompts:auto 等价；入口先展示 provisional RouteDecision / Plan，随后写最小 run。
- 当前会话 tools schema 决定可用调用；不依赖 Claude agent 文件或 hooks，不硬编码多代理/调度 API。
- 使用可用的命令校验、执行记录和独立 CI。没有被宿主执行的拦截器时，明确为指令纪律，不承诺硬 Stop。
- 只在已授权任务及有效能力条件下分派；worker 收到局部任务，不再启动主入口。

## 安装与恢复

安装清单记录受管理文件及版本/hash；安装前保存被覆盖内容，卸载保留用户修改与非受管理资源。
工具执行失败不能报告安装成功。真实重装前先在临时 home 验证卸载/重装，再核对明确目标路径和备份。
文件hash一致证明安装内容一致；宿主注册、真实反馈和模型行为需要各自的冒烟验收，不从文件存在推导全部通过。
