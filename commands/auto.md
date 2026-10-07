---
name: auto
description: 将用户目标转为有业务依据、可验证、可续接的变更；按需加载技能和阶段细则
---

# /auto — 任务与证据闭环

SCAN → PLAN → EXECUTE → VERIFY → SUMMARIZE → LEARN。
本入口面向 Claude Code；Codex 使用 auto.codex.md。/auto 是唯一编排入口，不让用户另跑 route/doctor/learn 才能完成任务。

## 起步与共享真源

1. 去掉 /auto 前缀，保留用户原任务和会话中已有授权。状态询问不替换进行中的目标。
2. 查项目 AGENTS.md / CLAUDE.md / .auto/constitution.md、相关代码/能力索引与完整 Git 状态，形成 provisional RouteDecision 和 Plan；先向用户展示再深入修改。
3. 加载 **production-governance/references/workflow-contract.md** 一次。这是跨端共享执行契约，不在入口复制细则。
4. 当前阶段需要时才读取 **workflow-phases.md** 的对应章节；安装工具与版本限制查 **host-adapters.md**。不预加载所有 skills。
5. 解析路径：本仓库使用 skills/production-governance/references/；安装后从本命令所在 commands/ 的宿主根查 skills/production-governance/references/。文件缺失时明确缺少安装产物，不猜规则已生效。

## RouteDecision 与 Plan

- strategy：explore / fix / implement / refactor；complexity 与 riskLevel 按实际范围判定。
- assurance：routine / reinforced / high-assurance；executionMode 默认 single-executor。
- skills / verifyGates 仅选择当前任务适用项，记录选择理由与相关经验来源。
- 计划写目标、不变量、独立验收、工作区基线、touchFiles、恢复方式；实现/重构先有测试计划。
- 普通任务由当前执行者完成。只有用户授权或任务需要且宿主实际支持时分派专家，owner 负责合并验证，worker 不重启全套 /auto。
- 已授权必要可逆步骤继续推进；关键需求确实缺失才澄清。不要因“有多种写法”让用户再作选择。

**容量假设** <!-- capacity-contract: assumption -->：涉及集合、数据或 I/O 时考虑数据量 ×100 / 明确容量上限，排查无界查询；不适用则记 capacity: not-applicable 并给理由。

## 执行与验证

依共享契约完成真实定位 → 失败/基线证据 → 最小修改 → 实际验证。保护用户既有修改，必要 scope-expand 更新计划。
把最终 diff 对照原目标；合法新增/修正测试不默认视为篡改。明显削弱验收必须解释并独立验证。
验证 A 业务依据、B 实际行为、C 测试敏感度三链；空测试、全 skip、旧文件状态或模型自评分不能建立 pass。
具体 gate 按 quality-gates 选择；失败仍输出总结和下一步，不能无限阻断 Stop。self-critique 按证据触发，不编造盲点。
协议字段使用 protocol-validator；项目已有 .auto 时，本次真源是 .auto/runs/<runId>/。收口命令须明确目标项目和 runId。

**容量探针** <!-- capacity-contract: probe -->：用数据量 ×100 或声明上限验证无界查询、分页/流式/背压与资源边界；无关任务记 capacity: not-applicable，缺条件不得伪造 pass。

## 宿主与持续执行

工具、权限、hooks、后台任务和调度以本机版本与当前工具证据为准。在线文档有某功能不代表当前已启用。
“直到完成”表示继续当前任务；显式 interval 或持续巡检才加载 loop-engineering。创建成功前不称后台运行，无用户预算不自设付费授权。
不自动 commit/push；用户已授权的交付、卸载或重装在验证后完成，不重复询问。

## 收尾

报告业务变化、实际变更、验证、未验证项与交付状态；有 .auto 则补 index、VerifyReport 与有依据的 LearnCard/分发。
工作流检查通过不等于编码收益。清楚区分脚本行为、宿主集成和真实任务效果；未经对照不声称“最优”或固定提速。
