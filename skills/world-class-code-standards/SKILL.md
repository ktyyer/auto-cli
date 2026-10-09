---
name: world-class-code-standards
description: 代码质量度量参考 — 圈复杂度、认知复杂度、测试覆盖率与技术债。仅在当前变更需要这些度量时加载，以项目实际规则、风险和验证工具为准；指标不代替独立业务验收。
tags:
  - quality
  - standards
  - metrics
  - complexity
  - maintainability
  - world-class
---

# World-Class Code Standards — 世界级代码量化标准

> 度量用于定位风险，不构成“世界级”的充分证据。共享执行契约与目标项目规则优先。

下文数字、评级与示例仅是可讨论的参考值，不自动成为 VERIFY 门槛。先记录项目采用的规则及来源、实际工具与基线；没有测量则填 null/unknown，不复制示例 pass。低影响文档变更不要求应用覆盖率或按文件行数拆分。

---

## 激活摘要 (Activation Digest)

**检查清单** (checklist):

- [ ] 圈复杂度（Cyclomatic Complexity）≤ 10（每个函数）
- [ ] 认知复杂度（Cognitive Complexity）≤ 15（每个函数）
- [ ] 函数长度 ≤ 50 行
- [ ] 文件长度 ≤ 500 行
- [ ] 嵌套层数 ≤ 4
- [ ] 重复代码率 ≤ 3%
- [ ] 测试覆盖率 ≥ 80%
- [ ] 严重问题 = 0
- [ ] 高优先级问题 ≤ 2

**硬约束** (constraints):

- 按项目已采用的规则检查复杂度；风险与职责证据支持时才重构，不为达到通用行数配额拆分
- 已证实的严重问题必须修复或明确报告未通过，不用综合评分掩盖
- 覆盖率按实际变更和项目要求验收；缺少关键行为测试时补测试，不用通用百分比替代判断

**输出模板** (output):

以下数值是格式示例，不是本次观测；实际报告必须替换为工具结果与来源，缺测不得保留 pass。

```json
{
  "worldClassStandards": {
    "complexity": {
      "cyclomatic": { "avg": 6.2, "max": 9, "threshold": 10, "status": "pass" },
      "cognitive": { "avg": 8.5, "max": 14, "threshold": 15, "status": "pass" },
      "nesting": { "max": 3, "threshold": 4, "status": "pass" }
    },
    "maintainability": {
      "functionLength": { "avg": 32, "max": 48, "threshold": 50, "status": "pass" },
      "fileLength": { "max": 320, "threshold": 500, "status": "pass" },
      "duplication": { "rate": 2.1, "threshold": 3, "status": "pass" }
    },
    "test": {
      "coverage": { "value": 87, "threshold": 80, "status": "pass" },
      "mutationScore": { "value": 72, "threshold": 70, "status": "pass" }
    },
    "issues": {
      "critical": { "count": 0, "threshold": 0, "status": "pass" },
      "high": { "count": 1, "threshold": 2, "status": "pass" },
      "medium": { "count": 3, "threshold": 10, "status": "pass" }
    },
    "overallRating": "A",
    "verdict": "PASS"
  }
}
```

**反模式** (anti-patterns):

- 用"看起来挺好"或单一指标代替行为证据
- 为刷绿降低项目已采用的门槛，或用未采用的通用门槛阻止交付
- 只测简单路径以提高覆盖率 → 虚假覆盖

---

## 量化标准详解

### 1. 圈复杂度（Cyclomatic Complexity）

**定义**: 代码中独立路径的数量（if/for/while/case 等分支）

**阈值**:

- ≤ 5: 简单，容易测试
- 6-10: 合理，可接受
- 11-15: 值得检查职责与测试路径
- > 15: 风险信号；依据项目规则与实际行为决定处置

**验证命令**:

```bash
# JavaScript/TypeScript
# 使用项目已安装的 ESLint 与配置；complexity 是内置规则，阈值来自项目
npx --no-install eslint src/

# Python
radon cc -a -nb src/

# Java
# 使用 CheckStyle / PMD 配置 CyclomaticComplexity
```

