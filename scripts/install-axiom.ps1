# Axiom 安装脚本
# 用于在项目中初始化 Axiom 长期记忆和工作流系统

param(
    [string]$ProjectPath = ".",
    [string]$AxiomRepo = "https://github.com/Boundary-Correction/Axiom",
    [string]$AxiomPath = (Join-Path $HOME "Axiom")
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Axiom 安装脚本" -ForegroundColor Cyan
Write-Host "  长期记忆 + 工作流系统" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: 检查/克隆 Axiom 仓库
Write-Host "[Step 1/4] 检查 Axiom 仓库..." -ForegroundColor Yellow
Write-Host ""

if (Test-Path $AxiomPath) {
    Write-Host "  Axiom 已存在于: $AxiomPath" -ForegroundColor Green
    Write-Host "  正在更新..." -ForegroundColor Cyan
    try {
        Push-Location $AxiomPath
        git pull 2>$null
        Pop-Location
        Write-Host "  [+] Axiom 已更新" -ForegroundColor Green
    } catch {
        Write-Host "  [!] 更新失败，继续使用现有版本" -ForegroundColor Yellow
    }
} else {
    Write-Host "  正在克隆 Axiom..." -ForegroundColor Cyan
    try {
        git clone $AxiomRepo $AxiomPath
        Write-Host "  [+] Axiom 克隆完成" -ForegroundColor Green
    } catch {
        Write-Host "  [!] 克隆失败: $_" -ForegroundColor Red
        Write-Host "      请检查网络连接或手动克隆" -ForegroundColor Yellow
        Write-Host "      git clone $AxiomRepo $AxiomPath" -ForegroundColor Gray
    }
}

Write-Host ""

# Step 2: 在项目中创建 .agent 目录
Write-Host "[Step 2/4] 创建项目 Axiom 结构..." -ForegroundColor Yellow
Write-Host ""

$agentPath = Join-Path $ProjectPath ".agent"
$memoryPath = Join-Path $agentPath "memory"
$workflowsPath = Join-Path $agentPath "workflows"

# 创建目录
New-Item -ItemType Directory -Path $memoryPath -Force | Out-Null
New-Item -ItemType Directory -Path $workflowsPath -Force | Out-Null

Write-Host "  [+] 创建目录结构:" -ForegroundColor Green
Write-Host "      .agent/" -ForegroundColor Gray
Write-Host "      ├── memory/" -ForegroundColor Gray
Write-Host "      └── workflows/" -ForegroundColor Gray

Write-Host ""

# Step 3: 创建初始记忆文件
Write-Host "[Step 3/4] 创建初始记忆文件..." -ForegroundColor Yellow
Write-Host ""

# project_decisions.md
$projectDecisionsContent = @"
# 项目架构决策记录

> 记录项目的技术选型和架构决策

## 技术栈

- **语言**: [填写项目语言]
- **框架**: [填写项目框架]
- **数据库**: [填写数据库类型]
- **其他**: [其他技术栈]

## 架构模式

- **架构风格**: [分层架构/微服务/单体等]
- **依赖注入**: [Spring DI/手动注入等]
- **事务管理**: [声明式/编程式]
- **异常处理**: [全局异常处理器]

## 命名规范

- **包名**: [com.company.module.layer]
- **类名**: [XxxController, XxxService, XxxRepository]
- **方法名**: [camelCase]
- **常量**: [UPPER_SNAKE_CASE]

## 决策历史

### $(Get-Date -Format "yyyy-MM-dd"): 项目初始化
- **背景**: 项目开始
- **决策**: 使用当前技术栈
- **原因**: [填写原因]
- **影响**: 所有后续开发

---

> 提示: 每次做出重要架构决策时，更新此文件
"@

$projectDecisionsFile = Join-Path $memoryPath "project_decisions.md"
$projectDecisionsContent | Out-File -FilePath $projectDecisionsFile -Encoding UTF8
Write-Host "  [+] project_decisions.md" -ForegroundColor Green

# coding_patterns.md
$codingPatternsContent = @"
# 编码模式

> 记录项目中使用的编码模式和最佳实践

## API 响应格式

``````java
// 统一 API 响应格式
public class Result<T> {
    private Integer code;
    private String message;
    private T data;

    public static <T> Result<T> success(T data) {
        Result<T> result = new Result<>();
        result.setCode(200);
        result.setMessage("success");
        result.setData(data);
        return result;
    }

    public static <T> Result<T> error(Integer code, String message) {
        Result<T> result = new Result<>();
        result.setCode(code);
        result.setMessage(message);
        return result;
    }
}
``````

## 分页查询

``````java
// 统一分页查询模式
public PageResult<Entity> list(QueryParams params) {
    Page<Entity> page = new Page<>(params.getPageNum(), params.getPageSize());
    // 构建查询条件
    return PageResult.of(mapper.selectPage(page, wrapper));
}
``````

## 业务异常

``````java
// 统一业务异常
public class BusinessException extends RuntimeException {
    private final Integer code;

    public BusinessException(ErrorCode errorCode) {
        super(errorCode.getMessage());
        this.code = errorCode.getCode();
    }
}

// 使用
throw new BusinessException(ErrorCode.INVALID_PARAM, "参数错误");
``````

---

> 提示: 发现新的编码模式时，添加到此文件
"@

$codingPatternsFile = Join-Path $memoryPath "coding_patterns.md"
$codingPatternsContent | Out-File -FilePath $codingPatternsFile -Encoding UTF8
Write-Host "  [+] coding_patterns.md" -ForegroundColor Green

# lessons_learned.md
$lessonsLearnedContent = @"
# 经验教训

> 记录开发过程中遇到的问题和解决方案

## 使用方式

每次遇到重要问题并解决后，记录以下内容：

### YYYY-MM-DD: 问题标题

**问题**: 问题描述

**原因**: 问题根因分析

**解决**: 解决方案

**代码**:
``````java
// ❌ 错误示例
// 错误代码

// ✅ 正确示例
// 正确代码
``````

---

## 示例

### 2026-01-15: 批量操作性能问题

**问题**: 批量插入 10000 条数据超时

**原因**: 逐条插入，没有使用批量插入

**解决**: 使用 MyBatis Plus saveBatch() 方法

**代码**:
``````java
// ❌ 错误
for (Entity e : entities) {
    mapper.insert(e);
}

// ✅ 正确
mapper.saveBatch(entities, 1000);
``````

---

> 提示: 每次解决重要问题后，记录到此文件，避免重复犯错
"@

$lessonsLearnedFile = Join-Path $memoryPath "lessons_learned.md"
$lessonsLearnedContent | Out-File -FilePath $lessonsLearnedFile -Encoding UTF8
Write-Host "  [+] lessons_learned.md" -ForegroundColor Green

Write-Host ""

# Step 4: 复制工作流模板
Write-Host "[Step 4/4] 复制工作流模板..." -ForegroundColor Yellow
Write-Host ""

if (Test-Path "$AxiomPath\.agent\workflows") {
    Copy-Item -Path "$AxiomPath\.agent\workflows\*" -Destination $workflowsPath -Force -ErrorAction SilentlyContinue
    Write-Host "  [+] 工作流模板已复制" -ForegroundColor Green
} else {
    # 创建默认工作流文件
    $startWorkflowContent = @"
# /start 工作流

此文件由 ai-max 的 Axiom 集成创建。

完整工作流定义请参考:
- commands/auto.md
- commands/plan.md
- docs/INTEGRATION_PLAN.md
"@
    $startWorkflowFile = Join-Path $workflowsPath "start.md"
    $startWorkflowContent | Out-File -FilePath $startWorkflowFile -Encoding UTF8
    Write-Host "  [+] start.md (默认)" -ForegroundColor Green
}

Write-Host ""

# 完成
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  安装完成!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "已创建:" -ForegroundColor Green
Write-Host "  .agent/memory/project_decisions.md  (架构决策)" -ForegroundColor White
Write-Host "  .agent/memory/coding_patterns.md    (编码模式)" -ForegroundColor White
Write-Host "  .agent/memory/lessons_learned.md    (经验教训)" -ForegroundColor White
Write-Host "  .agent/workflows/start.md           (工作流)" -ForegroundColor White
Write-Host ""

Write-Host "下一步:" -ForegroundColor Cyan
Write-Host "  1. 编辑 .agent/memory/project_decisions.md 填写项目信息" -ForegroundColor White
Write-Host "  2. 使用 /start 开始复杂任务" -ForegroundColor White
Write-Host "  3. 使用 /evolve 更新项目记忆" -ForegroundColor White
Write-Host ""

Write-Host "可用命令:" -ForegroundColor Cyan
Write-Host "  /start          - 完整工作流（复杂任务）" -ForegroundColor White
Write-Host "  /feature-flow   - 功能开发流（中等任务）" -ForegroundColor White
Write-Host "  /evolve         - 知识进化" -ForegroundColor White
Write-Host ""
