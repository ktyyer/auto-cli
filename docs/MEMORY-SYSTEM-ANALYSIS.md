# 记忆系统对比分析：auto-cli vs Vibe-Skills

## 现状对比

### auto-cli 当前记忆能力（三层）

| 层级 | 组件 | 状态 | 存储位置 | 覆盖范围 |
|------|------|------|---------|---------|
| **L1 会话层** | conversational-state-machine | ✅ 已实现 | `.auto/state/session-state.json` | 单会话内状态管理 |
| **L2 项目层** | project-memory | ✅ 已实现 | `.claude/skills/knowledge/` | 架构决策、编码模式 |
| **L3 语义层** | smart-context | ✅ 已实现 | 代码索引 | 项目代码 RAG 检索 |
| **L4 图谱层** | - | ❌ **缺失** | - | 跨项目知识积累 |

### Vibe-Skills 记忆能力（四层）

| 层级 | 组件 | 状态 | 存储位置 | 覆盖范围 |
|------|------|------|---------|---------|
| **L1 会话层** | state_store | ✅ | 会话内存 | 执行进度、临时状态 |
| **L2 项目层** | Serena | ✅ | 项目知识库 | 架构决策、技术规范 |
| **L3 语义层** | ruflo | ✅ | 向量缓存 | 会话内语义检索 |
| **L4 图谱层** | Cognee | ✅ | 实体关系图谱 | 跨会话知识积累 |

### 专属记忆技能对比

| 功能 | auto-cli | Vibe-Skills | 借鉴价值 |
|------|----------|-------------|---------|
| **知识管家** | ❌ 无 | knowledge-steward（Obsidian + GitHub） | 🔥 高 |
| **数字大脑** | ❌ 无 | digital-brain（个人知识库） | 🔥 高 |
| **上下文折叠** | context-compression | deepagent-memory-fold | ✅ 已有类似 |
| **个人偏好** | ❌ 无 | mem0（可选） | 🟡 中 |
| **记忆块映射** | ❌ 无 | Letta（Token 压力策略） | 🟡 中 |

---

## 核心差异分析

### 1. 知识沉淀机制

**Vibe-Skills 的优势**：
- **一句话保存**：用户说"保存这个提示词"，知识立即写入 Obsidian + GitHub
- **永久归档**：所有灵感、踩坑、有效 Prompt 永久可查
- **跨会话复用**：新会话自动载入相关历史知识

**auto-cli 的现状**：
- 会话结束时自动生成摘要（依赖用户触发）
- 手动记录到 `.claude/skills/knowledge/`（需要主动操作）
- 没有快速保存机制（如"save this insight"）

**改进空间**：
```javascript
// 当前：手动记录
用户：记录这个决策到 CRITICAL.md
AI：[手动写入文件]

// 改进：一键保存
用户：保存这个提示词
AI：[自动提取 → 分类 → 写入知识库 → Git 提交]
```

### 2. 跨项目知识积累

**Vibe-Skills 的优势**：
- **实体关系图谱**：技术栈、设计模式、最佳实践自动关联
- **越用越聪明**：每次对话都积累新的实体关系
- **跨项目查询**："React 性能优化"自动汇总所有项目的经验

**auto-cli 的现状**：
- 每个项目独立记忆（`.claude/skills/knowledge/`）
- 无法跨项目积累经验
- 重复遇到相同问题时需要重新分析

**改进空间**：
```javascript
// 当前：项目隔离
项目 A: 学会了 React 性能优化技巧
项目 B: 再次遇到同样问题，需要重新分析

// 改进：图谱积累
项目 A: 学会 React 性能优化 → 存入图谱
项目 B: 自动检索"React 性能" → 立即获得项目 A 的经验
```

### 3. 个人知识库

**Vibe-Skills 的优势**：
- **digital-brain**：管理身份定位、内容创作、人脉网络、项目复盘
- **结构化存储**：时间线、关系网、知识图谱
- **工作台集成**：一个命令访问所有个人知识

**auto-cli 的现状**：
- 没有个人知识库概念
- 无法管理非项目相关的知识（如人脉、创意）

**改进空间**：
```javascript
// 新增能力
/auto:save-insight "React Hooks 的依赖陷阱" --tag performance
/auto:query-insights "React 性能优化"
/auto:network add "张三" --role "前端架构师" --context "React 专家"
```

---

## 借鉴方案：三层渐进式实施

### 阶段 1：知识管家（v0.3.1）- 🔥 高优先级

