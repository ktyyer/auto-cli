---
name: spec-driven
description: 从需求规格推导可执行验收标准，确保实现不偏离用户原始意图
tags:
  - spec
  - acceptance
  - verification
  - requirement
  - contract
  - interface
---

# Spec-Driven Development

> 从需求到验收的结构化链路：需求条款 → 接口契约 → 可执行 acceptance → 验证命令。

## 使用时机

- 需求明确但验收标准模糊
- 接口设计 / API 契约定义
- 多 Quest 任务需要统一验收基准
- 用户要求"按规格实现"或"不要偏离需求"

## 激活摘要

### checklist

- [ ] 每个 Quest 的 acceptance 可追溯到用户原始需求的具体条款
- [ ] acceptance 使用可执行命令（非"功能正常"等弱描述）
- [ ] 边界条件（空值、极值、并发、权限不足）显式列出
- [ ] 接口契约（输入类型、输出类型、错误码、状态码）在 PLAN 阶段固化
- [ ] 降级场景有明确的 fallback 行为定义

### constraints

- acceptance 必须在 EXECUTE 前确定，不得事后根据实现结果反推
- 每条 acceptance 必须对应至少一个验证动作（命令 / 断言 / 人工检查点）
- 接口契约变更必须显式声明并获得确认，不得静默修改
- 边界条件至少覆盖：空输入、极大输入、无权限、网络超时

### anti-patterns

- "功能正常工作" — 太模糊，无法机械验证
- "代码无报错" — 只验证了语法，未验证逻辑正确性
- 事后根据实现结果反推 acceptance — 本末倒置
- 只测试 happy path — 忽略边界和错误路径
- acceptance 写成实现细节（"使用 Redis 缓存"）而非行为规格（"响应时间 < 200ms"）

### output template

每个 Quest 的 acceptance 格式：

```
1. [命令] `npm test -- --grep "X"` 预期输出包含 "passed"
2. [文件] path/to/file.ts:L10-L20 满足接口契约 Y
3. [边界] 输入空字符串时返回 400 + 错误消息 "input required"
4. [边界] 输入超过 10MB 时返回 413 + 错误消息 "payload too large"
5. [集成] `curl -X POST /api/endpoint -d '{}'` 返回预期 JSON 结构
```

## 详细流程

### 阶段 1：需求条款提取

从用户原始需求中提取可验证的条款：

1. 识别动词短语（"用户可以..."、"系统应该..."、"当...时..."）
2. 每个动词短语转化为一条可测试的断言
3. 标记隐含需求（安全、性能、可访问性）

### 阶段 2：接口契约固化

对每个涉及的接口（API / 函数 / 组件）定义：

- 输入：类型、范围、必填/选填
- 输出：类型、结构、状态码
- 错误：错误码、错误消息格式、重试策略
- 约束：速率限制、大小限制、权限要求

### 阶段 3：验收命令生成

将每条断言转化为可执行的验证命令：

| 断言类型 | 验证方式                              |
| -------- | ------------------------------------- |
| 单元行为 | `npm test -- --grep "描述"`           |
| API 响应 | `curl` + `jq` 断言                    |
| 文件产出 | `test -f path && grep "pattern" path` |
| 性能指标 | `time command` + 阈值比较             |
| 类型安全 | `tsc --noEmit`                        |
| 格式规范 | `prettier --check` / `eslint`         |

### 阶段 4：边界矩阵

对每个核心输入维度生成边界测试：

| 维度   | 正常值  | 边界值              | 异常值                |
| ------ | ------- | ------------------- | --------------------- |
| 字符串 | "hello" | ""、max_length      | null、undefined、超长 |
| 数字   | 42      | 0、MAX_SAFE_INTEGER | -1、NaN、Infinity     |
| 数组   | [1,2,3] | []、[单元素]        | null、超大数组        |
| 对象   | {valid} | {}、{部分字段}      | null、循环引用        |

## 与其他 Skill 的协作

- **test-plan-writer**：spec-driven 产出的 acceptance 作为 test-plan-writer 的输入维度
- **requirement-clarifier**：当需求条款提取发现歧义时，触发 requirement-clarifier
- **api-design**：接口契约固化阶段可参考 api-design 的规范模板
