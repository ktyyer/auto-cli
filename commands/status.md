---
description: 查看项目状态和能力安装情况
---

# /auto:status -- 状态查看

> **查看项目当前状态、已安装能力、运行时模块健康度**

---

## 执行步骤

### 1. 项目概览

读取以下文件提取项目信息（如果存在）：

```
Read package.json → 提取 name, version, scripts
Read pom.xml → 提取 groupId, artifactId（Java 项目）
Read go.mod → 提取 module 名（Go 项目）
Bash: find . -maxdepth 2 -type f | wc -l → 文件统计
Bash: git status --short | wc -l → 未提交变更数
```

### 2. 已安装能力扫描

逐项扫描并统计：

```
# Agents
Glob: agents/*.md → 计数和列表名

# Commands
Glob: commands/*.md 和 commands/**/*.md → 计数

# Skills
Glob: skills/*.md 和 skills/**/SKILL.md → 计数

# Rules
Glob: rules/*.md → 计数

# Hooks
Read hooks/hooks.json → 统计 hook 数量

# Knowledge
Bash: ls .auto/insights/*.md 2>/dev/null | wc -l → 知识条目数
```

### 3. 项目健康度检查

```
# 关键文件检查
Bash: test -f CLAUDE.md && echo "EXISTS" || echo "MISSING"
Bash: test -f REPO_MAP.md && echo "EXISTS" || echo "MISSING"
Bash: test -f tsconfig.json && echo "EXISTS" || echo "MISSING"

# 依赖状态
Bash: test -d node_modules && echo "INSTALLED" || echo "NOT_INSTALLED"

# Git 状态
Bash: git rev-parse --short HEAD → 当前 commit
Bash: git branch --show-current → 当前分支
```

### 4. Runtime 模块状态

调用 `getRuntimeStatus()` 检查 13 个核心模块的初始化和健康状态：

| 模块 | 检查项 | 说明 |
|------|--------|------|
| flowEngine | state, phase | 工作流状态机 |
| memory | stats | 三层记忆系统 |
| tokenBudget | status, summary | Token 预算控制 |
| contextMonitor | status, summary | 上下文窗口监控 |
| skillIndexer | initialized | 技能索引器 |
| agentRegistry | initialized, stats | Agent 注册表 |
| canonicalRouter | initialized | 意图路由器 |
| repoIndexer | initialized | 仓库符号索引 |
| knowledgeSteward | initialized | 知识管家 |
| dreamScheduler | healthy | 自动记忆整理 |
| workflow | phase, mode, quests | 当前工作流状态 |

输出格式：

```markdown
### Runtime 模块状态

| 模块 | 状态 | 详情 |
|------|------|------|
| FlowEngine | IDLE/WORKING | phase={n} |
| MemoryManager | OK | session={n} project={n} global={n} |
| TokenBudget | OK/WARNING/CRITICAL | {used}% used |
| ContextMonitor | OK/COMPRESS | {used}% of limit |
| SkillIndexer | READY | cached={bool} |
| AgentRegistry | READY | agents={n} |
| CanonicalRouter | READY | - |
| RepoIndexer | READY/IDLE | indexed={bool} |
| KnowledgeSteward | READY/IDLE | - |
| DreamScheduler | READY | - |
```

### 5. Agent/Skill/Rule 文件完整性检查

扫描所有 agent、skill、rule 文件，验证：

```
# Agent 文件完整性
agents/*.md: 检查 frontmatter 必需字段（name, triggerKeywords, capabilities）
缺失字段 → 警告提示

# Skill 文件完整性
skills/*.md: 检查 frontmatter 必需字段（name, description, tags）
缺失字段 → 警告提示

# Rule 文件完整性
rules/*.md: 检查文件非空且有实质内容（>100 字节）
空文件 → 警告提示
```

### 6. 输出格式

将所有信息汇总为以下格式输出：

```markdown
## 项目状态

**项目**: {name} v{version} | **分支**: {branch} @ {commit}
**文件**: {count} | **未提交**: {unstaged}

### 已安装能力

| 类型 | 数量 | 详情 |
|------|------|------|
| Agents | {n} | {agent names} |
| Commands | {n} | {command names} |
| Skills | {n} | {skill names} |
| Rules | {n} | {rule names} |
| Hooks | {n} | {hook types} |
| Knowledge | {n} | 知识条目 |

### 健康度

| 检查项 | 状态 |
|--------|------|
| CLAUDE.md | EXISTS / MISSING |
| REPO_MAP.md | EXISTS / STALE |
| node_modules | INSTALLED / MISSING |
| Git 状态 | CLEAN / DIRTY |

### Runtime 模块

| 模块 | 状态 | 详情 |
|------|------|------|
| ... | ... | ... |

### 文件完整性

| 类型 | 检查结果 |
|------|----------|
| Agents | {n}/{n} 完整 |
| Skills | {n}/{n} 完整 |
| Rules | {n}/{n} 完整 |

### 建议
- [ ] 缺失项的建议操作（如有）
```

### 7. 建议操作

根据扫描结果生成建议：

- CLAUDE.md 缺失 → 建议 `/auto:init-project`
- REPO_MAP.md 缺失 → 建议 `/auto:update-codemaps`
- node_modules 缺失 → 建议 `npm install`
- 能力数量 < 预期 → 建议 `/auto:doctor` 检查安装
- Agent/Skill 文件不完整 → 建议修复 frontmatter
- Runtime 模块异常 → 建议检查模块初始化
