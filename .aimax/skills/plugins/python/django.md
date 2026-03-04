---
name: django-helper
version: 1.1.0
description: Django 开发助手 - 严格遵循项目现有代码风格
author: aimax
triggers:
  - "Django"
  - "django"
  - "Model"
  - "View"
  - "Serializer"
  - "QuerySet"
  - "ORM"
  - "migration"
priority: 50
language: python
framework: django
---

# Django 开发助手（项目风格优先）

> 第一原则：**沿用项目已有 Django 风格**，不要强推固定脚手架模板。

## 规则优先级

1. **项目现有代码**
2. **项目配置与工具链**（`settings.py`、`pyproject.toml`、ruff/black/isort）
3. **项目文档与约定**
4. **本插件兜底建议**（仅无样例时）

## 执行流程

### Step 1: 先探测项目习惯

生成前先确认：

- Django + DRF 版本与依赖
- 视图风格（FBV/CBV/ViewSet）
- 序列化风格（DRF Serializer/ModelSerializer/Forms）
- 路由方式（router/path/re_path）
- ORM 写法和 QuerySet 优化习惯
- 权限与认证方案
- 测试框架（pytest/unittest）

### Step 2: 按样本对齐

至少参考同应用 2-3 个现有文件（model/view/serializer/test），对齐：

- 命名与文件布局
- 错误处理与响应格式
- 校验与权限处理
- 测试结构与 fixture 用法

### Step 3: 最小增量实现

- 只实现当前需求，不顺手重构整个 app
- 不强制从 FBV 切到 ViewSet 或反向切换
- 不引入项目未使用依赖

## 强制约束（不可违反）

1. 项目未使用 DRF 时，禁止默认引入 DRF 结构。
2. 项目使用 Forms 校验时，禁止强行改成 Serializer 校验。
3. 项目已有统一响应格式时，禁止另起一套响应包装。
4. 项目已有鉴权方案时，禁止平行新增另一套方案。

## 输出要求

实现说明必须包含：

- 参考了哪些现有 Django 文件
- 继承了哪些项目约定
- 哪些规范不明确需要你确认

## 兜底建议（仅无样例时）

仅在项目缺少可参考代码时，使用以下默认建议：

- 清晰的 Model / View / Serializer 职责分离
- 合理的 QuerySet 优化（`select_related`/`prefetch_related`）
- 明确的权限和输入校验
- 覆盖核心路径的测试