**目标**：实现"一句话保存灵感"

**新增技能**：`knowledge-steward`

**核心功能**：
```javascript
// 1. 一键保存
用户：保存这个提示词
AI: 自动提取当前对话中的关键 Prompt → 写入 `.auto/insights/prompts.md`
用户：记录这个踩坑经验
AI: 提取问题 + 解决方案 → 写入 `.auto/insights/traps.md`

// 2. 智能分类
自动识别内容类型：
- Prompt → `.auto/insights/prompts.md`
- 踩坑 → `.auto/insights/traps.md`
- 架构决策 → `.claude/skills/knowledge/essential/CRITICAL.md`
- 编码模式 → `.claude/skills/knowledge/essential/PATTERNS.md`

// 3. Git 自动提交
保存后自动：git add insights/ && git commit -m "docs: save insight about React Hooks"
```

**实施清单**：
- [ ] 创建 `src/knowledge/` 目录
- [ ] 实现 `KnowledgeSteward` 类
- [ ] 定义内容分类规则
- [ ] 添加 `/auto:save` 命令
- [ ] 集成 Git 自动提交
- [ ] 编写单元测试

**预估工作量**：3-4 小时

### 阶段 2：跨项目知识图谱（v0.4.0）- 🔥 高优先级

**目标**：实现"越用越聪明"的知识积累

**新增模块**：`knowledge-graph`

**核心功能**：
```javascript
// 1. 实体提取
从每个项目的知识中提取：
- 技术栈：React, TypeScript, Vitest...
- 设计模式：Strategy, Observer, Singleton...
- 最佳实践：TDD, 80% 覆盖率, 不可变性...
- 常见陷阱：React 依赖泄露, TypeScript 类型推断...

// 2. 关系图谱
{
  "React": {
    "related": ["Hooks", "TypeScript", "Performance"],
    "patterns": ["useCallback 优化", "useMemo 缓存"],
    "traps": ["依赖数组陷阱", "闭包陷阱"]
  },
  "TDD": {
    "related": ["Vitest", "Coverage", "Refactor"],
    "patterns": ["先写测试", "红灯-绿灯-改进"],
    "projects": ["project-a", "project-b"] // 跨项目积累
  }
}

// 3. 跨项目查询
用户：React 性能优化有哪些技巧？
AI: [检索图谱] → 从所有项目中汇总 → 返回综合答案
```

**实施清单**：
- [ ] 创建 `src/graph/` 目录
- [ ] 实现 `KnowledgeGraph` 类
- [ ] 定义实体类型和关系
- [ ] 实现跨项目检索
- [ ] 添加 `/auto:query` 命令
- [ ] 编写单元测试

**预估工作量**：5-6 小时

### 阶段 3：个人知识库（v0.5.0）- 🟡 中优先级

**目标**：管理身份、人脉、创意等非项目知识

**新增模块**：`digital-brain`

**核心功能**：
```javascript
// 1. 知识类别
- Identity: 身份定位、职业目标、核心能力
- Network: 人脉网络、协作历史
- Ideas: 创意灵感、待办事项
- Reviews: 项目复盘、经验总结

// 2. 使用示例
/auto:brain add identity "高级前端架构师" --skills "React, TypeScript, Node.js"
/auto:brain add network "李四" --role "产品经理" --company "ABC"
/auto:brain add idea "开发一个 AI 驱动的 CLI 工具" --tag startup
/auto:brain review 2026-Q1 --summary "完成了 3 个重点项目"

// 3. 检索和关联
用户：推荐一个前端专家
AI: [检索 Network] → 返回人脉列表 + 协作历史
```

**实施清单**：
- [ ] 创建 `src/brain/` 目录
- [ ] 实现 `DigitalBrain` 类
- [ ] 定义知识模型
- [ ] 添加 `/auto:brain` 命令
- [ ] 实现关联检索
- [ ] 编写单元测试

**预估工作量**：4-5 小时

---

## 技术架构设计

### 存储结构

```
.auto/
├── insights/                    # 知识管家的快速笔记
│   ├── prompts.md              # 有效 Prompt 汇总
│   ├── traps.md                # 踩坑经验
│   ├── patterns.md             # 设计模式应用
│   └── decisions.md            # 决策记录
│
├── graph/                      # 知识图谱（跨项目）
│   ├── entities.json           # 实体定义
│   ├── relations.json          # 关系映射
│   └── index.json              # 反向索引
│
├── brain/                      # 个人知识库
│   ├── identity.json           # 身份定位
│   ├── network.json            # 人脉网络
│   ├── ideas.json              # 创意灵感
│   └── reviews.json            # 复盘记录
│
└── state/                      # 会话状态（已有）
    └── session-state.json
```

