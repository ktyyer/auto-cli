---
description: 闯关大纲设计 v4 - 完整代码输出 + 精确插入指令 + 合约驱动，输出可直接复制执行的 Quest Map
---

# /auto:quest — 闯关大纲设计 v4

> **输入一份需求，输出一套完整可编译代码的渐进式闯关教案**

`/auto:quest` 将复杂需求拆解为可直接复制执行的 Quest Map。核心差异化：**完整代码输出（不是描述） + 精确锚点插入（不是行号） + 预判坑点**。

---

## v4 核心改变（相对 v3）

- **完整代码输出**：CREATE 文件包含 package+import+类定义的完整可编译代码
- **精确锚点插入**：MODIFY 文件指定唯一文本锚点 + 插入代码 + import 列表
- **预判坑点**：每个 Quest 预判 PHASE 3 可能遇到的 3 个坑（来自代码分析）
- **合约系统**：跨 Quest 的接口协议，确保类型一致性
- **风险分层**：🔴高/🟡中/🟢低风险分类，高风险配备额外护栏
- **15 项自验证**：通过线 10/15

---

## 执行流程

```
用户输入需求
      |
[第1步] 需求解析 + 变更范围预判
      |  → 关键词提取 + 预判涉及文件
      |
[第2步] 深度代码分析（核心步骤）
      |  → 分层读取 5-12 个核心文件
      |  → 提取 COMPLETE 模式（含 package + import + 注解顺序）
      |  → 全链路依赖分析
      |  → 提取代码片段锚点（含完整 import）
      |
[第3步] 合约定义 + 完整代码设计
      |  → 变更清单（精确到文件级 + CREATE/MODIFY 标记）
      |  → 先定义合约(CONTRACT)再拆分 Quest
      |  → 为每个文件产出完整代码
      |  → 依赖拓扑排序 + 风险分层
      |
[第4步] 生成 Quest Map（完整代码格式）
      |  → 📦 完整实现（可直接复制执行的代码）
      |  → ⚠️ 预判坑点 + 反模式警告
      |  → ✅ 验收标准 + 🔙 回滚方案
      |
[第5步] 合约一致性 + 路径 + 代码完整性校验
      |  → 跨 Quest 类型一致性校验
      |  → CREATE 文件有 package+import
      |  → MODIFY 文件有唯一锚点
      |
[第6步] 15 项自验证（>= 10/15 通过）
      |
[第7步] 输出 + 等待确认
```

---

## 调用 quest-designer v4

```
Agent({
  subagent_type: "quest-designer",
  prompt: "你是 quest-designer v4。

【用户需求】[需求描述]
【技术栈】[语言 + 框架]
【完整能力清单】[从 /auto PHASE 1 传入，或此处现场扫描]
【现有代码文件】[src/ 下文件列表]

严格按 quest-designer v4 的 7 步工作流执行。
关键要求：
- 第2步分层读取 5-12 个核心文件，提取 COMPLETE 模式（含 import 和 package）
- 第3步为每个文件产出完整代码（CREATE 包含 package+import+类定义，MODIFY 包含锚点+插入代码+import列表）
- 第4步 Quest Map 的 📦 完整实现必须是可直接复制执行的代码
- 第5步合约一致性 + 路径校验 + 代码完整性校验
- 第6步自验证 >= 10/15
输出 Quest Map，等待用户确认。"
})
```

---

## Quest v4 标准输出格式

```markdown
# 《[项目/功能名称] 闯关大纲》

## 全局信息
**技术栈**：[语言 + 框架]
**建议执行模式**：[单Agent / Subagent并行 / Agent Teams]
**合约清单**：CONTRACT-1 (...), CONTRACT-2 (...)

---

## Quest [X.Y]：[具体动作描述]

🎯 **目标**：[具体到文件和代码动作]
⚠️ **风险**：[🔴高/🟡中/🟢低]
🚫 **边界**：[禁止的文件/模块/模式/技术]
🔗 **依赖**：[前置 Quest 编号]
🔗 **合约**：产出/消费的合约编号

📦 **完整实现**：

**文件 1** — CREATE `src/main/java/com/.../XxxDTO.java`
```java
package com.example.xxx.dto;

import lombok.Data;
// ... 完整 import

@Data
public class XxxDTO {
    // 完整字段定义
}
```

**文件 2** — MODIFY `src/main/java/com/.../XxxService.java`
插入锚点：在 `public interface XxxService {` 之后
```java
    // 完整方法签名
```
需新增 import：`import com.example.xxx.dto.XxxDTO;`

⚠️ **预判坑点**：
1. [基于代码分析的具体坑]
2. [基于代码分析的具体坑]

反模式警告：
- 不要 [具体禁止的操作]

✅ **验收标准**：
| # | 验证点 | 验证命令 | 预期 |
|---|-------|---------|------|
| 1 | [具体] | [可粘贴命令] | [预期结果] |

🔙 **回滚**：`git checkout -- [具体文件]`
```

---

## 与 /auto 的关系

| 场景 | 推荐用法 |
|------|---------|
| 只看规划不执行 | `/auto:quest [需求]` → 输出 Quest Map |
| 规划 + 执行 | `/auto [需求]` → 内部调用 quest-designer v4 → 逐关执行 |

**核心定位**：`/auto:quest` 只出完整代码蓝图不写文件，`/auto` 负责按蓝图直接写入文件。
