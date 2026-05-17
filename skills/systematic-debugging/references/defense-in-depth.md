---
name: systematic-debugging:defense-in-depth
description: 由 systematic-debugging.md 主文件按需加载。完整上下文见主文件。
---

# 多层防御验证

> 由 `systematic-debugging.md` 主文件按需加载。完整上下文见主文件。
> 基于 [obra/superpowers/defense-in-depth](https://github.com/obra/superpowers/blob/main/skills/systematic-debugging/defense-in-depth.md) 适配。

---

## 核心原则

修复了一个由无效数据引起的 bug 后，在一个地方加验证感觉足够了。但单点检查可能被不同代码路径、重构或 mock 绕过。

**核心原则：在数据经过的每一层都添加验证。让 bug 在结构上不可能发生。**

| 策略     | 效果                          |
| -------- | ----------------------------- |
| 单层验证 | "我们修了这个 bug"            |
| 多层防御 | "我们让这个 bug 不可能再发生" |

---

## 四层防护

### Layer 1：入口点验证

**目的：** 在 API 边界拒绝明显无效的输入

```typescript
function createProject(name: string, workingDirectory: string) {
  if (!workingDirectory || workingDirectory.trim() === '') {
    throw new Error('workingDirectory cannot be empty');
  }
  if (!existsSync(workingDirectory)) {
    throw new Error(`workingDirectory does not exist: ${workingDirectory}`);
  }
  if (!statSync(workingDirectory).isDirectory()) {
    throw new Error(`workingDirectory is not a directory: ${workingDirectory}`);
  }
  // ... proceed
}
```

### Layer 2：业务逻辑验证

**目的：** 确保数据对该操作有意义

```typescript
function initializeWorkspace(projectDir: string, sessionId: string) {
  if (!projectDir) {
    throw new Error('projectDir required for workspace initialization');
  }
  // ... proceed
}
```

### Layer 3：环境保护

**目的：** 在特定上下文中阻止危险操作

```typescript
async function gitInit(directory: string) {
  // 测试环境中，拒绝在临时目录外执行 git init
  if (process.env.NODE_ENV === 'test') {
    const normalized = normalize(resolve(directory));
    const tmpDir = normalize(resolve(tmpdir()));

    if (!normalized.startsWith(tmpDir)) {
      throw new Error(`Refusing git init outside temp dir during tests: ${directory}`);
    }
  }
  // ... proceed
}
```

### Layer 4：调试探针

**目的：** 为事后取证记录上下文

```typescript
async function gitInit(directory: string) {
  const stack = new Error().stack;
  logger.debug('About to git init', {
    directory,
    cwd: process.cwd(),
    stack
  });
  // ... proceed
}
```

---

## 应用模式

修复 bug 时：

1. **追踪数据流** — 错误值从哪里产生？在哪里使用？
2. **映射所有检查点** — 列出数据经过的每个点
3. **每层添加验证** — 入口、业务、环境、调试
4. **逐层测试** — 尝试绕过 Layer 1，验证 Layer 2 能捕获

---

## 实战案例

Bug：空 `projectDir` 导致 `git init` 在源代码目录执行

**数据流：**

1. 测试设置 → 空字符串
2. `Project.create(name, '')`
3. `WorkspaceManager.createWorkspace('')`
4. `git init` 在 `process.cwd()` 执行

**四层防御：**

| 层      | 位置               | 验证内容                            |
| ------- | ------------------ | ----------------------------------- |
| Layer 1 | `Project.create()` | 非空、存在、可写                    |
| Layer 2 | `WorkspaceManager` | projectDir 非空                     |
| Layer 3 | `WorktreeManager`  | 测试环境中拒绝 tmpdir 外的 git init |
| Layer 4 | git init 前        | 堆栈追踪日志                        |

**结果：** 1847 个测试全部通过，bug 不可能复现

---

## 关键洞察

所有四层都是必要的。测试中每层都捕获了其他层遗漏的 bug：

- 不同代码路径绕过了入口验证
- Mock 绕过了业务逻辑检查
- 不同平台的边缘情况需要环境保护
- 调试日志识别出结构性误用

**不要只在一个验证点停下。** 在每一层都添加检查。
