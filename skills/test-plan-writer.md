---
name: test-plan-writer
description: 严谨测试计划生成 — 在编码前先产出测试维度矩阵（unit/integration/e2e/regression/edge-case/security），把"怎么测"变成可执行 quest 列表交给 tdd-guide / e2e-runner / verification 执行。当策略=实现或重构时强制注入；用户提到测试计划/test plan/QA strategy/质量保障/验收标准时也必须加载。即使用户没说"测试计划"，新功能/重构都要先有 test plan 才动代码。
tags: [test-plan, tdd, qa, coverage, quality, methodology]
---

# Test Plan Writer — 测试计划方法论

> 借鉴 [catlog22/Claude-Code-Workflow](https://github.com/catlog22/Claude-Code-Workflow) 的 `workflow-tdd-plan` skill 与高频 skill `pr-description-writer` 思路。
> 核心原则：**先想清楚怎么测，再想怎么写。** 没有测试计划的实现都是赌博。

## 快速使用

```
/auto 实现一个秒杀订单接口
/auto 重构购物车的库存校验逻辑
/auto 帮我写这个支付回调的测试计划
```

---

## 使用时机

**必须加载**：

- `RouteDecision.strategy = 实现`（任何新功能）
- `RouteDecision.strategy = 重构`（任何架构级改动）
- 用户显式提到"测试计划 / test plan / QA strategy / 验收标准"
- 改动涉及对外契约（API / 事件 / DB schema）

**按需加载**：

- `RouteDecision.strategy = 修复`：仅当根因不确定或影响面大时
- `探索`：通常跳过

**不要触发**：

- 文档修改、格式化、注释更新
- 配置文件单值修改

---

## 激活摘要 (Activation Digest)

**检查清单** (checklist):

- [ ] 6 维矩阵: unit / integration / e2e / regression / edge-case / security
- [ ] 每个维度: 验证目标 + 工具/Agent + 预期结果 + 必需性标记
- [ ] 测试优先级: P0(阻塞上线) > P1(重要) > P2(可延后)
- [ ] 边界值覆盖: 空值/null/零值/极大值/特殊字符/并发
- [ ] 产出 test-plan.md 作为 quest-designer 上下文输入

**硬约束** (constraints):

- 实现/重构策略必须先有 test plan 再动代码
- 涉及对外契约(API/事件/DB schema)必须有 regression 测试
- 验收标准必须用可执行命令（`npm test -- --grep "X"`），不用"功能正常"

**输出模板** (output):

- 6 维矩阵表 → 测试优先级排序 → 可执行测试命令列表

**反模式** (anti-patterns):

- 只关注 happy path 忽略边界值 → 生产事故
- test plan 写成"功能正常即可" → 不可验证

---

## 核心流程（3 步）

### 第一步：6 维测试矩阵

针对每个变更点，按 6 维度产出测试条目：

| 维度            | 验证目标                            | 工具 / Agent              | 必需性        |
| --------------- | ----------------------------------- | ------------------------- | ------------- |
| **unit**        | 单个函数/类的行为正确               | Vitest / Jest / JUnit     | 实现/重构必须 |
| **integration** | 跨模块协作 / 数据库 / 外部 API mock | 测试框架 + testcontainers | 涉及 IO 必须  |
| **e2e**         | 关键用户旅程端到端                  | Playwright                | 涉及 UI 必须  |
| **regression**  | 既有功能不被破坏                    | 现有测试套件全跑          | 重构必须      |
| **edge-case**   | 边界值 / 空值 / 极端输入            | 单元 + 集成               | 全部必须      |
| **security**    | 鉴权 / 注入 / 越权 / 敏感数据       | security-reviewer         | 安全敏感必须  |

### 第二步：每维写「最小可执行」测试条目

每条测试条目必须满足：

- **可执行命令**（如 `npm test -- --grep "X"` / `mvn test -Dtest=ClassNameTest#method`），不能是"测试 Y 功能"这种模糊话
- **明确的输入与期望输出**
- **覆盖的代码 / 接口路径**
- **失败信号**（什么算挂了）

不允许出现「正常情况下应该 OK」「测试通过即可」之类弱描述。

### 第三步：产出 test-plan.md

强制结构化输出，写入 `.auto/runs/<runId>/test-plan.md`：

```markdown
# Test Plan

## 变更范围

- 文件 A / 函数 X
- 文件 B / 接口 Y

## 测试矩阵

### unit

- [ ] T-U1: <描述>
  - cmd: `npm test -- --grep "..."`
  - 输入: ...
  - 期望: ...
  - 覆盖: <文件:函数>

### integration

- [ ] T-I1: ...

### e2e

- [ ] T-E1: ...

### regression

- [ ] R-1: 跑既有 `npm test` 全套，0 失败

### edge-case

- [ ] T-EC1: 空输入 / null / 极大值

### security（如适用）

- [ ] T-S1: 未授权访问返回 401
- [ ] T-S2: SQL 注入尝试被拦截

## 跳过的维度（带理由）

- e2e：本次为内部工具，无 UI

## Quest 映射

| Test ID | 执行 Agent | 所属 Quest |
| ------- | ---------- | ---------- |
| T-U1    | tdd-guide  | Q2         |
| T-E1    | e2e-runner | Q4         |

## 覆盖率目标

- unit + integration ≥ 80%（rules/testing.md 要求）
```

---

## 与 PHASE 协议的对接

每个 test 条目对应一个 `Quest`，按以下规则插入到 QuestMap：

| 测试维度    | 落到 Quest 的方式                                   |
| ----------- | --------------------------------------------------- |
| unit        | 与对应实现 quest 配对（红 → 绿 → 重构）             |
| integration | 单独 quest，ownerAgent: tdd-guide                   |
| e2e         | 单独 quest，ownerAgent: e2e-runner                  |
| regression  | VERIFY 阶段 gate=test 必须包含                      |
| edge-case   | 注入到对应实现 quest 的 acceptance                  |
| security    | 安全敏感时单独 quest，ownerAgent: security-reviewer |

---

## 反模式

| 反模式                      | 后果                         |
| --------------------------- | ---------------------------- |
| 测试计划只写"功能正常即可"  | 等同没写，VERIFY 无法判定    |
| 跳过 regression 维度        | 重构变拆毁现有功能           |
| edge-case 只列"输入异常"    | 不具体 = 不会真的测          |
| 把"手动验收"当 test 条目    | 不可重复，下次回归靠运气     |
| 测试计划与实现 quest 不对齐 | tdd-guide 拿不到对应的红测试 |

---

## 与 auto-cli 集成

| 注入时机             | 说明                                                                   |
| -------------------- | ---------------------------------------------------------------------- |
| PHASE 2 PLAN         | 策略=实现/重构时，**先于** quest-designer 调用本 skill 产 test-plan.md |
| PHASE 2.5 Quest 设计 | quest-designer 把 test-plan.md 的条目转为对应 Quest                    |
| PHASE 3 EXECUTE      | tdd-guide 按红-绿-重构走 unit；e2e-runner 跑 e2e                       |
| PHASE 4 VERIFY       | gate=test 必须包含 regression 全跑结果                                 |

---

## 与现有 skill 的关系

| skill                  | 角色           | 与 test-plan-writer 的差异                        |
| ---------------------- | -------------- | ------------------------------------------------- |
| `tdd-guide`            | 执行红-绿-重构 | 拿到 test-plan.md 的 unit 条目当输入              |
| `e2e-runner`           | 跑 Playwright  | 拿到 e2e 条目                                     |
| `systematic-debugging` | bug 调试       | 修复阶段；本 skill 是事前规划                     |
| `verification`         | 对抗验证       | 重构策略下用本 skill 的 security/edge-case 当输入 |

---

## 验收标准

- [ ] test-plan.md 6 维度都有处理（执行 / 显式跳过 + 理由）
- [ ] 每条测试条目都有可执行 cmd
- [ ] regression 维度被显式列出
- [ ] 安全敏感任务包含 security 维度
- [ ] test-plan.md 的条目能 1:1 映射到 QuestMap 的 quest

## 来源

- catlog22/Claude-Code-Workflow workflow-tdd-plan 思路
- Anthropic 官方测试相关 skill 集
- 项目 `rules/testing.md` 80% 覆盖率要求
