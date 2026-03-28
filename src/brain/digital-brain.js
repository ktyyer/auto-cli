/**
 * 数字大脑 - 个人知识库
 *
 * 核心功能：
 * - 管理身份、人脉、创意、复盘等非项目知识
 * - 支持关联检索和推荐
 * - JSON 文件存储
 */
import path from 'path';
import fs from 'fs-extra';
import { logger } from '../logger.js';

/**
 * @typedef {Object} Identity
 * @property {string} id - 唯一标识
 * @property {string} title - 标题
 * @property {string[]} skills - 核心能力
 * @property {string} goals - 职业目标
 * @property {string} createdAt - 创建时间
 */

/**
 * @typedef {Object} NetworkContact
 * @property {string} id - 唯一标识
 * @property {string} name - 姓名
 * @property {string} role - 角色
 * @property {string} company - 公司
 * @property {string[]} tags - 标签
 * @property {string} lastContact - 最后联系时间
 * @property {string[]} collaborations - 协作历史
 * @property {string} createdAt - 创建时间
 */

/**
 * @typedef {Object} Idea
 * @property {string} id - 唯一标识
 * @property {string} title - 标题
 * @property {string} description - 描述
 * @property {string[]} tags - 标签
 * @property {string} status - 状态（idea/planning/in-progress/completed）
 * @property {string} createdAt - 创建时间
 */

/**
 * @typedef {Object} Review
 * @property {string} id - 唯一标识
 * @property {string} period - 复盘周期（如 2026-Q1）
 * @property {string} summary - 总结
 * @property {string[]} achievements - 成就
 * @property {string[]} improvements - 改进点
 * @property {string} createdAt - 创建时间
 */

class DigitalBrain {
  /**
   * @param {string} [projectDir] - 项目根目录
   */
  constructor(projectDir) {
    this.projectDir = projectDir || process.cwd();
    this.brainDir = path.join(this.projectDir, '.auto', 'brain');
  }

  /**
   * 确保目录结构存在
   * @returns {Promise<string>} brain 目录路径
   */
  async ensureStructure() {
    await fs.ensureDir(this.brainDir);

    // 为每种类型创建空文件（如果不存在）
    const types = ['identity.json', 'network.json', 'ideas.json', 'reviews.json'];
    for (const file of types) {
      const filePath = path.join(this.brainDir, file);
      if (!(await fs.pathExists(filePath))) {
        await fs.writeJson(filePath, [], { spaces: 2 });
      }
    }

    return this.brainDir;
  }

  /**
   * 添加身份定位
   * @param {string} title - 标题
   * @param {Object} options - 选项
   * @param {string[]} [options.skills] - 核心能力
   * @param {string} [options.goals] - 职业目标
   * @returns {Promise<Identity>} 创建的身份
   */
  async addIdentity(title, options = {}) {
    await this.ensureStructure();

    const identity = {
      id: this._generateId(),
      title,
      skills: options.skills || [],
      goals: options.goals || '',
      createdAt: new Date().toISOString()
    };

    const filePath = path.join(this.brainDir, 'identity.json');
    const identities = await fs.readJson(filePath);
    identities.push(identity);
    await fs.writeJson(filePath, identities, { spaces: 2 });

    logger.info(`身份定位已添加: ${title}`);
    return identity;
  }

  /**
   * 添加人脉联系人
   * @param {string} name - 姓名
   * @param {Object} options - 选项
   * @param {string} [options.role] - 角色
   * @param {string} [options.company] - 公司
   * @param {string[]} [options.tags] - 标签
   * @returns {Promise<NetworkContact>} 创建的联系人
   */
  async addContact(name, options = {}) {
    await this.ensureStructure();

    const contact = {
      id: this._generateId(),
      name,
      role: options.role || '',
      company: options.company || '',
      tags: options.tags || [],
      lastContact: options.lastContact || '',
      collaborations: options.collaborations || [],
      createdAt: new Date().toISOString()
    };

    const filePath = path.join(this.brainDir, 'network.json');
    const network = await fs.readJson(filePath);
    network.push(contact);
    await fs.writeJson(filePath, network, { spaces: 2 });

    logger.info(`联系人已添加: ${name}`);
    return contact;
  }

