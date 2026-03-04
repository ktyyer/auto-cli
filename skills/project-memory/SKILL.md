---
name: project-memory
description: 项目记忆系统 - 让 AI MAX 记住每次对话，实现真正的项目上下文感知
---

# Project Memory - 项目记忆系统

> **解决核心痛点：每次都从头对话熟悉项目**

## 问题现状

当前 AI 辅助开发工具的核心问题：
- ❌ 每次新对话都要重新解释项目背景
- ❌ AI 不记得之前的架构决策
- ❌ 重复的编码模式需要反复强调
- ❌ 团队成员之间无法共享 AI 习得的知识

## 解决方案

借鉴 **Cursor Memories**、**Continue.dev**、**Aider** 等优秀工具的最佳实践，构建三层记忆体系：

---

## 📚 三层记忆体系

### Layer 1: 对话记忆（Session Memory）

**作用**：记住当前对话中的上下文和决策

**存储内容**：
```yaml
session_memory:
  session_id: "sess-20260303-001"
  start_time: "2026-03-03T10:00:00Z"
  project_path: "/path/to/project"

  # 任务摘要
  tasks_completed:
    - "实现用户认证 API (JWT)"
    - "修复订单计算 bug"
    - "重构 UserService 层"

  # 架构决策
  decisions:
    - decision: "使用 JWT 进行无状态认证"
      reason: "避免服务端 session 存储"
      timestamp: "2026-03-03T10:30:00Z"

  # 编码模式
  patterns_observed:
    - pattern: "Controller 返回 Result<T>"
      files: ["UserController.java", "OrderController.java"]
      count: 5

  # 问题和解决方案
  lessons_learned:
    - problem: "MyBatis #{} 传参报错"
      solution: "使用 ${} 传动态字段名"
      timestamp: "2026-03-03T11:00:00Z"
```

**自动触发时机**：
- 每次使用 `/aimax:auto` 完成任务后
- 用户手动触发 `/aimax:memory-save`
- 每次对话结束时自动保存

---

### Layer 2: 项目记忆（Project Memory）

**作用**：跨会话持久化项目知识

**存储路径**：`.aimax/memory/project-{hash}.yaml`

```yaml
project_memory:
  project_id: "proj-abc123"
  project_name: "电商后台管理系统"
  git_url: "https://github.com/user/project.git"
  created_at: "2026-02-01"
  updated_at: "2026-03-03"

  # 项目元信息
  metadata:
    language: "Java"
    framework: "Spring Boot 3.2"
    database: "MySQL 8.0"
    build_tool: "Maven"

  # 架构概览（自动提取）
  architecture:
    layers:
      - name: "Controller 层"
        path: "src/main/java/com/eco/controller/"
        responsibility: "API 接口定义"
      - name: "Service 层"
        path: "src/main/java/com/eco/service/"
        responsibility: "业务逻辑"

  # 编码规范（从 CLAUDE.md + Instincts 学习）
  conventions:
    - rule: "所有 Controller 方法返回 Result<T>"
      source: "CLAUDE.md"
      confidence: 1.0
    - rule: "Service 层方法加 @Transactional"
      source: "Instinct (12 次观察)"
      confidence: 0.85
    - rule: "使用 LambdaQueryWrapper 而非 QueryWrapper"
      source: "java-coding-style.md"
      confidence: 1.0

  # 历史任务记录
  task_history:
    - task_id: "task-001"
      description: "实现用户认证 API"
      date: "2026-02-15"
      files_modified:
        - "AuthController.java"
        - "JwtTokenProvider.java"
      patterns_used:
        - "Result<T> 包装"
        - "@Transactional"

  # 常见问题 FAQ
  faq:
    - question: "如何处理分页查询？"
      answer: |
        使用 Page<T> + PageInfo<T> 模式：
        ```java
        Page<User> page = new Page<>(pageNum, pageSize);
        IPage<User> result = userMapper.selectPage(page, wrapper);
        return PageInfo.of(result, UserDTO::from);
        ```
      related_files: ["UserService.java", "UserController.java"]

  # 技术债务
  tech_debt:
    - item: "OrderService 缺少单元测试"
      priority: "高"
      created_at: "2026-02-20"
```

**自动更新时机**：
- 每次使用 `/aimax:auto` 完成任务
- 检测到项目结构变化（新增/删除文件）
- 手动触发 `/aimax:memory-sync`

---

### Layer 3: 跨项目通用知识（Team Knowledge）

