---
name: learn
description: 从当前会话或 Git 历史提取可复用的编码模式并保存为 Skill（双模式：会话级 + 历史级）
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /learn — 双模式提取

> **模式 1**：分析当前会话，将有价值的编码模式、调试技巧或解决方案提取为可复用的 Skill。
> **模式 2**：分析项目 Git 历史，自动提取编码模式、工作流程和团队约定。
> 来自 everything-claude-code 的完整知识沉淀能力。

---

## 使用方式

```bash
/learn                              # 模式 1: 从当前会话提取（默认）
/learn --git                        # 模式 2: 从 Git 历史分析（默认最近 200 次提交）
/learn --git --commits 100          # 分析最近 100 次提交
/learn --git --output ./skills      # 自定义输出目录
/learn --git --instincts            # 同时生成 Instinct 格式（用于 continuous-learning）
```

---

## 模式 1：会话提取

### 使用时机

在会话中任何时候运行 `/learn`，当你解决了一个非平凡问题时。

### 提取内容类型

#### 1. 错误解决模式
- 发生了什么错误？
- 根本原因是什么？
- 如何修复的？
- 是否可复用于类似错误？

#### 2. 调试技巧
- 不明显的调试步骤
- 有效的工具组合
- 诊断模式

#### 3. 变通方案
- 库的怪癖
- API 限制
- 特定版本修复

#### 4. 项目特定模式
- 发现的代码库约定
- 架构决策
- 集成模式

### 输出格式

创建 Skill 文件于 `~/.claude/skills/learned/[pattern-name].md`：

```markdown
---
name: [descriptive-pattern-name]
description: Brief description of when this applies
version: 1.0.0
source: session-extraction
extracted_at: [ISO-date]
---

# [描述性模式名称]

**提取时间：** [Date]
**适用场景：** [Brief description of when this applies]

## 问题

[What problem this solves - be specific]

## 解决方案

[The pattern/technique/workaround]

## 示例

[Code example if applicable]

## 使用时机

[Trigger conditions - what should activate this skill]
```

### 工作流程（模式 1）

1. **审查会话** - 查找可提取的模式
2. **识别最有价值的洞察** - 专注于可复用的内容
3. **起草 Skill 文件** - 按标准格式组织
4. **请求用户确认** - 展示草稿等待批准
5. **保存到 learned 目录** - 持久化存储

### 不提取的内容

- ❌ 平凡修复（拼写错误、简单语法错误）
- ❌ 一次性问题（特定 API 中断等）
- ❌ 过于具体的内容（特定日期的故障）

### 专注提取

- ✅ 可复用的模式
- ✅ 跨项目适用的经验
- ✅ 节省未来时间的洞察

### 示例（模式 1）

解决了一个 TypeScript 泛型问题后，运行 `/learn` 可能生成：

```markdown
---
name: typescript-generic-inference
description: 处理 TypeScript 泛型推断边缘情况
version: 1.0.0
source: session-extraction
extracted_at: 2026-03-29
---

# TypeScript 泛型推断边缘情况

**提取时间：** 2026-03-29
**适用场景：** 当泛型类型推断失败时，特别是在条件类型中

## 问题

TypeScript 无法正确推断嵌套条件类型中的泛型参数，导致 `Type 'X' is not assignable to type 'Y'` 错误。

## 解决方案

使用中间类型别名和 `extends` 约束：

```typescript
// 不要这样
function parse<T>(input: string): T {
  return JSON.parse(input) as T;
}

// 使用类型推断辅助
type InferJSON<T> = T extends string
  ? JSON.parse(T)
  : never;

function parse<T extends string>(input: T): InferJSON<T> {
  return JSON.parse(input);
}
```

## 使用时机

- 泛型推断包含联合类型时
- 条件类型嵌套超过 2 层
- 出现 "Type instantiation is excessively deep" 错误
```

---

## 模式 2：Git 历史分析

### 使用场景

- 新团队成员快速了解项目规范
- 自动化项目文档生成
- 提取团队最佳实践
- 遗留代码库的架构理解

