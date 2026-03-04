---
name: tdd-templates
version: 1.0.0
description: TDD 多语言测试模板 - JS/Python/Java/Go
author: ai-max
priority: 90
builtin: true
---

# TDD 多语言测试模板

> 为不同语言和测试框架提供标准化的测试模板

## 测试结构原则

所有测试遵循 **Given-When-Then** 结构：

- **Given**（准备）：设置测试前置条件
- **When**（执行）：执行被测试的代码
- **Then**（验证）：验证结果是否符合预期

---

## JavaScript / TypeScript

### Jest / Vitest 模板

```javascript
describe('FeatureName', () => {
  describe('Success Case', () => {
    test('should do something correctly', () => {
      // Given
      const input = { ... };

      // When
      const result = functionUnderTest(input);

      // Then
      expect(result).toBe(expected);
    });
  });

  describe('Error Case', () => {
    test('should throw error when invalid input', () => {
      // Given
      const invalidInput = { ... };

      // When & Then
      expect(() => {
        functionUnderTest(invalidInput);
      }).toThrow('Expected error message');
    });
  });

  describe('Edge Case', () => {
    test('should handle empty input', () => {
      // Given
      const emptyInput = null;

      // When
      const result = functionUnderTest(emptyInput);

      // Then
      expect(result).toBe(defaultValue);
    });
  });
});
```

### React 组件测试

```javascript
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ComponentName } from './ComponentName';

describe('ComponentName', () => {
  describe('Rendering', () => {
    test('should render with correct text', () => {
      // Given
      const props = { title: 'Test Title' };

      // When
      render(<ComponentName {...props} />);

      // Then
      expect(screen.getByText('Test Title')).toBeInTheDocument();
    });

    test('should render with default props', () => {
      // When
      render(<ComponentName />);

      // Then
      expect(screen.getByRole('button')).toBeInTheDocument();
    });
  });

  describe('User Interaction', () => {
    test('should call onClick when button clicked', async () => {
      // Given
      const handleClick = jest.fn();
      render(<ComponentName onClick={handleClick} />);

      // When
      await userEvent.click(screen.getByRole('button'));

      // Then
      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('State Changes', () => {
    test('should update state when input changes', async () => {
      // Given
      render(<ComponentName />);
      const input = screen.getByLabelText('Input Label');

      // When
      await userEvent.type(input, 'test value');

      // Then
      expect(input).toHaveValue('test value');
    });
  });
});
```

### API 测试（Next.js App Router）

```javascript
import { NextRequest } from 'next/server';
import { GET, POST } from './route';

describe('API Route: /api/resource', () => {
  describe('GET', () => {
    test('should return data successfully', async () => {
      // Given
      const request = new NextRequest('http://localhost/api/resource');

      // When
      const response = await GET(request);
      const data = await response.json();

      // Then
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    });

    test('should validate query parameters', async () => {
      // Given
      const request = new NextRequest(
        'http://localhost/api/resource?limit=invalid'
      );

      // When
      const response = await GET(request);

      // Then
      expect(response.status).toBe(400);
    });
  });

  describe('POST', () => {
    test('should create resource successfully', async () => {
      // Given
      const body = JSON.stringify({ name: 'Test' });
      const request = new NextRequest('http://localhost/api/resource', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      });

      // When
      const response = await POST(request);
      const data = await response.json();

      // Then
      expect(response.status).toBe(201);
      expect(data.name).toBe('Test');
    });
  });
});
```

---

## Python

### pytest 模板

```python
import pytest
from module import function_under_test

class TestFeature:
    """功能测试类"""

    def test_success_case(self):
        """测试正常情况"""
        # Given
        input_data = {...}

        # When
        result = function_under_test(input_data)

        # Then
        assert result == expected

    def test_error_case(self):
        """测试异常情况"""
        # Given
        invalid_input = {...}

        # When & Then
        with pytest.raises(ValueError, match="Expected message"):
            function_under_test(invalid_input)

    @pytest.mark.parametrize("input,expected", [
        ({"value": 1}, 1),
        ({"value": 0}, 0),
        ({"value": -1}, -1),
    ])
    def test_multiple_cases(self, input, expected):
        """参数化测试"""
        # Given
        # input 从参数获取

        # When
        result = function_under_test(input)

        # Then
        assert result == expected
```

