---
description: 查看项目状态和能力安装情况
---

# /auto:status -- 状态查看

> **查看项目当前状态、已安装能力和建议**

---

## 显示内容

### 项目概览
- 项目名称和路径
- 语言和框架（从 package.json / pom.xml / go.mod 推断）
- 文件统计

### 已安装能力
- **Agents**：已安装的 Agent 数量和列表
- **Commands**：已安装的命令数量
- **Skills**：已安装的 Skill 数量和索引状态
- **Rules**：已安装的规范数量
- **Hooks**：已安装的 Hook 配置
- **Knowledge**：知识库条目统计（.auto/insights/）

### 项目健康度
- CLAUDE.md 是否存在
- REPO_MAP.md 是否存在
- 依赖是否安装
- Git 仓库状态

### 建议操作
- 缺失的配置文件（建议运行 /auto:doctor）
- 待优化的项

## 使用示例

```bash
/auto:status
```
