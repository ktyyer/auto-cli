#!/usr/bin/env node

/**
 * CLAUDE.md 自动生成器
 *
 * 功能:
 *   - 扫描项目结构，自动生成 CLAUDE.md 配置
 *   - 检测技术栈和框架
 *   - 生成项目特定的规则和约定
 *   - 支持多种语言和框架
 *
 * 用法:
 *   node claude-md-generator.js
 *   node claude-md-generator.js --dir /path/to/project
 *   node claude-md-generator.js --output .claude/CLAUDE.md
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 技术栈检测规则
const TECH_DETECTION = {
  // 前端
  vue: {
    files: ['package.json'],
    patterns: [/vue/i],
    name: 'Vue.js',
    category: 'frontend',
    config: {
      script_syntax: 'Composition API with <script setup>',
      style_pattern: 'scoped styles with BEM naming',
      type_rules: 'TypeScript strict mode, no any'
    }
  },
  react: {
    files: ['package.json'],
    patterns: [/react/i],
    name: 'React',
    category: 'frontend',
    config: {
      component_pattern: 'Functional components with hooks',
      state_management: 'React Context or Zustand',
      type_rules: 'TypeScript or PropTypes'
    }
  },
  nextjs: {
    files: ['package.json', 'next.config.js'],
    patterns: [/next/i],
    name: 'Next.js',
    category: 'fullstack',
    config: {
      routing: 'App Router (app/ directory)',
      data_fetching: 'Server Components by default',
      api_routes: 'Route Handlers in app/api/'
    }
  },
  nuxt: {
    files: ['package.json', 'nuxt.config.ts'],
    patterns: [/nuxt/i],
    name: 'Nuxt',
    category: 'fullstack',
    config: {
      composition: 'Composition API',
      auto_imports: 'Auto-imported composables and utilities',
      server_routes: 'server/api/ directory'
    }
  },

  // 后端
  springboot: {
    files: ['pom.xml', 'build.gradle'],
    patterns: [/spring-boot/i, /springframework/i],
    name: 'Spring Boot',
    category: 'backend',
    config: {
      architecture: 'Controller -> Service -> Repository',
      database: 'MyBatis Plus or JPA',
      validation: 'Bean Validation with @Valid'
    }
  },
  express: {
    files: ['package.json'],
    patterns: [/express/i],
    name: 'Express.js',
    category: 'backend',
    config: {
      routing: 'Express Router',
      middleware: 'Middleware pattern for cross-cutting concerns',
      error_handling: 'Centralized error handler'
    }
  },
  nestjs: {
    files: ['package.json'],
    patterns: [/nestjs|@nestjs/i],
    name: 'NestJS',
    category: 'backend',
    config: {
      architecture: 'Module-based architecture with Controllers, Services, Repositories',
      dependency_injection: 'Built-in DI container',
      validation: 'class-validator with ValidationPipe'
    }
  },
  fastapi: {
    files: ['requirements.txt', 'pyproject.toml', 'Pipfile'],
    patterns: [/fastapi/i],
    name: 'FastAPI',
    category: 'backend',
    config: {
      routing: 'APIRouter pattern',
      async: 'async/await throughout',
      validation: 'Pydantic models for request/response'
    }
  },
  django: {
    files: ['requirements.txt', 'pyproject.toml', 'manage.py'],
    patterns: [/django/i],
    name: 'Django',
    category: 'backend',
    config: {
      mvt: 'Model-View-Template pattern',
      orm: 'Django ORM',
      apps: 'App-based architecture'
    }
  },

  // 数据库
  postgresql: {
    files: ['package.json', 'requirements.txt', 'pom.xml'],
    patterns: [/postgresql|postgres|psycopg/i],
    name: 'PostgreSQL',
    category: 'database'
  },
  mysql: {
    files: ['package.json', 'requirements.txt', 'pom.xml'],
    patterns: [/mysql/i],
    name: 'MySQL',
    category: 'database'
  },
  mongodb: {
    files: ['package.json', 'requirements.txt'],
    patterns: [/mongodb|mongoose/i],
    name: 'MongoDB',
    category: 'database'
  },

  // 测试
  jest: {
    files: ['package.json', 'jest.config.js'],
    patterns: [/jest/i],
    name: 'Jest',
    category: 'testing'
  },
  vitest: {
    files: ['package.json', 'vitest.config.ts'],
    patterns: [/vitest/i],
    name: 'Vitest',
    category: 'testing'
  },
  pytest: {
    files: ['requirements.txt', 'pyproject.toml'],
    patterns: [/pytest/i],
    name: 'Pytest',
    category: 'testing'
  },
  junit: {
    files: ['pom.xml', 'build.gradle'],
    patterns: [/junit/i],
    name: 'JUnit',
    category: 'testing'
  },

  // 构建工具
  vite: {
    files: ['package.json', 'vite.config.js', 'vite.config.ts'],
    patterns: [/vite/i],
    name: 'Vite',
    category: 'build'
  },
  webpack: {
    files: ['package.json', 'webpack.config.js'],
    patterns: [/webpack/i],
    name: 'Webpack',
    category: 'build'
  },
  maven: {
    files: ['pom.xml'],
    patterns: [/.*/],
    name: 'Maven',
    category: 'build'
  },
  gradle: {
    files: ['build.gradle', 'build.gradle.kts'],
    patterns: [/.*/],
    name: 'Gradle',
    category: 'build'
  }
};

