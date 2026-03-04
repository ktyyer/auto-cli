# Self-* 系统与记忆系统集成指南

> **AI MAX v3.0 核心架构文档**

---

## 📊 系统架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                    AI MAX v3.0 核心架构                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │         Memory Manager (统一记忆管理接口)            │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │  • query() - 统一查询                               │   │
│  │  • generateReport() - 生成报告                      │   │
│  │  • getStats() - 统计信息                            │   │
│  └─────────────────────────────────────────────────────┘   │
│                          ↓                                  │
│  ┌───────────────┬───────────────┬─────────────────────┐   │
│  │   Project     │   Smart       │  Conversational     │   │
│  │   Memory      │   Context     │  State Machine      │   │
│  ├───────────────┼───────────────┼─────────────────────┤   │
│  │ • Sessions    │ • RAG Index   │ • State Tracking    │   │
│  │ • Patterns    │ • Search      │ • Checkpoints       │   │
│  │ • Decisions   │ • Chunks      │ • History           │   │
│  │ • FAQ         │ • Vectors     │ • Compression       │   │
│  └───────────────┴───────────────┴─────────────────────┘   │
│                          ↓                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │         Self-* System (自我进化系统)                  │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │  • Self-Aware (感知)    → learnPattern()            │   │
│  │  • Self-Improving (改进) → recordFeedback()         │   │
│  │  • Self-Fixing (修复)   → fixErrors()              │   │
│  │  • Self-Building (构建)  → autoInitialize()         │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔌 集成接口

### MemoryManager 类

**位置**: `skills/self-star/lib/memory-manager.js`

**核心方法**:

```javascript
// 初始化
const memoryManager = new MemoryManager(projectPath);

// 统一查询接口
const results = memoryManager.query('用户认证');
// 返回: { patterns, relevantCode, faq, decisions, suggestions }

// Project Memory
memoryManager.addSession({ task, result, duration });
memoryManager.addDecision({ topic, decision, rationale });
memoryManager.addFAQ('如何使用？', '只需 /auto:auto');

// Smart Context
const status = memoryManager.getSmartContextStatus();
const files = memoryManager.searchRelevantCode('UserController');

// Conversational State Machine
const state = memoryManager.getConversationState(sessionId);
memoryManager.addCheckpoint(sessionId, 'TDD', { tests: 3 });
memoryManager.compressHistory(sessionId);

// Self-* System
const context = memoryManager.getProjectContext();
memoryManager.learnPattern('framework', 'Spring Boot', 'MVC 架构');
memoryManager.recordFeedback('build', { error: 'TS2345' }, false);
const improvements = memoryManager.getImprovements();

// 报告生成
const report = memoryManager.generateReport();
const stats = memoryManager.getStats();
```

---

## 🔄 工作流集成

### /auto:auto 第 0 步：初始化

```javascript
// 1. 创建 MemoryManager
const memoryManager = new MemoryManager(projectPath);

// 2. Self-Aware: 检测项目上下文
const context = memoryManager.getProjectContext();
// → { language, framework, structure, patterns }

// 3. Self-Building: 首次使用自动初始化
if (!fs.existsSync('.aimax/patterns.json')) {
  memoryManager.selfStar.autoInitialize();
}

// 4. 加载已学习模式（置信度 ≥ 0.6）
const patterns = memoryManager.getLearnedPatterns(0.6);
// → [{ name, confidence, usageCount, ... }]

// 5. 检查未完成会话
const recentSessions = memoryManager.getProjectMemory().sessions;
const unfinished = recentSessions.filter(s => !s.completed);
if (unfinished.length > 0) {
  // 提示恢复
}
```

### /auto:auto 第 1 步：应用已学习模式

```javascript
// 查询相关记忆
const query = '用户认证 API';
const results = memoryManager.query(query);

// 应用已学习模式
results.patterns.forEach(pattern => {
  if (pattern.confidence >= 0.6) {
    // 自动应用模式
    applyPattern(pattern);
  }
});

// 参考相关代码
results.relevantCode.forEach(filePath => {
  // 读取并分析相关代码
  analyzeFile(filePath);
});

// 参考 FAQ
results.faq.forEach(faq => {
  // 显示相关 FAQ
  showFAQ(faq);
});
```

