---
description: 查看项目状态和 Self-* 系统学习情况
---

# /auto:status — 状态查看

> **查看项目当前状态、能力和建议**

## 🆕 v5.0 增强

集成 Self-* 系统和记忆系统，显示：
- 🧠 Project Memory：持久化的项目知识
- ✨ Architect/Editor：双模型调用统计
- 🛡️ Guardrails：当前护栏安全级别

---

## 显示内容

### 项目概览
- 项目名称和路径
- 语言和框架
- 文件统计与 REPO_MAP 状态

### 🧠 记忆系统状态
- **Project Memory**：会话记录、架构决策、风格偏好
- **Smart Context**：索引状态、预估 Search 效率
- **Self-Aware**：已学习的团队编码模式列表（带置信度）

### 🤖 核心能力状态
- **Architect/Editor**：双模型流转次数、Diff 节省 Token 比例
- **Git Auto-Commit**：开启状态、自动提交次数
- **Smart Guardrails**：当前配置级别（自动/确认）
- **Self-Fixing**：自动修复成功率

### 💡 建议操作
- 待优化项与技术债务
- 改进建议（如：生成最新的地图、处理遗留 TODO）

## 示例

```bash
/auto:status
```

*(输出会以紧凑的 Markdown 面板形式在终端展示)*
