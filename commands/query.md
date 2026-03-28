---
description: 跨项目知识图谱查询 - 汇总所有项目的经验
---

# /auto:query — 知识图谱查询

> 跨项目知识积累，一次查询，汇总所有项目经验

---

## 用法

用户可以通过以下方式触发：

1. **直接说**："查询 React 性能优化技巧"、"统计知识图谱"
2. **斜杠命令**：`/auto:query`
3. **CLI 命令**：`auto query search -q "React"`

---

## 执行流程

### Step 1：提取知识图谱（如果未提取）

```bash
# 从当前项目提取实体和关系
auto query extract -n <project-name>
```

提取内容：
- **实体**：技术栈（React, TypeScript...）、设计模式（Observer, Strategy...）、最佳实践（TDD, 80% 覆盖率...）、陷阱（依赖泄露, 内存泄漏...）
- **关系**：实体间的关联（React → Hooks, TDD → Vitest...）
- **项目索引**：记录每个项目包含哪些实体

### Step 2：搜索知识图谱

```bash
auto query search -q "React" -t tech_stack -l 10
```

搜索结果：
- 匹配的实体列表
- 实体类型、出现次数
- 关联的项目
- 按相关性排序

### Step 3：查看统计信息

```bash
auto query stats
```

统计内容：
- 实体总数
- 关系总数
- 项目总数
- 按类型分布

---

## 示例

### 示例 1：查询技术栈

```
用户：查询 React 相关的知识

AI: 正在搜索知识图谱...

找到 5 个相关实体：
  React (技术栈)
    出现次数: 15 | 相关项目: 3
    项目: project-a, project-b, auto-cli

  Hooks (技术栈)
    出现次数: 8 | 相关项目: 2
    项目: project-a, project-b

  TypeScript (技术栈)
    出现次数: 12 | 相关项目: 3
    项目: project-a, project-b, auto-cli
```

### 示例 2：查询最佳实践

```
用户：总结所有项目中的 TDD 实践

AI: 从知识图谱汇总 TDD 相关经验...

[从多个项目的 .auto/insights/patterns.md 中汇总]
- 先写测试，后写实现
- 测试覆盖率要达到 80% 以上
- 使用 Vitest 运行测试
- 遵循红-绿-重构循环
```

### 示例 3：查询陷阱

```
用户：查询 React Hooks 相关的陷阱

AI: 找到以下常见陷阱：

[从知识图谱检索]
1. 依赖数组陷阱 - 遗漏依赖导致闭包问题
2. 过度渲染 - useEffect 依赖对象导致无限循环
3. 清理函数缺失 - 订阅和定时器未清理
```

---

## 核心价值

### 跨项目积累
- 项目 A 学会了 React 性能优化技巧
- 项目 B 遇到了同样问题
- 通过知识图谱，项目 B 可以立即获得项目 A 的经验

### 越用越聪明
- 每次保存知识（`/auto:save`），自动更新图谱
- 项目越多，知识越丰富
- 形成组织的知识资产

---

## 与 Knowledge Steward 的关系

```
Knowledge Steward (v0.3.1)
  ↓ 保存知识到
.auto/insights/{prompts,traps,patterns,decisions}.md
  ↓ 提取实体和关系
Knowledge Graph (v0.4.0)
  ↓ 构建图谱
.auto/graph/{entities,relations,index}.json
  ↓ 跨项目查询
/auto:query
```