### /auto:auto 第 2-7 步：Self-Fixing

```javascript
// 执行过程中遇到错误
try {
  await build();
} catch (error) {
  // Self-Fixing: 自动修复
  const errors = memoryManager.selfStar.detectBuildErrors(error.output);
  const fixes = await memoryManager.selfStar.fixErrors(errors);

  // 尝试修复（最多 3 次）
  for (let i = 0; i < 3; i++) {
    try {
      await applyFixes(fixes);
      await build();
      break; // 成功，退出
    } catch (retryError) {
      if (i === 2) {
        // 最后一次也失败，记录反馈
        memoryManager.recordFeedback('build', { error: retryError }, false);
        throw retryError;
      }
    }
  }
}
```

### /auto:auto 第 8 步：Self-Improving

```javascript
// 记录成功反馈
memoryManager.recordFeedback('task', {
  type: 'feature',
  complexity: 'medium',
  duration: 45 * 60 * 1000
}, true);

// 学习新模式
memoryManager.learnPattern(
  'coding_style',
  'Result<T> Wrapper',
  '统一响应包装',
  ['Result.success()', 'Result.fail()']
);

// 更新置信度
// (已在 learnPattern 内部自动处理)

// 添加会话记录
memoryManager.addSession({
  task: '实现用户认证 API',
  result: 'success',
  duration: 45 * 60 * 1000,
  patterns: ['Result<T> Wrapper', 'JWT Token']
});

// 添加 FAQ（如果用户有疑问）
memoryManager.addFAQ(
  '如何统一响应格式？',
  '使用 Result<T> 包装所有响应'
);

// 提取决策
memoryManager.addDecision({
  topic: '认证方案',
  decision: '使用 JWT 无状态认证',
  rationale: '无需服务器存储，易于扩展'
});

// 压缩对话历史
memoryManager.compressHistory(sessionId);
```

---

## 📊 数据结构

### Project Memory

```json
{
  "sessions": [
    {
      "task": "实现用户认证 API",
      "result": "success",
      "duration": 2700000,
      "patterns": ["Result<T> Wrapper", "JWT Token"],
      "timestamp": 1709481600000
    }
  ],
  "patterns": [
    {
      "type": "framework",
      "name": "Spring Boot MVC",
      "description": "Controller-Service-Mapper 架构",
      "usageCount": 12,
      "confidence": 0.95
    }
  ],
  "decisions": [
    {
      "topic": "认证方案",
      "decision": "使用 JWT",
      "rationale": "无状态，易于扩展",
      "timestamp": 1709481600000
    }
  ],
  "faq": [
    {
      "question": "如何统一响应格式？",
      "answer": "使用 Result<T> 包装",
      "createdAt": 1709481600000
    }
  ],
  "architecture": {
    "layers": ["Controller", "Service", "Mapper"],
    "pattern": "MVC"
  },
  "updatedAt": 1709481600000
}
```

### Smart Context Status

```json
{
  "indexed": true,
  "lastIndexed": 1709481600000,
  "fileCount": 125,
  "chunkCount": 450,
  "vectorDb": "chroma",
  "lastUpdated": 1709481600000
}
```

### Conversational State

```json
{
  "sessionId": "uuid-123",
  "state": "EXECUTE",
  "checkpoints": [
    {
      "step": "REQUIREMENT_ANALYSIS",
      "data": { "features": ["登录", "注册"] },
      "timestamp": 1709481600000
    }
  ],
  "history": [
    {
      "role": "user",
      "content": "实现用户认证",
      "timestamp": 1709481600000
    }
  ],
  "compressedSummary": {
    "messageCount": 50,
    "topics": ["认证", "JWT", "Spring Boot"],
    "timeRange": {
      "start": 1709481600000,
      "end": 1709485200000
    }
  },
  "createdAt": 1709481600000,
  "lastUpdated": 1709485200000
}
```

### Self-* Patterns

```json
{
  "type": "coding_style",
  "name": "Result<T> Wrapper",
  "description": "统一响应包装",
  "examples": ["Result.success()", "Result.fail()"],
  "usageCount": 8,
  "confidence": 0.8,
  "phase": "已确认",
  "lastUsed": 1709481600000,
  "createdAt": 1709400000000
}
```

