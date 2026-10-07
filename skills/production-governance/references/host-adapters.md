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

## Codex

- /auto 与 /prompts:auto 等价；入口先展示 provisional RouteDecision / Plan，随后写最小 run。
- 当前会话 tools schema 决定可用调用；不依赖 Claude agent 文件或 hooks，不硬编码多代理/调度 API。
- 使用可用的命令校验、执行记录和独立 CI。没有被宿主执行的拦截器时，明确为指令纪律，不承诺硬 Stop。
- 只在已授权任务及有效能力条件下分派；worker 收到局部任务，不再启动主入口。

## 安装与恢复

安装清单记录受管理文件及版本/hash；安装前保存被覆盖内容，卸载保留用户修改与非受管理资源。
工具执行失败不能报告安装成功。真实重装前先在临时 home 验证卸载/重装，再核对明确目标路径和备份。
文件hash一致证明安装内容一致；宿主注册、真实反馈和模型行为需要各自的冒烟验收，不从文件存在推导全部通过。