### Django 测试模板

```python
from django.test import TestCase, Client
from django.urls import reverse
from myapp.models import MyModel

class MyModelTestCase(TestCase):
    """模型测试"""

    def setUp(self):
        """测试前置设置"""
        self.instance = MyModel.objects.create(
            name="Test",
            value=100
        )

    def test_model_creation(self):
        """测试模型创建"""
        # Given
        # 在 setUp 中创建

        # When & Then
        self.assertEqual(self.instance.name, "Test")
        self.assertEqual(self.instance.value, 100)

    def test_model_str(self):
        """测试字符串表示"""
        self.assertEqual(str(self.instance), "Test")


class MyViewTestCase(TestCase):
    """视图测试"""

    def setUp(self):
        self.client = Client()
        self.url = reverse('myapp:myview')

    def test_get_request(self):
        """测试 GET 请求"""
        # When
        response = self.client.get(self.url)

        # Then
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'myapp/template.html')

    def test_post_request(self):
        """测试 POST 请求"""
        # Given
        data = {"name": "New Item"}

        # When
        response = self.client.post(self.url, data)

        # Then
        self.assertEqual(response.status_code, 302)  # Redirect
        self.assertTrue(MyModel.objects.filter(name="New Item").exists())
```

### FastAPI 测试模板

```python
import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

class TestAPI:
    """API 测试"""

    def test_get_items_success(self):
        """测试获取列表成功"""
        # When
        response = client.get("/api/items")

        # Then
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    def test_create_item_success(self):
        """测试创建项目成功"""
        # Given
        data = {"name": "Test Item", "value": 100}

        # When
        response = client.post("/api/items", json=data)

        # Then
        assert response.status_code == 201
        assert response.json()["name"] == "Test Item"

    def test_create_item_validation_error(self):
        """测试创建项目验证失败"""
        # Given
        data = {"name": "", "value": -1}  # 无效数据

        # When
        response = client.post("/api/items", json=data)

        # Then
        assert response.status_code == 422
```

---

## Java

### JUnit 5 模板

```java
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("Feature Test")
class FeatureTest {

    @Mock
    private Dependency dependency;

    @InjectMocks
    private ServiceUnderTest service;

    @BeforeEach
    void setUp() {
        // 测试前置设置
    }

    @Test
    @DisplayName("应该成功执行功能")
    void testSuccess() {
        // Given
        InputType input = new InputType(...);
        when(dependency.method()).thenReturn(expectedValue);

        // When
        ResultType result = service.execute(input);

        // Then
        assertNotNull(result);
        assertEquals(expected, result.getValue());
        verify(dependency, times(1)).method();
    }

    @Test
    @DisplayName("应该抛出异常当输入无效")
    void testError() {
        // Given
        InputType invalidInput = new InputType(...);

        // When & Then
        assertThrows(ExpectedException.class, () -> {
            service.execute(invalidInput);
        });
    }

    @ParameterizedTest
    @ValueSource(ints = {0, 1, 100, -1})
    @DisplayName("参数化测试")
    void testParameterized(int value) {
        // Given
        InputType input = new InputType(value);

        // When
        ResultType result = service.execute(input);

        // Then
        assertNotNull(result);
    }

    @AfterEach
    void tearDown() {
        // 测试后清理
    }
}
```

### Spring Boot 测试模板

```java
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@DisplayName("Controller Integration Test")
class ControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @DisplayName("GET 应该返回所有资源")
    void getAllShouldReturnResources() throws Exception {
        // When & Then
        mockMvc.perform(get("/api/resources")
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data").isArray())
            .andExpect(jsonPath("$.data[0].id").exists());
    }

    @Test
    @DisplayName("POST 应该创建新资源")
    void createShouldReturnCreated() throws Exception {
        // Given
        String requestBody = """
            {
                "name": "Test Resource",
                "value": 100
            }
            """;

        // When & Then
        mockMvc.perform(post("/api/resources")
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.name").value("Test Resource"));
    }

    @Test
    @DisplayName("GET 应该返回单个资源")
    void getByIdShouldReturnResource() throws Exception {
        // When & Then
        mockMvc.perform(get("/api/resources/1"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value(1));
    }

    @Test
    @DisplayName("PUT 应该更新资源")
    void updateShouldReturnUpdated() throws Exception {
        // Given
        String requestBody = """
            {
                "name": "Updated Name"
            }
            """;

        // When & Then
        mockMvc.perform(put("/api/resources/1")
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.name").value("Updated Name"));
    }

    @Test
    @DisplayName("DELETE 应该删除资源")
    void deleteShouldReturnNoContent() throws Exception {
        // When & Then
        mockMvc.perform(delete("/api/resources/1"))
            .andExpect(status().isNoContent());
    }
}
```

