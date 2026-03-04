---
name: super-tdd-universal
description: 通用 TDD 流程 - 适配任何语言和测试框架
version: 2.0
universal: true
---

# Super TDD — 通用测试驱动开发

> 适用于任何编程语言和测试框架

## 触发方式

```bash
# 通过 /aimax:auto 自动触发
/aimax:auto 测试用户登录功能

# 直接使用
/aimax:tdd 实现用户登录的测试
```

## 完整流程（语言无关）

### Phase 1: 🔴 红灯（Red）- 编写失败测试

**目标**: 编写一个会失败的测试，代码还不存在

#### JavaScript (Jest)

```javascript
describe('calculateAverage', () => {
    test('应该正确计算平均分', () => {
        // Given
        const scores = [80, 90, 100];

        // When
        const result = calculateAverage(scores);

        // Then
        expect(result).toBe(90);
    });
});
```

#### Python (pytest)

```python
def test_calculate_average():
    # Given
    scores = [80, 90, 100]

    # When
    result = calculate_average(scores)

    # Then
    assert result == 90
```

#### Java (JUnit)

```java
@Test
@DisplayName("应该正确计算平均分")
void testCalculateAverage_Success() {
    // Given
    List<Integer> scores = Arrays.asList(80, 90, 100);

    // When
    double result = calculateAverage(scores);

    // Then
    assertEquals(90.0, result, 0.01);
}
```

#### Go

```go
func TestCalculateAverage(t *testing.T) {
    // Given
    scores := []int{80, 90, 100}

    // When
    result := CalculateAverage(scores)

    // Then
    if result != 90.0 {
        t.Errorf("Expected 90.0, got %f", result)
    }
}
```

**预期**: 编译失败或运行失败（因为函数还不存在）

---

### Phase 2: 🟢 绿灯（Green）- 最小实现

**目标**: 编写最少代码让测试通过

#### JavaScript

```javascript
function calculateAverage(scores) {
    // 最小实现 - 让测试通过
    if (!Array.isArray(scores) || scores.length === 0) {
        throw new Error('Invalid scores');
    }

    const sum = scores.reduce((a, b) => a + b, 0);
    return sum / scores.length;
}
```

#### Python

```python
def calculate_average(scores):
    if not isinstance(scores, list) or len(scores) == 0:
        raise ValueError("Invalid scores")

    return sum(scores) / len(scores)
```

#### Java

```java
public double calculateAverage(List<Integer> scores) {
    if (scores == null || scores.isEmpty()) {
        throw new IllegalArgumentException("Invalid scores");
    }

    return scores.stream()
        .mapToInt(Integer::intValue)
        .average()
        .orElse(0.0);
}
```

#### Go

```go
func CalculateAverage(scores []int) (float64, error) {
    if len(scores) == 0 {
        return 0, errors.New("invalid scores")
    }

    sum := 0
    for _, score := range scores {
        sum += score
    }

    return float64(sum) / float64(len(scores)), nil
}
```

**预期**: 测试通过

---

### Phase 3: 🧹 重构（Refactor）- 清理代码

```bash
# 自动触发代码清理
/aimax:simplify

# 清理项：
✅ 提取重复逻辑
✅ 优化命名
✅ 添加注释
✅ 性能优化
```

**预期**: 测试依然通过

---

## 自动化门禁（通用）

### 门禁 1: 编译检查

```bash
# JavaScript/TypeScript
npm run build

# Python
python -m py_compile

# Java
mvn compile

# Go
go build
```

✅ 必须成功

### 门禁 2: 测试通过

```bash
# JavaScript
npm test

# Python
pytest

# Java
mvn test

# Go
go test ./...
```

✅ 必须全部通过

### 门禁 3: 覆盖率检查

```bash
# JavaScript
npm test -- --coverage

# Python
pytest --cov=. --cov-report=html

# Java
mvn test jacoco:report

# Go
go test -coverprofile=coverage.out
go tool cover -html=coverage.out
```

✅ 覆盖率必须 >= 80%

---

## 测试模板（按语言）

### JavaScript/TypeScript

```typescript
describe('Feature Name', () => {
    describe('Success Case', () => {
        test('should do something correctly', () => {
            // Given
            const input = {...};

            // When
            const result = functionUnderTest(input);

            // Then
            expect(result).toBe(expected);
        });
    });

    describe('Error Case', () => {
        test('should throw error when invalid input', () => {
            // Given
            const invalidInput = {...};

            // When & Then
            expect(() => {
                functionUnderTest(invalidInput);
            }).toThrow('Expected error message');
        });
    });
});
```

