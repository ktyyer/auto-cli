---
name: skill-create
description: 分析 Git 历史提取编码模式并生成 SKILL.md 文件
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /skill-create — Git 历史 → 技能生成

> 分析项目 Git 历史，自动提取编码模式、工作流程和团队约定，生成可复用的 Skill 文件。
> 来自 everything-claude-code 的实战验证能力。

---

## 使用方式

```bash
/skill-create                    # 分析当前项目（默认最近 200 次提交）
/skill-create --commits 100      # 分析最近 100 次提交
/skill-create --output ./skills  # 自定义输出目录
/skill-create --instincts        # 同时生成 Instinct 格式（用于 continuous-learning）
```

---

## 工作流程

### 第一步：收集 Git 数据

```bash
# 获取最近 N 次提交及其文件变更
git log --oneline -n 200 --name-only --pretty=format:"%H|%s|%ad" --date=short

# 获取文件变更频率（哪些文件最常被修改）
git log --oneline -n 200 --name-only | grep -v "^$" | grep -v "^[a-f0-9]" | sort | uniq -c | sort -rn | head -20

# 获取提交消息模式
git log --oneline -n 200 | cut -d' ' -f2- | head -50
```

### 第二步：检测模式

| 模式类型 | 检测方法 |
|---------|---------|
| **提交约定** | 正则匹配提交消息（feat:, fix:, chore:, docs: 等） |
| **文件联动** | 总是一起变更的文件组合 |
| **工作流序列** | 重复出现的文件变更模式 |
| **架构规范** | 目录结构和命名约定 |
| **测试模式** | 测试文件位置、命名、覆盖率要求 |

### 第三步：生成 SKILL.md

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

### 第四步：生成 Instinct（可选）

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

---

## 示例输出

在 TypeScript 项目上运行 `/skill-create` 可能产生：

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

---

## 与 Auto CLI 集成

生成的 Skill 文件会：
1. 自动放置在项目的 `skills/` 目录
2. 被 quest-designer v4 在 PHASE 2 自动发现并加载
3. 增强 Quest Map 的项目上下文感知能力

---

## 高级用法：GitHub App

对于大型项目（10k+ 提交）或团队协作，使用 [Skill Creator GitHub App](https://github.com/apps/skill-creator)：
- 在 Issue 评论 `/skill-creator analyze`
- 自动生成 PR 包含技能文件
- 支持团队共享和版本控制

---

## 相关命令

- `/learn` - 从当前会话提取模式
- `auto save insight -c "..."` - 保存单条知识
- `/auto:update-codemaps` - 更新代码地图
