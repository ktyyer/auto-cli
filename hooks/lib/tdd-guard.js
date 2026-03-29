/**
 * TDD Guard - Test-Driven Development Enforcement Module
 *
 * This module provides intelligent TDD violation detection and enforcement.
 * It can be used standalone or integrated with Claude Code hooks.
 */

import path from 'node:path';
import fs from 'node:fs/promises';
import fsExtra from 'fs-extra';

/**
 * TDD Guard configuration options
 */
export const TDDGuardOptions = {
  // Whether to enforce TDD strictly (block violations) or just warn
  strictMode: true,

  // File patterns to check
  sourcePatterns: ['.js', '.jsx', '.ts', '.tsx', '.java', '.py', '.go', '.rs'],

  // Test file patterns to look for
  testPatterns: {
    '.js': ['.test.js', '.spec.js', '/__tests__/', '.cy.js'],
    '.jsx': ['.test.jsx', '.spec.jsx', '/__tests__/'],
    '.ts': ['.test.ts', '.spec.ts', '/__tests__/'],
    '.tsx': ['.test.tsx', '.spec.tsx', '/__tests__/'],
    '.java': ['Test.java', '/src/test/java/'],
    '.py': ['test_', '/tests/', '_test.py'],
    '.go': ['_test.go'],
    '.rs': ['_test.rs', '/tests/']
  },

  // Directories to exclude from TDD checking
  excludedDirs: ['node_modules', 'dist', 'build', '.git', 'coverage', '__tests__'],

  // Files that are exempt from TDD (config files, etc.)
  exemptPatterns: [
    '.config.',
    '.config.js',
    '.config.ts',
    'config.',
    'jest.config.',
    'vitest.config.',
    'tsconfig.json',
    'package.json',
    '.eslintrc',
    '.prettierrc'
  ]
};

/**
 * TDD Guard class
 */
export class TDDGuard {
  constructor(options = {}) {
    this.options = { ...TDDGuardOptions, ...options };
    this.violations = [];
  }