// 语言检测
const LANGUAGE_DETECTION = {
  'package.json': { langs: ['JavaScript', 'TypeScript'], check_deps: true },
  'tsconfig.json': { langs: ['TypeScript'] },
  'pom.xml': { langs: ['Java'] },
  'build.gradle': { langs: ['Java', 'Kotlin'] },
  'requirements.txt': { langs: ['Python'] },
  'pyproject.toml': { langs: ['Python'] },
  'Pipfile': { langs: ['Python'] },
  'go.mod': { langs: ['Go'] },
  'Cargo.toml': { langs: ['Rust'] },
  'pubspec.yaml': { langs: ['Dart'] },
  'Gemfile': { langs: ['Ruby'] },
  'composer.json': { langs: ['PHP'] }
};

/**
 * 扫描项目目录
 */
function scanProject(projectDir) {
  const result = {
    name: path.basename(projectDir),
    languages: [],
    frameworks: [],
    buildTools: [],
    databases: [],
    testing: [],
    structure: [],
    hasTests: false,
    hasDocs: false,
    hasGit: false,
    packageManager: null,
    config: {}
  };

  // 检查 git
  result.hasGit = fs.existsSync(path.join(projectDir, '.git'));

  // 扫描根目录文件
  const rootFiles = fs.readdirSync(projectDir);

  // 检测包管理器
  if (rootFiles.includes('package-lock.json')) result.packageManager = 'npm';
  else if (rootFiles.includes('yarn.lock')) result.packageManager = 'yarn';
  else if (rootFiles.includes('pnpm-lock.yaml')) result.packageManager = 'pnpm';
  else if (rootFiles.includes('bun.lockb')) result.packageManager = 'bun';

  // 检测语言和技术栈
  for (const file of rootFiles) {
    // 语言检测
    const langInfo = LANGUAGE_DETECTION[file];
    if (langInfo) {
      result.languages.push(...langInfo.langs);
    }

    // 技术栈检测
    for (const [key, tech] of Object.entries(TECH_DETECTION)) {
      if (tech.files.includes(file)) {
        const filePath = path.join(projectDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');

        for (const pattern of tech.patterns) {
          if (pattern.test(content)) {
            if (!result.frameworks.find(f => f.name === tech.name)) {
              result.frameworks.push({ name: tech.name, category: tech.category, config: tech.config });
            }
            break;
          }
        }
      }
    }
  }

  // 去重语言
  result.languages = [...new Set(result.languages)];

  // 分类技术栈
  for (const fw of result.frameworks) {
    if (fw.category === 'build') result.buildTools.push(fw.name);
    else if (fw.category === 'database') result.databases.push(fw.name);
    else if (fw.category === 'testing') result.testing.push(fw.name);
  }
  result.frameworks = result.frameworks.filter(f =>
    !['build', 'database', 'testing'].includes(f.category)
  );

  // 扫描目录结构
  for (const entry of rootFiles) {
    const fullPath = path.join(projectDir, entry);
    if (fs.statSync(fullPath).isDirectory() && !entry.startsWith('.')) {
      result.structure.push(entry);
    }
  }

  // 检查是否有测试
  const testDirs = ['test', 'tests', '__tests__', 'spec'];
  result.hasTests = result.structure.some(s => testDirs.includes(s.toLowerCase()));

  // 检查是否有文档
  result.hasDocs = result.structure.some(s => ['docs', 'doc', 'documentation'].includes(s.toLowerCase()));

  return result;
}

/**
 * 生成 CLAUDE.md 内容
 */
function generateClaudeMd(projectInfo) {
  const lines = [];
  const projectType = determineProjectType(projectInfo);

  // 项目名称
  lines.push(`# ${projectInfo.name}`);
  lines.push('');

  // 项目概述
  lines.push('## 项目概述');
  lines.push('');
  lines.push(`**项目类型**: ${projectType}`);

  if (projectInfo.languages.length > 0) {
    lines.push('');
    lines.push('**主要语言**: ' + projectInfo.languages.join(', '));
  }

  if (projectInfo.frameworks.length > 0) {
    lines.push('');
    lines.push('**框架和库**:');
    for (const fw of projectInfo.frameworks) {
      lines.push(`- ${fw.name}`);
    }
  }

  if (projectInfo.databases.length > 0) {
    lines.push('');
    lines.push('**数据库**: ' + projectInfo.databases.join(', '));
  }

  if (projectInfo.testing.length > 0) {
    lines.push('');
    lines.push('**测试框架**: ' + projectInfo.testing.join(', '));
  }

  lines.push('');

  // 核心规则
  lines.push('---');
  lines.push('');
  lines.push('## 核心规则（必须遵守）');
  lines.push('');

  // 根据检测到的框架生成规则
  for (const fw of projectInfo.frameworks) {
    if (fw.config) {
      lines.push(`### ${fw.name} 规则`);
      lines.push('');
      for (const [key, value] of Object.entries(fw.config)) {
        const formattedKey = key.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());
        lines.push(`- **${formattedKey}**: ${value}`);
      }
      lines.push('');
    }
  }

  // 语言特定规则
  if (projectInfo.languages.includes('Java')) {
    lines.push(JavaRules());
  } else if (projectInfo.languages.includes('TypeScript') || projectInfo.languages.includes('JavaScript')) {
    lines.push(JavaScriptRules());
  } else if (projectInfo.languages.includes('Python')) {
    lines.push(PythonRules());
  }

  lines.push('');
  lines.push('---');
  lines.push('');

  // 目录结构
  lines.push('## 目录结构');
  lines.push('');
  lines.push('```');
  const importantDirs = projectInfo.structure.filter(d =>
    !['node_modules', '.git', 'dist', 'build', 'target', '__pycache__'].includes(d)
  );
  for (const dir of importantDirs) {
    lines.push(`${dir}/`);
  }
  lines.push('```');
  lines.push('');

  // 常用命令
  lines.push('---');
  lines.push('');
  lines.push('## 常用命令');
  lines.push('');

  if (projectInfo.packageManager) {
    lines.push('### 包管理');
    lines.push('```bash');
    if (projectInfo.packageManager === 'npm') {
      lines.push('npm install      # 安装依赖');
      lines.push('npm run build    # 构建');
      lines.push('npm test         # 运行测试');
      lines.push('npm run dev      # 开发服务器');
    } else if (projectInfo.packageManager === 'yarn') {
      lines.push('yarn install     # 安装依赖');
      lines.push('yarn build       # 构建');
      lines.push('yarn test        # 运行测试');
      lines.push('yarn dev         # 开发服务器');
    } else if (projectInfo.packageManager === 'pnpm') {
      lines.push('pnpm install     # 安装依赖');
      lines.push('pnpm build       # 构建');
      lines.push('pnpm test        # 运行测试');
      lines.push('pnpm dev         # 开发服务器');
    } else if (projectInfo.packageManager === 'bun') {
      lines.push('bun install      # 安装依赖');
      lines.push('bun run build    # 构建');
      lines.push('bun test         # 运行测试');
      lines.push('bun dev          # 开发服务器');
    }
    lines.push('```');
    lines.push('');
  }

  if (projectInfo.testing.length > 0) {
    lines.push('### 测试');
    lines.push('```bash');
    if (projectInfo.testing.includes('Jest') || projectInfo.testing.includes('Vitest')) {
      lines.push('npm test                # 运行所有测试');
      lines.push('npm test -- --watch     # 监听模式');
      lines.push('npm test -- --coverage  # 生成覆盖率报告');
    } else if (projectInfo.testing.includes('JUnit')) {
      lines.push('mvn test                # 运行测试');
      lines.push('mvn test -Dtest=ClassName  # 运行单个测试类');
    } else if (projectInfo.testing.includes('Pytest')) {
      lines.push('pytest                  # 运行测试');
      lines.push('pytest -v               # 详细输出');
      lines.push('pytest --cov=src        # 生成覆盖率');
    }
    lines.push('```');
    lines.push('');
  }

  // 开发检查清单
  lines.push('---');
  lines.push('');
  lines.push('## 开发检查清单');
  lines.push('');
  lines.push('在提交代码前，确保：');
  lines.push('');
  lines.push(`- [ ] 代码通过 ${projectInfo.testing.join(' 和 ') || '所有'} 测试`);
  lines.push('- [ ] 代码符合项目风格规范');
  lines.push('- [ ] 添加必要的注释和文档');
  if (projectInfo.hasTests) {
    lines.push('- [ ] 新功能包含对应的测试');
  }
  if (projectInfo.hasDocs) {
    lines.push('- [ ] 更新相关文档');
  }
  lines.push('');

  // Git 相关
  if (projectInfo.hasGit) {
    lines.push('---');
    lines.push('');
    lines.push('## Git 工作流');
    lines.push('');
    lines.push('```bash');
    lines.push('git checkout -b feature/your-feature  # 创建功能分支');
    lines.push('git commit -m "feat: add feature"     # 提交');
    lines.push('git push origin feature/your-feature  # 推送');
    lines.push('```');
    lines.push('');
    lines.push('### 提交信息规范');
    lines.push('- `feat:` 新功能');
    lines.push('- `fix:` 修复 bug');
    lines.push('- `refactor:` 重构');
    lines.push('- `docs:` 文档更新');
    lines.push('- `test:` 测试相关');
    lines.push('- `chore:` 构建/工具链');
    lines.push('');
  }

  // Auto CLI 集成
  lines.push('---');
  lines.push('');
  lines.push('## AI 辅助开发');
  lines.push('');
  lines.push('本项目使用 **Auto CLI** 增强 Claude Code 能力：');
  lines.push('');
  lines.push('- `/auto:plan` - 需求分析和规划');
  lines.push('- `/auto:tdd` - 测试驱动开发');
  lines.push('- `/auto:code-review` - 代码审查');
  lines.push('- `/auto:build-fix` - 修复构建错误');
  lines.push('- `/auto:update-codemaps` - 更新代码地图');
  lines.push('');

  return lines.join('\n');
}

