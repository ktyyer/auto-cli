---
name: feedback-loop
description: 为无 UI 的 I/O 系统建立 AI 可操作的自验证闭环 — 识别应用 I/O 模型（消息/请求/事件/文件）、构建 CLI 测试驱动器、建立结构化日志反馈链路，让 AI 能在命令行自主测试并迭代直至通过，无需人工介入。当项目是 bot 框架、daemon、消息队列消费者、CLI 工具、后台服务等无浏览器 UI 的 I/O 系统时激活。
tags:
  [
    feedback-loop,
    e2e,
    cli-harness,
    bot,
    daemon,
    testability,
    self-verification,
    tdd,
    io-system,
    reflexion,
    swe-agent
  ]
---

# Feedback Loop — I/O 系统自验证闭环

> 核心洞察：任何系统本质上都是 **输入 → 处理 → 输出** 的管道。只要能为 AI 提供一个可操作的 CLI 驱动器和结构化的输出反馈，AI 就能自主完成"写代码 → 测试 → 读日志 → 修复 → 再测试"的完整闭环，无需人工介入。

## 理论基础

本 skill 融合三个经过实证验证的方法论：

| 方法论                                      | 核心机制                                                      | 在本 skill 的映射                               |
| ------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------- |
| **SWE-agent ACI**（Yang et al., 2024）      | Think → Act → Observe 循环；工具输出质量决定 LLM 能否正确继续 | CLI 驱动器 = Act 层；结构化日志 = Observe 层    |
| **Reflexion**（Shinn et al., NeurIPS 2023） | 外部执行信号 + 语言反思；episodic memory 跨轮积累             | 测试结果 = 外部信号；日志历史 = episodic memory |
| **非退化性收敛**（Lyapunov 稳定性类比）     | 每次迭代失败数单调不增 → 有界有限步收敛                       | 每轮修复后必须重跑全量场景验证不退化            |

**关键告诫**（Olausson et al., ICLR 2024 实证）：没有外部执行信号的纯语言自我批评，效果等同于噪声，有时比"不修复"更差。**外部测试运行是闭环有效的前提，不是选项。**

## 激活摘要

**何时激活**：

- 项目是 bot 框架 / daemon / 消息队列消费者 / CLI 工具 / 后台服务
- 被测系统的核心逻辑无法用 Playwright 驱动（无浏览器 UI）
- Mock 掉外部依赖后无法覆盖真正的业务场景
- 用户希望 AI 自主测试、迭代，减少人工介入

**与相邻 skill/agent 的边界**：

| 场景                            | 使用哪个                        |
| ------------------------------- | ------------------------------- |
| 有浏览器 UI 的 Web 应用         | `e2e-runner`（Playwright）      |
| 纯函数 / 模块逻辑隔离验证       | `tdd-guide`（单元测试）         |
| **无 UI 的 I/O 系统端到端验证** | **`feedback-loop`（本 skill）** |

**检查清单**：

- [ ] 已识别系统的核心 I/O 抽象（输入格式、处理单元、输出格式）
- [ ] 已构建 CLI 驱动器（可在命令行模拟真实输入）
- [ ] 日志输出结构化，AI 可解读"预期输出 vs 实际输出"
- [ ] 验收场景列表已定义（正常路径 + 边界 + 错误路径）
- [ ] 闭环已通：写代码 → CLI 测试 → 读日志 → 修复 → 再测 全程无人工

**硬约束**：

- CLI 驱动器必须幂等（多次运行结果一致，不污染状态）
- 测试场景覆盖正常路径、边界、错误路径三类
- 每轮修复后必须重跑全量场景，不只跑失败的那条

---

## Step 1：识别 I/O 模型

分析项目核心处理单元，按类型映射到对应的 CLI 驱动架构：

| 系统类型       | 输入形态               | 输出形态             | CLI 驱动方式           |
| -------------- | ---------------------- | -------------------- | ---------------------- |
| Bot / 消息框架 | 用户消息文本           | 回复文本             | `send-message` 子命令  |
| HTTP API       | HTTP 请求（JSON/Form） | HTTP 响应            | `curl` / `httpie` 脚本 |
| 消息队列消费者 | 队列消息（JSON）       | 处理结果 / 副作用    | 生产者模拟脚本         |
| CLI 工具       | 命令行参数 / stdin     | stdout / 文件输出    | 直接调用 + 断言输出    |
| 后台 daemon    | 文件 / 信号 / 定时触发 | 文件 / 数据库 / 日志 | 触发脚本 + 状态检查    |
| 批处理任务     | 输入文件               | 输出文件             | 文件驱动 + diff 比对   |

**识别输出**：记录到 `CLAUDE.md` 或 `.auto/runs/<runId>/io-model.md`：

```
系统类型: [类型]
核心处理单元: [描述]
输入格式: [格式 + 示例]
输出格式: [格式 + 示例]
CLI 驱动方式: [选择的驱动方案]
```

---

## Step 2：构建 CLI 驱动器

### 模板 A：Bot / 消息框架

```python
#!/usr/bin/env python3
# cli_test.py — Bot 测试驱动器
import argparse, sys, json
from your_bot_module import handle_message

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--message", required=True, help="模拟发送的消息")
    parser.add_argument("--user", default="test_user")
    parser.add_argument("--json", action="store_true", help="输出 JSON 格式")
    args = parser.parse_args()

    response = handle_message(args.user, args.message)

    if args.json:
        print(json.dumps({"input": args.message, "output": response}, ensure_ascii=False))
    else:
        print(f"[INPUT]  {args.message}")
        print(f"[OUTPUT] {response}")

if __name__ == "__main__":
    main()
```