  /**
   * Check if a file path should be excluded from TDD checking
   * @param {string} filePath - The file path to check
   * @returns {boolean}
   */
  isExempt(filePath) {
    const normalizedPath = filePath.replace(/\\/g, '/');

    // Check if any excluded directory is in the path
    for (const excludedDir of this.options.excludedDirs) {
      if (normalizedPath.includes(`/${excludedDir}/`) ||
          normalizedPath.startsWith(`${excludedDir}/`)) {
        return true;
      }
    }

    // Check exempt file patterns
    for (const pattern of this.options.exemptPatterns) {
      if (normalizedPath.includes(pattern)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Determine the expected test file path for a source file
   * @param {string} sourcePath - The source file path
   * @returns {string[]} Array of possible test file paths
   */
  getTestFilePaths(sourcePath) {
    const ext = path.extname(sourcePath);
    const dir = path.dirname(sourcePath);
    const base = path.basename(sourcePath, ext);

    const testPaths = [];

    // Get test patterns for this extension
    const patterns = this.options.testPatterns[ext] || [];

    for (const pattern of patterns) {
      if (pattern.startsWith('/')) {
        // Directory-based pattern
        const testDir = dir.replace(/src\/main\//, 'src/test/');
        testPaths.push(path.join(testDir, pattern, `${base}${ext}`));
      } else if (pattern.endsWith('.js') || pattern.endsWith('.ts') ||
                 pattern.endsWith('.jsx') || pattern.endsWith('.tsx')) {
        // Full extension pattern
        testPaths.push(path.join(dir, base + pattern));
      } else if (pattern.startsWith('test_')) {
        // Python-style pattern
        testPaths.push(path.join(dir, `${pattern}${base}.py`));
      } else if (pattern.startsWith('_test.')) {
        // Go/Rust-style pattern
        testPaths.push(path.join(dir, `${base}${pattern}`));
      } else if (pattern.endsWith('Test.java')) {
        // Java-style pattern
        const testDir = dir.replace(/src\/main\/java\//, 'src/test/java/');
        testPaths.push(path.join(testDir, `${base}Test.java`));
      } else {
        // Generic pattern
        testPaths.push(path.join(dir, `${base}${pattern}`));
      }
    }

    return testPaths;
  }

  /**
   * Check if a test file exists for a given source file
   * @param {string} sourcePath - The source file path
   * @returns {Promise<Object>} Check result
   */
  async checkTestFile(sourcePath) {
    if (this.isExempt(sourcePath)) {
      return { exempt: true, hasTest: true, testPaths: [] };
    }

    const testPaths = this.getTestFilePaths(sourcePath);

    for (const testPath of testPaths) {
      const exists = await fsExtra.pathExists(testPath);
      if (exists) {
        return { exempt: false, hasTest: true, testPaths, foundTest: testPath };
      }
    }

    return { exempt: false, hasTest: false, testPaths };
  }

  /**
   * Analyze a directory for TDD violations
   * @param {string} dirPath - Directory to analyze
   * @returns {Promise<Array>} Array of violations
   */
  async analyzeDirectory(dirPath) {
    const violations = [];

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          // Recursively check subdirectories
          const subViolations = await this.analyzeDirectory(fullPath);
          violations.push(...subViolations);
        } else if (entry.isFile()) {
          const ext = path.extname(fullPath);
          if (this.options.sourcePatterns.includes(ext)) {
            const check = await this.checkTestFile(fullPath);
            if (!check.exempt && !check.hasTest) {
              violations.push({
                file: fullPath,
                testPaths: check.testPaths,
                type: 'missing_test'
              });
            }
          }
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }

    return violations;
  }

  /**
   * Generate a report of TDD violations
   * @param {Array} violations - Array of violations
   * @returns {string} Formatted report
   */
  generateReport(violations) {
    if (violations.length === 0) {
      return '✅ TDD Guard: No violations found. All source files have tests.';
    }

    let report = `⚠️ TDD Guard: Found ${violations.length} violation(s)\n\n`;

    for (const violation of violations) {
      report += `❌ ${violation.file}\n`;
      report += `   Expected test file(s):\n`;
      for (const testPath of violation.testPaths) {
        report += `     - ${testPath}\n`;
      }
      report += '\n';
    }

    report += '\n📝 TDD Workflow:\n';
    report += '   1. Write the test first (RED)\n';
    report += '   2. Write minimal code to make test pass (GREEN)\n';
    report += '   3. Refactor while keeping tests green (REFACTOR)\n';

    return report;
  }

  /**
   * Create a hook-compatible message for blocking edits
   * @param {string} sourcePath - Source file path
   * @param {Object} check - Check result from checkTestFile
   * @returns {string} Hook message
   */
  createBlockMessage(sourcePath, check) {
    let message = '[TDD Guard] BLOCKED: Corresponding test file does not exist\n';
    message += `[TDD Guard] Source file: ${sourcePath}\n`;
    message += '[TDD Guard] Expected test file(s):\n';

    for (const testPath of check.testPaths) {
      message += `   - ${testPath}\n`;
    }

    message += '\n[TDD Guard] Please follow Test-Driven Development (TDD):\n';
    message += '   1. Write the test first (it will fail - RED)\n';
    message += '   2. Write minimal code to make test pass (GREEN)\n';
    message += '   3. Refactor while keeping tests green (REFACTOR)\n';

    return message;
  }
}

/**
 * Convenience function to check a single file
 * @param {string} filePath - File to check
 * @param {Object} options - TDD Guard options
 * @returns {Promise<Object>}
 */
export async function checkTDD(filePath, options = {}) {
  const guard = new TDDGuard(options);
  return await guard.checkTestFile(filePath);
}

/**
 * Convenience function to analyze a directory
 * @param {string} dirPath - Directory to analyze
 * @param {Object} options - TDD Guard options
 * @returns {Promise<string>} Report
 */
export async function analyzeTDD(dirPath, options = {}) {
  const guard = new TDDGuard(options);
  const violations = await guard.analyzeDirectory(dirPath);
  return guard.generateReport(violations);
}
