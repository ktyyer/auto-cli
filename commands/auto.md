---
description: 智能超级命令 - 动态能力发现 + Quest Map + 按规模自动选择执行模式
---

# /auto — 智能超级命令

> 上下文扫描 → 能力统筹 + Quest Map → 逐关执行 → 整合验证 → 提交 → 知识沉淀
> 快速通道：简单任务（<=3 文件、无架构变更）可跳过 PHASE 2/5，走 1→3→4→6 路径
> 详细设计文档（缓存机制、故障排查、输出模板）：`plugins/builtin/auto-core.md`

---

## ⚠️ HARD CONSTRAINTS（不可绕过）

### 约束 1：顺序锁定
PHASE 1 → 2 → 3 → 4 → 5 → 6，不可跳过、合并、重排。
- IF 没有输出能力健康检查报告 → 不可进入 PHASE 2
- IF 没有调用 `Agent({ subagent_type: "quest-designer" })` → 不可进入 PHASE 3
- IF 没有 Quest Map → 禁止编辑任何代码文件

### 约束 2：quest-designer 必须被调用
PHASE 2 的唯一合法操作是调用 `Agent({ subagent_type: "quest-designer" })`。不可用"自己分析"替代，不可因"任务简单"跳过。

### 约束 3：代码修改前置条件
满足以下全部才能使用 Edit/Write：
1. PHASE 1 健康检查报告已输出
2. quest-designer Agent 已返回 Quest Map
3. Quest Map 已展示给用户

### 约束 4：简单任务快速通道

IF 满足以下全部条件，可跳过 PHASE 2（quest-designer）和 PHASE 5（增量提交），走 1 → 3 → 4 → 6 快速路径：

1. 变更范围 <= 3 个文件
2. 不涉及架构变更（无新增文件、无接口变更、无 Schema 变更）
3. 不涉及跨模块调用
4. 用户明确表达"快速修复"/"简单修改"/"改一下"意图
5. PHASE 1 健康检查已完成

**快速路径流程**：
- PHASE 1: DISCOVER（正常执行）
- PHASE 3: EXECUTE（单 Agent 串行，直接 Edit/Write）
- PHASE 4: VERIFY（编译验证）
- PHASE 6: LEARN（知识沉淀）

PHASE 1 结束时输出判断：
```
🔍 任务复杂度评估：
  - 影响文件数: [N]
  - 是否涉及架构: [是/否]
  - 推荐路径: [完整 6 PHASE / 快速通道]
  - 原因: [一句话说明]
```

如果不满足快速通道条件（>=4 个文件 OR 涉及架构 OR 用户未表达简单意图），则按完整 6 PHASE 执行。

**自检**：每个 PHASE 开始前，检查上一 PHASE 产出是否存在。不存在则回退执行。

---

## PHASE 1: DISCOVER — 扫描项目上下文 + 能力清单

> 健壮原则：目录不存在不崩溃，只输出 WARNING。

### 1.0 缓存检查

```bash
Bash("mkdir -p .auto/cache")
Read(".auto/cache/capability-snapshot.json")
```

如存在且有效（<24h + 文件数匹配）→ 跳到 1.4 输出报告。
如不存在/过期/失效 → 执行 1.1-1.3 完整扫描。
（缓存验证逻辑详见 auto-core.md v8.1）

### 1.0a 上下文压缩检查（长对话场景）

```javascript
import { compressContext, CONTEXT_COMPRESSION } from 'src/utils.js';

// 获取当前对话消息列表（Claude Code 内部可访问）
const messages = getConversationMessages(); // Claude Code 内置能力

if (messages && messages.length >= CONTEXT_COMPRESSION.MESSAGE_THRESHOLD) {
  const result = compressContext(messages, {
    threshold: CONTEXT_COMPRESSION.MESSAGE_THRESHOLD,
    maxEntries: CONTEXT_COMPRESSION.MAX_COMPRESSED_ENTRIES
  });

  if (result.compressed) {
    // 输出压缩摘要，让用户了解上下文已被压缩
    console.log(result.summary);
    // 输出提示信息
    console.log(`[上下文压缩] 对话过长（${messages.length} 条），已压缩至 ${result.keptCount} 条关键消息。`);
    console.log('[上下文压缩] 压缩策略：保留含关键词的消息 + 最近的消息。');
  }
}
```

> 设计原则：静默压缩，不打断工作流。仅在日志中记录，不阻塞 PHASE 流程。

### 1.1 技术栈 + 项目上下文（并行）

