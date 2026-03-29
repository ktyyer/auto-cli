# Auto CLI 发展路线图

> 最后更新: 2026-03-30
> 版本: v0.20.0

---

## 核心定位

**Auto CLI** = 超级开发辅助工具
- 不是简单的命令集合
- 是 AI 能力编排系统
- 目标: "一条命令，AI 自动完成"

---

## 已实现的核心能力

### v0.12.0 - Canonical Router (2026-03-29)
- ✅ AgentRegistry（11 个内置 Agent）
- ✅ 智能意图识别
- ✅ 优先级排序 + 回退链
- ✅ 默认路由（无匹配 → quest-designer）

**测试覆盖**: 38 个新测试

### v0.15.0 - Token 优化 (2026-03-28)
- ✅ 上下文压缩工具 (`compressContext`)
- ✅ Skill 按需加载索引 (`SkillIndexer`)
- ✅ 节省 30-80% Token

### Quest Designer v4
- ✅ 完整代码输出（CREATE 含 package+import）
- ✅ 精确锚点插入（MODIFY 含锚点+代码）
- ✅ 预判坑点 + 合约驱动
- ✅ 自验证 >= 10/15

### Reflection + Plan Mode Workflows (v0.20.0)
- ✅ 新增 reflection Skill（2026 年 5 大 Agent 设计模式之一）
- ✅ 新增 plan-mode-workflows Skill（4 种工作流自动检测）
- ✅ 更新 README 和 ROADMAP 反映最新能力

### TDD Guard
- ✅ 多语言支持（JS/TS/Java/Python/Go/Rust）
- ✅ 智能测试文件路径推断
- ✅ PreToolUse Hook 自动拦截
- ✅ 可配置排除目录

### Session Restore
- ✅ 会话历史分析（.jsonl）
- ✅ 关键信息提取
- ✅ 智能摘要压缩
- ✅ 时间过滤（只恢复相关上下文）

---

## 规划中的功能

### Phase 1（1-2 天）- 快速胜利
**优先级**: 🔥 立即可引入

- [x] **上下文管理最佳实践 Skill**（已在 unified-memory-system.md 中覆盖，无需单独创建）

- [x] **Agent 循环模式文档**（已在 rules/agents.md 第 53-119 行完整覆盖）

- [x] **README 最佳实践章节**（已在 README.md v0.20.0 中完成）

- [x] **Reflection 反思能力 Skill**
  - 文件: `skills/reflection.md`
  - 内容: 即时/交叉/累积三种反思模式 + 检查清单
  - 价值: 补齐 2026 年 5 大 Agent 设计模式

- [x] **Plan Mode 4 种工作流模式 Skill**
  - 文件: `skills/plan-mode-workflows.md`
  - 内容: Explore/Implement/Fix/Review 自动检测 + 上下文策略
  - 价值: 减少 50% 上下文浪费

---

### Phase 2（3-5 天）- 核心增强
**优先级**: 🔶 中期规划

- [ ] **Plan Mode 4 种工作流模式**
  - 修改: `commands/auto.md` PHASE 1
  - 功能: 探索/实现/修复/审查模式自动检测
  - 价值: 增强智能化，减少上下文浪费

- [ ] **Quest Designer v4 Agent 循环增强**
  - 修改: `agents/quest-designer.md`
  - 功能: 强化循环逻辑，自验证机制
  - 价值: 提高蓝图质量

---

### Phase 3（1-2 周）- 系统升级
**优先级**: 🔶 核心差距补齐

- [ ] **TodoLists 系统**
  - 新建: `plugins/task-system.md`
  - 功能: 依赖感知 + 跨会话持久化 + 并行执行
  - 架构: 类似 Loop State Machine
  - 价值: 与现有编排能力形成互补

- [ ] **任务状态可视化**
  - 快捷键: `Ctrl+T`（或类似）
  - 状态: 已完成/进行中/待处理/被阻塞
  - 价值: 透明化进度

---

### Phase 4（2-4 周）- 安全增强
**优先级**: 🔷 长期战略

- [ ] **安全分类器（轻量版 Auto Mode）**
  - 新建: `rules/security-classifier.md`
  - 功能: 风险模式白名单/黑名单
  - 集成: Hook 系统
  - 价值: 提升安全性，减少误操作

---

## 不在规划内的功能

| 功能 | 拒绝理由 |
|------|---------|
| **完整 Auto Mode** | 官方仅限 Team 用户，需 ML 分类器，成本过高 |
| **深度思考模式** | 依赖 Claude 3.7+ 模型能力，非项目可控 |
| **700+ Skills 仓库** | 与现有 15 个 Skills 重复，维护成本高 |
| **中文开发套件** | 项目定位是全球工具，非特定区域 |
| **官方 Skills 市场** | 需官方支持，非核心功能 |

---

## 竞争优势分析

### Auto CLI 独有（官方/社区未提供）
- ✅ Canonical Router - 中心化路由
- ✅ Quest Designer v4 - 完整代码蓝图
- ✅ 按规模自动选择执行模式
- ✅ Token 优化 30-80%

### 与官方对标
- ✅ TDD Guard（官方无强制）
- ✅ 上下文压缩（官方无系统化）
- ✅ Session Restore（官方无跨会话）

### 社区最佳实践整合
- ✅ Vibe Coding（上下文管理）
- ✅ awesome-claude-code（资源精选）
- ✅ TDD Guard（Nizar Selander）

---

## 技术债务

### 需要重构
- [ ] `REPO_MAP.md` - 需要自动化生成脚本，当前手动维护易过时
- [ ] `commands/auto.md` - PHASE 流程描述过长，可考虑模块化拆分
- [ ] 测试覆盖率 - 部分模块 < 80%

### 需要优化
- [ ] 缓存失效策略 - 当前是 24h 硬编码
- [ ] 错误处理 - 部分 Agent 缺少降级逻辑
- [ ] 文档同步 - README 与实际功能有差距

---

## 版本规划

### v0.20.0（当前）
**主题**: 社区最佳实践整合
- 新增 reflection Skill（反思能力）
- 新增 plan-mode-workflows Skill（4 种工作流模式）
- 确认上下文管理和 Agent 循环已在既有文件中完整覆盖

### v0.19.0
**主题**: 精简优化
- 删除 3 个冗余 Skills（agentic-workflow-patterns, coding-standards, model-selection-guide）
- 精简 2 个 Skills 为快速参考（chrome-devtools-mcp, git-worktree）
- 修正 REPO_MAP.md 幻影引用
- 文档与代码一致性校验

### v0.21.0（计划下一步）
**主题**: 安全增强
- 安全分类器（轻量版 Auto Mode）
- Hook 集成增强

---

## 社区生态

### 官方仓库
- https://github.com/ktyyer/auto-cli

### 参考资源
- https://github.com/hesreallyhim/awesome-claude-code
- https://github.com/VoltAgent/awesome-claude-skills
- https://github.com/modelcontextprotocol/servers

### 贡献指南
- PR 欢迎
- Issue 先讨论
- 测试覆盖率 >= 80%
- 遵循现有编码风格

---

## 研究计划

### 季度更新（每 3 个月）
- [ ] 2026-06-29 - 下次全网研究
- [ ] 2026-09-29 - Q3 研究
- [ ] 2026-12-29 - Q4 研究

### 持续跟踪
- Claude Code 官方更新
- awesome-claude-code 仓库
- MCP 生态发展
- GitHub Trending

---

**路线图维护**: 定期更新（每月或重大功能发布时）
**反馈渠道**: GitHub Issues
**讨论渠道**: GitHub Discussions
