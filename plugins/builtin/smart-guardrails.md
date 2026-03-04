---
name: smart-guardrails
version: 1.0.0
description: 智能护栏系统 - 安全操作自动执行，危险操作自动确认
author: ai-max
priority: 95
builtin: true
---

# Smart Guardrails (智能护栏)

为了平衡 AI-MAX 的"**自动化效率**"和代码仓库的"**安全性控制**"，v5.0 引入了借鉴 Cline 的操作分级确认系统。

你可以随时放心运行 `/auto:auto`，而不必担心它悄悄运行 `rm -rf` 或是篡改重要的配置文件。

---

## 🛑 操作级别字典 (Actions Dictionary)

系统将 AI 可以执行的所有操作分为三种基础属性级别（在 `.aimax/guardrails.yaml` 中配置）：

### 🟢 级别 1: 安全操作 (Safe Actions)
这类操作没有破坏性，属于在进行分析思考。
- 读取文件、预览文件 (`readFile`, `viewCode`)
- 搜索代码、查找定义 (`searchCode`, `grep`)
- 查看项目结构信息 (`listDir`, `readPoms`)
- 检查 Git 状态 (`git status`)
- **策略：总是自动执行** (Always Auto-Approve)

### 🟡 级别 2: 中等风险操作 (Moderate Actions)
这类操作会改变本地区域工作状态，属于在进行正常的工作流。
- 编辑现有代码文件 (`editFile`, `replaceRange`)
- 创建新代码文件 (`createFile`)
- 在命令行运行普通的单元测试 (`npm test`, `mvn test`)
- 触发相关的代码构建 (`npm run build`)
- **策略：默认自动执行，提供开关切换到手动确认**。

### 🔴 级别 3: 危险操作 (Dangerous Actions)
这类操作可能导致生产环境破坏或重要的配置丢失。
- 物理删除或重命名文件 (`rm`)
- 任意的自定义 Shell 命令行脚本 (`run shell`)
- 对项目根构建文件大范围修改 (`package.json`, `pom.xml`, `.gitignore`)
- 触碰数据库连接配置和建表语句
- Git Push 操作
- **策略：必须总是手动确认** (Always Require Approval)

---

## ⚙️ 护栏配置模式

用户可以通过修改配置文件设置他们期望的监控力度：

### 1. 自动模式 (`auto`)
默认的最高效模式。
级别 1、级别 2 的操作会由于被认为是开发常规行为而**自动放行**。仅当请求执行**危险操作**时，终止代理循环并在控制台暂停，请求 `y/n` 回答。

### 2. 交互模式 (`confirm-edits`)
更谨慎的结对编程模式。
所有导致代码**变动**（哪怕是改动了一行变量）的级别 2 操作，都会在终端以 Diff 高亮的形式请求人工核对：
"AI 将用 X 替换 Y，是否通过？(y/n/modify)"

### 3. 全局拦截 (`confirm-all`)
最强的锁定模式。除了查看代码外，不允许任何实质性动作自动流转。

---

## 和 auto-core 的集成

当用户发起 `/auto:auto` 命令后，首先进入初始流程（步骤2）：
- 护栏网关拦截评估即将发生的流转意图。
- 当 AI 要执行一个非自动核准动作时，任务挂起并等待。
- 这个机制保障了无论上层的 Architect 给了怎样离谱的任务清单，底层的防线都不会在未经允许的情况下破坏工程的核心。
