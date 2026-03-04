---
name: code-simplifier-universal
description: 通用代码清理 - 自动提取常量、简化条件、优化代码（适配任何语言）
version: 2.0
universal: true
---

# Code Simplifier — 通用代码清理专家

> 适用于任何编程语言

## 触发方式

```bash
# 通过 /aimax:auto 自动触发
/aimax:auto 清理最近改动的代码

# 直接使用
/code-simplify
```

## 清理规则（通用）

### 规则 1: 提取魔法值/常量

**问题**: 代码中出现裸数字或字符串

#### JavaScript

```javascript
// ❌ Before
if (score > 90) {
    level = "优秀";
}

// ✅ After
const EXCELLENT_SCORE_THRESHOLD = 90;
if (score > EXCELLENT_SCORE_THRESHOLD) {
    level = "优秀";
}
```

#### Python

```python
# ❌ Before
if score > 90:
    level = "优秀"

# ✅ After
EXCELLENT_SCORE_THRESHOLD = 90
if score > EXCELLENT_SCORE_THRESHOLD:
    level = "优秀"
```

#### Java

```java
// ❌ Before
if (score > 90) {
    level = "优秀";
}

// ✅ After
private static final int EXCELLENT_SCORE_THRESHOLD = 90;

if (score > EXCELLENT_SCORE_THRESHOLD) {
    level = "优秀";
}
```

#### Go

```go
// ❌ Before
if score > 90 {
    level = "优秀"
}

// ✅ After
const ExcellentScoreThreshold = 90

if score > ExcellentScoreThreshold {
    level = "优秀"
}
```

---

### 规则 2: 简化条件判断（提前返回）

**问题**: 深层嵌套

#### JavaScript

```javascript
// ❌ Before: 深层嵌套
function processUser(user) {
    if (user !== null) {
        if (user.name !== null) {
            if (user.age !== undefined) {
                // 业务逻辑
                return user.name + user.age;
            }
        }
    }
    return null;
}

// ✅ After: 提前返回
function processUser(user) {
    if (!user) return null;
    if (!user.name) return null;
    if (user.age === undefined) return null;

    // 业务逻辑
    return user.name + user.age;
}
```

#### Python

```python
# ❌ Before
def process_user(user):
    if user is not None:
        if user.name is not None:
            if user.age is not None:
                # 业务逻辑
                return f"{user.name}{user.age}"
    return None

# ✅ After
def process_user(user):
    if not user:
        return None
    if not user.name:
        return None
    if user.age is None:
        return None

    # 业务逻辑
    return f"{user.name}{user.age}"
```

#### Java

```java
// ❌ Before
public String processUser(User user) {
    if (user != null) {
        if (user.getName() != null) {
            if (user.getAge() != null) {
                // 业务逻辑
                return user.getName() + user.getAge();
            }
        }
    }
    return null;
}

// ✅ After
public String processUser(User user) {
    if (user == null) return null;
    if (user.getName() == null) return null;
    if (user.getAge() == null) return null;

    // 业务逻辑
    return user.getName() + user.getAge();
}
```

---

### 规则 3: 消除重复代码

#### JavaScript

```javascript
// ❌ Before: 重复逻辑
function validateUser(user) {
    if (!user) return false;
    if (!user.name) return false;
    if (!user.email) return false;
    return true;
}

function validateAdmin(admin) {
    if (!admin) return false;
    if (!admin.name) return false;
    if (!admin.email) return false;
    return true;
}

// ✅ After: 提取公共逻辑
function validatePerson(person) {
    if (!person) return false;
    if (!person.name) return false;
    if (!person.email) return false;
    return true;
}

function validateUser(user) {
    return validatePerson(user);
}

function validateAdmin(admin) {
    return validatePerson(admin);
}
```

#### Python

```python
# ❌ Before
def validate_user(user):
    if not user:
        return False
    if not user.name:
        return False
    return True

def validate_admin(admin):
    if not admin:
        return False
    if not admin.name:
        return False
    return True

# ✅ After
def validate_person(person):
    if not person:
        return False
    if not person.name:
        return False
    return True

def validate_user(user):
    return validate_person(user)

def validate_admin(admin):
    return validate_person(admin)
```

---

### 规则 4: 使用现代语法

#### JavaScript

```javascript
// ❌ Before: 传统循环
const ids = [];
for (let i = 0; i < users.length; i++) {
    if (users[i].id) {
        ids.push(users[i].id);
    }
}

// ✅ After: 现代 JavaScript
const ids = users
    .filter(user => user.id)
    .map(user => user.id);

// ❌ Before: var + function
var handler = function(event) {
    console.log(event);
};

// ✅ After: const + arrow function
const handler = event => {
    console.log(event);
};
```

#### Python

```python
# ❌ Before: 传统循环
ids = []
for user in users:
    if user.id:
        ids.append(user.id)

# ✅ After: 列表推导式
ids = [user.id for user in users if user.id]

# ❌ Before: 字符串格式化 %
name = "World"
print("Hello %s" % name)

# ✅ After: f-string
name = "World"
print(f"Hello {name}")
```

