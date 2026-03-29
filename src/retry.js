/**
 * 重试和降级工具模块
 * 提供网络请求、文件操作等场景的重试和降级策略
 */

/**
 * @typedef {Object} RetryOptions
 * @property {number} [maxRetries=3] - 最大重试次数
 * @property {number} [delay=1000] - 初始重试延迟（毫秒）
 * @property {number} [maxDelay=30000] - 最大重试延迟（毫秒）
 * @property {number} [backoffFactor=2] - 退避因子（每次重试延迟乘以该值）
 * @property {boolean} [jitter=true] - 是否添加随机抖动
 * @property {Function} [shouldRetry] - 判断是否应该重试的函数
 * @property {Function} [onRetry] - 每次重试时的回调
 * @property {Function} [onFailure] - 最终失败时的回调
 */

/**
 * 默认重试配置
 * @type {RetryOptions}
 */
const DEFAULT_RETRY_OPTIONS = {
  maxRetries: 3,
  delay: 1000,
  maxDelay: 30000,
  backoffFactor: 2,
  jitter: true,
  shouldRetry: (error) => {
    // 默认对网络错误和 5xx 错误重试
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
      return true;
    }
    if (error.response && error.response.status >= 500) {
      return true;
    }
    return false;
  }
};

/**
 * 计算下一次重试的延迟时间
 * @param {number} attempt - 当前尝试次数
 * @param {RetryOptions} options - 重试配置
 * @returns {number} 延迟时间（毫秒）
 */
function calculateDelay(attempt, options) {
  const { delay, maxDelay, backoffFactor, jitter } = options;
  let nextDelay = delay * Math.pow(backoffFactor, attempt - 1);
  nextDelay = Math.min(nextDelay, maxDelay);

  if (jitter) {
    // 添加 ±25% 的随机抖动
    nextDelay = nextDelay * (0.75 + Math.random() * 0.5);
  }

  return Math.floor(nextDelay);
}

/**
 * 延迟函数
 * @param {number} ms - 延迟时间（毫秒）
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 带重试机制的异步函数执行器
 * @template T
 * @param {() => Promise<T>} fn - 要执行的异步函数
 * @param {RetryOptions} [options={}] - 重试配置
 * @returns {Promise<T>} 函数执行结果
 * @throws {Error} 所有重试失败后抛出最后一个错误
 *
 * @example
 * // 基本用法
 * const result = await retry(() => fetch('/api/data'));
 *
 * // 自定义重试配置
 * const result = await retry(() => fetch('/api/data'), {
 *   maxRetries: 5,
 *   delay: 2000,
 *   shouldRetry: (error) => error.status !== 404
 * });
 */
export async function retry(fn, options = {}) {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError;

  for (let attempt = 1; attempt <= opts.maxRetries + 1; attempt++) {
    try {
      const result = await fn();
      return result;
    } catch (error) {
      lastError = error;

      // 检查是否应该重试
      if (attempt <= opts.maxRetries && (!opts.shouldRetry || opts.shouldRetry(error))) {
        const waitTime = calculateDelay(attempt, opts);

        if (opts.onRetry) {
          opts.onRetry(error, attempt, waitTime);
        }

        await delay(waitTime);
      } else {
        break;
      }
    }
  }

  if (opts.onFailure) {
    opts.onFailure(lastError);
  }

  throw lastError;
}

/**
 * 带降级策略的异步函数执行器
 * @template T
 * @param {() => Promise<T>} primaryFn - 主要函数
 * @param {() => Promise<T>|T} fallbackFn - 降级函数
 * @param {Object} [options={}] - 配置选项
 * @param {Function} [options.shouldFallback] - 判断是否应该降级的函数
 * @param {Function} [options.onFallback] - 降级时的回调
 * @returns {Promise<T>} 函数执行结果
 *
 * @example
 * // 基本用法
 * const data = await withFallback(
 *   () => fetchFromAPI(),
 *   () => fetchFromCache()
 * );
 *
 * // 带条件判断
 * const data = await withFallback(
 *   () => fetchFromAPI(),
 *   () => getMockData(),
 *   {
 *     shouldFallback: (error) => error.code === 'ECONNREFUSED'
 *   }
 * );
 */
export async function withFallback(primaryFn, fallbackFn, options = {}) {
  const { shouldFallback, onFallback } = options;

  try {
    return await primaryFn();
  } catch (error) {
    if (shouldFallback && !shouldFallback(error)) {
      throw error;
    }

    if (onFallback) {
      onFallback(error);
    }

    return await fallbackFn();
  }
}

/**
 * 带重试和降级策略的异步函数执行器
 * @template T
 * @param {() => Promise<T>} fn - 要执行的异步函数
 * @param {() => Promise<T>|T} fallbackFn - 降级函数
 * @param {RetryOptions} [retryOptions={}] - 重试配置
 * @returns {Promise<T>} 函数执行结果
 *
 * @example
 * const result = await retryWithFallback(
 *   () => fetch('/api/data'),
 *   () => getCachedData()
 * );
 */
export async function retryWithFallback(fn, fallbackFn, retryOptions = {}) {
  try {
    return await retry(fn, retryOptions);
  } catch {
    // 重试失败，使用降级方案
    return await fallbackFn();
  }
}

/**
 * 批量重试多个异步函数
 * @template T
 * @param {Array<() => Promise<T>>} fns - 要执行的异步函数数组
 * @param {RetryOptions} [options={}] - 重试配置
 * @returns {Promise<{successful: Array<{index: number, result: T}>, failed: Array<{index: number, error: Error}>}>}
 */
export async function retryAll(fns, options = {}) {
  const results = {
    successful: [],
    failed: []
  };

  for (let i = 0; i < fns.length; i++) {
    try {
      const result = await retry(fns[i], options);
      results.successful.push({ index: i, result });
    } catch (error) {
      results.failed.push({ index: i, error });
    }
  }

  return results;
}

/**
 * 创建一个带重试包装的函数
 * @template {Function} T
 * @param {T} fn - 要包装的函数
 * @param {RetryOptions} [options={}] - 重试配置
 * @returns {T} 带重试功能的包装函数
 *
 * @example
 * const fetchWithRetry = createRetryWrapper(fetch);
 * const response = await fetchWithRetry('/api/data');
 */
export function createRetryWrapper(fn, options = {}) {
  return (...args) => retry(() => fn(...args), options);
}

export { DEFAULT_RETRY_OPTIONS };
export default { retry, withFallback, retryWithFallback, retryAll, createRetryWrapper };
