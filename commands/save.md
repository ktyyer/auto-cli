---
description: 一键保存知识条目 - 灵感、踩坑经验、架构决策、编码模式
---

# /auto:save — 知识管家

> 一句话保存灵感、踩坑经验、架构决策，自动分类 + Git 提交

---

## 用法

用户可以通过以下方式触发：

1. **直接说**："保存这个提示词" / "记录这个踩坑经验" / "保存这个决策"
2. **斜杠命令**：`/auto:save`
3. **CLI 命令**：`auto save insight -c "内容" -t prompt`

---

## 执行流程

### Step 1：提取内容

从当前对话上下文中提取要保存的知识内容：

```
IF 用户明确指定了内容:
  使用用户指定的内容
ELSE:
  从最近 5 轮对话中提取关键信息
  生成一段简洁的知识摘要
```

### Step 2：智能分类

根据内容自动判断分类：

| 分类 | 关键词 | 目标文件 |
|------|--------|---------|
| prompt | 提示词、prompt、指令、模板 | `.auto/insights/prompts.md` |
| trap | 踩坑、bug、错误、失败、教训 | `.auto/insights/traps.md` |
| pattern | 模式、设计、架构、最佳实践 | `.auto/insights/patterns.md` |
| decision | 决策、选择、为什么、技术选型 | `.auto/insights/decisions.md` |

### Step 3：写入知识库

```bash
# 确保目录存在
mkdir -p .auto/insights

# 追加到对应文件
# 格式：
# ### [标题]
#
# **日期**: YYYY-MM-DD HH:mm:ss
# **标签**: tag1, tag2
#
# [内容]
#
# ---
```

### Step 4：Git 提交

```bash
git add ".auto/insights/[category].md"
git commit -m "docs: save [category] insight about [topic]"
```

---

## 示例

### 示例 1：保存 Prompt

```
用户：保存这个提示词，非常好用

AI：好的，我来保存这个有效的提示词。

提取内容：
"作为高级架构师，请分析以下代码的可维护性，输出三个维度：耦合度、内聚性、可测试性，每个维度评分 1-10 并给出改进建议。"

自动分类：prompt → .auto/insights/prompts.md
```

### 示例 2：记录踩坑经验

```
用户：记录这个坑：Node.js 的 fs.rm 在 Windows 上删除只读文件会报 EPERM

AI：已记录。

自动分类：trap → .auto/insights/traps.md
```

### 示例 3：保存架构决策

```
用户：保存决策：选用 Vitest 而非 Jest，因为原生 ESM 支持和更好的性能

AI：已保存决策记录。

自动分类：decision → .auto/insights/decisions.md
```

---

## 边界

- 不保存敏感信息（密码、密钥、Token）
- 不保存未经验证的信息（标注为"待验证"）
- 不修改已有知识条目（只追加）
- 单条内容不超过 2000 字（超出时截取摘要）