**作用**：团队共享的编码模式和最佳实践

**存储路径**：`.aimax/memory/team-knowledge.yaml`

```yaml
team_knowledge:
  team_id: "team-default"
  created_at: "2026-01-01"
  updated_at: "2026-03-03"

  # 通用编码模式
  patterns:
    - pattern_id: "java-spring-api-response"
      name: "Spring Boot API 统一响应"
      description: "所有 Controller 方法返回 Result<T> 包装"
      code_template: |
        ```java
        @GetMapping("/users/{id}")
        public Result<UserDTO> getUser(@PathVariable Long id) {
            return Result.success(userService.findById(id));
        }
        ```
      tags: ["java", "spring", "api"]
      usage_count: 45

    - pattern_id: "python-django-model"
      name: "Django Model 最佳实践"
      description: "Model 字段添加 verbose_name 和 help_text"
      code_template: |
        ```python
        class User(models.Model):
            name = models.CharField(
                max_length=100,
                verbose_name="用户名",
                help_text="请输入用户名"
            )
        ```

  # 反模式（不要这样做）
  anti_patterns:
    - pattern_id: "java-sql-injection-risk"
      name: "SQL 注入风险"
      bad_example: "WHERE username = '${username}'"
      fix: "使用 #{} 参数化查询"
      severity: "critical"
```

**使用场景**：
- 新项目初始化时自动加载
- 从优秀项目导出模式
- 团队成员之间共享

---

## 🚀 核心能力

### 1. 智能上下文检索

当用户提出问题时，自动检索相关记忆：

```text
用户: 添加一个用户查询 API

AI 内部流程:
1. 检测项目类型: Spring Boot
2. 检索项目记忆:
   - 找到 5 个类似的 Controller 示例
   - 找到 "Result<T> 包装" 模式（置信度 0.95）
   - 找到分页查询最佳实践
3. 检索对话记忆:
   - 上次实现的 OrderController 模式
4. 综合应用生成代码
```

### 2. 记忆索引系统

**借鉴 Continue.dev 的 RAG 索引机制**：

```yaml
index_config:
  # 文件索引
  files_index:
    - path: "src/main/java/**/*.java"
      chunk_size: 500  # tokens
      overlap: 50
      metadata:
        - "language"
        - "framework"
        - "layer"

  # 代码片段索引
  snippets_index:
    - type: "controller-method"
      extract_pattern: "@.*Mapping.*public Result<.*>.*\\(.*\\)"
      store_example: true

  # 决策索引
  decisions_index:
    - type: "architecture"
      extract_pattern: "架构决策:|技术选型:|为什么"
```

### 3. 记忆衰减与更新

```yaml
memory_decay:
  # 对话记忆：7 天后衰减
  session_memory:
    ttl: 7 days
    decay_rate: 0.1

  # 项目记忆：长期保留，但更新频率
  project_memory:
    ttl: never
    auto_update: true

  # 团队知识：永久保留
  team_knowledge:
    ttl: never
    manual_update: true
```

---

## 📋 命令接口

### 查看记忆状态

```bash
/aimax:memory-status
```

输出：

```markdown
## 📊 项目记忆状态

**项目**: 电商后台管理系统
**记忆条目**: 127 条
**上次更新**: 2 小时前

### 记忆分布
- 对话记忆: 5 条（最近 7 天）
- 项目记忆: 98 条
- 团队知识: 24 条

### 热门模式
1. Result<T> 包装 - 使用 45 次
2. @Transactional - 使用 32 次
3. LambdaQueryWrapper - 使用 28 次

### 最近决策
- [2026-03-03] 使用 JWT 进行无状态认证
- [2026-03-01] 订单状态机改为 State 模式
```

### 手动保存记忆

```bash
/aimax:memory-save
```

### 同步项目记忆

```bash
/aimax:memory-sync
```

作用：
- 重新扫描项目结构
- 更新架构概览
- 提取新的编码模式

### 导出/导入记忆

```bash
/aimax:memory-export team-knowledge.yaml
/aimax:memory-import team-knowledge.yaml
```

### 清理过期记忆

```bash
/aimax:memory-cleanup --older-than 30d
```

---

## 🔒 隐私与安全

**借鉴 Cursor 的隐私保护机制**：

1. **本地存储**：所有记忆数据仅存储在本地
2. **加密存储**：敏感信息（如 API 密钥）自动加密
3. **Git 忽略**：`.aimax/memory/` 已加入 `.gitignore`
4. **选择性上传**：团队知识需要手动导出才可共享

