---
name: init-project
description: 为新项目生成结构化 CLAUDE.md — 包含技术栈声明、编码规范、目录说明、AI 行为约束和会话恢复模板。当用户提到新项目初始化、生成 CLAUDE.md、项目规范、让 AI 理解项目、或 AI 反复犯同样错误时，必须加载此 skill。即使用户没有明确说"初始化"或"CLAUDE.md"，只要检测到当前项目缺少 CLAUDE.md，也要主动建议使用本 skill。
tags: [init, setup, claude-md, project-context, onboarding]
---

# Init Project — CLAUDE.md 智能初始化

> 新项目第一步：让 AI 理解你的项目。本 Skill 提供结构化 CLAUDE.md 生成能力。

## 快速使用

```
/auto 为当前项目生成 CLAUDE.md
/auto 新项目是 Spring Boot + Vue3，帮我生成 CLAUDE.md
```

---

## 激活摘要 (Activation Digest)

**检查清单** (checklist):

- [ ] 检测并声明技术栈（语言 + 框架 + 构建工具 + 数据库）
- [ ] 编写编码规范（命名、文件组织、错误处理、输入验证）
- [ ] 声明 AI 行为约束（禁止事项、边界限制）
- [ ] 包含目录结构说明和架构约束
- [ ] 验证: CLAUDE.md 能被 AI 正确理解和执行

**硬约束** (constraints):

- CLAUDE.md 控制在 200 行以内（>500 行 AI 会忽略）
- 不承诺尚未实现的功能，不包含硬编码密钥
- 写具体规则（"变量用 camelCase"），不写废话（"代码要写好"）

**输出模板** (output):

- 完整 CLAUDE.md 文件（概述 + 技术栈 + 项目结构 + 编码规范 + 测试 + AI 约束）

**反模式** (anti-patterns):

- 从其他项目复制 CLAUDE.md 不修改 → 规范与实际不符
- CLAUDE.md 过长 (>500 行) 或只写技术栈不写约束
- 一次写完永不更新 → CLAUDE.md 是活文档

---

## 使用方法

### 方式 1：通过 /auto 命令

```
/auto 为当前项目生成 CLAUDE.md
```

### 方式 2：手动参考模板

按需加载 7 板块完整模板 → `init-project.references/template-blocks.md`

---

## CLAUDE.md 7 板块结构（按重要性排序）

| #   | 板块              | 必须     | 核心价值                             |
| --- | ----------------- | -------- | ------------------------------------ |
| 1   | 项目概述 + 技术栈 | 是       | AI 看到技术栈就知道语法、API、工具链 |
| 2   | 项目结构          | 是       | 知道文件放哪里，不会放错目录         |
| 3   | 编码规范          | 是       | "禁止"比"推荐"更有效                 |
| 4   | 测试要求          | 是       | 覆盖率目标 + 运行命令                |
| 5   | Git 规范          | 推荐     | 提交格式 + 分支策略                  |
| 6   | AI 行为约束       | **必填** | 明确红线避免破坏性操作               |
| 7   | 已知问题/待办     | 可选     | AI 修改相关代码时主动考虑约束        |

> 完整代码块模板 → `init-project.references/template-blocks.md`
> 快速启动最小模板 → 同上文件末尾「快速启动模板」节

---

## 生成流程（给 quest-designer 参考）

1. **PHASE 1 SCAN**: 扫描 package.json/pom.xml/go.mod、src/ 目录结构、已有测试和配置
2. **提取信息**: 从 package.json 提取技术栈和脚本、从 src/ 提取目录结构、从 .eslintrc 提取编码规范
3. **生成 CLAUDE.md**: 基于提取信息 + 7 板块模板，生成项目专属 CLAUDE.md
4. **PHASE 4 VERIFY**: 验证格式正确 + 信息准确
5. **PHASE 6 LEARN**: 记录"项目已初始化 CLAUDE.md"到知识沉淀

---

## 使用时机

**必须加载**：

- 新项目初始化（用户提到新项目、生成 CLAUDE.md）
- 现有项目缺少 CLAUDE.md（AI 反复犯同样错误）
- 团队统一 AI 行为规范时
- 项目重大重构后更新 CLAUDE.md

---

## 与 auto-cli 集成

- `/auto 为当前项目生成 CLAUDE.md` — 自动触发本 Skill
- quest-designer 在 PHASE 2 检查 CLAUDE.md 是否存在，缺失时推荐使用
- PHASE 6 LEARN 记录 CLAUDE.md 的生成和后续更新

---

## 常见错误

| 错误做法                 | 正确做法                                  |
| ------------------------ | ----------------------------------------- |
| 写了 1000 行的 CLAUDE.md | 控制在 200 行以内                         |
| 只写"代码要写好"这种废话 | 写具体规则："变量用 camelCase"            |
| 一次写完再也不更新       | CLAUDE.md 是活文档，项目演进时同步更新    |
| 把密钥写进 CLAUDE.md     | CLAUDE.md 会被提交到 Git，密钥只能放 .env |

---

## 验收标准

- [ ] 新生成的 CLAUDE.md 包含所有必填板块（概述、技术栈、编码规范、测试、AI 行为约束）
- [ ] AI 在新项目中首次对话即理解项目技术栈和编码规范
- [ ] CLAUDE.md 在重大架构变更后同步更新
