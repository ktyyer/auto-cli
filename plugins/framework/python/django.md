---
name: python-django
version: 1.0.0
description: Python / Django + DRF 框架插件 - Django REST Framework 开发最佳实践，ViewSet/Serializer/Model规范
author: ai-max
triggers:
  - python
  - django
  - drf
  - fastapi
  - flask
  - pydantic
  - sqlalchemy
stack: python
priority: 75
---

# Python / Django 框架插件

> 适用于 Django REST Framework、FastAPI、Flask 项目的开发最佳实践

## 自动加载条件

检测到以下任一特征时自动激活：
- `manage.py` 存在（Django）
- `requirements.txt` 或 `pyproject.toml` 包含 `django`、`fastapi`、`flask`
- 文件扩展名 `.py` + 导入了 Django/FastAPI

---

## Django REST Framework 规范

### Serializer 设计

```python
# ✅ 正确：使用 ModelSerializer，明确声明字段
class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'full_name', 'created_at']
        read_only_fields = ['id', 'created_at']
        extra_kwargs = {
            'password': {'write_only': True}
        }
    
    def get_full_name(self, obj) -> str:
        return f"{obj.first_name} {obj.last_name}"
    
    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user

# ❌ 错误：使用 fields = '__all__'（暴露所有字段，包括密码）
class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = '__all__'
```

### ViewSet 设计

```python
# ✅ 推荐：使用 ViewSet + Router，统一处理 CRUD
class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.select_related('profile').all()
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['status', 'role']
    search_fields = ['username', 'email']
    ordering_fields = ['created_at', 'username']
    ordering = ['-created_at']
    
    def get_serializer_class(self):
        if self.action == 'list':
            return UserListSerializer  # 列表用精简版
        return UserDetailSerializer   # 详情用完整版
    
    def get_queryset(self):
        # 用户只能看自己的数据（除非是管理员）
        if self.request.user.is_staff:
            return User.objects.all()
        return User.objects.filter(id=self.request.user.id)

# 注册路由
router = DefaultRouter()
router.register(r'users', UserViewSet)
urlpatterns = router.urls
```

### Model 设计

```python
# ✅ 使用抽象基类统一时间戳
class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        abstract = True

# ✅ 使用 select_related / prefetch_related 避免 N+1
class Order(TimeStampedModel):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='orders')
    status = models.CharField(max_length=20, choices=OrderStatus.choices, default=OrderStatus.PENDING)
    
    class Meta:
        db_table = 'orders'
        indexes = [
            models.Index(fields=['user', 'status']),
            models.Index(fields=['-created_at']),
        ]

# ✅ QuerySet 优化
orders = Order.objects.select_related('user').prefetch_related('items__product').filter(status='pending')
```

### 权限设计

```python
# ✅ 自定义权限类
class IsOwnerOrAdmin(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        return obj.user == request.user or request.user.is_staff

# ✅ 在 ViewSet 中使用
class OrderViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsOwnerOrAdmin]
```

### 异常处理

```python
# ✅ 全局异常处理器
def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)
    
    if response is not None:
        response.data = {
            'success': False,
            'code': response.status_code,
            'message': str(exc.detail) if hasattr(exc, 'detail') else str(exc),
            'data': None
        }
    return response

# settings.py
REST_FRAMEWORK = {
    'EXCEPTION_HANDLER': 'core.exceptions.custom_exception_handler',
    'DEFAULT_PAGINATION_CLASS': 'core.pagination.StandardPagination',
    'PAGE_SIZE': 20,
}
```

---

## FastAPI 规范

```python
from fastapi import FastAPI, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

app = FastAPI(title="MyAPI", version="1.0.0")

# ✅ Pydantic 请求/响应模型
class UserCreate(BaseModel):
    username: str = Field(..., min_length=2, max_length=50)
    email: str = Field(..., pattern=r'^[\w.-]+@[\w.-]+\.\w+$')
    password: str = Field(..., min_length=8)

class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    
    model_config = {"from_attributes": True}

# ✅ 依赖注入
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(user: UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == user.email).first():
        raise HTTPException(status_code=400, detail="邮箱已存在")
    db_user = User(**user.model_dump(exclude={'password'}))
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user
```

---

## 测试规范（pytest）

```python
# ✅ Django 使用 APITestCase
class UserAPITest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user('testuser', 'test@example.com', 'password123')
        self.client.force_authenticate(user=self.user)
    
    def test_get_user_list(self):
        response = self.client.get('/api/users/')
        self.assertEqual(response.status_code, 200)
        self.assertIn('results', response.data)
    
    def tearDown(self):
        User.objects.all().delete()

# ✅ FastAPI 使用 TestClient
def test_create_user(client: TestClient, db: Session):
    response = client.post("/users", json={"username": "test", "email": "test@test.com", "password": "pass1234"})
    assert response.status_code == 201
    assert response.json()["username"] == "test"
```

---

## 代码质量门禁

```bash
# Black 格式化
black . --check

# Ruff Lint
ruff check .

# mypy 类型检查
mypy . --ignore-missing-imports

# pytest 测试 + 覆盖率
pytest --cov=app --cov-report=term-missing --cov-fail-under=80
```

---

## 开源借鉴

- **everything-claude-code Python/Django skills** — DRF / FastAPI / pytest 最佳实践
- **Django REST Framework 官方文档** — ViewSet / Permission / Serializer 规范
- **FastAPI 官方最佳实践** — Pydantic v2 / 依赖注入 / OpenAPI
