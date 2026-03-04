---
name: chrome-automation
version: 1.0.0
description: 浏览器自动化 - 控制浏览器、调试页面、数据抓取
author: ai-max
triggers:
  - "浏览器"
  - "网页"
  - "抓取"
  - "自动化"
  - "爬虫"
  - "调试"
  - "页面"
priority: 60
builtin: true
---

# Claude in Chrome - 浏览器自动化

> 控制浏览器、调试线上页面、数据抓取

## 触发条件

- 任务包含"浏览器"、"网页"、"抓取"、"自动化"
- 任务包含"调试页面"、"爬虫"、"数据采集"

---

## 前置要求

需要安装 Claude in Chrome 插件或使用 Playwright。

### 方式 1: Claude in Chrome 插件

```bash
# 安装 Claude in Chrome 浏览器扩展
# 从 Chrome Web Store 安装
```

### 方式 2: Playwright（推荐）

```bash
# 安装 Playwright
npm install -D @playwright/test
npx playwright install
```

---

## 常用操作

### 1. 页面导航

```typescript
import { test } from '@playwright/test';

test('导航到页面', async ({ page }) => {
  await page.goto('https://example.com');

  // 等待页面加载
  await page.waitForLoadState('networkidle');
});
```

### 2. 点击操作

```typescript
// 点击按钮
await page.click('button:has-text("提交")');

// 点击链接
await page.click('a[href="/login"]');

// 点击特定元素
await page.click('[data-testid="submit-button"]');
```

### 3. 表单操作

```typescript
// 输入文本
await page.fill('input[name="username"]', 'testuser');
await page.fill('input[name="password"]', 'password123');

// 选择下拉框
await page.selectOption('select[name="country"]', 'CN');

// 勾选复选框
await page.check('input[type="checkbox"]');

// 上传文件
await page.setInputFiles('input[type="file"]', 'path/to/file.pdf');
```

### 4. 获取数据

```typescript
// 获取文本
const title = await page.textContent('h1');

// 获取属性
const href = await page.getAttribute('a', 'href');

// 获取多个元素
const items = await page.$$eval('.item', elements =>
  elements.map(el => el.textContent)
);

// 截图
await page.screenshot({ path: 'screenshot.png' });
```

### 5. 等待操作

```typescript
// 等待元素出现
await page.waitForSelector('.result');

// 等待元素消失
await page.waitForSelector('.loading', { state: 'hidden' });

// 等待导航完成
await page.waitForURL('**/dashboard');

// 等待请求完成
await page.waitForResponse('**/api/data');
```

---

## 常用场景

### 登录流程

```typescript
test('用户登录', async ({ page }) => {
  await page.goto('https://example.com/login');

  // 填写表单
  await page.fill('input[name="email"]', 'user@example.com');
  await page.fill('input[name="password"]', 'password123');

  // 点击登录
  await page.click('button[type="submit"]');

  // 验证登录成功
  await page.waitForURL('**/dashboard');
  await expect(page.locator('.welcome-message')).toBeVisible();
});
```

### 数据抓取

```typescript
test('抓取产品列表', async ({ page }) => {
  await page.goto('https://example.com/products');

  // 等待数据加载
  await page.waitForSelector('.product-item');

  // 获取所有产品
  const products = await page.$$eval('.product-item', items =>
    items.map(item => ({
      name: item.querySelector('.name')?.textContent,
      price: item.querySelector('.price')?.textContent,
      link: item.querySelector('a')?.href
    }))
  );

  console.log(products);
});
```

### 分页抓取

```typescript
test('分页抓取', async ({ page }) => {
  const allData = [];

  for (let i = 1; i <= 10; i++) {
    await page.goto(`https://example.com/list?page=${i}`);
    await page.waitForSelector('.item');

    const items = await page.$$eval('.item', elements =>
      elements.map(el => el.textContent)
    );

    allData.push(...items);
  }

  console.log(`共抓取 ${allData.length} 条数据`);
});
```

### 调试线上问题

```typescript
test('调试线上页面', async ({ page }) => {
  // 监听控制台输出
  page.on('console', msg => {
    console.log('浏览器日志:', msg.text());
  });

  // 监听网络请求
  page.on('request', request => {
    console.log('请求:', request.url());
  });

  page.on('response', response => {
    console.log('响应:', response.status(), response.url());
  });

  await page.goto('https://example.com/problem-page');

  // 获取页面状态
  const errors = await page.evaluate(() => {
    return (window as any).errors || [];
  });

  console.log('页面错误:', errors);
});
```

---

## 使用示例

```bash
# 自动化登录并抓取数据
/aimax:auto 自动化登录 example.com 并抓取用户列表

# 调试线上问题
/aimax:auto 调试 example.com/product 页面的加载问题

# 生成自动化测试
/aimax:auto 为登录流程生成 Playwright 测试
```

---

## 注意事项

1. **遵守 robots.txt** - 尊重网站的爬虫协议
2. **添加延迟** - 避免请求过于频繁
3. **处理验证码** - 某些网站需要人工介入
4. **数据合规** - 确保数据使用符合法规

```typescript
// 添加随机延迟
await page.waitForTimeout(Math.random() * 2000 + 1000);
```

---

**核心原则**：
1. **安全合规** - 遵守网站规则
2. **稳定可靠** - 添加适当的等待
3. **可维护** - 代码清晰易懂
4. **可扩展** - 支持多种场景