function determineProjectType(projectInfo) {
  const frontend = projectInfo.frameworks.find(f => f.category === 'frontend');
  const backend = projectInfo.frameworks.find(f => f.category === 'backend');
  const fullstack = projectInfo.frameworks.find(f => f.category === 'fullstack');

  if (fullstack) return `全栈应用 (${fullstack.name})`;
  if (frontend && backend) return `全栈应用 (${frontend.name} + ${backend.name})`;
  if (frontend) return `前端应用 (${frontend.name})`;
  if (backend) return `后端应用 (${backend.name})`;
  if (projectInfo.languages.includes('Java')) return 'Java 应用';
  if (projectInfo.languages.includes('Python')) return 'Python 应用';
  if (projectInfo.languages.includes('JavaScript') || projectInfo.languages.includes('TypeScript')) {
    return 'JavaScript/TypeScript 项目';
  }
  return '通用项目';
}

function JavaRules() {
  return `### Java 编码规范

- **分层架构**: 严格遵守 Controller → Service → Repository
- **依赖注入**: 使用构造函数注入，避免字段注入
- **异常处理**: 使用自定义业务异常，统一异常处理器
- **参数校验**: 使用 Bean Validation (@NotNull, @Valid 等)
- **日志**: 使用 Slf4j，避免 System.out.println
- **事务**: Service 层使用 @Transactional，注意传播行为`;
}

