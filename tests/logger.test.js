import { describe, it, expect, vi, afterEach } from 'vitest';
import { Logger, logger, LOG_LEVELS } from '../src/logger.js';

describe('logger.js', () => {
  describe('LOG_LEVELS', () => {
    it('should define all log levels with numeric values', () => {
      expect(LOG_LEVELS.DEBUG).toBe(0);
      expect(LOG_LEVELS.INFO).toBe(1);
      expect(LOG_LEVELS.WARN).toBe(2);
      expect(LOG_LEVELS.ERROR).toBe(3);
      expect(LOG_LEVELS.SILENT).toBe(4);
    });

    it('should be frozen', () => {
      expect(() => {
        LOG_LEVELS.DEBUG = 99;
      }).toThrow();
    });
  });

  describe('Logger class', () => {
    it('should create instance with default options', () => {
      const instance = new Logger();
      expect(instance.level).toBe(LOG_LEVELS.INFO);
      expect(instance.prefix).toBe('');
      expect(instance.timestamp).toBe(false);
    });

    it('should create instance with custom options', () => {
      const instance = new Logger({
        level: LOG_LEVELS.DEBUG,
        prefix: 'test',
        timestamp: true
      });
      expect(instance.level).toBe(LOG_LEVELS.DEBUG);
      expect(instance.prefix).toBe('test');
      expect(instance.timestamp).toBe(true);
    });

    it('should accept level 0 (DEBUG) via constructor', () => {
      const instance = new Logger({ level: 0 });
      expect(instance.level).toBe(0);
    });

    describe('setLevel', () => {
      it('should accept valid string level names', () => {
        const instance = new Logger();
        instance.setLevel('DEBUG');
        expect(instance.level).toBe(LOG_LEVELS.DEBUG);

        instance.setLevel('silent');
        expect(instance.level).toBe(LOG_LEVELS.SILENT);
      });

      it('should accept valid numeric levels', () => {
        const instance = new Logger();
        instance.setLevel(0);
        expect(instance.level).toBe(0);

        instance.setLevel(4);
        expect(instance.level).toBe(4);
      });

      it('should throw on invalid string level', () => {
        const instance = new Logger();
        expect(() => instance.setLevel('INVALID')).toThrow('Invalid log level: INVALID');
      });

      it('should throw on out-of-range numeric level', () => {
        const instance = new Logger();
        expect(() => instance.setLevel(5)).toThrow('Invalid log level number: 5');
        expect(() => instance.setLevel(-1)).toThrow('Invalid log level number: -1');
      });

      it('should throw on non-string non-number input', () => {
        const instance = new Logger();
        expect(() => instance.setLevel(undefined)).toThrow();
        expect(() => instance.setLevel(null)).toThrow();
        expect(() => instance.setLevel({})).toThrow();
      });
    });

    describe('_formatMessage', () => {
      it('should return message as-is when no prefix or timestamp', () => {
        const instance = new Logger();
        const result = instance._formatMessage('hello');
        expect(result).toBe('hello');
      });

      it('should include prefix when set', () => {
        const instance = new Logger({ prefix: 'test' });
        const result = instance._formatMessage('hello');
        expect(result).toContain('[test]');
        expect(result).toContain('hello');
      });

      it('should include meta when provided', () => {
        const instance = new Logger();
        const result = instance._formatMessage('hello', { key: 'value' });
        expect(result).toContain('hello');
        expect(result).toContain('"key":"value"');
      });

      it('should skip meta when empty object', () => {
        const instance = new Logger();
        const result = instance._formatMessage('hello', {});
        expect(result).toBe('hello');
      });
    });

    describe('log method (level-aware)', () => {
      afterEach(() => {
        vi.restoreAllMocks();
      });

      it('should output when level <= INFO', () => {
        const instance = new Logger({ level: LOG_LEVELS.INFO });
        const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

        instance.log('test message');

        expect(spy).toHaveBeenCalledTimes(1);
      });

      it('should suppress output when level > INFO', () => {
        const instance = new Logger({ level: LOG_LEVELS.SILENT });
        const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

        instance.log('test message');

        expect(spy).not.toHaveBeenCalled();
      });
    });

    describe('infoRaw method (level-aware)', () => {
      afterEach(() => {
        vi.restoreAllMocks();
      });

      it('should output when level <= INFO', () => {
        const instance = new Logger({ level: LOG_LEVELS.INFO });
        const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

        instance.infoRaw('raw message');

        expect(spy).toHaveBeenCalledTimes(1);
      });

      it('should suppress output when level > INFO', () => {
        const instance = new Logger({ level: LOG_LEVELS.SILENT });
        const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

        instance.infoRaw('raw message');

        expect(spy).not.toHaveBeenCalled();
      });
    });

    describe('warn method (level-aware)', () => {
      afterEach(() => {
        vi.restoreAllMocks();
      });

      it('should output when level <= WARN', () => {
        const instance = new Logger({ level: LOG_LEVELS.WARN });
        const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        instance.warn('warning message');

        expect(spy).toHaveBeenCalledTimes(1);
      });

      it('should suppress output when level > WARN', () => {
        const instance = new Logger({ level: LOG_LEVELS.ERROR });
        const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        instance.warn('warning message');

        expect(spy).not.toHaveBeenCalled();
      });
    });

    describe('error method (level-aware)', () => {
      afterEach(() => {
        vi.restoreAllMocks();
      });

      it('should output when level <= ERROR', () => {
        const instance = new Logger({ level: LOG_LEVELS.ERROR });
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

        instance.error('error message');

        expect(spy).toHaveBeenCalledTimes(1);
      });

      it('should suppress output when level > ERROR', () => {
        const instance = new Logger({ level: LOG_LEVELS.SILENT });
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

        instance.error('error message');

        expect(spy).not.toHaveBeenCalled();
      });
    });

    describe('success method (level-aware)', () => {
      afterEach(() => {
        vi.restoreAllMocks();
      });

      it('should output when level <= INFO', () => {
        const instance = new Logger({ level: LOG_LEVELS.INFO });
        const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

        instance.success('success message');

        expect(spy).toHaveBeenCalledTimes(1);
      });

      it('should suppress output when level > INFO', () => {
        const instance = new Logger({ level: LOG_LEVELS.WARN });
        const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

        instance.success('success message');

        expect(spy).not.toHaveBeenCalled();
      });
    });

    describe('info method (level-aware)', () => {
      afterEach(() => {
        vi.restoreAllMocks();
      });

      it('should output when level <= INFO', () => {
        const instance = new Logger({ level: LOG_LEVELS.INFO });
        const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

        instance.info('info message');

        expect(spy).toHaveBeenCalledTimes(1);
      });

      it('should suppress output when level > INFO', () => {
        const instance = new Logger({ level: LOG_LEVELS.WARN });
        const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

        instance.info('info message');

        expect(spy).not.toHaveBeenCalled();
      });
    });

    describe('debug method (level-aware)', () => {
      afterEach(() => {
        vi.restoreAllMocks();
      });

      it('should output when level <= DEBUG', () => {
        const instance = new Logger({ level: LOG_LEVELS.DEBUG });
        const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

        instance.debug('debug message');

        expect(spy).toHaveBeenCalledTimes(1);
      });

      it('should suppress output when level > DEBUG', () => {
        const instance = new Logger({ level: LOG_LEVELS.INFO });
        const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

        instance.debug('debug message');

        expect(spy).not.toHaveBeenCalled();
      });
    });
  });

  describe('default logger instance', () => {
    it('should be a Logger instance', () => {
      expect(logger).toBeInstanceOf(Logger);
    });

    it('should have prefix auto-cli', () => {
      expect(logger.prefix).toBe('auto-cli');
    });
  });
});
