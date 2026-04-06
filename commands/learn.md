---
name: learn
description: 分析 Git 历史中的可复用模式，输出提交约定、热点文件和文件联动等结构化结果
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /auto:learn — Git 历史模式分析

> 当前版本聚焦 Git 历史分析，提取提交约定、热点文件与文件联动模式。
> 输出以终端文本或 JSON 结构为主，不会自动生成 Skill 文件或 Instinct 文件。

---

## 使用方式

```bash
/auto:learn                    # 在 Claude Code 中触发 learn 命令
/auto:learn --git              # 基于 Git 历史分析模式
auto learn --git               # CLI：分析最近默认数量的提交
auto learn --git --commit-count 100
auto learn --git --json
auto learn --git --json -d .
```

---

## 当前支持范围

- 分析最近若干次 Git 提交
- 识别约定式提交占比
- 统计热点文件
- 发现常见文件联动关系
- 支持 JSON 输出供后续流程消费

> 当前版本不支持会话级提取、Skill 落盘、`--output` 或 `--instincts`。

---

## Git 历史分析

### 使用场景

- 新团队成员快速了解仓库提交习惯
- 回顾团队常见改动热点
- 为后续文档或流程优化提供依据
- 在 `/auto` 工作流后补充 Git 经验分析

### 工作流程

#### 第一步：收集 Git 数据

```bash
# 获取最近 N 次提交及其文件变更
git log --oneline -n 200 --name-only --pretty=format:"%H|%s|%ad" --date=short

# 获取文件变更频率（哪些文件最常被修改）
git log --oneline -n 200 --name-only | grep -v "^$" | grep -v "^[a-f0-9]" | sort | uniq -c | sort -rn | head -20

# 获取提交消息模式
git log --oneline -n 200 --pretty=format:"%s" | head -50
```

#### 第二步：检测模式

| 模式类型 | 检测方法 |
|---------|---------|
| **提交约定** | 正则匹配提交消息（feat:, fix:, chore:, docs: 等） |
| **文件联动** | 总是一起变更的文件组合 |
| **热点文件** | 最近提交中被频繁修改的文件 |
| **工作流线索** | 重复出现的文件变更模式 |

#### 第三步：输出结果

命令返回结构化结果，包含：

- `mode`
- `gitPatterns.analyzedCommits`
- `gitPatterns.commitConventions`
- `gitPatterns.fileCochanges`
- `gitPatterns.hotFiles`
- `gitPatterns.analyzedAt`

### 示例输出

```json
{
  "mode": "git",
  "gitPatterns": {
    "analyzedCommits": 50,
    "commitConventions": [
      {
        "name": "conventional-commits",
        "ratio": 98,
        "sampleCount": 49
      }
    ],
    "fileCochanges": [
      {
        "pair": "README.md <-> bin/cli.js",
        "count": 2
      }
    ],
    "hotFiles": [
      {
        "file": "commands/auto.md",
        "changes": 14
      }
    ],
    "analyzedAt": 1775455817119
  }
}
```

---

## 参数说明

| 参数 | 说明 |
|------|------|
| `--git` | 启用 Git 历史分析 |
| `--commit-count <n>` | 指定分析的提交数量 |
| `--json` | 输出 JSON 结构 |
| `-d, --dir <path>` | 指定分析目录 |

---

## 相关命令

- `/auto`：在完整工作流后统一汇总执行结果
- `auto status --json -d .`：查看当前 runtime 与能力状态
- `auto codemaps -d .`：生成代码地图

---

## 说明

`/auto:learn` 与 `auto learn` 使用同一套底层分析逻辑；当前能力以 Git 历史模式分析为准。

如果后续扩展会话提取或 Skill 落盘，应以真实 CLI 参数与运行时输出为准再更新文档。
