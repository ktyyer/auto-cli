import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PerformanceMonitor } from '../src/utils/perf.js';

describe('PerformanceMonitor', () => {
  let monitor;

  beforeEach(() => {
    monitor = new PerformanceMonitor();
  });

  afterEach(() => {
    monitor.clear();
  });

  describe('基础功能', () => {
    it('应该能够开始和结束计时', () => {
      monitor.start('test-operation');
      const result = monitor.end('test-operation');

      expect(result.label).toBe('test-operation');
      expect(result.duration).toMatch(/\d+\.\d+ms/);
      expect(result.memoryUsed).toMatch(/\d+\.\d+MB/);
    });

    it('应该在多次调用 start 时覆盖之前的计时', () => {
      monitor.start('test');
      monitor.start('test'); // 覆盖
      const result = monitor.end('test');

      expect(result).toBeDefined();
    });
  });

  describe('错误处理', () => {
    it('应该在 end 未匹配的 label 时抛出错误', () => {
      expect(() => {
        monitor.end('nonexistent');
      }).toThrow('Timer "nonexistent" not found');
    });
  });

  describe('measure 方法', () => {
    it('应该能够测量同步函数执行时间', async () => {
      const result = await monitor.measure('sync-task', async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return 'done';
      });

      expect(result).toBe('done');
      expect(monitor.getMeasurements().length).toBe(1);
    });

    it('应该能够处理函数错误并清理计时器', async () => {
      await expect(
        monitor.measure('error-task', async () => {
          throw new Error('Test error');
        })
      ).rejects.toThrow('Test error');

      expect(monitor.timers.has('error-task')).toBe(false);
    });
  });

  describe('测量结果管理', () => {
    it('应该能够获取所有测量结果', () => {
      monitor.start('task1');
      monitor.end('task1');

      monitor.start('task2');
      monitor.end('task2');

      const measurements = monitor.getMeasurements();
      expect(measurements).toHaveLength(2);
    });

    it('应该能够清空所有测量结果', () => {
      monitor.start('task');
      monitor.end('task');

      monitor.clear();

      expect(monitor.getMeasurements()).toHaveLength(0);
      expect(monitor.timers.size).toBe(0);
    });
  });

  describe('报告功能', () => {
    it('应该能够生成性能报告', () => {
      monitor.start('operation1');
      monitor.end('operation1');

      monitor.start('operation2');
      monitor.end('operation2');

      // 测试 report 不抛出错误
      expect(() => {
        monitor.report();
      }).not.toThrow();
    });

    it('应该在无测量数据时显示提示信息', () => {
      const consoleSpy = vi.spyOn(console, 'log');

      monitor.report();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('No performance measurements')
      );
    });
  });

  describe('实际用例', () => {
    it('应该能够测量数组操作的性能', async () => {
      const largeArray = Array.from({ length: 10000 }, (_, i) => i);

      const result = await monitor.measure('array-filter', async () => {
        return largeArray.filter((n) => n % 2 === 0);
      });

      expect(result.length).toBeGreaterThan(0);
    });

    it('应该能够测量对象操作的性能', async () => {
      const data = { a: 1, b: 2, c: 3 };

      await monitor.measure('object-keys', async () => {
        return Object.keys(data);
      });
    });
  });
});
