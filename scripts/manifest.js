// Auto CLI 文件清单
//
// install.js / uninstall.js 共享的清单。
// 新增 agent / skill / rule / hook 时只改本文件一处。

import path from 'path';
import os from 'os';
import fs from 'fs';

const CLAUDE_DIR = path.join(os.homedir(), '.claude');
const CODEX_DIR = path.join(os.homedir(), '.codex');
const CODEX_SKILL_DIRS = [
  'api-design',
  'brainstorming',
  'code-analyzer',
  'code-style-enforcer',
  'comment-standards',
  'dependency-analyzer',
  'error-patterns',
  'git-workflow',
  'init-project',
  'java-patterns',
  'logging-patterns',
  'performance-patterns',
  'prd-writer',
  'production-standards',
  'refactoring-patterns',
  'requirement-clarifier',
  'research-analyst',
  'robustness-patterns',
  'skill-creator',
  'skill-evaluator',
  'spec-driven',
  'systematic-debugging',
  'test-plan-writer',
  'using-git-worktrees',
  'workflow-patterns'
];
const CODEX_ALLOWED_COMMAND_FILES = ['auto.md'];
const CODEX_ALLOWED_COMMAND_SUBDIR_FILES = {
  auto: ['dashboard.md', 'doctor.md', 'learn.md', 'route.md', 'status.md']
};
const CODEX_MANAGED_ROOT_FILES = ['AGENTS.md'];

// --- 工具检测 ---

export function detectTools() {
  const tools = [];
  if (fs.existsSync(CLAUDE_DIR)) {
    tools.push({
      name: 'claude',
      dir: CLAUDE_DIR,
      commandsDir: path.join(CLAUDE_DIR, 'commands'),
      agentsDir: path.join(CLAUDE_DIR, 'agents'),
      skillsDir: path.join(CLAUDE_DIR, 'skills'),
      rulesDir: path.join(CLAUDE_DIR, 'rules'),
      hooksDir: path.join(CLAUDE_DIR, 'hooks'),
      // skills: flat .md per skill
      skillFileName: null,
      // agents / rules / hooks 是否支持
      hasAgents: true,
      hasRules: true,
      hasHooks: true
    });
  }
  if (fs.existsSync(CODEX_DIR)) {
    tools.push({
      name: 'codex',
      dir: CODEX_DIR,
      commandsDir: path.join(CODEX_DIR, 'prompts'), // Codex calls them "prompts"
      agentsDir: null,
      skillsDir: path.join(CODEX_DIR, 'skills'),
      rulesDir: null,
      hooksDir: null,
      // skills: dir per skill, SKILL.md inside
      skillFileName: 'SKILL.md',
      hasAgents: false,
      hasRules: false,
      hasHooks: false
    });
  }
  return tools;
}

// install.js 复制源目录 → 目标目录的映射（Claude 兼容旧调用）
export const COMPONENTS = [
  { src: 'commands', dest: path.join(CLAUDE_DIR, 'commands') },
  { src: 'agents', dest: path.join(CLAUDE_DIR, 'agents') },
  { src: 'skills', dest: path.join(CLAUDE_DIR, 'skills') },
  { src: 'rules', dest: path.join(CLAUDE_DIR, 'rules') },
  { src: 'hooks', dest: path.join(CLAUDE_DIR, 'hooks') }
];

export const CODEX_MANAGED_FILES = {
  rootFiles: CODEX_MANAGED_ROOT_FILES,
  prompts: CODEX_ALLOWED_COMMAND_FILES,
  promptDirs: ['auto'],
  skills: CODEX_SKILL_DIRS
};

// Auto CLI 管理的具体文件清单（install --clean 与 uninstall 共用）
// 仅覆盖 Claude 侧；Codex 侧由 detectTools() + 遍历清洁
export const MANAGED_FILES = [
  {
    dir: path.join(CLAUDE_DIR, 'commands'),
    files: ['auto.md'],
    subdirs: ['auto']
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
      'verification.md'
    ]
  },
  {
    dir: path.join(CLAUDE_DIR, 'skills'),
    files: [
      'api-design.md',
      'brainstorming.md',
      'code-analyzer.md',
      'code-style-enforcer.md',
      'comment-standards.md',
      'dependency-analyzer.md',
      'error-patterns.md',
      'git-workflow.md',
      'init-project.md',
      'java-patterns.md',
      'logging-patterns.md',
      'performance-patterns.md',
      'prd-writer.md',
      'production-standards.md',
      'refactoring-patterns.md',
      'requirement-clarifier.md',
      'research-analyst.md',
      'robustness-patterns.md',
      'skill-creator.md',
      'skill-evaluator.md',
      'spec-driven.md',
      'systematic-debugging.md',
      'test-plan-writer.md',
      'using-git-worktrees.md',
      'workflow-patterns.md'
    ],
    subdirs: [
      'api-design.references',
      'code-analyzer.references',
      'comment-standards.references',
      'error-patterns.references',
      'init-project.references',
      'java-patterns.references',
      'logging-patterns.references',
      'performance-patterns.references',
      'prd-writer.references',
      'production-standards.references',
      'refactoring-patterns.references',
      'robustness-patterns.references',
      'systematic-debugging.references',
      'workflow-patterns.references'
    ]
  },
  {
    dir: path.join(CLAUDE_DIR, 'rules'),
    files: [
      'agents.md',
      'coding-style.md',
      'commands.md',
      'git-workflow.md',
      'hooks.md',
      'markdown-authoring.md',
      'performance.md',
      'security.md',
      'testing.md',
      'version-and-release.md'
    ]
  },
  {
    dir: path.join(CLAUDE_DIR, 'hooks'),
    files: ['hooks.json']
  },
  {
    dir: path.join(CLAUDE_DIR, 'hooks', 'lib'),
    files: ['codemaps-hook.sh', 'tdd-guard-cli.js', 'tdd-guard.js']
  }
];

export {
  CLAUDE_DIR,
  CODEX_ALLOWED_COMMAND_FILES,
  CODEX_ALLOWED_COMMAND_SUBDIR_FILES,
  CODEX_MANAGED_ROOT_FILES,
  CODEX_DIR
};
