---
description: 智能超级命令 - 上下文扫描 → Quest设计 → 逐关执行 → 验证 → 提交 → 知识沉淀
---

# /auto — 智能超级命令

> 上下文扫描 → Quest设计 → 逐关执行 → 验证 → 提交 → 知识沉淀

---

## 双模式执行

根据任务复杂度自动选择执行模式：

| 条件 | 模式 | 执行路径 |
|------|------|----------|
| <=3文件 且 无架构变更 | **轻量模式** | PHASE 1 -> PHASE 2(轻量) -> PHASE 4 -> PHASE 6 |
| >3文件 或 有架构变更 | **完整模式** | 完整 6 PHASE |

**轻量模式**：quest-designer 输出简化版（影响文件 + 执行顺序 + 风险评估）
**完整模式**：quest-designer 输出完整 Quest Map

---

## PHASE 1: DISCOVER — 扫描 + 能力清单

> 健壮原则：目录不存在不崩溃，只输出 WARNING。

### 1.1 缓存检查

```bash
mkdir -p .auto/cache
cat .auto/cache/capability-snapshot.json 2>/dev/null
```

**缓存命中条件**（同时满足）：
- 文件存在且 < 24小时
- `file_count` 与实际文件数匹配
- `hash` 与当前关键文件内容一致

命中 -> 跳过扫描，直接输出报告。

### 1.2 并行扫描

使用以下工具扫描项目：

```
1. 技术栈检测：
   Glob("package.json") / Glob("pom.xml") / Glob("go.mod")
   -> Read 获取依赖信息

2. 能力清单扫描：
   Glob("~/.claude/commands/auto/*.md")
   Glob("~/.claude/agents/*.md")
   Glob("~/.claude/plugins/**/*.md")
   -> Grep(pattern="^(name|description|tools|model):", output_mode="content")
   -> 仅提取元数据行，不读正文

3. 源码扫描：
   Glob("src/**/*.{java,ts,tsx,js,jsx,py,go}")
   -> 仅获取路径列表（如 REPO_MAP.md 存在则跳过）
```

### 1.3 Router 推荐（强制）

使用 CLI 工具执行路由：

```bash
auto route "<用户意图>" --json
```

如果 auto CLI 未安装，则使用内置 Agent 列表手动匹配：
- 安全相关 -> security-reviewer
- 测试相关 -> tdd-guide
- 构建错误 -> build-error-resolver
- 架构设计 -> architect
- 代码审查 -> code-reviewer
- 默认 -> quest-designer

输出：
```
Router 推荐：
  主 Agent：<name>
     匹配原因：<matchReason>
  回退链：<fallback1>, <fallback2>, ...
```

### 1.4 输出报告 + 门禁

```
能力健康检查报告（绿/黄/红） + 能力清单表格

TodoWrite([
  { content: "任务: [需求摘要]", status: "completed" },
  { content: "技术栈: [tech]", status: "completed" },
  { content: "能力: [N] cmd, [N] agent, [N] plugin, [N] skill, [N] MCP, [N] hook", status: "completed" },
  { content: "执行模式: [轻量模式/完整模式]", status: "completed" }
])

GATE: PHASE 1 -> 2
  报告已输出 + 能力清单已收集 + Router 推荐已获取
  -> 调用 Agent({ subagent_type: "quest-designer" })
  禁止: 编辑代码、跳到 PHASE 3
```

---

## PHASE 2: REASON — Quest 设计

> v4 核心：完整代码输出 + 精确锚点插入 + 预判坑点 + 合约驱动

### 2.1 调用 quest-designer

```
Agent({
  subagent_type: "quest-designer",
  prompt: "quest-designer v4。项目完整上下文：

【用户需求】[原始需求描述]
【执行模式】[轻量模式/完整模式]
【技术栈】[语言+框架]
【Router 推荐】主Agent：<name> | 原因：<reason>

【能力清单】
Commands: [name + description]
Agents: [name + description + tools]
Plugins: [name + description]
Skills: [name + description]
MCP: [服务名 + 状态]
Hooks: [类型数量]

【现有代码文件】[src/ 路径列表]

v4 要求：
- 轻量模式：输出 影响文件 + 执行顺序 + 风险评估（不生成完整 Quest Map）
- 完整模式：完整 Quest Map（含完整代码、锚点、合约校验）
- 第6步自验证 >= 10/15

输出 Quest Map，等待用户确认。"
})
```

### 2.2 缓存更新

```bash
# 将当前扫描结果写入缓存快照
# 使用 Bash 工具计算 hash 和写入文件
```

---

## PHASE 3: EXECUTE — 逐关执行

| 规模 | 模式 | Token 成本 |
|------|------|-----------|
| 1-5 关 | 单 Agent 串行 | 1x |
| 6-15 关 | Subagent 并行 | 2-3x |
| 15+ 关 | Agent Teams | 3-10x |

**每关执行流程**：
1. 读取完整代码 -> Write/Edit 到指定路径
2. MODIFY：先 Read 确认锚点存在 -> Edit 插入 -> 补 import
3. 高风险：先 Read 影响范围 -> 备份分支 -> 实现 -> 验证
4. 编译验证 -> 通过则增量提交 -> 下一关
5. 失败：回滚 -> 修复 -> 重试（最多 2 次）

---

## PHASE 4: VERIFY — 全量门禁

```
编译/构建 -> 全量测试 -> 覆盖率 >= 80% -> 安全扫描
```

**失败处理**：
1. 修复（调用 build-error-resolver 分析）
2. 替代方案
3. `git checkout -- .` 回滚

---

## PHASE 5: COMMIT — 增量提交

每关通过后 `git add [当前 Quest 文件] && git commit`。
不用 `git add -A`，只 add 当前 Quest 涉及的文件。

---

## PHASE 6: LEARN — 知识沉淀

> 经验自动积累到知识库

### 6.1 自动沉淀（推荐）

在 `~/.claude/settings.json` 配置 Stop Hook：

```json
{
  "hooks": {
    "stop": [{
      "hook": "stop",
      "action": "auto-learn",
      "config": {
        "enabled": true,
        "minConfidence": 0.7
      }
    }]
  }
}
```

### 6.2 手动沉淀（PHASE 6 执行时）

使用 CLI 工具保存知识：

```bash
# 保存踩坑记录
auto save insight -c "失败详情..." -t trap --tags "auto-execution,failed-quest"

# 保存成功模式
auto save insight -c "成功实现..." -t pattern --tags "auto-execution,successful-pattern"

# 搜索历史知识
auto save search -q "相关关键词"
```

### 6.3 输出总结

```
知识沉淀完成:
   - 踩坑记录: [N] 条
   - 成功模式: [N] 条
   - 架构决策: [N] 条

下次遇到类似任务，AI 会自动检索这些经验。
```

---

## 核心原则

1. **一个入口** — /auto 完成所有事情
2. **智能缓存** — 不变数据复用，24h 内只扫描一次
3. **按规模执行** — 小任务轻量模式不浪费，大任务完整模式不将就
4. **原子化验收** — 每关有验收标准，失败可回滚
5. **可回溯** — 每步 Git Commit，失败可回滚
6. **知识沉淀** — 越用越强
7. **自动恢复** — 失败时自动诊断
