import { checkStatus, install } from './installer.js';
import { WorkflowOrchestrator } from './workflow/workflow-orchestrator.js';

function createInstallIssue(componentKey, status) {
  return Object.freeze({
    severity: 'warning',
    message: `${componentKey} 组件缺失 — 建议运行 auto install ${componentKey}`,
    component: componentKey,
    path: status.path
  });
}

function createInstallAction(componentKey) {
  return Object.freeze({
    action: 'install-component',
    component: componentKey,
    reason: `${componentKey} 组件未安装，可通过 auto install 自动补齐`
  });
}

function buildInstallDiagnostics(installStatus = {}) {
  const issues = [];
  const recommendedActions = [];
  const missingComponents = [];

  for (const [componentKey, status] of Object.entries(installStatus)) {
    if (status?.installed) {
      continue;
    }

    missingComponents.push(componentKey);
    issues.push(createInstallIssue(componentKey, status || {}));
    recommendedActions.push(createInstallAction(componentKey));
  }

  return Object.freeze({
    issues: Object.freeze(issues),
    recommendedActions: Object.freeze(recommendedActions),
    missingComponents: Object.freeze(missingComponents)
  });
}

async function applyInstallFixes(installStatus = {}) {
  const diagnostics = buildInstallDiagnostics(installStatus);
  if (diagnostics.missingComponents.length === 0) {
    return Object.freeze({
      applied: Object.freeze([]),
      skipped: Object.freeze([])
    });
  }

  try {
    const result = await install([...diagnostics.missingComponents], {
      backup: false,
      force: false
    });

    return Object.freeze({
      applied: Object.freeze([
        Object.freeze({
          action: 'install-missing-components',
          components: Object.freeze([...diagnostics.missingComponents]),
          installedFiles: result.installedFiles.length,
          skippedFiles: result.skippedFiles.length
        })
      ]),
      skipped: Object.freeze([])
    });
  } catch (error) {
    return Object.freeze({
      applied: Object.freeze([]),
      skipped: Object.freeze([
        Object.freeze({
          action: 'install-missing-components',
          components: Object.freeze([...diagnostics.missingComponents]),
          reason: error.message
        })
      ])
    });
  }
}

/**
 * 运行 doctor 检查
 * @param {Object} [options]
 * @param {string} [options.dir]
 * @param {boolean} [options.fix]
 * @returns {Promise<Object>}
 */
export async function runDoctorChecks(options = {}) {
  const projectDir = options.dir || process.cwd();
  const orchestrator = new WorkflowOrchestrator({ projectDir });
  const doctorResult = await orchestrator.phaseDiscover.runDoctorCheck({
    fix: Boolean(options.fix),
    source: options.source || 'cli'
  });

  const accumulatedFixes = [...(doctorResult.fixesApplied || [])];
  const accumulatedSkipped = [...(doctorResult.fixesSkipped || [])];

  let installStatus = await checkStatus();
  if (options.fix) {
    const installFixResult = await applyInstallFixes(installStatus);
    accumulatedFixes.push(...installFixResult.applied);
    accumulatedSkipped.push(...installFixResult.skipped);
    installStatus = await checkStatus();
  }

  const installDiagnostics = buildInstallDiagnostics(installStatus);
  const issues = [...(doctorResult.issues || []), ...installDiagnostics.issues];
  const recommendedActions = [
    ...(doctorResult.recommendedActions || []),
    ...installDiagnostics.recommendedActions
  ];

  return Object.freeze({
    projectDir,
    healthy: issues.filter((issue) => issue.severity === 'error').length === 0,
    issues: Object.freeze(issues),
    checks: Object.freeze({ ...(doctorResult.checks || {}) }),
    recommendedActions: Object.freeze(recommendedActions),
    installStatus: Object.freeze({ ...installStatus }),
    fixRequested: Boolean(options.fix),
    fixesApplied: Object.freeze(accumulatedFixes),
    fixesSkipped: Object.freeze(accumulatedSkipped),
    changedFiles: Object.freeze([...(doctorResult.changedFiles || [])])
  });
}

/**
 * 格式化 doctor 输出
 * @param {Object} report
 * @returns {string}
 */
export function formatDoctorReport(report) {
  const issueCount = report.issues?.length || 0;
  const lines = [
    'Auto Doctor',
    `目录: ${report.projectDir}`,
    `健康状态: ${report.healthy ? 'healthy' : 'needs-attention'}`,
    `问题数: ${issueCount}`,
    '',
    '组件状态:'
  ];

  for (const [name, status] of Object.entries(report.installStatus || {})) {
    lines.push(
      `- ${name}: ${status.installed ? 'installed' : 'missing'} (${status.fileCount} files)`
    );
  }

  if (issueCount > 0) {
    lines.push('', '检查结果:');
    for (const issue of report.issues) {
      lines.push(`- [${issue.severity}] ${issue.message}`);
    }
  }

  if ((report.recommendedActions || []).length > 0) {
    lines.push('', '建议动作:');
    for (const action of report.recommendedActions) {
      lines.push(`- ${action.action}: ${action.reason}`);
    }
  }

  if ((report.fixesApplied || []).length > 0) {
    lines.push('', '已应用修复:');
    for (const fix of report.fixesApplied) {
      if (fix.action === 'install-missing-components') {
        lines.push(`- ${fix.action}: ${fix.components.join(', ')}`);
        continue;
      }
      lines.push(`- ${fix.action}: ${fix.reason || 'done'}`);
    }
  }

  if ((report.fixesSkipped || []).length > 0) {
    lines.push('', '跳过的修复:');
    for (const fix of report.fixesSkipped) {
      lines.push(`- ${fix.action}: ${fix.reason}`);
    }
  }

  if ((report.changedFiles || []).length > 0) {
    lines.push('', '修复变更文件:');
    for (const file of report.changedFiles) {
      lines.push(`- ${file}`);
    }
  }

  return lines.join('\n');
}

/**
 * 是否存在需要关注的问题
 * @param {Object} report
 * @returns {boolean}
 */
export function hasDoctorIssues(report) {
  return (report.issues?.length || 0) > 0;
}
