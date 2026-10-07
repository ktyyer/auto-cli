# /auto 阶段参考

只读当前阶段需要的章节。核心不变量见 [workflow-contract.md](workflow-contract.md)；安装工具用法见 [host-adapters.md](host-adapters.md)。
这些章节是阶段细则，不是新的 slash command 或另一层工作流。

## SCAN

1. 去掉 /auto 或 /prompts:auto 前缀；命令余文与本会话有效任务合并，状态询问不取消原目标。
2. 确認运行环境、真实工具、目录、Git 和项目测试命令。项目的 AGENTS.md / CLAUDE.md / constitution 是约束；REPO_MAP 与缓存作为线索。
3. 保存完整 git status --porcelain=v1（包含既有修改），查当前失败与近期相关变更，定位业务符号和调用链。
4. 读取 skills 的名称/描述及相关 insight 摘要，命中后再读正文；缓存缺失或失效时直接查真实文件，不阻断、不假装缓存可靠。
5. 对相关经验记录 notes.relevantInsights，保留来源；历史反馈只有有效观测满足契约时才参与路由。未知成功率不加权。
6. 形成 RouteDecision：strategy、complexity、riskLevel、assurance、primaryAgent、skills、verifyGates、next，以及工作区基线。
7. 选定 run 真源并写 Route/Plan 骨架；先向用户展示简版 RouteDecision / Plan，再进入深读和修改。若宿主要求工具前 commentary，使用 provisional 规划卡片并随后核实。

无需因 /auto 入口而全量扫描所有源码、加载所有技能或重建未使用的缓存。tree-sitter 不可用就用 rg / 语言现有工具；不要安装新依赖仅为生成代码地图。
探索也应有证据。Codex 要求完整最小闭环；Claude 的只读短答可只保留必要计划与依据，已有 .auto 时仍落盘真源。

## PLAN

- 用用户原话和独立业务来源描述 desired behavior、不变量、范围和验证条件；影响正确性的未知项不能悄悄当已确认需求。
- 写 Micro QuestMap 或完整 QuestMap。每关至少 questId/objective/ownerAgent/acceptance，复杂任务补依赖、touchFiles、失败恢复；实现/重构四项条件字段见共享契约。
- 先检查同模块风格、真实测试命令和邻近实现；按 unit/integration/e2e/regression/edge/security 六维决定适用测试。配置/文档微调可用结构、引用和安装验证，不凑代码测试。
- 关键未决产品选择才用 requirement-clarifier；架构取舍才用 brainstorming；已授权并有依据的实现选择直接记录理由。
- 多角度方案仅在高复杂度且权衡不清或用户明确要求时采用 plan-ensemble；先独立立论，再以证据处理分歧，不按代理数量决定正确。
- 专家任务明确 owner、读写范围、独立验收、失败反馈；并行代码使用同基线隔离工作树。主代理只在集成验证后接受结果。
- 将任务外既有修改列为不变量；快照是额外恢复材料，不能代替归属保护。

## EXECUTE

1. 核对本关 objective、独立 acceptance、触及文件和基线；不要从缓存猜真实实现。
2. 留下故障/差异基线。修复先最小可复现；重构先现有回归保护。
3. 做可审查的小步修改，遵循现有命名/错误处理/注释/格式。业务实体来源需沿调用链确认。
4. 运行相关验证，保存测试命令自身结果；如验证不可执行，记录原因与下一步，不能写 pass。
5. 检查 diff 是否仍服务原目标。授权内必要 scope-expand 更新计划，未授权目标变化才澄清。
6. 有失败证据或范围偏移时做 self-critique；疑点先查证，不能凭空“改进”已通过实现。
7. 产出 QuestResult：id/runId/correlationId/status/summary/questId/attempt/ownerAgent/changedFiles，加输出与验证指针。失败补 failureContext.recommendedNext 与 retry。
8. 到达失败上限或连续无进展，调查根因/换候选，不靠反复运行相同命令刷绿；暂停/中断保留续接记录。

任务状态：pending/running/completed/failed/skipped/blocked，以及兼容 v2 的 succeeded/cancelled/suspended。任务完成与验证通过分开。

## VERIFY

先沿 A/B/C 三链复核共享契约，再取 quality-gates 中适用的门禁定义。保留现有 taxonomy，不为新增能力堆新 gate 名称。
探索关注 analysis、实际 skill 应用、knowledge-reuse、clean-state；修复/实现/重构根据变更加入 test/build/lint/security/adversarial/production-readiness 等。
实现/重构检查 production-governance 与协议；coverage、容量和运维仅在适用时检查。self-critique 无触发信号可说明理由为 not_applicable。
项目真实格式与静态检查优先于通用量化建议；不要用文件行数、自评分、声明的覆盖率代替正确性判断。
测试除 exit code 外还查发现/执行/skip/回归；collector 支持的 Node test adapter 用 installed tooling 保存本地执行证据，其他框架保留原始命令与报告并明确未适配部分。
严格 test pass 必须引用有效、非空且新鲜的记录。记录来源是本地可写时，只声称本地一致性；不得据此升级为可信外部裁判。
强化任务对独立业务依据作显式结论；业务假设未消解则 warning/未验证，不因实现和自写测试同绿放行。

对抗按风险覆盖：边界、并发、幂等、异常、注入、容量。隔离副本里做 mutation，原工作树不变；故意破坏后必须变红，再在最终未破坏产物上复验变绿。
变异不改变目标行为或等价时，不把“没红”误报为测试漏洞；也不从全部 mutants 被杀推断业务完整。
缺测试补测试、错误断言先证明期望错误、实现错回 EXECUTE、环境错修环境或明确阻塞。必要验收没完成不得成功。
完成后检查完整 Git 差异和既有修改是否保留。clean-state 表示交付状态可解释，不要求把用户未提交修改清掉。

## SUMMARIZE

无论成功还是失败都输出：行为变化、实际修改、验证命令/证据、未验证项与风险、交付状态及下一步。
Codex 使用 RouteDecision / Plan / Execution / Findings / Verify / Learn 五段入口格式；可简短，但不要让用户翻 commentary 才能知道结果。
只报告实际安装、调度、测试与发布；schema 完整只证明结构。没有对照数据不声称编码提速、零缺陷或绝对最优。

## LEARN

- 按 knowledge-management 的契约产出 LearnCard，保留 source/category/scope/confidence；无新增知识不编造结论，允许明确的无新增说明。
- 先查重和矛盾，再合并到 insights；category=trap 进入相应 traps。分发时检查真实写入；在 LEARN 收口，不在尚未产生卡片的 VERIFY 阶段提前判失败。
- 实际调用的 skills/agents 按 runId 幂等更新 observations，保留旧元数据；unknown 不作失败、不进成功率分母。计数不是因果收益。
- 如工具可用，针对明确 runId 生成 metrics 与运行完整性检查；耗时/token等缺遥测为 null。
- 保留可续接摘要与来源。旧 run 归档必须核对路径与依赖，不为了收尾移动/删除无关历史。
- 共识、论文、经验均有适用范围；未经当前任务验证的建议保持假设标签。

## 定时或持续任务

只有明确 interval / 持续巡检目标才加载 loop-engineering。普通“直到完成”是当前任务持续执行，不默认10分钟、300美元或72小时调度。
登记 scheduler 支持证据、任务ID与生命周期；创建成功后才写 scheduled。会话等待不等于持久任务。
每轮保留同一 loopId 和累积预算；没有用户预算不杜撰支出授权。收敛与停止尊重用户目标，不能自动 commit 或回退他人修改。
