/**
 * 日志工具模块
 * 提供结构化日志输出，替换 console.log
 *
 * @typedef {Object} LoggerOptions
 * @property {number} [level] - 日志级别（0=DEBUG, 1=INFO, 2=WARN, 3=ERROR, 4=SILENT）
 * @property {string} [prefix] - 日志前缀
 * @property {boolean} [timestamp] - 是否显示时间戳
 */
import chalk from 'chalk';

/**
 * 日志级别常量
 * @readonly
 * @enum {number}
 */
const LOG_LEVELS = Object.freeze({
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  SILENT: 4
});

/**
 * 日志类
 * @class
 */
class Logger {
  /**
   * 创建日志实例
   * @param {LoggerOptions} options - 配置选项
   */
  constructor(options = {}) {
    /** @type {number} */
    this.level = options.level ?? LOG_LEVELS.INFO;
    /** @type {string} */
    this.prefix = options.prefix ?? '';
    /** @type {boolean} */
    this.timestamp = options.timestamp ?? false;
  }

  /**
   * 设置日志级别
   * @param {number|string} level - 日志级别（数字 0-4 或字符串 debug/info/warn/error/silent）
   */
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

  /**
   * 格式化消息
   * @param {string} message - 消息内容
   * @param {Object} [meta] - 元数据
   * @returns {string} 格式化后的消息
   * @private
   */
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

  /**
   * 输出 DEBUG 级别日志
   * @param {string} message - 消息内容
   * @param {Object} [meta] - 元数据
   */
  debug(message, meta) {
    if (this.level <= LOG_LEVELS.DEBUG) {
      console.log(chalk.gray('DEBUG:'), this._formatMessage(message, meta));
    }
  }

  /**
   * 输出 INFO 级别日志
   * @param {string} message - 消息内容
   * @param {Object} [meta] - 元数据
   */
  info(message, meta) {
    if (this.level <= LOG_LEVELS.INFO) {
      console.log(chalk.blue('INFO:'), this._formatMessage(message, meta));
    }
  }

  /**
   * 输出 WARN 级别日志
   * @param {string} message - 消息内容
   * @param {Object} [meta] - 元数据
   */
  warn(message, meta) {
    if (this.level <= LOG_LEVELS.WARN) {
      console.warn(chalk.yellow('WARN:'), this._formatMessage(message, meta));
    }
  }

  /**
   * 输出 ERROR 级别日志
   * @param {string} message - 消息内容
   * @param {Object} [meta] - 元数据
   */
  error(message, meta) {
    if (this.level <= LOG_LEVELS.ERROR) {
      console.error(chalk.red('ERROR:'), this._formatMessage(message, meta));
    }
  }

  /**
   * 输出 SUCCESS 级别日志
   * @param {string} message - 消息内容
   * @param {Object} [meta] - 元数据
   */
  success(message, meta) {
    if (this.level <= LOG_LEVELS.INFO) {
      console.log(chalk.green('SUCCESS:'), this._formatMessage(message, meta));
    }
  }

  /**
   * 输出日志（尊重级别控制）
   * @param {string} message - 消息内容
   * @param {Object} [meta] - 元数据
   */
  log(message, meta) {
    if (this.level <= LOG_LEVELS.INFO) {
      console.log(this._formatMessage(message, meta));
    }
  }

  /**
   * 输出原始信息（无前缀，但尊重级别控制）
   * @param {string} message - 消息内容
   */
  infoRaw(message) {
    if (this.level <= LOG_LEVELS.INFO) {
      console.log(message);
    }
  }
}

// 创建默认日志实例
/** @type {Logger} */
const logger = new Logger({
  level: LOG_LEVELS.INFO,
  prefix: 'auto-cli',
  timestamp: false
});

export { Logger, logger, LOG_LEVELS };
export default logger;
