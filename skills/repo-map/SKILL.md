---
name: repo-map
description: 仓库符号地图 - 用 ast-grep/ctags 提取项目全局符号表，让 AI 无需逐文件扫描即可理解项目结构
version: 1.0.0
author: ai-max
tags: [repo-map, codebase, navigation, ast-grep, architecture]
---

# Repo Map — 仓库符号地图

> 让 AI 在 30 秒内理解整个代码库结构，而不是花 10 分钟逐文件扫描

## 核心理念

AI 理解代码库的常见低效方式：
- 逐文件读取 → 消耗大量 token
- 凭记忆猜测结构 → 容易出错
- 多轮对话询问 → 浪费时间

Repo Map 方法：
- 一次性提取所有符号（类/函数/接口/导出）
- 生成结构化地图文件
- AI 读地图 → 精准定位 → 最小化文件读取

---

## 生成仓库地图

### 方法 1: 使用 `ast-grep`（推荐，支持语义搜索）

```bash
# 安装
npm install -g @ast-grep/cli

# 搜索所有 Java 类定义
ast-grep --pattern 'class $NAME { $$$ }' --lang java src/ -l

# 搜索所有 Spring Controller
ast-grep --pattern '@RestController class $NAME { $$$ }' --lang java src/

# 搜索所有 Service 接口
ast-grep --pattern 'interface $NAME { $$$ }' --lang java src/

# 搜索所有导出函数（JavaScript）
ast-grep --pattern 'export function $NAME($$$) { $$$ }' --lang js src/
```

### 方法 2: 使用 `ctags`（通用，支持 40+ 语言）

```bash
# 安装（macOS）
brew install universal-ctags

# 安装（Windows）
scoop install universal-ctags

# 生成标签文件
ctags -R --fields=+l --languages=Java,JavaScript,TypeScript,Python --output-format=json -o .repo-tags.json src/

# 读取标签
cat .repo-tags.json | jq '.[] | select(.kind == "class") | {name: .name, file: .path}'
```

### 方法 3: AI 辅助生成（当以上工具不可用时）

```bash
# 快速结构扫描（适合中小型项目）
find src -name "*.java" | head -50 | xargs grep -l "@RestController\|@Service\|@Repository" | sort

# 提取类名（Java）
find src -name "*.java" -exec grep -H "^public class\|^public interface\|^public enum" {} \; | sed 's/.*\/\(.*\)\.java:.*/\1/'

# 提取导出（TypeScript）
find src -name "*.ts" -exec grep -H "^export (class|interface|function|const)" {} \;
```

---

## REPO_MAP.md 标准格式

生成后保存为 `REPO_MAP.md`（不提交到 git，加入 `.gitignore`）：

```markdown
# 仓库地图

> 自动生成于 2026-02-28 | 项目: eco-saas

## 技术栈
- 语言: Java 17, TypeScript
- 框架: Spring Boot 3.x, Vue 3
- 构建: Maven, Vite
- 数据库: MySQL + Redis

## 模块结构

### eco-common（公共模块）
| 类/接口 | 文件 | 类型 | 描述 |
|---------|------|------|------|
| `Result<T>` | common/Result.java | 类 | 统一响应包装 |
| `PageInfo<T>` | common/PageInfo.java | 类 | 分页响应 |
| `BaseEntity` | entity/BaseEntity.java | 类 | 实体基类（id/createTime/updateTime）|
| `ServiceException` | exception/ServiceException.java | 类 | 服务层异常 |

### eco-system（系统模块）
| 类/接口 | 文件 | 类型 | 描述 |
|---------|------|------|------|
| `SysUserController` | controller/SysUserController.java | 类 | 用户管理 API |
| `SysUserService` | service/SysUserService.java | 接口 | 用户服务接口 |
| `SysUserServiceImpl` | service/impl/SysUserServiceImpl.java | 类 | 用户服务实现 |
| `SysUserMapper` | mapper/SysUserMapper.java | 接口 | 用户数据访问 |

### eco-order（订单模块）
| 类/接口 | 文件 | 类型 | 描述 |
|---------|------|------|------|
| `OrderController` | controller/OrderController.java | 类 | 订单管理 API |
| `OrderService` | service/OrderService.java | 接口 | 订单服务接口 |

## 关键依赖关系

- `SysUserController` → `SysUserService` → `SysUserMapper` → `sys_user` 表
- `OrderController` → `OrderService` → `OrderMapper` → `eco_order` 表
- 所有 Controller 继承 `BaseController`
- 所有响应使用 `Result<T>` 包装

## API 端点速查

| 端点 | 方法 | 控制器 | 功能 |
|------|------|--------|------|
| `/system/user/list` | GET | SysUserController | 分页查询用户 |
| `/system/user/{id}` | GET | SysUserController | 查询用户详情 |
| `/order/create` | POST | OrderController | 创建订单 |

## 最近修改（最近 7 天）

- `SysUserController.java` — 2026-02-27 — 添加导出功能
- `OrderService.java` — 2026-02-26 — 优化分页查询
```

---

## 使用 Repo Map 的正确姿势

### AI 使用 Repo Map 的工作流程

```
1. 读取 REPO_MAP.md（~3000 token）
2. 根据任务定位相关类（精确到文件）
3. 只读取相关的 2-5 个文件（而非全部）
4. 实现修改
5. 检查影响的关联类
```

### 在 CLAUDE.md 中引用

```markdown
## 代码库地图

详见 [REPO_MAP.md](./REPO_MAP.md)

使用规则：
1. 在读取任何源文件之前，先查阅 REPO_MAP.md
2. 修改代码前，检查关联类和依赖关系
3. 新增类/接口后，更新 REPO_MAP.md
```

---

## 自动更新策略

### Git Hook 自动更新（推荐）

```bash
# .git/hooks/post-commit
#!/bin/bash
echo "Updating REPO_MAP.md..."
# 使用 ai-max 的 update-codemaps 命令
/aimax:update-codemaps
```

### CI 中更新

```yaml
# 在 aimax-evolution-gates.yml 中添加
- name: Update repo map
  run: |
    # 检测是否有新的类/接口添加
    if git diff HEAD~1 --name-only | grep -E '\.(java|ts|py)$'; then
      echo "Source files changed, update REPO_MAP.md"
    fi
```

---

## 与 /aimax:update-codemaps 协作

`/aimax:update-codemaps` 命令在此技能基础上工作：
1. 运行 ast-grep / ctags 提取最新符号
2. 更新 `REPO_MAP.md`
3. 检测与上次的差异（漂移检测）
4. 输出变更摘要

---

## 开源借鉴

- **Aider Repo Map** — 用 AST 提取符号树，精准定位修改范围
- **everything-claude-code Repo Map Skill** — REPO_MAP.md 格式规范
- **ast-grep** — 语义级代码搜索，支持 Java/TS/Python/Go 等
