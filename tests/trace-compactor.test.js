import { describe, it, expect, beforeEach } from 'vitest';
import {
  parseFrame,
  createFingerprint,
  compactTrace,
  clearFingerprints,
  getFingerprintCount,
  FILTERED_PATTERNS,
  PROJECT_PATTERNS
} from '../src/utils/trace-compactor.js';

describe('FILTERED_PATTERNS', () => {
  it('should be frozen', () => {
    expect(Object.isFrozen(FILTERED_PATTERNS)).toBe(true);
  });

  it('should include node_modules and node:internal', () => {
    expect(FILTERED_PATTERNS).toContain('node_modules');
    expect(FILTERED_PATTERNS).toContain('node:internal');
  });
});

describe('PROJECT_PATTERNS', () => {
  it('should include src/ and tests/', () => {
    expect(PROJECT_PATTERNS).toContain('src/');
    expect(PROJECT_PATTERNS).toContain('tests/');
  });
});

describe('parseFrame', () => {
  it('should parse standard Node.js stack frame', () => {
    const frame = parseFrame('    at myFunc (src/index.js:42:10)');

    expect(frame.file).toBe('src/index.js');
    expect(frame.line).toBe(42);
    expect(frame.isProject).toBe(true);
    expect(frame.isFiltered).toBe(false);
  });

  it('should parse frame without function name', () => {
    const frame = parseFrame('    at src/utils.js:15:3');

    expect(frame.file).toBe('src/utils.js');
    expect(frame.line).toBe(15);
    expect(frame.isProject).toBe(true);
  });

  it('should mark node_modules as filtered', () => {
    const frame = parseFrame('    at Object.run (node_modules/vitest/dist/index.js:100:5)');

    expect(frame.isFiltered).toBe(true);
    expect(frame.isProject).toBe(false);
  });

  it('should mark node:internal as filtered', () => {
    const frame = parseFrame('    at Module._compile (node:internal/modules/cjs/loader:1241:14)');

    expect(frame.isFiltered).toBe(true);
    expect(frame.isProject).toBe(false);
  });

  it('should handle unparseable lines', () => {
    const frame = parseFrame('not a stack frame');

    expect(frame.file).toBe('');
    expect(frame.isFiltered).toBe(true);
  });
});

describe('createFingerprint', () => {
  it('should return 12-char hex string', () => {
    const fp = createFingerprint('Error: test\n    at src/index.js:10:5');

    expect(fp).toMatch(/^[0-9a-f]{12}$/);
  });

  it('should produce same fingerprint for same error', () => {
    const stack = 'Error: boom\n    at src/foo.js:1:1';
    expect(createFingerprint(stack)).toBe(createFingerprint(stack));
  });

  it('should produce different fingerprints for different errors', () => {
    const fp1 = createFingerprint('Error: one\n    at src/a.js:1:1');
    const fp2 = createFingerprint('Error: two\n    at src/b.js:2:2');

    expect(fp1).not.toBe(fp2);
  });

  it('should accept Error objects', () => {
    const err = new Error('test error');
    const fp = createFingerprint(err);

    expect(fp).toMatch(/^[0-9a-f]{12}$/);
  });
});

describe('compactTrace', () => {
  beforeEach(() => {
    clearFingerprints();
  });

  const sampleStack = [
    'TypeError: Cannot read properties of undefined',
    '    at processData (src/router/canonical-router.js:45:12)',
    '    at handleRequest (src/index.js:120:8)',
    '    at Object.run (node_modules/commander/lib/command.js:900:12)',
    '    at Module._compile (node:internal/modules/cjs/loader:1241:14)',
    '    at node:internal/modules/run_main:135:12'
  ].join('\n');

  it('should preserve error message', () => {
    const result = compactTrace(sampleStack);

    expect(result.compacted).toContain('TypeError: Cannot read properties of undefined');
  });

  it('should keep project frames', () => {
    const result = compactTrace(sampleStack);

    expect(result.compacted).toContain('src/router/canonical-router.js:45');
    expect(result.compacted).toContain('src/index.js:120');
  });

  it('should filter node_modules and internal frames', () => {
    const result = compactTrace(sampleStack);

    expect(result.compacted).not.toContain('node_modules');
    expect(result.compacted).not.toContain('node:internal');
  });

  it('should report stats', () => {
    const result = compactTrace(sampleStack);

    expect(result.stats.projectFrames).toBe(2);
    expect(result.stats.filteredFrames).toBe(3);
    expect(result.stats.totalFrames).toBe(5);
  });

  it('should detect duplicates', () => {
    const first = compactTrace(sampleStack);
    const second = compactTrace(sampleStack);

    expect(first.isDuplicate).toBe(false);
    expect(second.isDuplicate).toBe(true);
    expect(second.compacted).toContain('duplicate');
  });

  it('should skip dedup when disabled', () => {
    compactTrace(sampleStack);
    const second = compactTrace(sampleStack, { dedupe: false });

    expect(second.isDuplicate).toBe(false);
  });

  it('should respect maxProjectFrames', () => {
    const manyFrames = [
      'Error: test',
      '    at a (src/a.js:1:1)',
      '    at b (src/b.js:2:1)',
      '    at c (src/c.js:3:1)',
      '    at d (src/d.js:4:1)',
      '    at e (src/e.js:5:1)',
      '    at f (src/f.js:6:1)'
    ].join('\n');

    const result = compactTrace(manyFrames, { maxProjectFrames: 2 });

    expect(result.stats.keptFrames).toBe(2);
    expect(result.compacted).toContain('+4 more project frames');
  });

  it('should accept Error objects', () => {
    const err = new Error('test');
    const result = compactTrace(err);

    expect(result.compacted).toContain('Error: test');
    expect(result.fingerprint).toMatch(/^[0-9a-f]{12}$/);
  });

  it('should return frozen result', () => {
    const result = compactTrace(sampleStack);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.stats)).toBe(true);
  });
});

describe('clearFingerprints / getFingerprintCount', () => {
  beforeEach(() => {
    clearFingerprints();
  });

  it('should track fingerprint count', () => {
    expect(getFingerprintCount()).toBe(0);

    compactTrace('Error: a\n    at src/x.js:1:1');
    expect(getFingerprintCount()).toBe(1);

    compactTrace('Error: b\n    at src/y.js:2:2');
    expect(getFingerprintCount()).toBe(2);
  });

  it('should clear all fingerprints', () => {
    compactTrace('Error: a\n    at src/x.js:1:1');
    clearFingerprints();
    expect(getFingerprintCount()).toBe(0);
  });
});
