---
name: dependency-analyzer
description: 依赖安全性分析和版本兼容性检查 — 覆盖 npm/Maven/Go modules，检测已知漏洞（CVE）、版本漂移、废弃包和依赖膨胀。当 PHASE 1 SCAN 执行依赖检查、security-reviewer 执行安全门禁、用户提到依赖漏洞、版本冲突、npm audit、依赖升级、或 build-error-resolver 处理依赖冲突时，必须加载此 skill。
tags: [dependency, security, audit, npm, maven, versions, compatibility, outdated]
---

# Dependency Analyzer — 依赖分析

> 与 PHASE 1 SCAN 集成，在项目扫描阶段自动检测依赖健康度。
> security-reviewer Agent 参考本知识库进行安全门禁。

## 快速使用

```
/auto 检查 package.json 里的依赖有没有已知漏洞
/auto lodash 版本太旧，分析升级影响
/auto mvn dependency-check 扫描结果分析
```

## 使用时机

**必须加载**：

- PHASE 1 SCAN 执行依赖健康度检查时
- security-reviewer 执行安全门禁时
- 用户提到依赖漏洞、版本冲突、npm audit 时

**按需加载**（按技术栈）：

- Node.js/npm → Section 1（安全审计、废弃检测、版本兼容性）
- Java/Maven → Section 2（安全审计、常见问题）
- Go modules → Section 3

---

## 激活摘要 (Activation Digest)

**检查清单** (checklist):

- [ ] 确认技术栈: Node.js/npm → Section 1, Java/Maven → Section 2, Go → Section 3
- [ ] 运行安全审计: `npm audit --audit-level=high` / `mvn dependency-check:check` / `go list -m all`
- [ ] 检查废弃包: `npm outdated` / `mvn versions:display-dependency-updates`
- [ ] 检查版本漂移和 breaking changes

**硬约束** (constraints):

- 有 HIGH/CRITICAL 漏洞的包不得用于生产
- 升级前必须检查 changelog 中的 breaking changes
- 自动修复只允许 patch 级别 (`npm audit fix`)，minor/major 需人工审查

**输出模板** (output):

- 包名 → 当前版本 → 最新版本 → 漏洞(CVE) → 升级风险 → 建议

**反模式** (anti-patterns):

- 不审计划直接 `npm audit fix --force` → 可能引入 breaking changes
- 只看直接依赖忽略传递依赖 → 漏掉深层漏洞

---

## 一、Node.js / npm 依赖

### 1.1 安全审计

```bash
# 漏洞扫描
npm audit --audit-level=high

# 详细报告
npm audit --json | jq '.vulnerabilities | to_entries[] | {name: .key, severity: .value.severity, title: .value.title}'

# 自动修复（仅允许 patch 级别）
npm audit fix

# 强制修复（允许 minor 级别，谨慎使用）
npm audit fix --force
```

### 1.2 废弃包检测

```bash
# 检查废弃依赖
npx depcheck

# 检查过期依赖
npx npm-check --no-emoji

# 检查未使用的导出
npx knip --reporter compact
```

### 1.3 版本兼容性矩阵

| 场景          | 检测命令                         | 风险 |
| ------------- | -------------------------------- | ---- |
| 版本范围冲突  | `npm ls <package>`               | 中   |
| peer 依赖缺失 | `npm ls 2>&1 \| grep "ERESOLVE"` | 高   |
| 循环依赖      | `npx madge --circular src/`      | 高   |
| 重复安装      | `npx npm-dedupe`                 | 低   |
| Phantom 依赖  | 检查 node_modules 直接引用       | 中   |

### 1.4 依赖选择决策树

```
选择新依赖时：
1. 周下载量 > 100K？
2. 最近 6 个月有更新？
3. 无已知安全漏洞（npm audit）？
4. MIT/Apache-2.0 许可？
5. Bundle size < 目标的 5%？
6. 有 TypeScript 类型？
→ 全部 YES 才引入
```

---

## 二、Java / Maven 依赖

### 2.1 安全审计

```bash
# OWASP 依赖检查
mvn org.owasp:dependency-check-maven:check

# 查看依赖树
mvn dependency:tree -Dverbose

# 检测冲突
mvn dependency:analyze | grep "WARNING"
```

### 2.2 常见问题

| 问题     | 症状                     | 修复                                   |
| -------- | ------------------------ | -------------------------------------- |
| 版本冲突 | `NoSuchMethodError`      | `mvn dependency:tree` + `<exclusions>` |
| 依赖缺失 | `ClassNotFoundException` | 检查 scope 是否为 provided/test        |
| 重复依赖 | `LinkageError`           | `mvn enforcer:enforce` + banDuplicates |
| 过期依赖 | 安全漏洞                 | 升级到最新稳定版                       |

---

## 三、Go Modules

```bash
# 漏洞扫描
govulncheck ./...

# 依赖更新
go get -u ./...
go mod tidy

# 检测间接依赖
go mod graph | grep indirect
```

---

## 四、风险评级标准

| 等级     | CVE        | 影响         | 处理               |
| -------- | ---------- | ------------ | ------------------ |
| Critical | CVE >= 9.0 | 远程代码执行 | 立即修复，阻断构建 |
| High     | CVE >= 7.0 | 数据泄露     | 24h 内修复         |
| Medium   | CVE >= 4.0 | 拒绝服务     | 下个迭代修复       |
| Low      | CVE < 4.0  | 信息泄露     | 记录跟踪           |

---

## 验收标准

- [ ] PHASE 1 SCAN 包含依赖安全检查（`npm audit` 或等效命令）
- [ ] Critical/High CVE 必须在构建前修复
- [ ] 依赖升级后运行 `npm audit` 确认无新漏洞引入
- [ ] 版本兼容性矩阵覆盖项目所有直接依赖

## 五、与 auto-cli 集成

- **PHASE 1 SCAN**: `_runDoctorCheck()` 集成 `npm audit --audit-level=high`
- **PHASE 4 VERIFY**: 完整模式运行 `npm audit` 作为安全门禁
- **security-reviewer Agent**: 参考风险评级标准决定阻断/放行
- **build-error-resolver Agent**: 依赖冲突时参考版本兼容性矩阵