### Python

```python
class TestFeature:
    def test_success_case(self):
        """Should do something correctly"""
        # Given
        input_data = {...}

        # When
        result = function_under_test(input_data)

        # Then
        assert result == expected

    def test_error_case(self):
        """Should raise error when invalid input"""
        # Given
        invalid_input = {...}

        # When & Then
        with pytest.raises(ValueError, match="Expected message"):
            function_under_test(invalid_input)
```

### Java

```java
@ExtendWith(MockitoExtension.class)
class FeatureTest {

    @Test
    @DisplayName("应该正确执行功能")
    void testSuccess() {
        // Given
        InputType input = ...;

        // When
        ResultType result = service.execute(input);

        // Then
        assertEquals(expected, result);
    }

    @Test
    @DisplayName("应该抛出异常当输入无效")
    void testError() {
        // Given
        InputType invalidInput = ...;

        // When & Then
        assertThrows(ExpectedException.class, () -> {
            service.execute(invalidInput);
        });
    }
}
```

### Go

```go
func TestFeature(t *testing.T) {
    t.Run("Success", func(t *testing.T) {
        // Given
        input := ...

        // When
        result := FunctionUnderTest(input)

        // Then
        if result != expected {
            t.Errorf("Expected %v, got %v", expected, result)
        }
    })

    t.Run("Error", func(t *testing.T) {
        // Given
        invalidInput := ...

        // When & Then
        _, err := FunctionUnderTest(invalidInput)
        if err == nil {
            t.Error("Expected error, got nil")
        }
    })
}
```

---

## 覆盖率目标（通用）

| 代码类型 | 最低覆盖率 | 推荐覆盖率 |
|---------|----------|----------|
| 核心业务逻辑 | 80% | 90% |
| 工具函数 | 90% | 95% |
| UI/视图层 | 60% | 70% |
| 配置/常量 | 0% | - |

---

## 快速命令

```bash
# 完整 TDD 循环
/aimax:tdd 实现用户登录功能

# 只生成测试代码
/aimax:tdd 生成 UserService 的测试

# 运行测试
npm test        # JavaScript
pytest          # Python
mvn test        # Java
go test ./...   # Go

# 检查覆盖率
npm test -- --coverage
pytest --cov=.
mvn test jacoco:report
go test -cover
```

---

## 最佳实践（通用）

### ✅ DO（推荐）

1. **先写测试，后写代码**（红灯 → 绿灯 → 重构）
2. **测试命名清晰**：`test{功能}_{场景}_{预期}`
3. **使用 Given-When-Then** 结构
4. **一个测试只测一件事**
5. **Mock 外部依赖**（数据库、API）
6. **测试边界条件**（null、空、边界值）
7. **测试异常情况**

### ❌ DON'T（不推荐）

1. ❌ 测试私有方法
2. ❌ 测试第三方库
3. ❌ 测试 getter/setter
4. ❌ 一个测试测多件事
5. ❌ 直接访问外部依赖（数据库、网络）
6. ❌ 测试依赖执行顺序
7. ❌ 忽略失败的测试

---

## 语言特定规范

### JavaScript/TypeScript

```typescript
// ✅ 推荐：使用 Jest 的描述性语法
describe('UserLogin', () => {
    test('should return token when credentials valid', () => {
        // ...
    });
});

// ✅ 推荐：使用 async/await
test('should fetch user data', async () => {
    const data = await fetchUser(userId);
    expect(data).toBeDefined();
});
```

### Python

```python
# ✅ 推荐：使用 pytest 和描述性函数名
def test_user_login_should_return_token_when_credentials_valid():
    # ...
    pass

# ✅ 推荐：使用 fixture
@pytest.fixture
def user():
    return User(username="test", password="pass")
```

### Java

```java
// ✅ 推荐：使用 JUnit 5 和 DisplayName
@Test
@DisplayName("应该返回 token 当凭证有效")
void testLogin_ShouldReturnToken_WhenCredentialsValid() {
    // ...
}
```

### Go

```go
// ✅ 推荐：使用 t.Run 分组测试
func TestUserLogin(t *testing.T) {
    t.Run("Success", func(t *testing.T) {
        // ...
    })

    t.Run("Error", func(t *testing.T) {
        // ...
    })
}
```

---

**适用于任何语言的 TDD！** 🚀
