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
    if (typeof level === 'string') {
      const upperLevel = level.toUpperCase();
      if (upperLevel in LOG_LEVELS) {
        this.level = LOG_LEVELS[upperLevel];
      } else {
        throw new Error(
          `Invalid log level: ${level}. Valid levels: ${Object.keys(LOG_LEVELS).join(', ')}`
        );
      }
    } else if (typeof level === 'number') {
      if (level >= 0 && level <= 4) {
        this.level = level;
      } else {
        throw new Error(`Invalid log level number: ${level}. Valid range: 0-4`);
      }
    } else {
      throw new TypeError(`Log level must be string or number, got: ${typeof level}`);
    }
  }

  _formatMessage(message, meta) {
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
      console.log(chalk.gray('DEBUG:'), this._formatMessage(message, meta));
    }
  }

  info(message, meta) {
    if (this.level <= LOG_LEVELS.INFO) {
      console.log(chalk.blue('INFO:'), this._formatMessage(message, meta));
    }
  }

  warn(message, meta) {
    if (this.level <= LOG_LEVELS.WARN) {
      console.warn(chalk.yellow('WARN:'), this._formatMessage(message, meta));
    }
  }

  error(message, meta) {
    if (this.level <= LOG_LEVELS.ERROR) {
      console.error(chalk.red('ERROR:'), this._formatMessage(message, meta));
    }
  }

  success(message, meta) {
    if (this.level <= LOG_LEVELS.INFO) {
      console.log(chalk.green('SUCCESS:'), this._formatMessage(message, meta));
    }
  }

  /**
   * 输出日志（尊重级别控制）
   */
  log(message, meta) {
    if (this.level <= LOG_LEVELS.INFO) {
      console.log(this._formatMessage(message, meta));
    }
  }

  /**
   * 输出原始信息（无前缀，但尊重级别控制）
   */
  infoRaw(message) {
    if (this.level <= LOG_LEVELS.INFO) {
      console.log(message);
    }
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
