---
name: axiom-detector
version: 1.0.0
description: Axiom 检测模块 - 检测项目是否有 Axiom 并读取记忆
author: ai-max
---

# Axiom 检测模块

> 检测项目是否集成了 Axiom 长期记忆和工作流系统

## 检测逻辑

### 第1步：检测 Axiom 工作流

```bash
# 检查 .agent/workflows/start.md 是否存在
if [ -f ".agent/workflows/start.md" ]; then
    AXIOM_AVAILABLE=true
    echo "✅ 检测到 Axiom 工作流"
else
    AXIOM_AVAILABLE=false
    echo "❌ 未检测到 Axiom"
fi
```

### 第2步：检测长期记忆

```bash
# 检查 .agent/memory/ 目录是否存在
if [ -d ".agent/memory" ]; then
    MEMORY_AVAILABLE=true
    echo "✅ 检测到长期记忆系统"
else
    MEMORY_AVAILABLE=false
    echo "❌ 未检测到长期记忆系统"
fi
```

### 第3步：返回 Axiom 状态

```json
{
  "axiom_available": true,
  "workflows": {
    "start": true,
    "feature_flow": true,
    "evolve": true
  },
  "memory": {
    "project_decisions": true,
    "coding_patterns": true,
    "lessons_learned": true
  }
}
```

## 记忆读取

### 读取架构决策

```markdown
## 读取 .agent/memory/project_decisions.md

if [ -f ".agent/memory/project_decisions.md" ]; then
    echo "正在读取项目架构决策..."
    cat .agent/memory/project_decisions.md

    # 应用到当前任务：
    # - 使用项目中既定的技术栈
    # - 遵循已定义的架构模式
    # - 不重复已做出的决策
fi
```

### 读取编码模式

```markdown
## 读取 .agent/memory/coding_patterns.md

if [ -f ".agent/memory/coding_patterns.md" ]; then
    echo "正在读取编码模式..."
    cat .agent/memory/coding_patterns.md

    # 应用到当前任务：
    # - 使用项目中既定的命名规范
    # - 使用项目中既定的代码结构
    # - 使用项目中既定的错误处理模式
fi
```

### 读取经验教训

```markdown
## 读取 .agent/memory/lessons_learned.md

if [ -f ".agent/memory/lessons_learned.md" ]; then
    echo "正在读取经验教训..."
    cat .agent/memory/lessons_learned.md

    # 应用到当前任务：
    # - 避免已知的坑
    # - 使用已验证的最佳实践
    # - 复用成功的模式
fi
```

## Axiom 目录结构

```
项目根目录/
├── .agent/                        # Axiom 配置目录
│   ├── memory/                    # 长期记忆
│   │   ├── project_decisions.md   # 架构决策记录
│   │   ├── coding_patterns.md     # 编码模式
│   │   ├── lessons_learned.md     # 经验教训
│   │   └── api_contracts.md       # API 契约（可选）
│   ├── workflows/                 # 工作流定义
│   │   ├── start.md               # 完整工作流
│   │   ├── feature-flow.md        # 功能开发流
│   │   └── evolve.md              # 知识进化流
│   └── config.md                  # Axiom 配置（可选）
```

## 记忆文件格式

### project_decisions.md 格式

```markdown
# 项目架构决策记录

## 技术栈

- **语言**: Java 17
- **框架**: Spring Boot 3.x
- **数据库**: PostgreSQL
- **缓存**: Redis
- **消息队列**: RabbitMQ

## 架构模式

- **分层架构**: Controller → Service → Repository → Entity
- **依赖注入**: 使用 Lombok @RequiredArgsConstructor
- **事务管理**: Service 层 @Transactional
- **异常处理**: 全局 @ControllerAdvice

## 命名规范

- **包名**: com.company.module.layer
- **类名**: XxxController, XxxService, XxxRepository
- **方法名**: camelCase
- **常量**: UPPER_SNAKE_CASE

## 决策历史

### 2026-02-01: 使用 MyBatis Plus 而非 JPA
- **原因**: 项目需要复杂查询，MyBatis Plus 更灵活
- **影响**: 所有 Repository 使用 BaseMapper

### 2026-02-15: 统一使用 LocalDateTime
- **原因**: 避免时区问题
- **影响**: 所有时间字段使用 LocalDateTime
```

### coding_patterns.md 格式

