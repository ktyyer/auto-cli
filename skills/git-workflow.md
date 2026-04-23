---
name: git-workflow
description: Git 分支策略、约定式提交和 PR 流程 — 覆盖分支模型（main/dev/feature/fix）、约定式提交格式（feat/fix/refactor/docs）、PR 模板、冲突解决和 Git 历史分析。当 SUMMARIZE 后用户决定提交、创建 PR、处理合并冲突、或 /auto:learn 执行 Git 历史分析时，必须加载此 skill。
tags: [git, workflow, branch, commit, pr, convention, merge, rebase]
---

# Git Workflow — Git 工作流规范

> 与 SUMMARIZE 后的手动提交流程集成，确保提交信息规范、分支策略一致。
> auto 在工作流完成并通过验证后输出总结，由用户决定是否提交，提交时参考本规范。

## 快速使用

```
/auto 提交当前变更（约定式提交格式）
/auto 创建 PR 合并 feature/auth 分支
/auto 解决 main 和 dev 分支的合并冲突
```

## 使用时机

**必须加载**：

- SUMMARIZE 后用户决定提交时（执行约定式提交格式）
- 创建 PR 前（PR 检查项 + PR 模板）
- 合并冲突时（冲突解决策略）
- /auto:learn 执行 Git 历史分析时

**按需加载**（按操作）：

- 分支管理 → Section 1（分支模型 + 分支操作）
- 提交规范 → Section 2（约定式提交格式 + 禁止项）
- PR 流程 → Section 3（PR 模板 + 检查项）
- 历史分析 → Section 4（分析命令）

---

## 一、分支模型

### 1.1 分支类型

| 分支         | 命名规范                     | 生命周期       | 用途                     |
| ------------ | ---------------------------- | -------------- | ------------------------ |
| `main`       | —                            | 永久           | 生产分支，只通过 PR 合并 |
| `dev`        | —                            | 永久           | 开发分支，日常集成       |
| `feature/*`  | `feature/short-description`  | 功能完成后删除 | 新功能开发               |
| `fix/*`      | `fix/issue-description`      | 修复后删除     | Bug 修复                 |
| `refactor/*` | `refactor/scope-description` | 重构后删除     | 代码重构                 |
| `release/*`  | `release/vX.Y.Z`             | 发布后保留     | 发版准备                 |

### 1.2 分支操作

```bash
# 从 dev 创建功能分支
git checkout dev && git pull
git checkout -b feature/user-export

# 完成后合并回 dev
git checkout dev && git pull
git merge --no-ff feature/user-export
git branch -d feature/user-export

# 紧急修复从 main 拉分支
git checkout main && git pull
git checkout -b fix/hotfix-login-bug
```

---

## 二、约定式提交

### 2.1 格式

```
<type>(<scope>): <description>

<body>
```

### 2.2 Type 清单

| Type       | 用途     | 示例                                     |
| ---------- | -------- | ---------------------------------------- |
| `feat`     | 新功能   | `feat(order): 新增批量导出 Excel 功能`   |
| `fix`      | Bug 修复 | `fix(auth): 修复 Token 过期后无限重定向` |
| `refactor` | 重构     | `refactor(utils): 抽取分页工具方法`      |
| `perf`     | 性能优化 | `perf(query): 优化列表查询 N+1 问题`     |
| `docs`     | 文档     | `docs: 更新 API 接口文档`                |
| `test`     | 测试     | `test(order): 补充导出功能单元测试`      |
| `chore`    | 杂务     | `chore: 升级 vite 到 5.0`                |
| `ci`       | CI/CD    | `ci: 添加 GitHub Actions 构建流程`       |
| `style`    | 格式     | `style: 统一使用单引号`                  |

### 2.3 auto 提交规则

如用户在 SUMMARIZE 后决定提交，建议使用：

```
<type>(<scope>): <Quest 标题>

Quest: <quest-id>
Decision: <关键决策笔记>
Files: <变更文件列表>
```

其中 `<type>` 必须根据本次 run 的实际性质选择，如 `feat` / `fix` / `refactor` / `docs` / `test`。

### 2.4 禁止项

- 无 `--no-verify` 跳过钩子
- 无 `--force` 推送到 main/dev
- 无 `git add .` 全量暂存（只 add 当前 Quest 文件）
- 无 `--amend` 修改已推送的提交

---

## 三、PR 工作流

### 3.1 PR 模板

```markdown
## Summary

- <1-3 bullet points>

## Changes

| 文件    | 变更           |
| ------- | -------------- |
| src/xxx | 新增/修改/删除 |

## Test Plan

- [ ] 单元测试通过
- [ ] 集成测试通过
- [ ] 手动验证 <场景>
```

### 3.2 PR 检查项

| 检查              | 工具                    | 阻断 |
| ----------------- | ----------------------- | ---- |
| 代码审查          | code-reviewer Agent     | 是   |
| 安全扫描          | security-reviewer Agent | 是   |
| 测试覆盖率 >= 80% | vitest --coverage       | 是   |
| 构建通过          | npm run build           | 是   |
| Lint 通过         | eslint                  | 是   |

### 3.3 冲突解决策略

```
冲突类型 → 策略：
1. 纯格式冲突 → 接受两边（git merge -X union）
2. 逻辑冲突 → 手动解决（在 Zed/VS Code 中查看）
3. 删除/修改冲突 → 优先保留修改，确认删除意图后决定
4. 二进制文件冲突 → 保留较新版本

解决流程：
1. git pull --rebase origin dev
2. 解决冲突
3. git add <resolved-files>
4. git rebase --continue
5. 运行测试确认无回归
```

---

## 四、Git 历史分析

### 4.1 常用分析命令

```bash
# 文件变更频率（热点文件）
git log --oneline -200 --name-only | sort | uniq -c | sort -rn | head -20

# 提交消息模式检测
git log --oneline -50 --pretty=format:"%s" | grep -oE "^[a-z]+" | sort | uniq -c

# 文件联动分析（总是一起变更的文件）
git log --oneline -100 --name-only | awk '/^[a-f0-9]/{files=""} /.*/{files=files" "$1} /^$/{print files}' | sort | uniq -c | sort -rn | head -10

# Blame 追踪
git log -p --all -S "function_name" -- "*.ts"
```

---

## 验收标准

- [ ] 每次提交符合约定式提交格式（`type: description`）
- [ ] 提交信息真实反映变更内容（不包含无关文件）
- [ ] PR 包含 Summary + Test Plan
- [ ] 无敏感文件（.env/credentials）被意外提交

## 五、与 auto-cli 集成

- **用户决定提交时**: 使用约定式提交格式，按本次变更边界组织提交
- **PHASE 6 LEARN**: `/auto:learn --git` 分析提交约定、文件联动、热点文件
- **/auto:learn --git**: 从 Git 历史自动提取编码模式
- **create-hook**: PreToolUse Hook 阻止 `git push --force` 到 main/dev
