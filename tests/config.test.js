import { describe, it, expect, beforeEach } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';

describe('config.js', () => {
  let config;

  beforeEach(async () => {
    config = await import('../src/config.js');
  });

  describe('PROJECT_ROOT', () => {
    it('should be an absolute path', () => {
      expect(path.isAbsolute(config.PROJECT_ROOT)).toBe(true);
    });

    it('should point to project root directory', () => {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const expected = path.resolve(__dirname, '..');
      expect(config.PROJECT_ROOT).toBe(expected);
    });
  });

  describe('DOCS_URL', () => {
    it('should be a non-empty string', () => {
      expect(typeof config.DOCS_URL).toBe('string');
      expect(config.DOCS_URL.length).toBeGreaterThan(0);
    });

    it('should be a valid URL', () => {
      expect(config.DOCS_URL).toMatch(/^https?:\/\//);
    });
  });

  describe('LOG_LEVEL', () => {
    it('should be a non-empty string', () => {
      expect(typeof config.LOG_LEVEL).toBe('string');
      expect(config.LOG_LEVEL.length).toBeGreaterThan(0);
    });
  });

  describe('DEFAULT_MAX_RETRIES', () => {
    it('should be a positive integer', () => {
      expect(Number.isInteger(config.DEFAULT_MAX_RETRIES)).toBe(true);
      expect(config.DEFAULT_MAX_RETRIES).toBeGreaterThan(0);
    });
  });

  describe('DEFAULT_TIMEOUT', () => {
    it('should be a positive integer', () => {
      expect(Number.isInteger(config.DEFAULT_TIMEOUT)).toBe(true);
      expect(config.DEFAULT_TIMEOUT).toBeGreaterThan(0);
    });
  });

  describe('CLAUDE_DIR', () => {
    it('should be a non-empty string', () => {
      expect(typeof config.CLAUDE_DIR).toBe('string');
      expect(config.CLAUDE_DIR.length).toBeGreaterThan(0);
    });
  });

  describe('default export', () => {
    it('should contain all named exports', () => {
      const defaultExport = config.default;
      expect(defaultExport).toHaveProperty('PROJECT_ROOT');
      expect(defaultExport).toHaveProperty('DOCS_URL');
      expect(defaultExport).toHaveProperty('LOG_LEVEL');
      expect(defaultExport).toHaveProperty('DEFAULT_MAX_RETRIES');
      expect(defaultExport).toHaveProperty('DEFAULT_TIMEOUT');
      expect(defaultExport).toHaveProperty('CLAUDE_DIR');
    });
  });

  describe('removed exports', () => {
    it('should not export VERSION_FILE', () => {
      expect(config.VERSION_FILE).toBeUndefined();
    });

    it('should not export SUPPORTED_LANGUAGES', () => {
      expect(config.SUPPORTED_LANGUAGES).toBeUndefined();
    });

    it('should not export SUPPORTED_FRAMEWORKS', () => {
      expect(config.SUPPORTED_FRAMEWORKS).toBeUndefined();
    });

    it('should not export DOCS_URL_NPM', () => {
      expect(config.DOCS_URL_NPM).toBeUndefined();
    });

    it('should not export DOCS_URL_GITHUB', () => {
      expect(config.DOCS_URL_GITHUB).toBeUndefined();
    });
  });
});