```
Glob("REPO_MAP.md") → 如存在则 Read（跳过 1.3 的 src/ 扫描）
Glob("package.json") / Glob("pom.xml") / Glob("go.mod") / Glob("requirements.txt") / Glob("Cargo.toml")
  → 匹配任一即确定技术栈 → Read 获取依赖和 scripts
Glob("CLAUDE.md") → Read（如存在）
```

### 1.2 能力清单收集（并行 Glob + Grep 提取 frontmatter，禁止 Read 完整文件）

```
Glob("$HOME/.claude/commands/auto/*.md")
Glob("$HOME/.claude/agents/*.md")
Glob("$HOME/.claude/plugins/**/*.md")

→ 对以上目录 Grep 批量提取：
  Grep(pattern="^(name|description|tools|model):", output_mode="content")
  → 仅提取元数据行，不读正文

→ Skills 目录使用 SkillIndexer 索引模式（替代 Glob 全量扫描）：

```javascript
import { SkillIndexer } from 'src/skills/skill-indexer.js';
import path from 'node:path';
import os from 'os';

const skillsDir = path.join(os.homedir(), '.claude', 'skills');
const indexer = new SkillIndexer(skillsDir);
const skillIndex = await indexer.buildIndex();
const skillSummary = await indexer.getIndexSummary();
```

输出 skillSummary（含 Skill 名称、描述、标签，以及节省百分比）。
按需加载：仅在 PHASE 2+ 匹配到关键词时，才调用 `indexer.loadContent(relativePath)` 读取完整内容。
```

### 1.3 配置文件 + 项目代码

```
Glob("$HOME/.claude/mcp-configs/*.json") → Read，统计 mcpServers，含 YOUR_*_HERE 标记 ⚠️
Glob("$HOME/.claude/hooks/*.json") → Read，统计 hook 类型数量

IF REPO_MAP.md 已加载 → 跳过 src/ 扫描
ELSE：
  Glob("src/**/*.{java,ts,tsx,js,jsx,py,go}") → 仅路径列表
```

### 1.3a 写入能力快照（1.1-1.3 执行后）

```bash
Write(".auto/cache/capability-snapshot.json", {
  created_at: [Bash("date +%s")], file_counts: {...},
  tech_stack, capabilities, mcp, hooks, source_files
})
```

### 1.4 输出 + Gate Check

```
能力健康检查报告（🟢绿/🟡黄/🔴红） + 能力清单表格

TodoWrite([
  { content: "任务: [需求摘要]", status: "completed" },
  { content: "技术栈: [tech]", status: "completed" },
  { content: "能力: [N] cmd, [N] agent, [N] plugin, [N] skill (索引模式, 节省 X% Token), [N] MCP, [N] hook", status: "completed" },
  { content: "上下文压缩: [已压缩/未触发] (对话 N 条, 阈值 30)", status: "completed" }
])

### 1.5 Router 推荐（可选）

```bash
import { CanonicalRouter } from 'src/router/canonical-router.js';
import { AgentRegistry } from 'src/router/agent-registry.js';

const registry = new AgentRegistry();
const router = new CanonicalRouter(registry);
await router.initialize();

const routeResult = await router.route(userIntent, {
  files: affectedFiles,
  scope: 'on-demand'
});
```

输出：
```
💡 Router 推荐：
  ✅ 主 Agent：<name>
     匹配原因：<matchReason>
  🔄 回退链：<fallback1>, <fallback2>, ...
```

🔒 GATE: PHASE 1 → 2
  ✓ 报告已输出 + 能力清单已收集 + Router 推荐（可选）
  → 调用 Agent({ subagent_type: "quest-designer" })
  ⛔ 禁止: 编辑代码、跳到 PHASE 3
```

---

## PHASE 2: REASON — quest-designer 深度分析 + Quest Map

> v4 核心：完整代码输出 + 精确锚点插入 + 预判坑点 + 合约驱动

### 2.0 知识搜索（基于历史经验）

```javascript
// 在分析前先搜索相关历史知识
import { KnowledgeSteward } from 'src/knowledge/knowledge-steward.js';

const steward = new KnowledgeSteward();
await steward.ensureStructure();

// 搜索时限制：每个分类最多 3 条，总计最多 10 条
const MAX_TOTAL = 10;
const MAX_PER_CATEGORY = 3;

const relatedKnowledge = await steward.search(userIntent, {
  limit: MAX_PER_CATEGORY,
  maxAgeDays: 180  // 只查近 6 个月
});

// 总数截断
let totalItems = 0;
const trimmedKnowledge = [];
for (const item of relatedKnowledge) {
  const remaining = MAX_TOTAL - totalItems;
  if (remaining <= 0) break;
  trimmedKnowledge.push({
    ...item,
    matches: item.matches.slice(0, remaining)
  });
  totalItems += item.matches.length;
}

if (trimmedKnowledge.length > 0) {
  console.log('📚 发现相关历史知识:');
  for (const item of trimmedKnowledge) {
    console.log(`  [${item.category}] ${item.matches.length} 条相关记录`);
    // 展示匹配内容供 quest-designer 参考（每条最多 200 字符）
    for (const match of item.matches.slice(0, MAX_PER_CATEGORY)) {
      console.log(`    ${match.slice(0, 200)}...`);
    }
  }
}
```

