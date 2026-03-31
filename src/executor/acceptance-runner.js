/**
 * 验收执行器 - 自动运行 Quest Map 中的验收标准
 *
 * 核心功能：
 * - 解析 markdown 中的验收命令（如 grep, npm test 等）
 * - 自动执行验收命令
 * - 记录执行结果（成功/失败/超时）
 * - 将结果附加到 Quest 执行报告中
 *
 * @module AcceptanceRunner
 */
import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../logger.js';

const execAsync = promisify(exec);

/**
 * 验收命令类型
 * @typedef {'grep' | 'bash' | 'npm' | 'node' | 'custom'} CommandType
 */

/**
 * 解析后的验收命令
 * @typedef {Object} ParsedCommand
 * @property {CommandType} type - 命令类型
 * @property {string} original - 原始命令文本
 * @property {string[]} args - 命令参数
 * @property {string} workingDir - 工作目录
 */

/**
 * 验收执行结果
 * @typedef {Object} AcceptanceResult
 * @property {string} questId - Quest ID
 * @property {string} command - 执行的命令
 * @property {boolean} success - 是否成功
 * @property {number} [exitCode] - 退出码
 * @property {string} [stdout] - 标准输出
 * @property {string} [stderr] - 标准错误
 * @property {number} duration - 执行时长（毫秒）
 * @property {string} [error] - 错误信息（如果失败）
 */

/**
 * 默认超时时间（毫秒）
 */
const DEFAULT_TIMEOUT = 60000;

/**
 * 验收命令模式
 */
const COMMAND_PATTERNS = [
  {
    type: 'grep',
    pattern: /^(?:grep|rg)\s+(.+?)\s+(.+?)(?:\s*$)/,
    parse: (match) => ({
      type: 'grep',
      args: [match[1], match[2]],
      description: `搜索 "${match[1]}" 在 ${match[2]}`
    })
  },
  {
    type: 'npm',
    pattern: /^npm\s+(test|run|lint|build)\s*(.+)?$/,
    parse: (match) => ({
      type: 'npm',
      args: [match[1], match[2] || ''],
      description: `npm ${match[1]}${match[2] ? ' ' + match[2] : ''}`
    })
  },
  {
    type: 'bash',
    pattern: /^(?:bash|sh)\s+(.+)$/,
    parse: (match) => ({
      type: 'bash',
      args: [match[1]],
      description: `执行脚本: ${match[1].slice(0, 50)}`
    })
  },
  {
    type: 'node',
    pattern: /^node\s+(--check)?\s*(.+)$/,
    parse: (match) => ({
      type: 'node',
      args: [match[1] || '', match[2]],
      description: `node ${match[1] || ''} ${match[2]}`
    })
  }
];

export class AcceptanceRunner {
  /**
   * @param {string} [projectDir] - 项目根目录
   * @param {number} [timeout] - 超时时间（毫秒）
   */
  constructor(projectDir, timeout = DEFAULT_TIMEOUT) {
    this.projectDir = projectDir || process.cwd();
    this.timeout = timeout;
    this.logger = logger;
  }

