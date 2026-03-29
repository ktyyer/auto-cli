/**
 * TodoList 管理器
 *
 * 核心功能：
 * - CRUD 操作：增删改查 Todo 项
 * - 依赖感知排序：自动检测循环依赖，阻塞未满足依赖的项
 * - 跨会话持久化：JSON 文件存储到 .auto/todos/ 目录
 * - 进度统计：完成率、阻塞项、下一步建议
 *
 * 灵感来源：
 * - Claude Code 官方 TodoLists（依赖感知 + 跨会话持久化）
 * - linux.do 社区验证："TodoList 比 mental model 可靠 10 倍"
 */
import path from 'node:path';
import fs from 'fs-extra';
import { logger } from '../logger.js';
import { TODO_STATES, TODO_PRIORITIES } from './todo-types.js';

const TODOS_DIR_NAME = '.auto/todos';
const MAX_DEPTH = 50;

/**
 * 生成唯一 ID
 * @returns {string}
 */
function generateId() {
  return `todo_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export class TodoManager {
  /**
   * @param {string} [projectDir] - 项目根目录
   */
  constructor(projectDir) {
    this.projectDir = projectDir || process.cwd();
    this.todosDir = path.join(this.projectDir, TODOS_DIR_NAME);
    this.logger = logger;
    this._snapshot = null;
    this._filePath = null;
  }

  /**
   * 初始化：加载或创建快照
   * @param {string} taskName - 任务名称
   * @returns {Promise<import('./todo-types.js').TodoListSnapshot>}
   */
  async initialize(taskName) {
    if (!taskName || typeof taskName !== 'string' || taskName.trim().length === 0) {
      throw new Error('taskName 不能为空');
    }

    await fs.ensureDir(this.todosDir);

    // 查找已有的活跃快照（未全部完成的）
    const files = await fs.readdir(this.todosDir);
    const activeFile = files.find((f) => f.startsWith('active_'));

    if (activeFile) {
      this._filePath = path.join(this.todosDir, activeFile);
      try {
        this._snapshot = await fs.readJson(this._filePath);
        this.logger.info(
          `TodoList 已加载: ${this._snapshot.items.length} 项, 任务="${this._snapshot.taskName}"`
        );
        return this._snapshot;
      } catch (error) {
        this.logger.warn(`加载 TodoList 失败: ${error.message}, 将创建新快照`);
      }
    }

    // 创建新快照
    this._snapshot = {
      id: generateId(),
      taskName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items: [],
      meta: { source: 'auto-cli', version: '1.0.0' }
    };
    this._filePath = path.join(this.todosDir, `active_${this._snapshot.id}.json`);
    await this._save();
    this.logger.info(`TodoList 已创建: 任务="${taskName}"`);
    return this._snapshot;
  }

  /**
   * 添加 Todo 项
   * @param {Object} params
   * @param {string} params.content - 任务描述
   * @param {string} [params.questId] - 关联 Quest ID
   * @param {string[]} [params.dependsOn] - 依赖的 Todo ID
   * @param {string} [params.priority] - 优先级
   * @param {string[]} [params.tags] - 标签
   * @param {string} [params.note] - 附加说明
   * @returns {Promise<import('./todo-types.js').TodoItem>}
   */
  async add({
    content,
    questId,
    dependsOn = [],
    priority = TODO_PRIORITIES.MEDIUM,
    tags = [],
    note
  }) {
    this._ensureInitialized();

    // 输入验证
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      throw new Error('content 不能为空');
    }

    // 校验依赖是否存在
    for (const depId of dependsOn) {
      if (!this._snapshot.items.some((item) => item.id === depId)) {
        throw new Error(`依赖项不存在: ${depId}`);
      }
    }

    const item = {
      id: generateId(),
      content,
      status: TODO_STATES.PENDING,
      priority,
      dependsOn,
      questId: questId || '',
      tags,
      note: note || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this._snapshot.items.push(item);

    // 检查依赖是否自动阻塞
    if (this._hasUnmetDependencies(item)) {
      item.status = TODO_STATES.BLOCKED;
    }

    await this._save();
    this.logger.info(`Todo 已添加: [${item.id}] ${content}`);
    return item;
  }

  /**
   * 更新 Todo 项状态
   * @param {string} id - Todo ID
   * @param {string} status - 新状态
   * @returns {Promise<import('./todo-types.js').TodoItem|null>}
   */
  async updateStatus(id, status) {
    this._ensureInitialized();

    const item = this._snapshot.items.find((i) => i.id === id);
    if (!item) {
      this.logger.warn(`Todo 不存在: ${id}`);
      return null;
    }

    // 状态转换校验
    if (status === TODO_STATES.IN_PROGRESS && this._hasUnmetDependencies(item)) {
      throw new Error(`无法开始: 存在未完成的依赖项`);
    }

    item.status = status;
    item.updatedAt = new Date().toISOString();
    if (status === TODO_STATES.COMPLETED) {
      item.completedAt = new Date().toISOString();
    }

    // 完成后解除下游阻塞
    if (status === TODO_STATES.COMPLETED) {
      this._unblockDependents(id);
    }

    await this._save();
    this.logger.info(`Todo 状态更新: [${id}] -> ${status}`);
    return item;
  }

  /**
   * 获取下一个可执行的 Todo（依赖已满足 + 优先级最高）
   * @returns {import('./todo-types.js').TodoItem|null}
   */
  getNext() {
    this._ensureInitialized();

    const candidates = this._snapshot.items.filter(
      (item) => item.status === TODO_STATES.PENDING && !this._hasUnmetDependencies(item)
    );

    if (candidates.length === 0) {
      return null;
    }

    // 按优先级排序
    const priorityOrder = {
      [TODO_PRIORITIES.CRITICAL]: 0,
      [TODO_PRIORITIES.HIGH]: 1,
      [TODO_PRIORITIES.MEDIUM]: 2,
      [TODO_PRIORITIES.LOW]: 3
    };

    candidates.sort((a, b) => (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2));
    return candidates[0];
  }

  /**
   * 获取进度统计
   * @returns {{ total: number, completed: number, inProgress: number, blocked: number, pending: number, completionPercent: number }}
   */
  getStats() {
    this._ensureInitialized();

    const items = this._snapshot.items;
    const total = items.length;
    if (total === 0) {
      return {
        total: 0,
        completed: 0,
        inProgress: 0,
        blocked: 0,
        pending: 0,
        completionPercent: 0
      };
    }

    const completed = items.filter((i) => i.status === TODO_STATES.COMPLETED).length;
    const inProgress = items.filter((i) => i.status === TODO_STATES.IN_PROGRESS).length;
    const blocked = items.filter((i) => i.status === TODO_STATES.BLOCKED).length;
    const pending = items.filter((i) => i.status === TODO_STATES.PENDING).length;

    return {
      total,
      completed,
      inProgress,
      blocked,
      pending,
      completionPercent: Math.round((completed / total) * 100)
    };
  }

  /**
   * 获取拓扑排序后的 Todo 列表（依赖在前，被依赖在后）
   * @returns {import('./todo-types.js').TodoItem[]}
   */
  getSorted() {
    this._ensureInitialized();

    const items = this._snapshot.items;
    const idToItem = new Map(items.map((i) => [i.id, i]));
    const visited = new Set();
    const result = [];

    const visit = (item, depth = 0) => {
      if (depth > MAX_DEPTH) {
        throw new Error(`拓扑排序深度超过 ${MAX_DEPTH}，可能存在循环依赖`);
      }
      if (visited.has(item.id)) return;
      visited.add(item.id);

      for (const depId of item.dependsOn) {
        const dep = idToItem.get(depId);
        if (dep) visit(dep, depth + 1);
      }

      result.push(item);
    };

    for (const item of items) {
      visit(item);
    }

    return result;
  }

  /**
   * 导出为 Markdown 格式的进度报告
   * @returns {string}
   */
  toMarkdown() {
    this._ensureInitialized();
    const stats = this.getStats();
    const next = this.getNext();
    const sorted = this.getSorted();

    const lines = [
      `# TodoList: ${this._snapshot.taskName}`,
      '',
      `**进度**: ${stats.completed}/${stats.total} (${stats.completionPercent}%)`,
      `**阻塞**: ${stats.blocked} 项 | **进行中**: ${stats.inProgress} 项`,
      ''
    ];

    if (next) {
      lines.push(`**下一步**: [${next.questId || next.id}] ${next.content}`);
      lines.push('');
    }

    for (const item of sorted) {
      const statusIcon =
        {
          [TODO_STATES.COMPLETED]: '[x]',
          [TODO_STATES.IN_PROGRESS]: '[>]',
          [TODO_STATES.BLOCKED]: '[!]',
          [TODO_STATES.CANCELLED]: '[-]',
          [TODO_STATES.PENDING]: '[ ]'
        }[item.status] || '[ ]';

      const questLabel = item.questId ? ` **${item.questId}**` : '';
      const depLabel = item.dependsOn.length > 0 ? ` (依赖: ${item.dependsOn.join(', ')})` : '';
      lines.push(`- ${statusIcon}${questLabel} ${item.content}${depLabel}`);
    }

    return lines.join('\n');
  }

  /**
   * 归档已完成的快照
   * @returns {Promise<string>} 归档文件路径
   */
  async archive() {
    this._ensureInitialized();

    const stats = this.getStats();
    if (stats.completionPercent < 100) {
      this.logger.warn(`TodoList 未全部完成 (${stats.completionPercent}%), 归档前请确认`);
    }

    const archiveName = `archived_${this._snapshot.id}.json`;
    const archivePath = path.join(this.todosDir, archiveName);
    await fs.move(this._filePath, archivePath);

    this.logger.info(`TodoList 已归档: ${archivePath}`);
    return archivePath;
  }

  /**
   * 获取当前快照（只读）
   * @returns {import('./todo-types.js').TodoListSnapshot|null}
   */
  getSnapshot() {
    return this._snapshot;
  }

  /**
   * 检查依赖是否全部满足
   * @param {import('./todo-types.js').TodoItem} item
   * @returns {boolean}
   * @private
   */
  _hasUnmetDependencies(item) {
    return item.dependsOn.some((depId) => {
      const dep = this._snapshot.items.find((i) => i.id === depId);
      return !dep || dep.status !== TODO_STATES.COMPLETED;
    });
  }

  /**
   * 解除下游阻塞
   * @param {string} completedId
   * @private
   */
  _unblockDependents(completedId) {
    for (const item of this._snapshot.items) {
      if (item.status === TODO_STATES.BLOCKED && item.dependsOn.includes(completedId)) {
        if (!this._hasUnmetDependencies(item)) {
          item.status = TODO_STATES.PENDING;
          item.updatedAt = new Date().toISOString();
        }
      }
    }
  }

  /**
   * 保存快照到磁盘
   * @private
   */
  async _save() {
    if (!this._snapshot || !this._filePath) return;

    this._snapshot.updatedAt = new Date().toISOString();
    await fs.writeJson(this._filePath, this._snapshot, { spaces: 2 });
  }

  /**
   * 确保已初始化
   * @private
   */
  _ensureInitialized() {
    if (!this._snapshot) {
      throw new Error('TodoManager 未初始化，请先调用 initialize()');
    }
  }
}

export default TodoManager;
