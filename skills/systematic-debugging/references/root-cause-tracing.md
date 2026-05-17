---
name: systematic-debugging:root-cause-tracing
description: 由 systematic-debugging.md 主文件按需加载。完整上下文见主文件。
---

# 根因向后追踪技术

> 由 `systematic-debugging.md` 主文件按需加载。完整上下文见主文件。
> 基于 [obra/superpowers/root-cause-tracing](https://github.com/obra/superpowers/blob/main/skills/systematic-debugging/root-cause-tracing.md) 适配。

---

## 核心原则

Bug 通常在调用栈深处显现（在错误目录执行 git init、文件创建到错误位置、数据库用了错误路径打开）。直觉是修复报错位置，但那只是在治症状。

**核心原则：沿调用链向后追踪，直到找到原始触发点，然后在源头修复。**

---

## 追踪流程

### 1. 观察症状

```
Error: git init failed in /Users/jesse/project/packages/core
```

### 2. 找到直接原因

**什么代码直接导致了这个错误？**

```typescript
await execFileAsync('git', ['init'], { cwd: projectDir });
```

### 3. 追问：谁调用了这个？

```typescript
WorktreeManager.createSessionWorktree(projectDir, sessionId)
  → Session.initializeWorkspace() 调用
  → Session.create() 调用
  → 测试中 Project.create() 调用
```

### 4. 持续向上追踪

**传递了什么值？**

- `projectDir = ''`（空字符串！）
- 空字符串作为 `cwd` 解析为 `process.cwd()`
- 那就是源代码目录！

### 5. 找到原始触发点

**空字符串从哪里来的？**

```typescript
const context = setupCoreTest(); // Returns { tempDir: '' }
Project.create('name', context.tempDir); // 在 beforeEach 之前访问！
```

---

## 添加堆栈追踪

无法手动追踪时，添加探针：

```typescript
async function gitInit(directory: string) {
  const stack = new Error().stack;
  console.error('DEBUG git init:', {
    directory,
    cwd: process.cwd(),
    nodeEnv: process.env.NODE_ENV,
    stack
  });

  await execFileAsync('git', ['init'], { cwd: directory });
}
```

**关键：** 测试中用 `console.error()`（不用 logger——可能被抑制）

**运行并捕获：**

```bash
npm test 2>&1 | grep 'DEBUG git init'
```

**分析堆栈追踪：**

- 查找测试文件名
- 找到触发调用的行号
- 识别模式（同一个测试？同一个参数？）

---

## 找到哪个测试造成污染

如果某个东西在测试中出现但不知道是哪个测试：

用二分查找脚本逐个运行测试，在第一个污染者处停止：

```bash
# 二分查找策略
# 1. 运行前半部分测试 → 如果问题出现，缩小到前半
# 2. 如果不出现，缩小到后半
# 3. 重复直到找到单个测试
```

---

## 实战案例：空 projectDir

**症状：** `.git` 在 `packages/core/`（源代码目录）中创建

**追踪链：**

1. `git init` 在 `process.cwd()` 运行 ← 空 cwd 参数
2. WorktreeManager 用空 projectDir 调用
3. Session.create() 传了空字符串
4. 测试在 beforeEach 之前访问了 `context.tempDir`
5. setupCoreTest() 初始返回 `{ tempDir: '' }`

**根因：** 顶层变量初始化访问了空值

**修复：** 让 tempDir 成为 getter，在 beforeEach 之前访问会抛异常

**同时添加多层防御：**

- Layer 1: Project.create() 验证目录
- Layer 2: WorkspaceManager 验证非空
- Layer 3: NODE_ENV 检查拒绝在 tmpdir 外执行 git init
- Layer 4: git init 前记录堆栈追踪

---

## 关键原则

**永远不要只在报错处修复。** 追踪回去找到原始触发点。

| 步骤         | 动作                    |
| ------------ | ----------------------- |
| 找到直接原因 | 能再往上追踪一层吗？    |
| 能 →         | 继续向后追踪            |
| 不能 →       | 这是源头吗？            |
| 是源头 →     | 在源头修复 + 每层加验证 |
| 不是 →       | 这个模式有根本性问题    |

---

## 堆栈追踪技巧

| 场景       | 技巧                               |
| ---------- | ---------------------------------- |
| 测试中     | 用 `console.error()` 不用 logger   |
| 危险操作前 | 在操作前记录，不是失败后           |
| 包含上下文 | 目录、cwd、环境变量、时间戳        |
| 捕获堆栈   | `new Error().stack` 显示完整调用链 |
