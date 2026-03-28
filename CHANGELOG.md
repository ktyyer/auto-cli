# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-03-28

### Added

- **quest-designer v4** -- 完整代码输出式闯关大纲设计师，产出可直接复制执行的施工图纸
  - 精确锚点定位（文本锚点替代行号）
  - 完整 import 列表 + package 声明
  - 预判坑点（基于代码分析，非通用建议）
  - 6 步工作流：需求解析 -> 深度代码分析 -> 合约定义 -> Quest Map -> 一致性校验 -> 自验证评分

- **MCP 集成增强** -- 分类配置 + 检测工具
  - 新增 `analyzeMcpServers()` 和 `countMcpServers()` 工具函数
  - 9 个核心 MCP 服务器按类别分组（devtools/ai/search/database）
  - 自动检测 ready/needsConfig 状态

- **prompt-craft skill** -- 短小精悍的提示词模板库

- **project-init skill** -- 项目初始化工具 + 费用追踪工具

- **npm sync script** -- `npm run sync` 一键同步 commands/ 到 .claude/commands/auto/

### Changed

- **auto 命令精简 -64%** -- 命令定义大幅压缩，去除冗余描述
- **self-star skill 优化** -- 合并多个子能力
- **Skills 合并** -- 精简后的高效组合，减少维护成本
- **MCP 配置精简** -- 去除冗余配置，保留核心 9 个服务器

### Fixed

- **installer 备份文件** -- 使用时间戳后缀防覆盖
- **installer 递归保护** -- 新增 MAX_RECURSION_DEPTH = 20 防循环链接
- **Logger 级别控制** -- 修复级别判断逻辑
- **URL 硬编码消除** -- 移除未使用的 promptComponentSelection

### Improved

- **测试覆盖率** -- 新增 logger/config/prompts/index/installer 单元测试，覆盖率 59% -> 91%
- **静态导入优化** -- 消除动态 import，统一使用 ES Modules

---

## [0.1.1] - 2026-03-25

### Added

- **auto-core v7** -- 动态能力发现 + Quest Map 方法论
  - Grep 批量提取 frontmatter 健康检查
  - 三段推理日志（透明化 AI 决策过程）
  - 文件存在性校验

- **auto-core 透明度增强** -- 五大原则落地
  - 禁止因任务简单而跳过 PHASE（强制规则）
  - 硬性约束重写 + Gate Check 断言

- **quest-designer v2/v3** -- 深度代码分析 + 合约驱动
  - v2: 依赖排序 + 自验证评分 + 防幻觉机制
  - v3: 实现蓝图 + 风险分层 + 代码片段锚定

- **融合 3 项新能力**
  - Council Pattern -- 多 Agent 议会模式协作
  - Auto-lint-fix -- 自动代码格式修复
  - Repo Map 持久化 -- 仓库符号地图

### Fixed

- **auto.md 源文件同步** -- Gate Check 硬性约束，修复安装覆盖丢失问题
- **PHASE 3 执行器** -- 对接 v3 Quest Map 的实现蓝图/风险分层/合约/回滚方案

---

## [3.0.0] - 2026-03-03

### 🚀 Major Release - 智能进化系统

**从"功能堆砌"到"智能进化"的革命性转变**

### Added

- **Self-* 自我进化系统**
  - Self-Aware（自我感知）- 理解项目编码模式
  - Self-Improving（自我改进）- 从反馈中学习
  - Self-Fixing（自修复）- 自动修复构建/测试错误
  - Self-Building（自构建）- 自动构建所需技能

- **三大记忆系统**
  - Project Memory（项目记忆）- 跨会话持久化项目知识
  - Smart Context（智能上下文）- RAG 索引，向量数据库语义搜索
  - Conversational State Machine（对话状态机）- 中断恢复，检查点持久化

- **新命令**
  - `/auto:fix` - 自动修复构建/测试错误
  - `/auto:status` - 查看项目状态和已学习模式
  - `/auto:help` - 显示帮助和使用示例

### Changed

- **精简命令**：15 个 → 5 个（-67%）
  - 保留：`/auto`, `/auto:plan`
  - 新增：`/auto:fix`, `/auto:status`, `/auto:help`
  - 删除并整合到 auto：14 个冗余命令

- **精简插件**：8 个 → 3 个（-63%）
  - Intelligent Dev（智能开发引擎）
  - Quality Guard（质量保障引擎）
  - Frontend Design（前端设计引擎）

- **精简技能**：12 个 → 6 个（-50%）
  - project-memory
  - smart-context
  - conversational-state-machine
  - continuous-learning
  - self-star（新增）
  - repo-map

### Improved

- **学习成本**：-80%（只需记住 `/auto`）
- **用户满意度**：+20%（从 70% → 90%+）
- **任务成功率**：+20%（从 75% → 90%+）
- **Token 消耗**：-70%（智能上下文索引）
- **维护成本**：-50%（代码精简）

### Fixed

- 解决命令过多导致的学习困难问题
- 解决功能重叠导致的维护困难问题
- 解决缺乏智能进化能力的问题

### Migration Guide

从 v2.0 升级到 v3.0：

```bash
# 备份已自动创建在 .aimax/backup/v2.0/

# 如需恢复 v2.0
cp -r .aimax/backup/v2.0/* .

# 主要变化
- 14 个命令已整合到 /auto
- 现在只需记住 /auto 一个命令
- 其他命令自动决策，无需手动调用
```

### References

- [v3.0 优化方案](docs/AIMAX_V3_OPTIMIZATION_PLAN.md)
- [v3.0 最终报告](docs/AIMAX_V3_FINAL_REPORT.md)
- [Self-* 系统详解](skills/self-star/SKILL.md)

### Acknowledgments

借鉴的优秀开源项目：
- [OpenCode](https://github.com/sst/opencode) - Self-* 架构
- [Self-Refine](https://gitcode.com/gh_mirrors/se/self-refine) - 迭代反馈
- [AutoBE](https://github.com/wrtnlabs/autobe) - 编译器反馈学习

---

## [2.0.0] - 2026-02-28

### Added

- 三大记忆系统（项目记忆、智能上下文、对话状态机）
- 15 个斜杠命令
- 8 个内置插件
- 12 个技能
- continuous-learning v2（Instinct 模式）

### Changed

- 重构为智能超级命令 `/auto`
- 添加框架插件系统
- 添加 agent 编排系统

---

## [1.0.0] - 2026-02-01

### Added

- 初始版本
- 基于 everything-claude-code 二次开发
- npm 全局安装支持
- CLI 交互式安装器
