/**
 * 性能监测工具
 *
 * 用于测量代码执行时间和内存使用情况
 */

class PerformanceMonitor {
  constructor() {
    this.timers = new Map();
    this.measurements = new Map();
  }

  /**
   * 开始计时
   * @param {string} label - 计时标签
   */
  start(label) {
    this.timers.set(label, {
      start: performance.now(),
      memoryStart: process.memoryUsage()
    });
  }

  /**
   * 结束计时并返回结果
   * @param {string} label - 计时标签
   * @returns {Object} 性能数据
   */
  end(label) {
    const timer = this.timers.get(label);
    if (!timer) {
      throw new Error(`Timer "${label}" not found. Call start() first.`);
    }

    const end = performance.now();
    const memoryEnd = process.memoryUsage();

    const duration = end - timer.start;
    const memoryUsed = memoryEnd.heapUsed - timer.memoryStart.heapUsed;

    const result = {
      label,
      duration: `${duration.toFixed(2)}ms`,
      memoryUsed: `${(memoryUsed / 1024 / 1024).toFixed(2)}MB`,
      timestamp: new Date().toISOString()
    };

    this.measurements.set(label, result);
    this.timers.delete(label);

    return result;
  }

  /**
   * 测量异步函数的执行时间
   * @param {string} label - 测量标签
   * @param {Function} fn - 异步函数
   * @returns {Promise<any>} 函数执行结果
   */
  async measure(label, fn) {
    this.start(label);
    try {
      const result = await fn();
      const perf = this.end(label);
      console.log(`[${label}] ${perf.duration} (内存: ${perf.memoryUsed})`);
      return result;
    } catch (error) {
      this.timers.delete(label);
      throw error;
    }
  }

  /**
   * 获取所有测量结果
   * @returns {Array} 测量结果列表
   */
  getMeasurements() {
    return Array.from(this.measurements.values());
  }

  /**
   * 清空所有测量结果
   */
  clear() {
    this.measurements.clear();
    this.timers.clear();
  }

  /**
   * 输出性能报告
   */
  report() {
    const measurements = this.getMeasurements();
    if (measurements.length === 0) {
      console.log('No performance measurements recorded.');
      return;
    }

    console.log('\n性能报告:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    measurements.forEach((m, index) => {
      console.log(`${index + 1}. ${m.label}`);
      console.log(`   执行时间: ${m.duration}`);
      console.log(`   内存使用: ${m.memoryUsed}`);
      console.log(`   时间戳: ${m.timestamp}`);
    });

    const totalDuration = measurements
      .reduce((sum, m) => sum + parseFloat(m.duration), 0)
      .toFixed(2);

    console.log(`\n总计: ${measurements.length} 次测量`);
    console.log(`总耗时: ${totalDuration}ms`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  }
}

// 创建默认实例
const perfMonitor = new PerformanceMonitor();

export { PerformanceMonitor, perfMonitor };
export default perfMonitor;
