/**
 * 日志工具模块
 * 提供结构化日志输出，替换 console.log
 */
import chalk from 'chalk';

const LOG_LEVELS = Object.freeze({
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  SILENT: 4
});

class Logger {
  constructor(options = {}) {
    this.level = options.level ?? LOG_LEVELS.INFO;
    this.prefix = options.prefix ?? '';
    this.timestamp = options.timestamp ?? false;
  }

  setLevel(level) {
    this.level = level;
  }

  _formatMessage(level, message, meta) {
    const parts = [];

    if (this.timestamp) {
      const time = new Date().toISOString();
      parts.push(chalk.gray(`[${time}]`));
    }

    if (this.prefix) {
      parts.push(chalk.gray(`[${this.prefix}]`));
    }

    parts.push(message);

    if (meta && Object.keys(meta).length > 0) {
      parts.push(chalk.gray(JSON.stringify(meta)));
    }

    return parts.join(' ');
  }

  debug(message, meta) {
    if (this.level <= LOG_LEVELS.DEBUG) {
      console.log(chalk.gray('DEBUG:'), this._formatMessage('DEBUG', message, meta));
    }
  }

  info(message, meta) {
    if (this.level <= LOG_LEVELS.INFO) {
      console.log(chalk.blue('INFO:'), this._formatMessage('INFO', message, meta));
    }
  }

  warn(message, meta) {
    if (this.level <= LOG_LEVELS.WARN) {
      console.warn(chalk.yellow('WARN:'), this._formatMessage('WARN', message, meta));
    }
  }

  error(message, meta) {
    if (this.level <= LOG_LEVELS.ERROR) {
      console.error(chalk.red('ERROR:'), this._formatMessage('ERROR', message, meta));
    }
  }

  success(message, meta) {
    if (this.level <= LOG_LEVELS.INFO) {
      console.log(chalk.green('SUCCESS:'), this._formatMessage('SUCCESS', message, meta));
    }
  }

  // 保留原有方法以兼容现有代码
  log(message) {
    console.log(message);
  }

  infoRaw(message) {
    console.log(message);
  }
}

// 创建默认日志实例
const logger = new Logger({
  level: LOG_LEVELS.INFO,
  prefix: 'auto-cli',
  timestamp: false
});

export { Logger, logger, LOG_LEVELS };
export default logger;