**示例（违规）**:

```javascript
function processOrder(order) {
  if (order.status === 'new') {
    if (order.paymentMethod === 'credit') {
      if (order.amount > 1000) {
        if (order.country === 'US') {
          // 复杂度 = 5（4 个 if）
          return applyDiscount(order);
        }
      }
    }
  }
  // ... 更多分支
  // 总复杂度 > 15 ❌
}
```

**修复方案**:

```javascript
// 拆分为多个小函数
function processOrder(order) {
  if (!isValidOrder(order)) return null;
  const discounted = applyDiscountRules(order);
  return saveOrder(discounted);
}

function isValidOrder(order) {
  return order.status === 'new' && order.amount > 0;
}
```

---

### 2. 认知复杂度（Cognitive Complexity）

**定义**: 代码的"理解难度"（嵌套、递归、跳转等）

**阈值**:

- ≤ 10: 易读
- 11-15: 合理
- 16-20: 难读
- > 20: 不可维护

**与圈复杂度的区别**:

- 圈复杂度：独立路径数（if/for/while）
- 认知复杂度：嵌套深度 + 逻辑中断（break/continue/goto）

**示例（违规）**:

```javascript
function processItems(items) {
  for (const item of items) {
    // +1
    if (item.active) {
      // +2 (嵌套)
      for (const tag of item.tags) {
        // +3 (嵌套)
        if (tag.startsWith('priority')) {
          // +4 (嵌套)
          // 认知复杂度 = 10+
        }
      }
    }
  }
}
```

---

### 3. 函数长度

**阈值**: ≤ 50 行（不含空行和注释）

**原因**:

- 超过 50 行的函数通常做了多件事
- 难以测试
- 难以复用

**修复**: 提取子函数

---

### 4. 文件长度

**阈值**: ≤ 500 行

**原因**:

- 文件较长可能增加阅读成本，但行数本身不能证明职责不单一
- 难以导航
- 合并冲突频繁

**修复**: 拆分为多个文件（按职责）

---

### 5. 嵌套层数

**阈值**: ≤ 4 层

**示例（违规）**:

```javascript
if (a) {
  // 1
  if (b) {
    // 2
    for (const x of list) {
      // 3
      if (c) {
        // 4
        while (d) {
          // 5 ❌
          // 太深了！
        }
      }
    }
  }
}
```

**修复**: 提前 return、提取函数

---

### 6. 重复代码率

**阈值**: ≤ 3%

**验证命令**:

```bash
# JavaScript/TypeScript
npx jscpd src/

# Python
pylint --disable=all --enable=duplicate-code src/
```

**修复**: 提取公共函数/模块

---

### 7. 测试覆盖率

**阈值**:

- 语句覆盖率 ≥ 80%
- 分支覆盖率 ≥ 70%
- 函数覆盖率 ≥ 90%

**验证命令**:

```bash
# JavaScript/TypeScript
npm test -- --coverage

# Python
pytest --cov=src --cov-report=term

# Java
mvn test jacoco:report
```

**注意**: 不要为了覆盖率而写无意义的测试

---

### 8. 问题严重级别

**阈值**:

- 严重问题（Critical）: 0（必须修复）
- 高优先级（High）: ≤ 2
- 中优先级（Medium）: ≤ 10

**严重问题定义**:

- 安全漏洞（SQL 注入、XSS、硬编码密钥）
- 空指针解引用
- 资源泄漏（未关闭文件/连接）
- 死循环

---

## 验证工具推荐

### JavaScript/TypeScript

- **ESLint** — 复杂度、代码风格
- **SonarQube** — 综合质量分析
- **Jest** — 测试覆盖率
- **jscpd** — 重复代码检测

### Python

- **radon** — 圈复杂度
- **pylint** — 综合代码检查
- **pytest-cov** — 测试覆盖率
- **SonarQube** — 综合质量分析

### Java