### 模块依赖

```
knowledge-steward（知识管家）
    ↓ 保存到
.insights/ + .claude/skills/knowledge/

knowledge-graph（知识图谱）
    ↓ 读取
.auto/graph/ + .claude/skills/knowledge/
    ↓ 提供
跨项目检索能力

digital-brain（个人知识库）
    ↓ 独立存储
.auto/brain/
    ↓ 关联
knowledge-graph（可选）
```

---

## 与 Vibe-Skills 的差异

### 保持简化的策略

| Vibe-Skills | auto-cli | 理由 |
|------------|----------|------|
| Cognee（复杂图谱引擎） | 简化 JSON 图谱 | 降低依赖，易维护 |
| Obsidian 集成 | Markdown 文件 | 轻量级，无需额外工具 |
| mem0（个人偏好） | 暂不实现 | 非核心需求 |
| Letta（记忆块映射） | 暂不实现 | 过度设计 |
| 向量数据库 | 关键词索引 | 足够使用，更简单 |

### 治理规则借鉴

✅ **采纳**：
- 单一权威源：每种记忆需求有且只有一个负责组件
- 显式写入：只有用户明确确认的内容才写入永久记忆
- Kill Switch：任何外部后端均可一键降级

❌ **不采纳**：
- episodic-memory 禁用（auto-cli 可以保留会话摘要）
- mem0 限制为个人偏好（auto-cli 暂不实现 mem0）

---

## 实施优先级

### 立即执行（v0.3.1）
- [x] 创建本文档
- [ ] 实现 knowledge-steward（知识管家）
- [ ] 添加 `/auto:save` 命令

### 短期规划（v0.4.0）
- [ ] 实现 knowledge-graph（知识图谱）
- [ ] 添加 `/auto:query` 跨项目检索
- [ ] 与现有 project-memory 集成

### 中期规划（v0.5.0）
- [ ] 实现 digital-brain（个人知识库）
- [ ] 添加 `/auto:brain` 命令
- [ ] 可视化知识图谱

### 长期优化（v0.6.0+）
- [ ] 引入向量数据库（可选）
- [ ] 与 Obsidian 集成（可选）
- [ ] mem0 个人偏好（可选）

---

## 成功标准

### v0.3.1（知识管家）
- [ ] 用户可以说"保存这个提示词"一键保存
- [ ] 自动分类到正确的文件
- [ ] Git 自动提交
- [ ] 保存的内容可被 project-memory 读取

### v0.4.0（知识图谱）
- [ ] 跨项目查询技术栈和模式
- [ ] 自动提取实体和关系
- [ ] 图谱持久化到文件
- [ ] 检索准确率 > 80%

### v0.5.0（个人知识库）
- [ ] 管理身份、人脉、创意
- [ ] 关联检索
- [ ] 时间线可视化

---

## 总结

### 核心价值

Vibe-Skills 的记忆机制最值得借鉴的三个点：

1. **知识管家**：一句话保存灵感，降低记录门槛
2. **知识图谱**：跨项目积累经验，越用越聪明
3. **个人知识库**：管理非项目知识，形成第二大脑

### 实施策略

**保持专注，渐进增强**：
- v0.3.1：知识管家（快速保存）
- v0.4.0：知识图谱（跨项目积累）
- v0.5.0：个人知识库（第二大脑）

**不做全量复制**：
- ❌ Cognee 复杂图谱引擎 → 简化 JSON 图谱
- ❌ Obsidian 硬依赖 → Markdown 文件
- ❌ mem0/Letta → 暂不实现

**借鉴架构模式**：
- ✅ 单一权威源
- ✅ 显式写入
- ✅ Kill Switch
- ✅ 一句话保存

---

**文档版本**: 1.0
**创建日期**: 2026-03-28
**下次审查**: v0.3.1 实施前
**相关文档**:
- [VIBE-SKILLS-ANALYSIS.md](./VIBE-SKILLS-ANALYSIS.md) - Vibe-Skills 架构分析
- [MEMORY-SYSTEM-DESIGN.md](./MEMORY-SYSTEM-DESIGN.md) - 记忆系统详细设计（待创建）
