---
name: using-git-worktrees
description: 多 Agent 并行隔离开发 — 当 QuestMap 中存在多个可并行 Quest（无依赖、触及不同模块、可独立测试）时，为每个 Quest 创建 git worktree，让多个 agent 在独立工作树中并行实施，互不干扰。最后 merge 回主分支统一验证。仅在 Quest 数 ≥ 3 且并行收益 ≥ 串行成本时触发。
tags: [git, worktree, parallel, multi-agent, execute-phase, isolation]
---

# Using Git Worktrees — 多 Agent 并行隔离

> 借鉴 [Superpowers/obra](https://github.com/obra/superpowers) 的 `using-git-worktrees` skill + Claude Code 2026-02 原生 Worktree 支持。
> 核心原则：**真正的多 Agent 并行需要文件系统级隔离**。共享工作目录的"并行"是假的，会互相覆盖。

## 快速使用

```
/auto 同时实现登录页 + 注册页 + 个人中心页（无依赖）
/auto 重构 auth/ + payment/ + notification/ 三模块
```

QuestMap 设计时检测到 3 个独立 Quest 触及不同模块 → 自动为每个 Quest 创建独立 worktree，多 agent 真正并行。

---

## 使用时机

**必须加载**：

- QuestMap 中存在 ≥ 3 个 `parallel: true` 的 Quest
- 各 Quest 触及完全不同的文件 / 模块（无 touchFiles 交集）
- 每个 Quest 可独立测试 / 验证
- 估计并行节省时间 ≥ 30 分钟（小任务并行收益不抵 worktree 成本）

**不要触发**：

- Quest 数 < 3（开销不抵收益）
- Quest 间有数据依赖（A 的输出是 B 的输入）
- 同一文件被多 Quest 触及（合并冲突风险高）
- 修复 / 探索策略（通常单关）

---

## 激活摘要 (Activation Digest)

**检查清单** (checklist):

- [ ] 触发判定：Quest 数 ≥ 3 + 无 touchFiles 交集 + 各自可独立测试
- [ ] 为每个并行 Quest 创建 worktree：`git worktree add ../auto-cli-quest-N <new-branch>`
- [ ] 每个 worktree 单独跑 agent 实施 + 单独 npm run check
- [ ] 全部 PASS 后逐个 merge 回主分支（顺序合并降低冲突）
- [ ] merge 后跑全量 check 确认无回归
- [ ] 用 `git worktree remove` 清理临时工作树

**硬约束** (constraints):

- 各 worktree 必须基于同一 HEAD 创建，避免起点漂移
- 单 worktree 失败不影响其他 worktree（隔离原则）
- merge 顺序：先合最简单 Quest，逐步合复杂 Quest（降低冲突）
- 全部 merge 后必须跑一次完整 check（worktree 内部 check ≠ 全量）

**输出模板** (output):

```bash
# 创建并行 worktree
git worktree add ../auto-cli-q1 quest-1-login
git worktree add ../auto-cli-q2 quest-2-register
git worktree add ../auto-cli-q3 quest-3-profile

# 并行实施（每个 worktree 独立 agent）
( cd ../auto-cli-q1 && agent-implement-quest-1 ) &
( cd ../auto-cli-q2 && agent-implement-quest-2 ) &
( cd ../auto-cli-q3 && agent-implement-quest-3 ) &
wait

# 顺序合并 + 全量验证
git merge quest-1-login && npm run check
git merge quest-2-register && npm run check
git merge quest-3-profile && npm run check

# 清理
git worktree remove ../auto-cli-q1
git worktree remove ../auto-cli-q2
git worktree remove ../auto-cli-q3
```

**反模式** (anti-patterns):

- 用同一工作目录并行多 agent → 互相覆盖，灾难
- 起点漂移：A worktree 从 main HEAD，B 从昨天的 commit → merge 时一片乱
- worktree 内 check PASS 就声称完成 → 漏掉跨 Quest 集成测试
- merge 后忘清理 worktree → 磁盘占用 + git 状态混乱

---

## 核心流程（5 步）

### 第一步：触发判定

读 QuestMap，逐条核对：

| 条件                              | 例  |
| --------------------------------- | --- |
| Quest 数 ≥ 3                      | ✓   |
| 各 Quest `touchFiles` 无交集      | ✓   |
| 每个 Quest 可独立 acceptance 验证 | ✓   |
| 估计串行总时长 ≥ 30 分钟          | ✓   |

任一项 ✗ → 跳过 worktree，走线性 EXECUTE。

### 第二步：创建 worktree 矩阵

```bash
BASE=$(pwd)
for i in 1 2 3; do
  git worktree add "$BASE-q$i" "quest-$i-<name>"
done
```

每个 worktree 自动建立同名 branch。

### 第三步：并行实施

每个 worktree 启动一个 agent（或 Task 子 agent），按 QuestMap 该 Quest 的 inputs / outputs / acceptance 实施。

主流程并行等待：

```bash
( cd "$BASE-q1" && implement-quest-1 ) &
( cd "$BASE-q2" && implement-quest-2 ) &
( cd "$BASE-q3" && implement-quest-3 ) &
wait
```

### 第四步：顺序合并 + 渐进验证

按"先简单后复杂"顺序合并，每合一个跑一次 `npm run check`：

```bash
for branch in quest-1-login quest-2-register quest-3-profile; do
  git merge --no-ff "$branch"
  npm run check || (echo "merge $branch broke main, rollback"; git reset --hard HEAD~1; exit 1)
done
```

合并失败立即回滚该次合并，进入"冲突修复"子 Quest，不连累其他已合并 Quest。

### 第五步：清理 worktree

```bash
git worktree remove "$BASE-q1" --force
git worktree remove "$BASE-q2" --force
git worktree remove "$BASE-q3" --force
```

---

## 与 Claude Code 2026-02 原生支持的关系

Claude Code 2026-02 原生支持 Git Worktree —— 用户可在 IDE 中直接为每个 task 创建 worktree。本 skill 在 auto-cli 层提供**自动化触发机制**：

- IDE 层：用户手动 `claude --worktree`
- auto-cli 层：QuestMap 自动判定 → auto-cli 自动创建/合并/清理

两者互补，不冲突。

---

## 反模式（详细版）

### 反模式 1: 强行并行 Quest 数 < 3

```
❌ 2 个 Quest 也建 worktree → 开销大于收益
✅ Quest 数 < 3 时直接线性执行
```

### 反模式 2: touchFiles 有交集还并行

```
❌ Q1 改 src/auth/*，Q2 改 src/auth/login.ts → 必然冲突
✅ 检查 touchFiles 交集，有交集就串行
```

### 反模式 3: worktree 失败影响其他 worktree

```
❌ Q1 失败立即 cancel Q2/Q3 → 浪费已完成工作
✅ Q1 失败仅标记 Q1 失败，Q2/Q3 继续 + Q1 进入修复子 Quest
```