---

## 🎯 与 /aimax:auto 集成

**自动触发记忆更新**：

```text
每次 /aimax:auto 执行流程第 8 步（经验沉淀）时：

1. 提取 Instinct 模式（已有）
2. 更新对话记忆（新增）
   - 记录本次任务摘要
   - 记录架构决策
   - 记录编码模式
3. 更新项目记忆（新增）
   - 如果是新项目，创建项目档案
   - 更新架构概览
   - 添加 FAQ 条目
4. 智能推荐
   - 如果检测到技术债务，提示记录
   - 如果发现反模式，建议改进
```

**对话启动时自动加载**：

```text
每次新对话开始时（第 1 步项目上下文检测）：

1. 读取 CLAUDE.md（项目规范）
2. 读取项目记忆（新增）
   - 加载项目架构概览
   - 加载编码规范
   - 加载常见 FAQ
3. 读取团队知识（新增）
   - 匹配相关模式
4. 综合应用
```

---

## 📈 收益对比

| 指标 | 无记忆系统 | 有记忆系统 | 提升 |
|------|-----------|-----------|------|
| **首次对话质量** | 中等（需解释背景） | 高（自动加载上下文） | +40% |
| **后续对话质量** | 低（重新解释） | 高（记住历史） | +80% |
| **代码一致性** | 中等（需强调） | 高（自动应用模式） | +60% |
| **新成员上手** | 慢（需口传） | 快（导入团队知识） | +70% |
| **重复工作** | 多（反复说明） | 少（AI 记住） | -50% |

---

## 🛠️ 技术实现

### 存储格式

- **YAML** - 人类可读，易于编辑
- **JSON** - 机器可读，便于索引
- **SQLite** - 可选：复杂查询场景

### 索引技术（可选高级功能）

- **向量数据库**（Chroma/Milvus）- 语义搜索
- **倒排索引** - 关键词搜索
- **Trie 树** - 自动补全

### 与现有系统集成

```yaml
integrations:
  # 与 continuous-learning 集成
  continuous_learning:
    auto_sync: true
    instinct_to_memory: true

  # 与 repo-map 集成
  repo_map:
    auto_update_architecture: true

  # 与 context-compression 集成
  context_compression:
    memory_as_anchor: true
```

---

## 🎓 最佳实践

### DO ✅

1. **定期同步记忆**：每次重大改动后运行 `/aimax:memory-sync`
2. **维护 FAQ**：遇到重复问题时，手动添加到 FAQ
3. **导出团队知识**：优秀项目的模式导出共享
4. **清理过期记忆**：每月运行一次 `/aimax:memory-cleanup`

### DON'T ❌

1. **不要过度依赖**：记忆是辅助，不是替代思考
2. **不要盲目应用**：记忆的模式可能过时，需验证
3. **不要忽视冲突**：当 CLAUDE.md 与记忆冲突时，以 CLAUDE.md 为准

---

## 📚 开源借鉴

本项目借鉴了以下优秀开源项目的最佳实践：

- **Cursor Memories** - 项目级记忆存储、架构概览
- **Continue.dev** - RAG 索引、代码库理解
- **Aider** - Git 集成、多文件编辑记忆
- **SWE-agent** - Agent 状态机、决策追踪
- **OpenDevin/OpenHands** - 多 Agent 协作记忆

---

## 🚀 未来演进

### v2.0 规划

- [ ] **语义搜索**：集成向量数据库，实现自然语言查询记忆
- [ ] **跨项目模式迁移**：自动将一个项目的成功模式应用到新项目
- [ ] **记忆可视化**：Web UI 展示项目知识图谱
- [ ] **AI 驱动记忆整理**：自动合并重复条目，提炼高价值模式

### v3.0 愿景

- [ ] **团队协作记忆**：云同步，团队成员共享 AI 习得的知识
- [ ] **记忆市场**：优秀项目的记忆库可分享/交易
- [ ] **自主记忆进化**：AI 自动重组记忆，形成更高级的 Skill

---

## 核心原则

1. **渐进增强** - 从简单开始，逐步积累
2. **用户控制** - 用户可以查看、编辑、删除任何记忆
3. **隐私优先** - 本地存储，绝不泄露敏感信息
4. **可解释** - 每个 AI 决策都能追溯到具体的记忆来源
5. **不臃肿** - 只记录必要信息，避免过度复杂