将搜索结果附加到 quest-designer prompt 的【历史知识】段落中（见 2.1 节）。

### 2.1 模式卡检查

```bash
Read(".auto/cache/pattern-cards.json")
```

验证 head_hash + 工作区脏检查 + 7天TTL。命中则传缓存给 quest-designer 跳过已缓存文件。（详见 auto-core.md）

### 2.1 调用 quest-designer

```
Agent({
  subagent_type: "quest-designer",
  prompt: "quest-designer v4。项目完整上下文：

【用户需求】[原始需求描述]
【技术栈】[语言+框架] | 项目规范: [有/无 CLAUDE.md]
【完整能力清单】
Commands: [name + description]
Agents: [name + description + tools]
Plugins: [name + description]
Skills: [name + description]
MCP: [服务名 + 状态(READY/⚠️需配置)]
Hooks: [类型数量 + 摘要]
【现有代码文件】[src/ 路径列表]

【历史知识】（来自 auto-cli 执行经验）
${trimmedKnowledge && trimmedKnowledge.length > 0 ? trimmedKnowledge.map(item =>
  `## [${item.category}] ${item.matches.length} 条记录\n` +
  item.matches.slice(0, 3).map(m => m.slice(0, 200)).join('\n---\n')
).join('\n\n') : '（无历史知识）'}

[IF 有 Router 推荐]：
【Router 推荐】主 Agent：<name> | 回退链：<fallbacks> | 匹配原因：<reason>

[IF 模式卡命中: 缓存数据，跳过已缓存文件]
[IF 未命中: 按标准流程读取 5-12 个核心文件]

v4 要求：
- 第2步利用缓存模式卡（如有）
- 第3步为每个文件产出完整代码（CREATE 含 package+import+类定义，MODIFY 含锚点+代码+import）
- 第4步 Quest Map 📦 完整实现 = 可直接复制执行的代码
- 第5步合约一致性校验 + 路径校验 + 代码完整性校验
- 第6步自验证 >= 10/15
- 第7.5步输出模式卡数据供缓存更新

说明：Router 推荐仅作为参考，最终决策由 quest-designer 自主判断。
输出 Quest Map，等待用户确认。"
})
```

### 2.2 更新模式卡缓存

从 quest-designer 返回中提取 `<!--PATTERN_CARDS_START-->...<!--PATTERN_CARDS_END-->`
→ upsert 合并 → Write `.auto/cache/pattern-cards.json`（详见 auto-core.md）

> 产出后等待用户确认，可迭代修改。

---

## PHASE 3: EXECUTE — 逐关执行（v4 蓝图驱动）

| 规模 | 模式 | Token 成本 |
|------|------|-----------|
| 1-5 关 | 单 Agent 串行 | 1x |
| 6-15 关 | Subagent 并行 | 2-3x |
| 15+ 关 | Agent Teams | 3-10x |

每关执行流程：
1. 读取 📦 完整代码 → Write/Edit 到指定路径（复制执行，不从描述写代码）
2. MODIFY 操作：先 Read 确认锚点存在且唯一 → Edit 插入 → 补 import
3. 遵守反模式警告（硬性约束）+ 预判坑点
4. 🔴 高风险：先 Read 影响范围 → 备份分支 → 实现 → 验证
5. 编译验证 → 通过则增量提交 → 下一关
6. 失败：回滚 → 修复 → 重试（最多 2 次）

---

## PHASE 4: VERIFY — 全量门禁

编译/构建 → 全量测试 → 覆盖率 >= 80% → 安全扫描
失败：修复(1) → 替代方案(2) → `git checkout -- .` 回滚(3)

---

## PHASE 5: COMMIT — 增量提交

每关通过后 `git add [当前 Quest 文件] && git commit`。
不用 `git add -A`，只 add 当前 Quest 涉及的文件。

---

## PHASE 6: LEARN — 知识沉淀

> 自动从本次执行中提取经验，调用 KnowledgeSteward 保存到知识库

### 6.1 收集执行摘要

```javascript
// 从 TodoWrite 获取执行结果
const todos = getCurrentTodos(); // Claude Code 内置
const completedQuests = todos.filter(t => t.status === 'completed');
const failedQuests = todos.filter(t => t.status === 'failed');

