---
description: 智能超级命令 - 自动完成需求分析、规划、编码、测试、审查
---

# /auto:auto — 智能超级命令

> **一个命令，自动完成所有事情**

输入你的需求，`/auto:auto` 会自动完成：需求分析 → 复杂度评估 → 规划设计 → 编码实现 → 测试验证 → 代码审查 → Git 提交 → 经验沉淀。

---

## 核心理念

- **零学习成本**：不需要记住其他命令，描述需求即可
- **全自动流程**：自动规划、编码、测试、审查、提交
- **Architect/Editor 双模型**：复杂任务推理与编辑分工，更精准
- **Diff-First 编辑**：优先 diff 修改，节省 token，变更清晰可追溯
- **Git Auto-Commit**：每个有意义的变更自动 commit，变更可回溯
- **Smart Guardrails**：安全操作自动执行，危险操作自动确认
- **Self-* 自我进化**：越用越聪明，从反馈中持续学习
- **Agentic 循环**：透明展示 Thought→Action→Observation→Reflection 过程

---

## 🆕 Architect/Editor 双模型策略（v5.0）

借鉴 **Aider** 的最佳实践，将"代码推理"与"代码编辑"解耦：

```yaml
Architect/Editor:
  触发条件: 复杂度 >= 中等
  
  Architect（推理模型）:
    职责:
      - 分析需求，理解业务上下文
      - 设计解决方案，确定修改范围
      - 列出具体要修改的文件和函数
      - 给出 diff 编辑指令（不直接编辑）
    输出: 结构化的编辑计划
  
  Editor（编辑模型）:
    职责:
      - 接收 Architect 的编辑计划
      - 精确执行 diff 级别的代码修改
      - 保证代码格式和风格一致
    输出: 实际代码变更
  
  简单任务:
    - 跳过 Architect，直接用 Editor 执行
```

---

## 🆕 Git Auto-Commit 策略（v5.0）

借鉴 **Aider** 的 Git 深度集成：

```yaml
Git Auto-Commit:
  触发: 门禁通过后自动执行
  
  Commit Message 规范（Conventional Commits）:
    - feat: 新功能
    - fix: 修复 bug
    - refactor: 重构
    - test: 添加测试
    - docs: 文档更新
  
  示例: "feat(user): add search API with pagination support"
  
  禁用: 用户可通过 --no-auto-commit 关闭
  
  安全:
    - 只提交已通过门禁的代码
    - 记录完整 diff 到 commit message body
    - 自动 stage 变更的文件（不 stage 无关文件）
```

---

## 🆕 Smart Guardrails 智能护栏（v5.0）

借鉴 **Cline** 的操作分级确认：

```yaml
Smart Guardrails:
  安全操作（自动执行，无需确认）:
    - 读取文件内容
    - 搜索代码
    - 分析代码结构
    - 查看 git 状态
  
  中等操作（默认自动，可配置确认）:
    - 编辑现有代码文件
    - 创建新文件
    - 运行测试命令
    - 运行构建命令
  
  危险操作（必须确认）:
    - 删除文件
    - 执行任意 shell 命令
    - 修改配置文件（pom.xml/package.json 等）
    - 修改数据库 schema
    - 推送到远程仓库
  
  配置: .aimax/guardrails.yaml
```

---

## 🆕 Diff-First 编辑模式（v5.0）

```yaml
Diff-First:
  原则: 优先使用精确 diff 编辑，而非全文重写
  
  策略:
    - 修改 < 20 行: 使用 search/replace block
    - 修改 20-100 行: 使用 unified diff
    - 新文件/全文重写: 仅在创建新文件时使用
  
  收益:
    - Token 消耗减少 60%+
    - 变更清晰可审查
    - 减少引入无关变更的风险
```

---

## Self-* 自我进化系统

```yaml
Self-Star System:
  Self-Aware:        # 自我感知：理解项目编码模式、识别团队风格
  Self-Improving:    # 自我改进：编译器/测试/审查/用户反馈 → 自动优化
  Self-Fixing:       # 自修复：检测失败 → 自动修复（最多 3 次）→ 回滚
  Self-Building:     # 自构建：首次使用自动初始化 + 从历史提取技能
```

详细文档：`skills/self-star/SKILL.md`

---

## Agentic 循环

```yaml
ReACT Loop（最多 5 次迭代）:
  1. Thought（思考）: 分析当前状态，制定计划
  2. Action（行动）: 执行具体操作
  3. Observation（观察）: 收集结果，检测问题
  4. Reflection（反思）: 评估质量，识别改进空间
  5. Decision（决策）: 继续优化或标记完成
```

---

## 执行流程