---

## 🎯 使用示例

### 示例 1：查询相关记忆

```javascript
const memoryManager = new MemoryManager('/path/to/project');

// 查询"用户认证"
const results = memoryManager.query('用户认证');

console.log('相关模式:', results.patterns);
// [{ name: 'JWT Token', confidence: 0.9 }]

console.log('相关代码:', results.relevantCode);
// ['src/auth/JwtTokenProvider.java', 'src/auth/AuthController.java']

console.log('FAQ:', results.faq);
// [{ question: '如何刷新 Token？', answer: '...' }]

console.log('相关决策:', results.decisions);
// [{ topic: '认证方案', decision: '使用 JWT' }]

console.log('改进建议:', results.suggestions);
// [{ type: 'pattern', message: '检测到重复错误: Token 过期' }]
```

### 示例 2：生成完整报告

```javascript
const report = memoryManager.generateReport();

console.log(report);
```

**输出**:
```
🧠 **记忆系统状态报告**

**📁 Project Memory**:
  • 会话数: 25
  • 决策数: 12
  • FAQ 数: 8
  • 最后更新: 2024-03-03 15:30:00

**🔍 Smart Context**:
  • 已索引: ✅
  • 文件数: 125
  • 分块数: 450
  • 最后索引: 2024-03-03 10:00:00

**🎯 已学习的模式**:
  • Result<T> Wrapper (置信度: 0.95, 使用: 12次)
  • JWT Token (置信度: 0.90, 使用: 8次)
  • LambdaQueryWrapper (置信度: 0.80, 使用: 6次)

🤖 **Self-* 系统状态报告**
...
```

---

## 🚀 性能优化

### 1. 缓存机制

```javascript
// Project Memory 缓存（1 分钟）
this.projectMemoryCache = {
  data: null,
  timestamp: 0,
  ttl: 60000
};

// Smart Context 缓存（5 分钟）
this.smartContextCache = {
  data: null,
  timestamp: 0,
  ttl: 300000
};
```

### 2. 增量索引

```javascript
// Merkle Tree 增量更新
updateIndex() {
  const newHashes = scanProject();
  const changed = compareMerkleTree(newHashes);

  // 只索引变更的文件
  changed.files.forEach(file => {
    indexFile(file);
  });
}
```

### 3. 压缩历史

```javascript
// 对话历史超过 100 条时压缩
if (history.length > 100) {
  compressHistory(sessionId);
}
```

---

## 📈 监控指标

```javascript
const stats = memoryManager.getStats();

console.log(stats);
// {
//   projectMemory: { sessions: 25, decisions: 12, faq: 8 },
//   smartContext: { indexed: true, fileCount: 125 },
//   patterns: { total: 15, mastered: 5, confirmed: 3, ... },
//   feedback: 42
// }
```

**关键指标**:
- **模式掌握率**: mastered / total
- **记忆使用率**: sessions / 50 (最多 50 条)
- **索引覆盖率**: fileCount / totalFiles
- **反馈成功率**: success / feedback.length

---

## 🔧 故障排查

### 问题 1：模式不应用

**原因**: 置信度 < 0.6

**解决**:
```javascript
// 降低阈值测试
const patterns = memoryManager.getLearnedPatterns(0.3);
```

### 问题 2：查询慢

**原因**: 没有缓存或索引

**解决**:
```javascript
// 启用索引
memoryManager.updateIndexStatus({ indexed: true });

// 使用缓存
const cached = memoryManager.getProjectMemory();
```

### 问题 3：内存占用高

**原因**: 历史记录过多

**解决**:
```javascript
// 压缩历史
memoryManager.compressHistory(sessionId);

// 清理旧会话
const memory = memoryManager.getProjectMemory();
memory.sessions = memory.sessions.slice(-50);
memoryManager.updateProjectMemory({ sessions: memory.sessions });
```

---

## 📚 相关文档

- [Self-* 系统实现](../skills/self-star/SKILL.md)
- [Project Memory](../skills/project-memory/SKILL.md)
- [Smart Context](../skills/smart-context/SKILL.md)
- [Conversational State Machine](../skills/conversational-state-machine/SKILL.md)

---

**更新时间**: 2026-03-03 | **版本**: v3.0.0
