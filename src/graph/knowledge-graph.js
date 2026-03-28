/**
 * 知识图谱 - 跨项目知识积累和检索
 *
 * 核心功能：
 * - 从 KnowledgeSteward 生成的知识文件中提取实体
 * - 构建实体关系图谱
 * - 支持跨项目查询和汇总
 */
import path from 'path';
import fs from 'fs-extra';
import { logger } from '../logger.js';
import { extractEntities, ENTITY_TYPES, ENTITY_TYPE_LABELS } from './entity-types.js';

/**
 * @typedef {Object} Entity
 * @property {string} name - 实体名称
 * @property {string} type - 实体类型
 * @property {number} occurrences - 出现次数
 * @property {string[]} projects - 关联的项目列表
 * @property {Object.<string, string[]>} related - 相关实体（按关系类型分组）
 */

/**
 * @typedef {Object} Relation
 * @property {string} from - 源实体
 * @property {string} to - 目标实体
 * @property {string} type - 关系类型
 * @property {number} weight - 关系权重
 */

/**
 * @typedef {Object} GraphData
 * @property {Object.<string, Entity>} entities - 实体集合
 * @property {Relation[]} relations - 关系列表
 * @property {Object.<string, string[]>} projectIndex - 项目到实体的反向索引
 */

class KnowledgeGraph {
  /**
   * @param {string} [projectDir] - 项目根目录
   */
  constructor(projectDir) {
    this.projectDir = projectDir || process.cwd();
    this.graphDir = path.join(this.projectDir, '.auto', 'graph');
    this.insightsDir = path.join(this.projectDir, '.auto', 'insights');
  }

  /**
   * 确保图谱目录存在
   * @returns {Promise<string>} 图谱目录路径
   */
  async ensureStructure() {
    await fs.ensureDir(this.graphDir);
    return this.graphDir;
  }

  /**
   * 从项目中提取知识图谱
   * @param {string} [projectName] - 项目名称（默认为目录名）
   * @returns {Promise<GraphData>} 图谱数据
   */
  async extractFromProject(projectName) {
    await this.ensureStructure();

    // 使用目录名作为项目名
    const name = projectName || path.basename(this.projectDir);
    logger.info(`开始从项目 "${name}" 提取知识图谱...`);

    const entities = {};
    const relations = [];
    const projectIndex = { [name]: [] };

    // 读取所有 insights 文件
    const insightFiles = await this._getInsightFiles();

    for (const filePath of insightFiles) {
      const content = await fs.readFile(filePath, 'utf-8');
      const extracted = this._extractFromContent(content, name);

      // 合并实体
      for (const entity of extracted.entities) {
        if (!entities[entity.name]) {
          entities[entity.name] = {
            name: entity.name,
            type: entity.type,
            occurrences: 0,
            projects: [],
            related: {}
          };
        }

        entities[entity.name].occurrences += entity.occurrences;

        if (!entities[entity.name].projects.includes(name)) {
          entities[entity.name].projects.push(name);
        }

        if (!projectIndex[name].includes(entity.name)) {
          projectIndex[name].push(entity.name);
        }
      }

      // 合并关系
      relations.push(...extracted.relations);
    }

    const graphData = { entities, relations, projectIndex };

    // 保存图谱数据
    await this._saveGraph(graphData);

    logger.info(
      `知识图谱提取完成：${Object.keys(entities).length} 个实体，${relations.length} 个关系`
    );

    return graphData;
  }

