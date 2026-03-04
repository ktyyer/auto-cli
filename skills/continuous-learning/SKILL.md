---
name: continuous-learning-v2
description: 持续学习系统（Instinct 模式） - 自动从用户行为中学习模式，支持置信度评分、导入导出和进化
---

# Continuous Learning v2 - 持续学习系统

> 让 AI 自动学习你的编码模式，越用越懂你

## 核心概念

### Instinct（本能/直觉）

Instinct 是从用户行为中提取的可复用模式：

```yaml
instinct:
  id: "inst-001"
  pattern: "Spring Controller 总是返回 Result<T> 包装"
  confidence: 0.85
  source: "观察到 12 次一致行为"
  action: "生成 Controller 方法时自动使用 Result<T>"
  evidence:
    - "UserController.java: getAllUsers() → Result<List<User>>"
    - "OrderController.java: getOrder() → Result<Order>"
  tags: ["java", "spring", "api-response"]
  created_at: "2026-02-27"
  updated_at: "2026-02-27"
```

---

## 🔁 PostTask 自动触发协议（无需关键词）

> **每次 `/aimax:auto` 完成后自动执行，不需要用户手动触发**

```
任务完成 → 自动提取以下信息：

1. 任务类型（功能开发/Bug修复/重构/审查）
2. 使用了哪些框架模式（Result<T>/ViewSet/Gin路由等）
3. 解决了哪类问题
4. 本次代码的关键决策

→ 输出简短 Instinct 候选条目：
  [Instinct候选] 模式: xxx | 来自: xxx | 置信度: 0.3（初始）

→ 若该模式已出现 3+次：自动晋升为 Instinct（置信度: 0.6）
→ 若该模式改变了项目结构：提示更新 CLAUDE.md
```

---

## 核心概念

### Instinct（本能/直觉）



### 1. 行为观察

在以下时机观察用户行为：

- 用户修改 AI 生成的代码时（偏好检测）
- 用户反复使用相同模式时（习惯检测）
- 用户明确指出"我总是这样做"时（显式学习）
- 代码审查中反复出现的修改意见

### 2. 模式提取

```text
观察 → 候选模式 → 验证（出现 3+ 次）→ Instinct
```

置信度评分：

| 出现次数 | 置信度 | 状态 |
|---------|--------|------|
| 1-2 次 | 0.3 | 候选 |
| 3-5 次 | 0.6 | 学习中 |
| 6-10 次 | 0.8 | 可靠 |
| 10+ 次 | 0.95 | 已确认 |

### 3. 主动应用

当置信度 >= 0.6 时，自动应用已学习的 Instinct：

```text
用户: 添加一个查询用户的 API

AI 内部: 检测到 inst-001（置信度 0.85）
         自动使用 Result<T> 包装返回值
         自动使用项目既定的分页模式
```

---

## Instinct 文件规范

### 存储路径

```
.aimax/instincts/
├── instincts.yaml         # 所有已学习的 instinct
├── candidates.yaml        # 候选模式（尚未确认）
└── exports/               # 导出文件
    └── team-instincts.yaml
```

### instincts.yaml 格式

```yaml
version: 2
instincts:
  - id: inst-001
    pattern: "Controller 方法返回 Result<T>"
    confidence: 0.85
    action: "自动应用 Result 包装"
    evidence:
      - "UserController: 12/12 次使用"
    tags: ["java", "spring"]
    
  - id: inst-002
    pattern: "Service 层方法加 @Transactional"
    confidence: 0.7
    action: "写 Service 时自动加事务注解"
    evidence:
      - "OrderService: 8/10 次使用"
    tags: ["java", "spring", "transaction"]
```

---

## 命令接口

### 查看已学习的 Instinct

```bash
/aimax:instinct-status
```

输出示例：

```markdown
## 🧠 已学习 Instincts (12 条)

| # | 模式 | 置信度 | 来源 |
|---|------|--------|------|
| 1 | Result<T> 包装 | ⬛⬛⬛⬛⬜ 0.85 | 12 次观察 |
| 2 | @Transactional | ⬛⬛⬛⬜⬜ 0.70 | 8 次观察 |
| 3 | Lombok @Data | ⬛⬛⬛⬛⬛ 0.95 | 20 次观察 |
| ... | ... | ... | ... |

候选模式: 3 条（待确认）
```

### 导入 Instinct

```bash
/aimax:instinct-import team-instincts.yaml
```

从团队成员或其他项目导入已学习的模式。

### 导出 Instinct

```bash
/aimax:instinct-export
```

将已学习的模式导出为 YAML 文件，方便团队共享。

### 进化 Instinct

```bash
/aimax:instinct-evolve
```

将相关的 Instinct 聚类合并为更高级的 Skill：

```text
inst-001 (Result<T> 包装)
inst-002 (@Transactional)     → 合并为 "Spring API 最佳实践" Skill
inst-003 (@Valid 参数校验)
```

---

## 与 CLAUDE.md 的关系

| 机制 | CLAUDE.md | Instinct |
|------|-----------|----------|
| 来源 | 人工编写/`/aimax:init` 生成 | 自动学习 |
| 粒度 | 项目级规范、命令 | 编码级个人习惯 |
| 更新 | 手动维护 | 自动演进 |
| 互补 | CLAUDE.md 定义"应该怎样" | Instinct 学习"实际怎样" |

两者互补：CLAUDE.md 是显式的项目规范，Instinct 是隐式的个人习惯。

---

## 与 auto-core 集成

auto-core 在执行任务时自动加载匹配的 Instinct：

```text
1. 读取 CLAUDE.md（项目规范，最高优先级）
2. 读取 .claude/rules/（编码规则集）
3. 读取 Instincts（个人/团队习惯模式）
4. 优先级：CLAUDE.md > rules > Instincts
5. 应用到代码生成
```


---

## 核心原则

1. **观察在先** — 不预设，从实际行为中学习
2. **渐进确认** — 置信度逐步提升，不过早下结论
3. **可解释** — 每个 Instinct 都有 evidence 和来源
4. **可覆盖** — 用户可以随时删除或修改任何 Instinct
5. **隐私安全** — Instinct 只存储在本地，不上传

---

## 开源借鉴

- **everything-claude-code Continuous Learning v2** — Instinct 模型、置信度评分、import/export/evolve
- **Kilo Memory Bank** — 持久化项目知识
- **Cursor Rules** — 项目级编码规范自动学习