```
用户输入需求
      ↓
[步骤0] 会话初始化
  ├─ 读取 CLAUDE.md / REPO_MAP.md / .claude/rules/
  ├─ Self-Aware：检测项目上下文（语言/框架）
  ├─ 加载框架插件 + 已学习的编码模式
  └─ 检测未完成会话 → 提示恢复
      ↓
[步骤1] 复杂度评估
  🟢 简单（<30分钟）→ 直接 Editor 实现
  🟡 中等（30-120分钟）→ Architect + Editor + TDD + 审查
  🔴 复杂（>120分钟）→ 建议 /auto:deep-plan
      ↓
[步骤2] Smart Guardrails 分级 → 确定哪些操作自动、哪些确认
      ↓
[步骤3] 技能与插件自动调度（详见 auto-core.md 路由表）
      ↓
[步骤4] Agentic 循环（Diff-First 编辑）
  ├─ Architect 推理（复杂任务）→ 编辑计划
  ├─ Editor 执行 → diff 级别代码变更
  ├─ Self-Fixing：失败自动修复（最多 3 次）
  └─ 每次循环检查质量，决定继续或完成
      ↓
[步骤5] 自动化门禁（不可跳过）
  ✅ 编译/构建通过
  ✅ 所有测试通过
  ✅ 覆盖率达标（≥80%）
  ✅ 安全扫描通过
      ↓
[步骤6] Git Auto-Commit（语义化提交）
      ↓
[步骤7] 代码审查（安全 + 质量 + 性能）
      ↓
[步骤8] 经验沉淀
  ├─ continuous-learning 提取 Instinct
  ├─ 更新项目记忆（save_memory 持久化）
  └─ Self-Improving：从反馈中学习
      ↓
    完成！
```

---

## 复杂度评估规则

| 维度 | 简单 | 中等 | 复杂 |
|------|------|------|------|
| **关键词** | 函数、方法、变量、修复 | 模块、组件、接口、API | 系统、架构、集成、重构 |
| **文件数** | 1 个文件 | 2-5 个文件 | >5 个文件 |
| **依赖** | 无外部依赖 | 有外部 API | 有数据库/多服务 |

**复杂度修正**：有外部 API → +1 级 | 有 DB Schema 变更 → +1 级 | 跨 5+ 文件 → 提升至复杂

---

## 输出格式

### 开始执行

```markdown
🚀 **/auto:auto 开始执行**

📝 **任务**: [任务描述]
🎯 **复杂度**: [🟢/🟡/🔴] [级别]（预计 [时间]）
🧠 **模型策略**: [Editor Only / Architect + Editor]
🛡️ **护栏级别**: [auto / confirm-edits / confirm-all]

🔍 **项目上下文**:
  • 语言/框架: [检测结果]
  • 插件: [已加载插件]
  • 规范: [已加载规范]
```

### 完成报告

```markdown
✅ **任务完成！**

📊 **执行摘要**:
| 步骤 | 状态 | 详情 |
|------|------|------|
| 上下文检测 | ✅ | [框架] |
| Architect 推理 | ✅/⏭ | [方案摘要] |
| 编码实现 | ✅ | [Agentic 循环次数] |
| 门禁检查 | ✅ | 构建✅ 测试✅ 覆盖率✅ |
| Git 提交 | ✅ | [commit hash + message] |
| 代码审查 | ✅ | [评分] |

📁 **变更文件**: [文件列表]
🔄 **Git**: [commit 信息]
💡 **优化建议**: [如有]
```

---

## 与其他命令的关系

`/auto:auto` 是**超级命令**，内部自动调用所有能力。精细控制时可使用：

| 命令 | 用途 |
|------|------|
| `/auto:plan` | 只规划不编码 |
| `/auto:deep-plan` | 复杂重构/架构两阶段深度规划 |
| `/auto:status` | 查看项目状态和 Self-* 学习情况 |
| `/auto:help` | 查看所有可用命令 |

**推荐**：大多数情况下直接使用 `/auto:auto` 即可。

---

## 最佳实践

### ✅ 推荐

```bash
/auto:auto 用 Spring Boot 实现用户分页查询接口
/auto:auto 在 React 项目中实现可复用的表单组件
/auto:auto 审查最近的代码改动
/auto:auto 清理 UserService 的代码
```

### ❌ 不推荐

```bash
/auto:auto 写代码          # 太模糊
/auto:auto 重构整个系统      # 太复杂，建议用 /auto:deep-plan
```

---

**核心原则**：
1. **一个入口** — `/auto:auto` 完成所有事情
2. **Architect/Editor** — 推理与编辑分工，更精准
3. **Diff-First** — 精确变更，节省 token
4. **Git Auto-Commit** — 每步可回溯
5. **Smart Guardrails** — 安全自动化 + 危险确认
6. **Self-* 进化** — 越用越聪明