  /**
   * 查询图谱
   * @param {string} query - 查询关键词
   * @param {Object} options - 查询选项
   * @param {string} [options.type] - 过滤实体类型
   * @param {number} [options.limit=10] - 返回结果数量限制
   * @returns {Promise<Array<{entity: Entity, score: number}>>} 匹配的实体列表
   */
  async query(query, options = {}) {
    const { type, limit = 10 } = options;
    const graphData = await this._loadGraph();

    if (!graphData) {
      logger.warn('图谱数据不存在，请先运行 extractFromProject()');
      return [];
    }

    const lowerQuery = query.toLowerCase();
    const results = [];

    for (const entityName of Object.keys(graphData.entities)) {
      const entity = graphData.entities[entityName];

      // 类型过滤
      if (type && entity.type !== type) {
        continue;
      }

      // 关键词匹配
      let score = 0;
      if (entityName.toLowerCase().includes(lowerQuery)) {
        score += 10;
      }
      if (entityName.toLowerCase() === lowerQuery) {
        score += 20;
      }

      if (score > 0) {
        // 考虑出现频率
        score += Math.min(entity.occurrences, 10);
        results.push({ entity, score });
      }
    }

    // 按分数排序
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, limit);
  }

  /**
   * 获取实体的详细关系
   * @param {string} entityName - 实体名称
   * @returns {Promise<Entity|null>} 实体详情
   */
  async getEntity(entityName) {
    const graphData = await this._loadGraph();

    if (!graphData || !graphData.entities[entityName]) {
      return null;
    }

    return graphData.entities[entityName];
  }

  /**
   * 获取项目统计
   * @returns {Promise<Object>} 项目统计信息
   */
  async getStats() {
    const graphData = await this._loadGraph();

    if (!graphData) {
      return {
        totalEntities: 0,
        totalRelations: 0,
        totalProjects: 0,
        entitiesByType: {}
      };
    }

    const entitiesByType = {};
    for (const entity of Object.values(graphData.entities)) {
      const label = ENTITY_TYPE_LABELS[entity.type] || entity.type;
      entitiesByType[label] = (entitiesByType[label] || 0) + 1;
    }

    return {
      totalEntities: Object.keys(graphData.entities).length,
      totalRelations: graphData.relations.length,
      totalProjects: Object.keys(graphData.projectIndex).length,
      entitiesByType
    };
  }

  /**
   * 获取所有 insights 文件
   * @returns {Promise<string[]>} 文件路径列表
   * @private
   */
  async _getInsightFiles() {
    const files = [];

    try {
      const entries = await fs.readdir(this.insightsDir);

      for (const entry of entries) {
        if (entry.endsWith('.md')) {
          files.push(path.join(this.insightsDir, entry));
        }
      }
    } catch (error) {
      logger.debug(`Insights 目录不存在: ${this.insightsDir}`);
    }

    return files;
  }

  /**
   * 从内容中提取实体和关系
   * @param {string} content - 文本内容
   * @param {string} projectName - 项目名称
   * @returns {{entities: Array, relations: Array}} 提取结果
   * @private
   */
  _extractFromContent(content, projectName) {
    const entities = extractEntities(content);
    const relations = [];

    // 简单关系推断：如果两个实体在同一段落中出现，建立关联
    const paragraphs = content.split('\n\n');
    for (const paragraph of paragraphs) {
      const paragraphEntities = extractEntities(paragraph);

      if (paragraphEntities.length >= 2) {
        // 为每对实体建立关系
        for (let i = 0; i < paragraphEntities.length; i++) {
          for (let j = i + 1; j < paragraphEntities.length; j++) {
            relations.push({
              from: paragraphEntities[i].name,
              to: paragraphEntities[j].name,
              type: 'relates_to',
              weight: 1
            });
          }
        }
      }
    }

    return { entities, relations };
  }

  /**
   * 保存图谱数据
   * @param {GraphData} graphData - 图谱数据
   * @returns {Promise<void>}
   * @private
   */
  async _saveGraph(graphData) {
    await fs.writeJson(path.join(this.graphDir, 'entities.json'), graphData.entities, {
      spaces: 2
    });
    await fs.writeJson(path.join(this.graphDir, 'relations.json'), graphData.relations, {
      spaces: 2
    });
    await fs.writeJson(path.join(this.graphDir, 'index.json'), graphData.projectIndex, {
      spaces: 2
    });
  }

  /**
   * 加载图谱数据
   * @returns {Promise<GraphData|null>} 图谱数据
   * @private
   */
  async _loadGraph() {
    try {
      const entitiesPath = path.join(this.graphDir, 'entities.json');
      const relationsPath = path.join(this.graphDir, 'relations.json');
      const indexPath = path.join(this.graphDir, 'index.json');

      if (!(await fs.pathExists(entitiesPath))) {
        return null;
      }

      const [entities, relations, projectIndex] = await Promise.all([
        fs.readJson(entitiesPath).catch(() => ({})),
        fs.readJson(relationsPath).catch(() => []),
        fs.readJson(indexPath).catch(() => ({}))
      ]);

      return { entities, relations, projectIndex };
    } catch (error) {
      logger.error(`加载图谱数据失败: ${error.message}`);
      return null;
    }
  }
}

export { KnowledgeGraph };
export default KnowledgeGraph;