---

## Go

### 基础测试模板

```go
package mypackage

import (
    "testing"
    "github.com/stretchr/testify/assert"
)

func TestFunctionUnderTest(t *testing.T) {
    t.Run("Success Case", func(t *testing.T) {
        // Given
        input := InputType{...}

        // When
        result, err := FunctionUnderTest(input)

        // Then
        assert.NoError(t, err)
        assert.Equal(t, expected, result)
    })

    t.Run("Error Case", func(t *testing.T) {
        // Given
        invalidInput := InputType{...}

        // When
        result, err := FunctionUnderTest(invalidInput)

        // Then
        assert.Error(t, err)
        assert.Equal(t, ExpectedError, err)
        assert.Nil(t, result)
    })

    t.Run("Edge Case - Empty Input", func(t *testing.T) {
        // Given
        emptyInput := InputType{}

        // When
        result, err := FunctionUnderTest(emptyInput)

        // Then
        assert.NoError(t, err)
        assert.Equal(t, defaultValue, result)
    })
}
```

### 表格驱动测试

```go
func TestFunctionWithTable(t *testing.T) {
    tests := []struct {
        name     string
        input    InputType
        expected ResultType
        wantErr  bool
    }{
        {
            name:     "正常情况",
            input:    InputType{Value: 100},
            expected: ResultType{Result: 100},
            wantErr:  false,
        },
        {
            name:     "零值",
            input:    InputType{Value: 0},
            expected: ResultType{Result: 0},
            wantErr:  false,
        },
        {
            name:     "负值",
            input:    InputType{Value: -1},
            expected: ResultType{},
            wantErr:  true,
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            // When
            result, err := FunctionUnderTest(tt.input)

            // Then
            if tt.wantErr {
                assert.Error(t, err)
            } else {
                assert.NoError(t, err)
                assert.Equal(t, tt.expected, result)
            }
        })
    }
}
```

### HTTP Handler 测试

```go
package handler

import (
    "net/http"
    "net/http/httptest"
    "testing"

    "github.com/stretchr/testify/assert"
)

func TestGetItemsHandler(t *testing.T) {
    t.Run("Success", func(t *testing.T) {
        // Given
        req := httptest.NewRequest(http.MethodGet, "/api/items", nil)
        rec := httptest.NewRecorder()

        // When
        handler := GetItemsHandler(mockService)
        handler.ServeHTTP(rec, req)

        // Then
        assert.Equal(t, http.StatusOK, rec.Code)
        assert.Contains(t, rec.Body.String(), "data")
    })

    t.Run("Create Success", func(t *testing.T) {
        // Given
        body := strings.NewReader(`{"name":"Test"}`)
        req := httptest.NewRequest(http.MethodPost, "/api/items", body)
        req.Header.Set("Content-Type", "application/json")
        rec := httptest.NewRecorder()

        // When
        handler := CreateItemHandler(mockService)
        handler.ServeHTTP(rec, req)

        // Then
        assert.Equal(t, http.StatusCreated, rec.Code)
    })
}
```

---

## 自动化门禁

### 门禁 1: 编译检查

```bash
# JavaScript/TypeScript
npm run build

# Python
python -m py_compile

# Java
mvn compile

# Go
go build ./...
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

## 覆盖率目标

| 代码类型 | 最低覆盖率 | 推荐覆盖率 |
|---------|----------|----------|
| 核心业务逻辑 | 80% | 90% |
| 工具函数 | 90% | 95% |
| API 端点 | 80% | 85% |
| UI/视图层 | 60% | 70% |
| 配置/常量 | 0% | - |

---

## 最佳实践

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

**适用于所有语言的 TDD！**
