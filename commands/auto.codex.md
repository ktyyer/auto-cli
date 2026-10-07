---
name: auto
description: Codex 的 /auto 单入口：任务契约、按需技能、实际验证与知识闭环
---

# /auto — Codex 入口

/auto <任务> 与 /prompts:auto <任务> 等价；不是普通聊天前缀。保持用户原目标、后续纠正和已授予的权限。

## 首屏与加载顺序

1. 工具执行前，第一条 commentary 必须包含简版 **RouteDecision** 和 **Plan**；可标 provisional，说明策略、复杂度、拟用技能、验证及拟读写范围。
2. 最小 preflight 核对项目 AGENTS.md / CLAUDE.md / .auto/constitution.md、REPO_MAP、相关能力索引、Git 完整基线和真实验证命令，再更新规划。
3. 读取 **production-governance/references/workflow-contract.md** 一次，遵循其中共享执行契约；按当前 Phase 读取 **workflow-phases.md** 相应章节。
4. 路径优先本仓库 skills/production-governance/references/；安装后从当前 prompts/ 目录的宿主根查 skills/production-governance/references/。工具路径与平台边界查 **host-adapters.md**。
5. 已有 .auto 的项目立即创建 runId/correlationId，写最小 RouteDecision / QuestMap。读过的内容复用，只在实际命中时加载 skill 正文。

不得先给 Findings 再补 Route/Plan；若发现遗漏，补齐本轮真实计划与已执行/待执行证据，不伪造历史步骤。
入口引用缺失是安装问题；不得默默回退为没有这些约束的普通问答。

## 路由与任务边界

- strategy：explore / fix / implement / refactor；另外记录 complexity / riskLevel / assurance / skills / verifyGates。
- executionMode 默认 single-executor。已授权且有收益的独立任务才分派；使用当前暴露的工具，不依赖 Claude agents/ 文件或 hooks。
- Micro Plan 也要写目标、验收、拟改文件与验证方式。实现/重构含独立业务依据、不变量、假设、备选取舍、风险与测试计划。
- 先查会话/仓库消除歧义，授权范围内必要可逆动作自主继续；不能仅因某个词模糊或存在两种实现就重新请求选择。
- 原始工作区修改是保护基线；scope-expand 可在授权目标内说明并继续，真正改变需求才澄清。

**容量假设** <!-- capacity-contract: assumption -->：数据/集合/I/O 任务先考虑数据量 ×100 或合理上限，识别无界查询；无关则 capacity: not-applicable 并说明。

## 六阶段最小闭环

| Phase     | 当前动作与产物                                                      |
| --------- | ------------------------------------------------------------------- |
| SCAN      | 核对用户目标、真实能力、业务符号、Git 基线和既有失败；RouteDecision |
| PLAN      | 先确定独立验收与恢复边界，再拆任务；QuestMap / Micro Plan           |
| EXECUTE   | 保留失败证据，小步修改，立即运行适用验证；QuestResult               |
| VERIFY    | 三链复核与适用 gate，检查执行计数/退出码/最终产物状态；VerifyReport |
| SUMMARIZE | 成功或失败均完整告知，不把缺测写成通过；index.md                    |
| LEARN     | 有依据的新经验查重分发，feedback 幂等；无新知识明确说明             |

每个阶段只读 workflow-phases.md 对应章节；协议字段真源为 protocol-validator / run-protocol.js，不另造 schema。
本次 run 工件的5类对象使用JSON；索引保留人类摘要。明确目标项目执行已安装校验器，不能在宿主安装目录误判当前项目。
测试允许合法变化；空集、全skip、旧证据、仅自评分不建立 pass。evidence 本地可写只证明一致性，不等于外部可信执行。
缺证据禁止成功声明，但允许失败总结；不模拟不存在的 Stop hook 或无限反复验证。
普通“直到完成”不创建定时任务；明确间隔/持续巡检才加载 loop-engineering，创建成功后才报告后台任务。

**容量探针** <!-- capacity-contract: probe -->：以数据量 ×100 或声明边界验证无界查询、全量累积、分页/流式/背压与资源上限；无关则 capacity: not-applicable，有关但缺测则 warning/skipped。

## 对用户的完整结果

第一条完整结果采用以下固定标题，内容可简短：

```markdown
## RouteDecision

## Plan

## Execution / Findings

## Verify

## Learn
```

Route 至少包含策略、复杂度、skills、verifyGates；Plan 写目标与读写/验证范围；Verify 列真实命令与未测项；Learn 指明run工件和实际沉淀。
即使只读检查也走最小闭环。进度 commentary 不代替最终完整结果。若部分未完成，如实报告原因与下一步。
不自动提交/推送；已授权的部署、卸载重装等在验证后继续完成，不重复索要许可。
