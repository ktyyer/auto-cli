---
name: playground
version: 1.0.0
description: HTML 工具生成 - 零依赖、即开即用的可视化工具
author: ai-max
triggers:
  - "可视化"
  - "工具"
  - "演示"
  - "HTML"
  - "看板"
  - "图表"
priority: 60
builtin: true
---

# Playground - HTML 工具生成

> 生成独立 HTML 文件，零依赖，即开即用

## 触发条件

- 任务包含"可视化"、"工具"、"演示"、"HTML"
- 任务包含"看板"、"图表"、"数据展示"

---

## 生成原则

### 1. 零依赖

```html
<!-- ✅ 正确：纯 HTML + 内联 CSS + 内联 JS -->
<!DOCTYPE html>
<html>
<head>
  <style>
    /* 所有样式内联 */
  </style>
</head>
<body>
  <script>
    // 所有脚本内联
  </script>
</body>
</html>

<!-- ❌ 错误：依赖外部 CDN -->
<link href="https://cdn.example.com/style.css">
<script src="https://cdn.example.com/lib.js"></script>
```

### 2. 即开即用

- 双击 HTML 文件即可在浏览器中打开
- 无需安装任何依赖
- 无需本地服务器

### 3. 单文件完整

- 所有 CSS 内联在 `<style>` 标签
- 所有 JS 内联在 `<script>` 标签
- 所有数据直接写在代码中

---

## 常用模板

### 数据可视化看板

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>数据看板</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, sans-serif; background: #f5f5f5; padding: 20px; }
    .dashboard { max-width: 1200px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 30px; }
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 30px; }
    .card { background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .card-title { color: #666; font-size: 14px; margin-bottom: 10px; }
    .card-value { font-size: 32px; font-weight: bold; color: #333; }
    .chart-container { background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    canvas { width: 100%; height: 300px; }
  </style>
</head>
<body>
  <div class="dashboard">
    <div class="header">
      <h1>数据看板</h1>
      <p>实时数据监控</p>
    </div>
    <div class="cards" id="cards"></div>
    <div class="chart-container">
      <canvas id="chart"></canvas>
    </div>
  </div>
  <script>
    // 数据配置
    const data = {
      metrics: [
        { title: '总用户', value: '12,345', trend: '+12%' },
        { title: '日活用户', value: '3,456', trend: '+5%' },
        { title: '转化率', value: '23.5%', trend: '+2%' },
        { title: '收入', value: '¥45,678', trend: '+18%' }
      ],
      chartData: [30, 50, 40, 60, 80, 70, 90]
    };

    // 渲染卡片
    const cardsEl = document.getElementById('cards');
    data.metrics.forEach(m => {
      cardsEl.innerHTML += `
        <div class="card">
          <div class="card-title">${m.title}</div>
          <div class="card-value">${m.value}</div>
          <div style="color: #22c55e; font-size: 14px;">${m.trend}</div>
        </div>
      `;
    });

    // 绘制图表（纯 Canvas）
    const canvas = document.getElementById('chart');
    const ctx = canvas.getContext('2d');
    // ... 图表绘制逻辑
  </script>
</body>
</html>
```

### 表单生成器

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>表单生成器</title>
  <style>
    /* 表单样式 */
  </style>
</head>
<body>
  <form id="form">
    <!-- 动态生成的表单字段 -->
  </form>
  <script>
    const schema = [
      { name: 'username', label: '用户名', type: 'text', required: true },
      { name: 'email', label: '邮箱', type: 'email', required: true },
      { name: 'age', label: '年龄', type: 'number', min: 0, max: 150 }
    ];
    // 动态渲染表单...
  </script>
</body>
</html>
```

### JSON 格式化工具

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>JSON 格式化</title>
  <style>
    textarea { width: 100%; height: 200px; font-family: monospace; }
    .output { background: #f0f0f0; padding: 15px; border-radius: 4px; }
  </style>
</head>
<body>
  <h2>JSON 格式化工具</h2>
  <textarea id="input" placeholder="粘贴 JSON..."></textarea>
  <button onclick="format()">格式化</button>
  <button onclick="minify()">压缩</button>
  <pre class="output" id="output"></pre>
  <script>
    function format() {
      const input = document.getElementById('input').value;
      try {
        const json = JSON.parse(input);
        document.getElementById('output').textContent = JSON.stringify(json, null, 2);
      } catch (e) {
        document.getElementById('output').textContent = '错误: ' + e.message;
      }
    }
    function minify() {
      const input = document.getElementById('input').value;
      try {
        const json = JSON.parse(input);
        document.getElementById('output').textContent = JSON.stringify(json);
      } catch (e) {
        document.getElementById('output').textContent = '错误: ' + e.message;
      }
    }
  </script>
</body>
</html>
```

### 颜色选择器

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>颜色选择器</title>
  <style>
    .palette { display: grid; grid-template-columns: repeat(8, 1fr); gap: 10px; }
    .color { width: 100%; aspect-ratio: 1; border-radius: 4px; cursor: pointer; }
  </style>
</head>
<body>
  <h2>颜色选择器</h2>
  <div class="palette" id="palette"></div>
  <p>选中颜色: <span id="selected">#000000</span></p>
  <script>
    const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280'];
    const palette = document.getElementById('palette');
    colors.forEach(c => {
      const div = document.createElement('div');
      div.className = 'color';
      div.style.background = c;
      div.onclick = () => document.getElementById('selected').textContent = c;
      palette.appendChild(div);
    });
  </script>
</body>
</html>
```

---

## 使用示例

```bash
# 生成数据看板
/auto:auto 生成一个销售数据可视化看板

# 生成工具页面
/auto:auto 生成一个 JSON 格式化工具

# 生成演示页面
/auto:auto 生成一个产品演示页面
```

---

## 输出规范

生成完成后，提供：

1. **文件位置** - HTML 文件保存路径
2. **打开方式** - 双击即可在浏览器打开
3. **使用说明** - 如何操作工具

```markdown
✅ HTML 工具已生成

📁 文件: tools/dashboard.html
🌐 打开: 双击文件即可在浏览器中打开

📝 使用说明:
1. 打开文件后自动显示数据
2. 点击卡片可查看详情
3. 图表支持鼠标悬停交互
```

---

**核心原则**：
1. **零依赖** - 纯 HTML/CSS/JS
2. **即开即用** - 双击即可运行
3. **单文件** - 所有内容内联
4. **可定制** - 数据配置清晰