#### Java

```java
// ❌ Before: 传统循环
List<Long> ids = new ArrayList<>();
for (User user : users) {
    if (user.getId() != null) {
        ids.add(user.getId());
    }
}

// ✅ After: Stream API
List<Long> ids = users.stream()
    .filter(user -> user.getId() != null)
    .map(User::getId)
    .collect(Collectors.toList());
```

---

### 规则 5: 优化命名

**通用规则**:

| 类型 | 命名规范 | 示例 |
|------|---------|------|
| 变量/函数 | camelCase | `getUserData` |
| 类/接口 | PascalCase | `UserService` |
| 常量 | UPPER_SNAKE_CASE | `MAX_COUNT` |
| 私有成员 | _prefix | `_privateMethod` |

#### JavaScript

```javascript
// ❌ Before
let d = new Date();
let u = users[0];

// ✅ After
let currentDate = new Date();
let firstUser = users[0];
```

#### Python

```python
# ❌ Before
def calc(u):
    pass

# ✅ After
def calculate_user_score(user):
    pass
```

#### Java

```java
// ❌ Before
private List<Map<String, Object>> getData(Integer id) {
    // ...
}

// ✅ After
private List<UserDto> queryUsersByDepartmentId(Long departmentId) {
    // ...
}
```

---

### 规则 6: 添加注释

**通用原则**:
- 复杂逻辑必须注释
- 公共 API 必须注释
- 边界条件必须注释

#### JavaScript

```javascript
// ❌ Before
function calc(scores) {
    return scores.reduce((a, b) => a + b, 0) / scores.length;
}

// ✅ After
/**
 * 计算分数列表的平均值
 * @param {number[]} scores - 分数数组
 * @returns {number} 平均分
 * @throws {Error} 如果数组为空
 */
function calculateAverageScore(scores) {
    if (!scores || scores.length === 0) {
        throw new Error('Scores array cannot be empty');
    }

    return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}
```

#### Python

```python
# ❌ Before
def calc(scores):
    return sum(scores) / len(scores)

# ✅ After
def calculate_average_score(scores):
    """
    计算分数列表的平均值

    Args:
        scores (list): 分数列表

    Returns:
        float: 平均分

    Raises:
        ValueError: 如果列表为空
    """
    if not scores:
        raise ValueError("Scores list cannot be empty")

    return sum(scores) / len(scores)
```

#### Java

```java
// ❌ Before
public double calc(List<Integer> scores) {
    // ...
}

// ✅ After
/**
 * 计算分数列表的平均值
 *
 * @param scores 分数列表
 * @return 平均分
 * @throws IllegalArgumentException 如果列表为空
 */
public double calculateAverageScore(List<Integer> scores) {
    if (scores == null || scores.isEmpty()) {
        throw new IllegalArgumentException("Scores list cannot be empty");
    }

    return scores.stream()
        .mapToInt(Integer::intValue)
        .average()
        .orElse(0.0);
}
```

---

## 自动化流程

```yaml
steps:
  1. 检测最近改动的文件
  2. 检测项目语言
  3. 应用对应语言的清理规则
  4. 生成优化建议
  5. 显示 diff 预览
  6. 等待用户确认
  7. 应用修改
  8. 运行测试确保没有破坏
```

---

## 使用示例

```bash
/code-simplify

# 分析中...
# 发现 2 个最近改动的文件：
#   1. userService.js
#   2. authController.js

# 优化建议：

## userService.js
✅ 提取 2 个魔法值
   - 90 → MAX_SCORE
   - 24 → HOURS_PER_DAY

✅ 简化 1 个条件判断
   - 减少嵌套层级 3 → 1

✅ 使用现代语法
   - var → const
   - function → arrow function

## authController.js
✅ 优化 1 个命名
   - d → currentUser

✅ 添加注释
   - 为公共方法添加 JSDoc

# 总计：
# - 提取魔法值：2 个
# - 简化条件：3 处
# - 现代化：5 处
# - 命名优化：1 个
# - 添加注释：3 个

# 是否应用这些优化？(y/N)
```

---

## 快速命令

```bash
# 清理最近改动的文件
/code-simplify

# 清理指定文件
/code-simplify userService.js

# 只显示建议，不应用
/code-simplify --dry-run

# 强制应用
/code-simplify --force

# 详细模式
/code-simplify --verbose
```

---

## 语言特定清理规则

### JavaScript/TypeScript

- 使用 `const` > `let` > `var`
- 使用 arrow function
- 使用 template literals
- 使用 async/await
- 使用解构赋值

### Python

- 使用列表推导式
- 使用 f-string
- 使用 Type Hints
- 使用 context managers (`with`)

### Java

- 使用 Stream API
- 使用 Optional
- 使用 try-with-resources
- 使用 Lombok (`@Getter @Setter`)

### Go

- 使用 go fmt
- 使用错误处理模式
- 使用 defer

---

**让代码更简洁、更易读！** 🧹
