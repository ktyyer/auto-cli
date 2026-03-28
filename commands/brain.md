---
description: 个人知识库 - 管理身份、人脉、创意、复盘
---

# /auto:brain — 数字大脑

> 个人知识库，管理非项目的个人知识（身份、人脉、创意、复盘）

---

## 用法

### 添加知识

```bash
# 添加身份定位
/auto:brain add -t identity -c "高级前端架构师" --tags "React,TypeScript,Node.js"

# 添加人脉
/auto:brain add -t contact -c "李四" --tags "产品经理,ABC公司"

# 添加创意
/auto:brain add -t idea -c "开发 AI CLI 工具" --tags "startup,ai"

# 添加复盘
/auto:brain add -t review -c "2026-Q1"
```

### 搜索知识

```bash
# 搜索人脉
/auto:brain search -t contact -q "李四"

# 搜索创意
/auto:brain search -t idea -q "AI"
```

### 查看统计

```bash
/auto:brain stats
```

---

## 4 种知识类型

### 1. Identity（身份定位）

记录你的职业身份、核心能力、职业目标：

- **标题**：如"高级前端架构师"
- **核心能力**：React, TypeScript, Node.js
- **职业目标**：成为技术专家、CTO

### 2. Network（人脉网络）

记录你认识的人脉、协作历史：

- **姓名**：如"李四"
- **角色**：如"产品经理"
- **公司**：如"ABC 公司"
- **标签**：如"frontend", "agile"
- **协作历史**：记录一起完成的项目

### 3. Ideas（创意灵感）

记录你的创意灵感、待办事项：

- **标题**：简短描述
- **描述**：详细说明
- **标签**：分类标签
- **状态**：idea/planning/in-progress/completed

### 4. Reviews（复盘记录）

记录项目复盘、经验总结：

- **周期**：如"2026-Q1"
- **总结**：概述
- **成就**：完成的里程碑
- **改进点**：待改进的地方

---

## 使用场景

### 场景 1：推荐专家

```
用户：推荐一个前端专家

AI: [搜索 Network] → 找到 3 个前端相关联系人
  - 张三（前端工程师，XYZ 公司）
  - 李四（产品经理，ABC 公司）
  - 王五（前端架构师，DEF 公司）

返回人脉列表 + 协作历史
```

### 场景 2：创意管理

```
用户：记录一个创业想法

AI: 已添加到创意库
标题: "AI 驱动的 CLI 工具"
标签: startup, ai, cli
状态: idea
```

### 场景 3：季度复盘

```
用户：添加 Q1 复盘

AI: 已添加复盘记录
周期: 2026-Q1
成就: 完成 v0.3.1, 完成 v0.4.0
改进: 加强测试, 优化文档
```

---

## CLI 命令对应关系

```
/auto:brain add     → auto brain add -t <type> -c <content>
/auto:brain search  → auto brain search -t <type> -q <keyword>
/auto:brain stats   → auto brain stats
```

---

## 存储位置

所有数据存储在 `.auto/brain/` 目录：

```
.auto/brain/
├── identity.json    # 身份定位
├── network.json     # 人脉网络
├── ideas.json       # 创意灵感
└── reviews.json     # 复盘记录
```
