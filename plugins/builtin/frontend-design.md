---
name: frontend-design
version: 1.0.0
description: 前端视觉设计 - 字体、间距、配色、组件视觉打磨
author: ai-max
triggers:
  - "组件"
  - "界面"
  - "UI"
  - "页面"
  - "样式"
  - "CSS"
  - "视觉"
priority: 70
builtin: true
---

# Frontend Design - 前端视觉设计

> 专业的 UI 组件视觉打磨

## 触发条件

- 项目有 package.json（前端项目）
- 任务包含"组件"、"界面"、"UI"、"页面"、"样式"

---

## 设计规范

### 字体系统

```css
/* 字体层级 */
--font-family-base: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
--font-family-mono: 'SF Mono', Monaco, 'Cascadia Code', monospace;

/* 字体大小 */
--font-size-xs: 0.75rem;    /* 12px */
--font-size-sm: 0.875rem;   /* 14px */
--font-size-base: 1rem;     /* 16px */
--font-size-lg: 1.125rem;   /* 18px */
--font-size-xl: 1.25rem;    /* 20px */
--font-size-2xl: 1.5rem;    /* 24px */
--font-size-3xl: 1.875rem;  /* 30px */

/* 行高 */
--line-height-tight: 1.25;
--line-height-normal: 1.5;
--line-height-relaxed: 1.75;
```

### 间距系统

```css
/* 间距层级（4px 基础单位） */
--spacing-0: 0;
--spacing-1: 0.25rem;   /* 4px */
--spacing-2: 0.5rem;    /* 8px */
--spacing-3: 0.75rem;   /* 12px */
--spacing-4: 1rem;      /* 16px */
--spacing-5: 1.25rem;   /* 20px */
--spacing-6: 1.5rem;    /* 24px */
--spacing-8: 2rem;      /* 32px */
--spacing-10: 2.5rem;   /* 40px */
--spacing-12: 3rem;     /* 48px */
--spacing-16: 4rem;     /* 64px */
```

### 配色系统

```css
/* 主色调 */
--color-primary-50: #eff6ff;
--color-primary-100: #dbeafe;
--color-primary-500: #3b82f6;
--color-primary-600: #2563eb;
--color-primary-700: #1d4ed8;

/* 中性色 */
--color-gray-50: #f9fafb;
--color-gray-100: #f3f4f6;
--color-gray-200: #e5e7eb;
--color-gray-300: #d1d5db;
--color-gray-400: #9ca3af;
--color-gray-500: #6b7280;
--color-gray-600: #4b5563;
--color-gray-700: #374151;
--color-gray-800: #1f2937;
--color-gray-900: #111827;

/* 语义色 */
--color-success: #22c55e;
--color-warning: #f59e0b;
--color-error: #ef4444;
--color-info: #3b82f6;
```

### 圆角系统

```css
--radius-none: 0;
--radius-sm: 0.125rem;   /* 2px */
--radius-base: 0.25rem;  /* 4px */
--radius-md: 0.375rem;   /* 6px */
--radius-lg: 0.5rem;     /* 8px */
--radius-xl: 0.75rem;    /* 12px */
--radius-2xl: 1rem;      /* 16px */
--radius-full: 9999px;
```

### 阴影系统

```css
--shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
--shadow-base: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);
--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
--shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
--shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
```

---

## 组件设计规范

### 按钮组件

```tsx
// 按钮变体
type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';

// 按钮尺寸
type ButtonSize = 'sm' | 'md' | 'lg';

// 标准按钮
<Button variant="primary" size="md">
  点击我
</Button>

// 设计规范
- 最小点击区域: 44px × 44px
- 内边距: sm(8px 16px), md(12px 20px), lg(16px 24px)
- 过渡动画: 150ms ease
- 悬停效果: 背景色加深 10%
```

### 输入框组件

```tsx
// 输入框状态
type InputState = 'default' | 'hover' | 'focus' | 'error' | 'disabled';

// 标准输入框
<Input
  label="用户名"
  placeholder="请输入用户名"
  error="用户名不能为空"
/>

// 设计规范
- 高度: sm(32px), md(40px), lg(48px)
- 内边距: 12px 16px
- 边框: 1px solid gray-300
- 聚焦边框: 2px solid primary-500
- 错误边框: 2px solid error
```

### 卡片组件

```tsx
// 标准卡片
<Card>
  <CardHeader>
    <CardTitle>标题</CardTitle>
    <CardDescription>描述文字</CardDescription>
  </CardHeader>
  <CardContent>内容区域</CardContent>
  <CardFooter>底部操作</CardFooter>
</Card>

// 设计规范
- 背景: white
- 边框: 1px solid gray-200
- 圆角: radius-lg (8px)
- 阴影: shadow-sm
- 内边距: 24px
```

### 表单组件

```tsx
// 标准表单布局
<Form>
  <FormField>
    <FormLabel>字段名</FormLabel>
    <FormControl><Input /></FormControl>
    <FormDescription>帮助文字</FormDescription>
    <FormMessage>错误信息</FormMessage>
  </FormField>
</Form>

// 设计规范
- 标签字体: font-size-sm, font-medium
- 标签间距: spacing-2 (8px)
- 字段间距: spacing-4 (16px)
- 错误颜色: color-error
```

---

## 响应式布局

### 断点系统

```css
/* 移动优先断点 */
--breakpoint-sm: 640px;   /* 手机横屏 */
--breakpoint-md: 768px;   /* 平板竖屏 */
--breakpoint-lg: 1024px;  /* 平板横屏 */
--breakpoint-xl: 1280px;  /* 桌面 */
--breakpoint-2xl: 1536px; /* 大屏桌面 */
```

### 响应式设计示例

```tsx
// 使用 Tailwind
<div className="
  grid
  grid-cols-1
  sm:grid-cols-2
  md:grid-cols-3
  lg:grid-cols-4
  gap-4
">
  {items.map(item => <Card key={item.id} {...item} />)}
</div>
```

---

## 动画规范

### 过渡时间

```css
--duration-fast: 150ms;
--duration-normal: 200ms;
--duration-slow: 300ms;
```

### 缓动函数

```css
--ease-in: cubic-bezier(0.4, 0, 1, 1);
--ease-out: cubic-bezier(0, 0, 0.2, 1);
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
```

### 常用动画

```css
/* 淡入 */
.fade-in {
  animation: fadeIn 200ms ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* 滑入 */
.slide-in {
  animation: slideIn 200ms ease-out;
}

@keyframes slideIn {
  from { transform: translateY(-10px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
```

---

## 使用示例

```bash
# 创建 UI 组件
/auto:auto 写一个登录表单组件

# 应用设计规范
/auto:auto 创建一个用户卡片组件，使用卡片设计规范

# 响应式布局
/auto:auto 创建一个响应式的产品列表页面
```

---

**核心原则**：
1. **一致性** - 统一的设计语言
2. **层次感** - 清晰的视觉层级
3. **响应式** - 适配各种屏幕
4. **可访问性** - 考虑所有用户
5. **性能** - 优化动画和过渡