### 模板 B：HTTP API

```bash
#!/usr/bin/env bash
# api_test.sh — API 测试驱动器
BASE_URL="${BASE_URL:-http://localhost:8080}"

run_case() {
    local name="$1" method="$2" path="$3" body="$4" expected="$5"
    echo "=== $name ==="
    actual=$(curl -s -X "$method" "$BASE_URL$path" \
        -H "Content-Type: application/json" \
        -d "$body")
    echo "INPUT:    $method $path $body"
    echo "OUTPUT:   $actual"
    if echo "$actual" | grep -q "$expected"; then
        echo "STATUS:   PASS"
    else
        echo "STATUS:   FAIL (expected: $expected)"
        return 1
    fi
}

run_case "正常请求" POST /api/action '{"key":"value"}' '"success":true'
```

### 模板 C：CLI 工具

```bash
#!/usr/bin/env bash
# cli_test.sh — CLI 工具测试驱动器
PASS=0; FAIL=0

assert_output() {
    local name="$1" cmd="$2" expected="$3"
    actual=$(eval "$cmd" 2>&1)
    if echo "$actual" | grep -qF "$expected"; then
        echo "PASS: $name"; ((PASS++))
    else
        echo "FAIL: $name"
        echo "  CMD:      $cmd"
        echo "  EXPECTED: $expected"
        echo "  ACTUAL:   $actual"
        ((FAIL++))
    fi
}

# 在此添加测试场景
assert_output "正常输入" "your-cli --input hello" "expected output"
assert_output "空输入错误" "your-cli --input ''" "error:"

echo "=== 结果: $PASS PASS, $FAIL FAIL ==="
[ "$FAIL" -eq 0 ]
```

---

## Step 3：建立结构化日志反馈

AI 需要能从日志中读出"哪条场景失败了、失败原因是什么"，结构化格式是关键：

```
=== 场景名称 ===
INPUT:    <输入内容>
OUTPUT:   <实际输出>
EXPECTED: <预期输出>（仅失败时显示）
STATUS:   PASS / FAIL
ERROR:    <错误信息>（仅失败时显示）
```

**日志落盘**：测试运行结果写到文件，AI 可在后续轮次读取历史：

```bash
your-test-driver 2>&1 | tee .auto/runs/latest-test.log
```

---

## Step 4：写入 CLAUDE.md（关键）

把 CLI 驱动器的使用方式写入项目 `CLAUDE.md`，让 AI 在每次修改后自动触发测试：

````markdown
## 测试方式

修改代码后运行以下命令验证，直到全部 PASS：

```bash
# 运行全量测试场景
python cli_test.py --message "场景A输入"
python cli_test.py --message "场景B输入"
# 或一键运行
bash run_tests.sh
```
````

AI 工作规则：

- 每次修改后必须运行测试
- 读取失败日志，分析原因，修复代码
- 不得要求人工介入；如无法修复，说明阻塞原因

```

---

## Step 5：定义验收场景

在测试驱动器中覆盖三类场景，缺一不可：

| 类型 | 说明 | 示例 |
|------|------|------|
| **正常路径** | 核心功能在标准输入下按预期工作 | 用户发送 `/help`，返回帮助信息 |
| **边界情况** | 极端或特殊输入 | 空消息、超长文本、特殊字符 |
| **错误路径** | 不合法输入或下游失败 | 未知命令、网络超时、权限不足 |

---

## Step 6：生产级强化（迭代收敛保证）

**不要在没有进展的轮次上继续迭代**。判断标准：

```

进展判定：
PASS 数量增加 → 有进展，继续
PASS 数量不变 → 无进展，必须换策略（不能只改措辞）
PASS 数量减少 → 退化！立即回滚当前修改，恢复后再分析根因

```

**退化防护协议**（借鉴 Agentless 多候选策略）：

1. 有复杂 bug 时，并行生成 2-3 个不同修复方向
2. 各自跑测试，选通过数最多的候选
3. 所有候选失败时，落盘当前状态到 `.auto/runs/latest-test.log` 再请求人工介入

**迭代终止条件**：

- 所有场景 PASS → 成功退出
- 连续 3 轮无进展 → 停止自主迭代，输出阻塞分析请求人工介入
- PASS 数量连续下降 → 回滚并终止，报告根因假设

---

## 与 auto-cli 集成

| 注入时机 | 说明 |
|---------|------|
| PHASE 1 SCAN | 检测到 bot/daemon/无 UI 系统 → 建议激活 |
| PHASE 2 PLAN | Quest 设计包含"构建 CLI 驱动器"关卡 |
| PHASE 3 EXECUTE | 每关修改后运行 CLI 驱动器验证 |
| PHASE 4 VERIFY | `clean-state` gate 包含 CLI 驱动器全量通过检查 |
| PHASE 6 LEARN | 成功的驱动器模板沉淀到 patterns.md |

## 参考 Skills

- **tdd-guide** — 单元逻辑层测试（与本 skill 分工：tdd-guide 覆盖函数，feedback-loop 覆盖业务场景）
- **systematic-debugging** — CLI 驱动器跑出 FAIL 时的系统排查流程
- **logging-patterns** — 结构化日志设计
```