```markdown
# 编码模式

## 响应格式

```java
// 统一 API 响应格式
public class Result<T> {
    private Integer code;
    private String message;
    private T data;
}
```

## 分页查询

```java
// 统一分页查询模式
public PageResult<Entity> list(QueryParams params) {
    Page<Entity> page = new Page<>(params.getPageNum(), params.getPageSize());
    LambdaQueryWrapper<Entity> wrapper = new LambdaQueryWrapper<>();
    // 构建查询条件
    return PageResult.of(mapper.selectPage(page, wrapper));
}
```

## 错误处理

```java
// 统一业务异常
throw new BusinessException(ErrorCode.INVALID_PARAM, "参数错误");
```
```

### lessons_learned.md 格式

```markdown
# 经验教训

## 2026-02-10: 批量操作性能问题

**问题**: 批量插入 10000 条数据超时
**原因**: 逐条插入，没有使用批量插入
**解决**: 使用 MyBatis Plus saveBatch() 方法
**代码**:
```java
// ❌ 错误
for (Entity e : entities) {
    mapper.insert(e);
}

// ✅ 正确
mapper.saveBatch(entities, 1000);
```

## 2026-02-20: N+1 查询问题

**问题**: 列表查询响应时间过长
**原因**: 关联数据导致 N+1 查询
**解决**: 使用 IN 查询预加载关联数据
**代码**:
```java
// ❌ 错误
List<Order> orders = orderMapper.selectList(null);
for (Order order : orders) {
    order.setUser(userMapper.selectById(order.getUserId()));
}

// ✅ 正确
List<Order> orders = orderMapper.selectList(null);
Set<Long> userIds = orders.stream().map(Order::getUserId).collect(Collectors.toSet());
Map<Long, User> userMap = userMapper.selectBatchIds(userIds)
    .stream().collect(Collectors.toMap(User::getId, Function.identity()));
for (Order order : orders) {
    order.setUser(userMap.get(order.getUserId()));
}
```
```

## 与 /auto:auto 的集成

### 在执行任务前

```markdown
## /auto:auto 执行流程（含 Axiom）

1. 检测 Axiom
   ```bash
   axiom_status = detect_axiom()
   ```

2. 如果有 Axiom，读取记忆
   ```bash
   if axiom_status.available:
       project_decisions = read_memory("project_decisions.md")
       coding_patterns = read_memory("coding_patterns.md")
       lessons_learned = read_memory("lessons_learned.md")
   ```

3. 评估任务复杂度
   ```bash
   complexity = evaluate_complexity(task)
   ```

4. 根据复杂度和 Axiom 状态选择处理方式
   ```bash
   if complexity == "complex" and axiom_status.available:
       suggest_start_workflow()
   elif complexity == "complex":
       use_planner_agent()
   else:
       direct_execute()
   ```

5. 执行任务时应用项目规范
   ```bash
   apply_patterns(coding_patterns)
   avoid_pitfalls(lessons_learned)
   ```
```

## 输出格式

### Axiom 检测成功

```markdown
🔍 **Axiom 检测**

✅ **Axiom 可用**
📚 **长期记忆**:
  - project_decisions.md (架构决策)
  - coding_patterns.md (编码模式)
  - lessons_learned.md (经验教训)

📋 **已加载项目规范**:
  - 技术栈: Spring Boot 3.x + MyBatis Plus
  - 架构: 分层架构
  - 命名: XxxController/XxxService/XxxRepository

💡 **当前任务将遵循以上规范**
```

### Axiom 未检测到

```markdown
🔍 **Axiom 检测**

❌ **Axiom 不可用**
📝 **优先按项目现有代码风格执行**
💡 **如需长期记忆和工作流支持，可运行安装脚本**:
  `./scripts/install-axiom.ps1`
```

## 安装 Axiom

### 前提条件

- Git 已安装
- 网络可访问 GitHub

### 安装步骤

```powershell
# Windows
.\scripts\install-axiom.ps1

# Linux/Mac
./scripts/install-axiom.sh
```

### 手动安装

```bash
# 1. 克隆 Axiom
git clone https://github.com/Boundary-Correction/Axiom "$HOME/Axiom"

# 2. 在项目中初始化
mkdir -p .agent/memory
mkdir -p .agent/workflows

# 3. 创建初始记忆文件
touch .agent/memory/project_decisions.md
touch .agent/memory/coding_patterns.md
touch .agent/memory/lessons_learned.md

# 4. 复制工作流模板
cp "$HOME/Axiom/workflows/"* .agent/workflows/
```

---

**核心原则**：
1. **先检测后执行** - 在执行任务前检测 Axiom
2. **记忆驱动** - 读取并应用项目规范
3. **优雅降级** - 无 Axiom 时仍按项目现有风格执行
4. **持续进化** - 任务完成后更新记忆
