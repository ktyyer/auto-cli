/**
 * TypeScript 类型定义
 * 为 JavaScript 代码提供类型提示
 */

export interface LoopState {
  run_id: string;
  task: string;
  current_state: string;
  current_step_index: number;
  steps_total: number;
  steps: string[];
  retries: Record<string, number>;
  gates: Record<string, string>;
  next_action: string;
  artifacts: unknown[];
  updated_at: string;
}

/**
 * 组件定义（与 utils.js COMPONENTS 对象匹配）
 */
export interface Component {
  /** 显示名称，如 'Agents（代理）' */
  name: string;
  /** 描述文本 */
  description: string;
  /** 源目录名（相对于项目根目录） */
  source: string;
  /** 目标目录名（相对于 .claude 目录） */
  target: string;
  /** 文件匹配模式，如 '*.md' 或 '**/*' */
  pattern: string;
  /** 是否递归复制子目录 */
  recursive?: boolean;
}

/**
 * 安装选项（与 installer.js install() 函数的 options 参数匹配）
 */
export interface InstallOptions {
  /** 是否备份已存在的文件（默认 true） */
  backup?: boolean;
  /** 是否强制覆盖（默认 false） */
  force?: boolean;
}

/**
 * 安装结果（与 installer.js install() 函数的返回值匹配）
 */
export interface InstallResult {
  /** 成功安装的文件绝对路径列表 */
  installedFiles: string[];
  /** 跳过的文件绝对路径列表（已存在且未 force） */
  skippedFiles: string[];
}

/**
 * 组件安装状态（与 installer.js checkStatus() 返回值匹配）
 */
export interface ComponentStatus {
  /** 是否已安装（文件数量 > 0） */
  installed: boolean;
  /** 目标路径 */
  path: string;
  /** 已安装文件数量 */
  fileCount: number;
}

/**
 * 版本信息（与 utils.js getInstalledVersion() 返回值匹配）
 */
export interface InstalledVersion {
  /** 安装时的包版本号 */
  version: string;
  /** 安装的组件 key 列表 */
  components: string[];
  /** 安装的文件绝对路径列表 */
  installedFiles: string[];
  /** 安装时间 ISO 字符串 */
  installedAt: string;
}