### 工作流程（模式 2）

#### 第一步：收集 Git 数据

```bash
# 获取最近 N 次提交及其文件变更
git log --oneline -n 200 --name-only --pretty=format:"%H|%s|%ad" --date=short

# 获取文件变更频率（哪些文件最常被修改）
git log --oneline -n 200 --name-only | grep -v "^$" | grep -v "^[a-f0-9]" | sort | uniq -c | sort -rn | head -20

# 获取提交消息模式
git log --oneline -n 200 | cut -d' ' -f2- | head -50
```

#### 第二步：检测模式

| 模式类型 | 检测方法 |
|---------|---------|
| **提交约定** | 正则匹配提交消息（feat:, fix:, chore:, docs: 等） |
| **文件联动** | 总是一起变更的文件组合 |
| **工作流序列** | 重复出现的文件变更模式 |
| **架构规范** | 目录结构和命名约定 |
| **测试模式** | 测试文件位置、命名、覆盖率要求 |

#### 第三步：生成 SKILL.md

输出格式：

```markdown
---
name: {repo-name}-patterns
description: 从 {repo-name} 提取的编码模式
version: 1.0.0
source: local-git-analysis
analyzed_commits: {count}
---

# {项目名称} 编码模式

## 提交约定
{检测到的提交消息模式}

## 代码架构
{检测到的目录结构和组织方式}

## 工作流程
{检测到的重复文件变更模式}

## 测试模式
{检测到的测试约定}
```

#### 第四步：生成 Instinct（可选）

如果使用 `--instincts` 标志，同时生成 continuous-learning-v2 兼容格式：

```yaml
---
id: {repo}-commit-convention
trigger: "when writing a commit message"
confidence: 0.8
domain: git
source: local-repo-analysis
---

# 使用约定式提交

## Action
提交前缀使用：feat:, fix:, chore:, docs:, test:, refactor:

## Evidence
- 分析了 {n} 次提交
- {percentage}% 遵循约定式提交格式
```

### 示例输出（模式 2）

在 TypeScript 项目上运行 `/learn --git` 可能产生：

```markdown
---
name: my-app-patterns
description: 从 my-app 仓库提取的编码模式
version: 1.0.0
source: local-git-analysis
analyzed_commits: 150
---

# My App 编码模式

## 提交约定
本项目使用 **约定式提交**：
- `feat:` - 新功能
- `fix:` - Bug 修复
- `chore:` - 维护任务
- `docs:` - 文档更新

## 代码架构
```
src/
├── components/    # React 组件（PascalCase.tsx）
├── hooks/         # 自定义 hooks（use*.ts）
├── utils/         # 工具函数
├── types/         # TypeScript 类型定义
└── services/      # API 和外部服务
```

## 工作流程

### 添加新组件
1. 创建 `src/components/ComponentName.tsx`
2. 在 `src/components/__tests__/ComponentName.test.tsx` 添加测试
3. 从 `src/components/index.ts` 导出

### 数据库迁移
1. 修改 `src/db/schema.ts`
2. 运行 `pnpm db:generate`
3. 运行 `pnpm db:migrate`

## 测试模式
- 测试文件：`__tests__/` 目录或 `.test.ts` 后缀
- 覆盖率目标：80%+
- 框架：Vitest
```

### 高级用法：GitHub App

对于大型项目（10k+ 提交）或团队协作，使用 [Skill Creator GitHub App](https://github.com/apps/skill-creator)：
- 在 Issue 评论 `/skill-creator analyze`
- 自动生成 PR 包含技能文件
- 支持团队共享和版本控制

---

## 与 Auto CLI 集成

- 提取的 Skill 会被 quest-designer v4 在 PHASE 2 发现
- 补充 `unified-memory-system` 的知识沉淀能力
- 双模式配合：会话级快速捕获 + 历史级深度分析

---

## 相关命令

- `auto save insight -c "..."` - 快速保存单条知识
- `/auto:update-codemaps` - 更新代码架构地图
- `/auto:doctor` - 检查项目健康状态