  /**
   * 添加创意
   * @param {string} title - 标题
   * @param {Object} options - 选项
   * @param {string} [options.description] - 描述
   * @param {string[]} [options.tags] - 标签
   * @param {string} [options.status] - 状态
   * @returns {Promise<Idea>} 创建的创意
   */
  async addIdea(title, options = {}) {
    await this.ensureStructure();

    const idea = {
      id: this._generateId(),
      title,
      description: options.description || '',
      tags: options.tags || [],
      status: options.status || 'idea',
      createdAt: new Date().toISOString()
    };

    const filePath = path.join(this.brainDir, 'ideas.json');
    const ideas = await fs.readJson(filePath);
    ideas.push(idea);
    await fs.writeJson(filePath, ideas, { spaces: 2 });

    logger.info(`创意已添加: ${title}`);
    return idea;
  }

  /**
   * 添加复盘记录
   * @param {string} period - 复盘周期
   * @param {Object} options - 选项
   * @param {string} [options.summary] - 总结
   * @param {string[]} [options.achievements] - 成就
   * @param {string[]} [options.improvements] - 改进点
   * @returns {Promise<Review>} 创建的复盘
   */
  async addReview(period, options = {}) {
    await this.ensureStructure();

    const review = {
      id: this._generateId(),
      period,
      summary: options.summary || '',
      achievements: options.achievements || [],
      improvements: options.improvements || [],
      createdAt: new Date().toISOString()
    };

    const filePath = path.join(this.brainDir, 'reviews.json');
    const reviews = await fs.readJson(filePath);
    reviews.push(review);
    await fs.writeJson(filePath, reviews, { spaces: 2 });

    logger.info(`复盘已添加: ${period}`);
    return review;
  }

  /**
   * 搜索联系人
   * @param {string} query - 搜索关键词
   * @returns {Promise<NetworkContact[]>} 匹配的联系人
   */
  async searchContacts(query) {
    await this.ensureStructure();

    const filePath = path.join(this.brainDir, 'network.json');
    const network = await fs.readJson(filePath);
    const lowerQuery = query.toLowerCase();

    return network.filter((contact) => {
      return (
        contact.name.toLowerCase().includes(lowerQuery) ||
        contact.role.toLowerCase().includes(lowerQuery) ||
        contact.company.toLowerCase().includes(lowerQuery) ||
        contact.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
      );
    });
  }

  /**
   * 搜索创意
   * @param {string} query - 搜索关键词
   * @returns {Promise<Idea[]>} 匹配的创意
   */
  async searchIdeas(query) {
    await this.ensureStructure();

    const filePath = path.join(this.brainDir, 'ideas.json');
    const ideas = await fs.readJson(filePath);
    const lowerQuery = query.toLowerCase();

    return ideas.filter((idea) => {
      return (
        idea.title.toLowerCase().includes(lowerQuery) ||
        idea.description.toLowerCase().includes(lowerQuery) ||
        idea.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
      );
    });
  }

  /**
   * 获取统计信息
   * @returns {Promise<Object>} 统计数据
   */
  async getStats() {
    await this.ensureStructure();

    const [identities, network, ideas, reviews] = await Promise.all([
      fs.readJson(path.join(this.brainDir, 'identity.json')),
      fs.readJson(path.join(this.brainDir, 'network.json')),
      fs.readJson(path.join(this.brainDir, 'ideas.json')),
      fs.readJson(path.join(this.brainDir, 'reviews.json'))
    ]);

    return {
      identities: identities.length,
      network: network.length,
      ideas: ideas.length,
      reviews: reviews.length,
      total: identities.length + network.length + ideas.length + reviews.length
    };
  }

  /**
   * 生成唯一 ID
   * @returns {string} UUID
   * @private
   */
  _generateId() {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}

export { DigitalBrain };
export default DigitalBrain;
