// Auto CLI 文件清单
//
// install.js / uninstall.js 共享的 MANAGED_FILES 清单。
// 新增 agent / skill / rule / hook 时只改本文件一处。

import path from 'path';
import os from 'os';

const CLAUDE_DIR = path.join(os.homedir(), '.claude');

// install.js 复制源目录 → ~/.claude 目标目录的映射
export const COMPONENTS = [
  { src: 'commands', dest: path.join(CLAUDE_DIR, 'commands') },
  { src: 'agents', dest: path.join(CLAUDE_DIR, 'agents') },
  { src: 'skills', dest: path.join(CLAUDE_DIR, 'skills') },
  { src: 'rules', dest: path.join(CLAUDE_DIR, 'rules') },
  { src: 'hooks', dest: path.join(CLAUDE_DIR, 'hooks') },
];

// Auto CLI 管理的具体文件清单（install --clean 与 uninstall 共用）
export const MANAGED_FILES = [
  {
    dir: path.join(CLAUDE_DIR, 'commands'),
    files: ['auto.md'],
    subdirs: ['auto'],
  },
  {
    dir: path.join(CLAUDE_DIR, 'agents'),
    files: [
      '_shared-principles.md',
      'architect.md',
      'build-error-resolver.md',
      'code-reviewer.md',
      'doc-updater.md',
      'e2e-runner.md',
      'quest-designer.md',
      'refactor-cleaner.md',
      'security-reviewer.md',
      'tdd-guide.md',
      'verification.md',
    ],
  },
  {
    dir: path.join(CLAUDE_DIR, 'skills'),
    files: [
      'code-style-enforcer.md',
      'dependency-analyzer.md',
      'error-patterns.md',
      'git-workflow.md',
      'init-project.md',
      'java-patterns.md',
      'performance-patterns.md',
      'prd-writer.md',
      'skill-creator.md',
      'skill-evaluator.md',
      'systematic-debugging.md',
      'workflow-patterns.md',
    ],
    subdirs: [
      'java-patterns.references',
      'prd-writer.references',
      'systematic-debugging.references',
      'workflow-patterns.references',
    ],
  },
  {
    dir: path.join(CLAUDE_DIR, 'rules'),
    files: [
      'agents.md',
      'coding-style.md',
      'git-workflow.md',
      'hooks.md',
      'performance.md',
      'security.md',
      'testing.md',
    ],
  },
  {
    dir: path.join(CLAUDE_DIR, 'hooks'),
    files: ['hooks.json'],
  },
  {
    dir: path.join(CLAUDE_DIR, 'hooks', 'lib'),
    files: ['codemaps-hook.sh', 'tdd-guard-cli.js', 'tdd-guard.js'],
  },
];

export { CLAUDE_DIR };