  /**
   * 从 markdown 文本中提取验收命令
   * @param {string} markdown - Quest Map markdown 内容
   * @param {string} questId - Quest ID
   * @returns {ParsedCommand[]}
   */
  parseCommands(markdown, questId) {
    const commands = [];
    const lines = markdown.split('\n');

    // 查找 ## Quest [X.X] 或 ### 验收标准 部分
    let inQuestSection = false;
    let currentQuestId = '';
    let inAcceptanceSection = false;

    for (const line of lines) {
      // 检测 Quest 标题
      const questMatch = line.match(/^##\s+Quest\s+\[([^\]]+)\]/);
      if (questMatch) {
        currentQuestId = questMatch[1];
        inQuestSection = true;
        inAcceptanceSection = false;
        continue;
      }

      // 检测验收标准标题
      if (inQuestSection && line.match(/^#{1,3}\s+验收标准/)) {
        inAcceptanceSection = true;
        continue;
      }

      // 检测下一个 Quest 则退出
      if (inQuestSection && line.match(/^##\s+Quest/)) {
        inAcceptanceSection = false;
        continue;
      }

      // 在验收标准部分查找命令
      if (inAcceptanceSection && currentQuestId === questId) {
        // 匹配 ```bash 代码块
        const codeBlockMatch = line.match(/^```(?:bash|sh|shell)?/);
        if (codeBlockMatch) {
          continue;
        }

        // 匹配命令（grep, npm, bash, node 等）
        const trimmed = line.trim();
        if (
          trimmed.startsWith('grep') ||
          trimmed.startsWith('rg ') ||
          trimmed.startsWith('npm ') ||
          trimmed.startsWith('bash ') ||
          trimmed.startsWith('sh ') ||
          trimmed.startsWith('node ')
        ) {
          const parsed = this._parseLine(trimmed);
          if (parsed) {
            commands.push(parsed);
          }
        }
      }
    }

    return commands;
  }

  /**
   * 解析单行命令
   * @param {string} line
   * @returns {ParsedCommand | null}
   * @private
   */
  _parseLine(line) {
    for (const { pattern, parse } of COMMAND_PATTERNS) {
      const match = line.match(pattern);
      if (match) {
        const parsed = parse(match);
        return {
          ...parsed,
          original: line,
          workingDir: this.projectDir
        };
      }
    }

    // 回退：作为自定义命令处理
    if (line.length > 0 && line.length < 500) {
      return {
        type: 'custom',
        original: line,
        args: [line],
        description: `自定义命令: ${line.slice(0, 50)}`,
        workingDir: this.projectDir
      };
    }

    return null;
  }

  /**
   * 执行单个验收命令
   * @param {ParsedCommand} command
   * @returns {Promise<AcceptanceResult>}
   * @private
   */
  async _executeCommand(command) {
    const startTime = Date.now();

    try {
      let fullCommand;
      const options = {
        cwd: command.workingDir,
        timeout: this.timeout,
        encoding: 'utf-8'
      };

      switch (command.type) {
        case 'grep':
          fullCommand = `rg "${command.args[0]}" "${command.args[1]}"`;
          break;
        case 'npm':
          fullCommand = `npm ${command.args[0]}${command.args[1] ? ' ' + command.args[1] : ''}`;
          break;
        case 'bash':
        case 'custom':
          fullCommand = command.args[0];
          break;
        case 'node':
          fullCommand = `node ${command.args[0]} ${command.args[1]}`;
          break;
        default:
          fullCommand = command.original;
      }

      const { stdout, stderr } = await execAsync(fullCommand, options);

      const duration = Date.now() - startTime;

      return {
        command: command.original,
        success: true,
        stdout: stdout.slice(0, 1000), // 截断输出
        stderr: stderr.slice(0, 500),
        duration
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      return {
        command: command.original,
        success: false,
        exitCode: error.code || 1,
        stdout: error.stdout?.slice(0, 1000) || '',
        stderr: error.stderr?.slice(0, 500) || '',
        duration,
        error: error.message
      };
    }
  }

  /**
   * 执行所有验收命令
   * @param {string} questMapContent - Quest Map markdown 内容
   * @param {string} questId - Quest ID
   * @returns {Promise<AcceptanceResult[]>}
   */
  async runForQuest(questMapContent, questId) {
    const commands = this.parseCommands(questMapContent, questId);

    if (commands.length === 0) {
      this.logger.debug(`Quest ${questId} 没有验收命令`);
      return [];
    }

    this.logger.info(`Quest ${questId} 开始验收，共 ${commands.length} 条命令`);

    const results = [];

    for (const command of commands) {
      this.logger.debug(`执行: ${command.original}`);
      const result = await this._executeCommand(command);
      results.push(result);

      if (result.success) {
        this.logger.debug(`✅ 成功: ${command.original} (${result.duration}ms)`);
      } else {
        this.logger.warn(`❌ 失败: ${command.original} - ${result.error}`);
      }
    }

    return results;
  }

  /**
   * 生成验收报告
   * @param {AcceptanceResult[]} results
   * @returns {string}
   */
  generateReport(results) {
    if (results.length === 0) {
      return '无验收命令';
    }

    const lines = [];
    lines.push('## 验收结果\n');

    let passCount = 0;
    let failCount = 0;

    for (const result of results) {
      const status = result.success ? '✅' : '❌';
      const duration = `${result.duration}ms`;

      lines.push(`### ${status} ${result.command}`);
      lines.push(`- 时长: ${duration}`);

      if (result.success) {
        passCount++;
        if (result.stdout) {
          lines.push(`- 输出: ${result.stdout.slice(0, 200)}`);
        }
      } else {
        failCount++;
        lines.push(`- 错误: ${result.error}`);
        if (result.stderr) {
          lines.push(`- stderr: ${result.stderr.slice(0, 200)}`);
        }
      }

      lines.push('');
    }

    lines.push('---');
    lines.push(`**汇总**: ${passCount} 通过, ${failCount} 失败`);

    return lines.join('\n');
  }

  /**
   * 检查是否有失败的验收
   * @param {AcceptanceResult[]} results
   * @returns {boolean}
   */
  hasFailures(results) {
    return results.some((r) => !r.success);
  }
}

export default AcceptanceRunner;