- **CheckStyle** — 代码风格
- **PMD** — 复杂度 + 坏味道
- **JaCoCo** — 测试覆盖率
- **SonarQube** — 综合质量分析

---

## 集成到 VERIFY Gate

### code-reviewer gate 增强

**当前**: code-reviewer 只输出问题列表

**按需**: 运行当前项目已有度量工具，记录输出、版本和适用范围；未执行则标记缺测

```markdown
## 示例报告（无需修改 agent 定义；数值仅演示格式）

在 code-reviewer 输出中新增：

### 量化指标

**复杂度**:

- 圈复杂度: 平均 6.2，最大 9 ✅
- 认知复杂度: 平均 8.5，最大 14 ✅
- 函数长度: 平均 32 行，最大 48 行 ✅

**测试**:

- 覆盖率: 87% ✅（阈值 80%）
- 未覆盖文件: `utils.ts:processData`

**问题**:

- 严重: 0 ✅
- 高优先级: 1 ⚠️
- 中优先级: 3 ⚠️

**总评**: A（世界级）
```

---

## 分级标准

| 评级 | 复杂度 | 覆盖率 | 严重问题 | 高优先级 | 说明     |
| ---- | ------ | ------ | -------- | -------- | -------- |
| A+   | ≤ 8    | ≥ 90%  | 0        | 0        | 顶级     |
| A    | ≤ 10   | ≥ 80%  | 0        | ≤ 2      | 世界级   |
| B    | ≤ 15   | ≥ 70%  | 0        | ≤ 5      | 良好     |
| C    | ≤ 20   | ≥ 60%  | 0        | ≤ 10     | 可接受   |
| D    | > 20   | < 60%  | > 0      | > 10     | 需重构   |
| F    | -      | -      | > 0      | -        | 禁止放行 |

**评级边界**: 仅在项目明确采用这套参考值且实际测得指标时展示；评级不证明业务正确或没有回归。

---

## CHECKER（验证要求）

使用项目实际支持的报告格式，不用 grep/awk 对人类文本中的分数判绿。检查工具自身退出码、非空报告、测量范围和最终产物状态；缺报告、未知字段、运行失败必须保留。度量检查通过后，仍需核对独立需求、行为测试和相关反例。

---

## 实施建议

以下阶段仅为项目主动采用后的演进示例，不自动创建门禁或截止时间。

### Phase 1: 按风险建立基线

- 严重问题 = 0（硬约束）
- 记录实际覆盖率与关键行为缺口，按项目要求补充测试

### Phase 2: 1 个月内（逐步收紧）

- 圈复杂度 ≤ 15（渐进降到 10）
- 高优先级问题 ≤ 5（渐进降到 2）

### Phase 3: 3 个月内（世界级目标）

- 评级 ≥ A
- 所有指标达标

---

## 常见问题

### Q: 遗留代码不符合标准怎么办？

A: 两种策略：

1. **增量改进**: 新代码遵循项目规范，旧代码按风险逐步改进
2. **技术债追踪**: 将不达标的代码记录到 `.auto/tech-debt.md`

### Q: 测试覆盖率 80% 太高了吧？

A: 先查项目采用的指标、测量范围和业务风险。没有这些依据，不能从其他项目名称推定覆盖率，也不能把 80% 当通用交付门槛。

### Q: 自动化工具可能误报怎么办？

A: 允许标注例外：

```javascript
/* eslint-disable complexity */
function legacyParser() {
  // 遗留代码，计划重构
}
/* eslint-enable complexity */
```

例外应记录具体原因、范围与复查条件，不能用无期限 TODO 掩盖已经确认的问题。

---

## 参考资料

- [Cognitive Complexity: A new way of measuring understandability](https://www.sonarsource.com/docs/CognitiveComplexity.pdf)
- [Code Complete (Steve McConnell)](https://www.amazon.com/Code-Complete-Practical-Handbook-Construction/dp/0735619670)
- [Google Engineering Practices](https://google.github.io/eng-practices/)
- [Linux Kernel Coding Style](https://www.kernel.org/doc/html/latest/process/coding-style.html)