const executionSummary = {
  totalQuests: completedQuests.length + failedQuests.length,
  completedQuests: completedQuests.map(t => t.content),
  failedQuests: failedQuests.map(t => t.content),
  timestamp: new Date().toISOString(),
  taskIntent: userIntent // 原始需求
};
```

### 6.2 保存经验到知识库

```javascript
import { KnowledgeSteward } from 'src/knowledge/knowledge-steward.js';

const steward = new KnowledgeSteward();
await steward.ensureStructure();

// 6.2.1 保存踩坑记录（issues encountered）
if (executionSummary.failedQuests.length > 0) {
  const trapContent = `## ${executionSummary.taskIntent}

**时间**: ${executionSummary.timestamp}
**失败关卡**: ${executionSummary.failedQuests.length}

**失败详情:**
${executionSummary.failedQuests.map(q => `- ${q}`).join('\n')}

**教训:**
> 待补充：分析失败原因，提取可复用的排查思路
`;

  await steward.save({
    content: trapContent,
    category: 'trap',
    tags: ['auto-execution', 'failed-quest']
  });
}

// 6.2.2 保存成功模式（successful patterns discovered）
if (executionSummary.completedQuests.length > 0) {
  const patternContent = `## ${executionSummary.taskIntent}

**时间**: ${executionSummary.timestamp}
**完成关卡**: ${executionSummary.completedQuests.length}

**成功实现:**
${executionSummary.completedQuests.map(q => `- ${q}`).join('\n')}

**关键模式:**
> 待补充：提取本次成功实现中的可复用模式
`;

  await steward.save({
    content: patternContent,
    category: 'pattern',
    tags: ['auto-execution', 'successful-pattern']
  });
}

// 6.2.3 保存决策记录（architectural decisions）
// 如果 Quest Map 涉及核心架构变更，记录决策
const architectureChanges = executionSummary.completedQuests.filter(q =>
  q.content.includes('架构') ||
  q.content.includes('重构') ||
  q.content.includes('核心')
);

if (architectureChanges.length > 0) {
  const decisionContent = `## ${executionSummary.taskIntent}

**时间**: ${executionSummary.timestamp}
**架构变更**: ${architectureChanges.length} 处

**变更内容:**
${architectureChanges.map(q => `- ${q}`).join('\n')}

**决策理由:**
> 待补充：记录为何做此架构决策
`;

  await steward.save({
    content: decisionContent,
    category: 'decision',
    tags: ['auto-execution', 'architecture']
  });

  // 提示用户更新 REPO_MAP
  console.log('⚠️ 检测到核心架构变更，建议运行 /auto:update-codemaps 更新代码地图');
}
```

### 6.3 更新项目记忆（可选）

```javascript
// 更新 memory/MEMORY.md 中的项目经验
import { readFile, writeFile } from 'fs/promises';

const memoryPath = path.join(getClaudeDir(), 'projects', projectDir.replace(/[/\\:]/g, '-').replace(/^-/, ''), 'memory', 'MEMORY.md');
try {
  const existing = await readFile(memoryPath, 'utf-8');
  const newEntry = `\n- [${executionSummary.timestamp}] ${executionSummary.taskIntent}: ${executionSummary.completedQuests.length} 关完成`;
  await writeFile(memoryPath, existing + newEntry, 'utf-8');
} catch {
  // 记忆文件不存在，跳过
}
```

### 6.4 输出总结

```
📚 知识沉淀完成:
   - 踩坑记录: ${executionSummary.failedQuests.length > 0 ? '已保存' : '无'}
   - 成功模式: ${executionSummary.completedQuests.length > 0 ? '已保存' : '无'}
   - 架构决策: ${architectureChanges?.length > 0 ? '已保存' : '无'}
   - 项目记忆: 已更新

💡 下次遇到类似任务，AI 会自动检索这些经验。
```

---

## 核心原则

1. **一个入口** — `/auto` 完成所有事情
2. **智能缓存** — 不变数据一天只扫一次，节省 ~80% Token
3. **统筹设计** — quest-designer 基于完整能力清单自主分析
4. **按规模执行** — 小任务不浪费，大任务自动并行
5. **原子化验收** — 每关有 PM 肉眼可见的验收标准
6. **风格继承** — 编码严格继承项目既有风格
7. **动态追加** — 执行中发现新能力随时追加
8. **可回溯** — 每步 Git Commit，失败可回滚
9. **知识沉淀** — 经验持续积累，越用越强
10. **索引模式** — Skill 按需加载，PHASE 1 Token 消耗减少 30-50%
11. **上下文压缩** — 长对话自动压缩保留关键信息，不丢失决策上下文