function JavaScriptRules() {
  return `### JavaScript/TypeScript 编码规范

- **类型安全**: TypeScript 项目使用严格模式，避免 any
- **组件命名**: 组件使用 PascalCase，工具函数使用 camelCase
- **导入顺序**: 外部库 → 内部模块 → 类型导入 → 相对路径
- **错误处理**: 使用 try-catch，提供有意义的错误信息
- **异步**: 使用 async/await 而非 Promise 链
- **格式化**: 项目使用 Prettier/Eslint，提交前自动格式化`;
}

function PythonRules() {
  return `### Python 编码规范

- **PEP 8**: 遵循 PEP 8 风格指南
- **类型注解**: 使用类型提示 (type hints)
- **文档字符串**: 函数和类使用 docstring
- **导入顺序**: 标准库 → 第三方库 → 本地模块
- **异常处理**: 捕获特定异常，避免裸 except
- **格式化**: 使用 Black 或 Ruff 格式化`;
}

/**
 * 主函数
 */
function main() {
  const args = process.argv.slice(2);

  let projectDir = process.cwd();
  let outputFile = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dir' && args[i + 1]) {
      projectDir = args[++i];
    }
    if (args[i] === '--output' && args[i + 1]) {
      outputFile = args[++i];
    }
    if (args[i] === '--help' || args[i] === '-h') {
      console.log(`
CLAUDE.md 自动生成器

用法:
  node claude-md-generator.js [--dir <path>] [--output <path>]

选项:
  --dir <path>    项目目录 (默认: 当前目录)
  --output <path> 输出文件路径 (默认: .claude/CLAUDE.md)
  --help, -h      显示帮助

示例:
  node claude-md-generator.js
  node claude-md-generator.js --dir /path/to/project
  node claude-md-generator.js --output ./CLAUDE.md
      `);
      process.exit(0);
    }
  }

  if (!fs.existsSync(projectDir)) {
    console.error(`错误: 目录不存在 - ${projectDir}`);
    process.exit(1);
  }

  console.log(`🔍 扫描项目: ${projectDir}`);

  const projectInfo = scanProject(projectDir);

  console.log(``);
  console.log(`📊 检测结果:`);
  console.log(`   语言: ${projectInfo.languages.join(', ') || '未知'}`);
  console.log(`   框架: ${projectInfo.frameworks.map(f => f.name).join(', ') || '未检测到'}`);
  console.log(`   测试: ${projectInfo.testing.join(', ') || '未检测到'}`);
  console.log(``);

  const content = generateClaudeMd(projectInfo);

  // 默认输出到 .claude/CLAUDE.md
  if (!outputFile) {
    const claudeDir = path.join(projectDir, '.claude');
    if (!fs.existsSync(claudeDir)) {
      fs.mkdirSync(claudeDir, { recursive: true });
    }
    outputFile = path.join(claudeDir, 'CLAUDE.md');
  }

  fs.writeFileSync(outputFile, content, 'utf-8');
  console.log(`✅ 已生成: ${outputFile}`);
  console.log(``);
  console.log(`💡 下一步:`);
  console.log(`   1. 检查生成的 CLAUDE.md 内容`);
  console.log(`   2. 根据项目需求调整配置`);
  console.log(`   3. 重启 Claude Code 以加载新配置`);
}

// 运行
const isMainModule = import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` ||
                      import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}` ||
                      process.argv[1].endsWith('claude-md-generator.js');

if (isMainModule) {
  main();
}

export { scanProject, generateClaudeMd };
