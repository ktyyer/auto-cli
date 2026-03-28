import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import os from 'os';
import path from 'path';
import fs from 'fs-extra';
import {
  getClaudeDir,
  getAutoDir,
  getCustomDir,
  getVersionFilePath,
  getInstalledVersion,
  saveInstalledVersion,
  getPackageVersion,
  COMPONENTS,
  DEFAULT_PORT,
  analyzeMcpServers,
  getMcpServerCategories,
  countMcpServers
} from '../src/utils.js';

describe('utils.js', () => {
  describe('getClaudeDir', () => {
    it('should return path to .claude directory in home folder', () => {
      const result = getClaudeDir();
      const expected = path.join(os.homedir(), '.claude');
      expect(result).toBe(expected);
    });
  });

  describe('getAutoDir', () => {
    it('should return path to auto directory inside .claude', () => {
      const result = getAutoDir();
      const expected = path.join(os.homedir(), '.claude', 'auto');
      expect(result).toBe(expected);
    });
  });

  describe('getCustomDir', () => {
    it('should return path to custom directory inside .claude', () => {
      const result = getCustomDir();
      const expected = path.join(os.homedir(), '.claude', 'custom');
      expect(result).toBe(expected);
    });
  });

  describe('getVersionFilePath', () => {
    it('should return path to .auto-version file', () => {
      const result = getVersionFilePath();
      const expected = path.join(os.homedir(), '.claude', '.auto-version');
      expect(result).toBe(expected);
    });
  });

  describe('getPackageVersion', () => {
    it('should return version string from package.json', () => {
      const result = getPackageVersion();
      const expectedVersion = fs.readJsonSync(path.join(process.cwd(), 'package.json')).version;
      expect(result).toBe(expectedVersion);
    });
  });

  describe('COMPONENTS', () => {
    it('should have agents component with correct structure', () => {
      expect(COMPONENTS.agents).toMatchObject({
        name: 'Agents（代理）',
        source: 'agents',
        target: 'agents',
        pattern: '*.md'
      });
    });

    it('should have rules component with correct structure', () => {
      expect(COMPONENTS.rules).toMatchObject({
        name: 'Rules（规则）',
        source: 'rules',
        target: 'rules',
        pattern: '*.md'
      });
    });

    it('should have commands component with correct structure', () => {
      expect(COMPONENTS.commands).toMatchObject({
        name: 'auto 斜杠指令',
        source: 'commands',
        target: 'commands/auto',
        pattern: '*.md'
      });
    });

    it('should have skills component with correct structure', () => {
      expect(COMPONENTS.skills).toMatchObject({
        name: 'Skills（技能）',
        source: 'skills',
        target: 'skills',
        pattern: '**/*',
        recursive: true
      });
    });

    it('should have plugins component with correct structure', () => {
      expect(COMPONENTS.plugins).toMatchObject({
        name: 'Plugins（插件）',
        source: 'plugins',
        target: 'plugins',
        pattern: '**/*',
        recursive: true
      });
    });

    it('should have templates component with correct structure', () => {
      expect(COMPONENTS.templates).toMatchObject({
        name: 'Templates（模板）',
        source: 'templates',
        target: 'templates',
        pattern: '**/*',
        recursive: true
      });
    });

    it('should have lib component with correct structure', () => {
      expect(COMPONENTS.lib).toMatchObject({
        name: 'Lib（核心库）',
        source: 'lib',
        target: 'lib',
        pattern: '**/*',
        recursive: true
      });
    });

    it('should have hooks component with correct structure', () => {
      expect(COMPONENTS.hooks).toMatchObject({
        name: 'Hooks（自动化门禁）',
        source: 'hooks',
        target: 'hooks',
        pattern: '*.json'
      });
    });

    it('should have mcpConfigs component with correct structure', () => {
      expect(COMPONENTS.mcpConfigs).toMatchObject({
        name: 'MCP Configs（外部服务配置）',
        source: 'mcp-configs',
        target: 'mcp-configs',
        pattern: '*.json'
      });
    });

    it('should have exactly 10 components', () => {
      expect(Object.keys(COMPONENTS)).toHaveLength(10);
    });
  });

  describe('DEFAULT_PORT', () => {
    it('should be 8099', () => {
      expect(DEFAULT_PORT).toBe(8099);
    });
  });

  describe('getInstalledVersion', () => {
    const testVersionFile = path.join(os.tmpdir(), '.auto-test-version');

    beforeEach(async () => {
      // Mock getVersionFilePath temporarily
      vi.spyOn(fs, 'pathExists').mockImplementation(async (p) => {
        if (p.includes('.auto-version')) {
          return fs.pathExists(testVersionFile);
        }
        return fs.pathExists(p);
      });
    });

    afterEach(async () => {
      vi.restoreAllMocks();
      await fs.remove(testVersionFile);
    });

    it('should return null if version file does not exist', async () => {
      vi.spyOn(fs, 'pathExists').mockResolvedValue(false);
      const result = await getInstalledVersion();
      expect(result).toBeNull();
    });

    it('should return version info if file exists', async () => {
      const versionInfo = {
        version: '1.0.0',
        components: ['agents', 'rules'],
        installedAt: '2024-01-01T00:00:00.000Z'
      };

      vi.spyOn(fs, 'pathExists').mockResolvedValue(true);
      vi.spyOn(fs, 'readFile').mockResolvedValue(JSON.stringify(versionInfo));

      const result = await getInstalledVersion();
      expect(result).toEqual(versionInfo);
    });

    it('should return null on parse error', async () => {
      vi.spyOn(fs, 'pathExists').mockResolvedValue(true);
      vi.spyOn(fs, 'readFile').mockResolvedValue('invalid json');

      const result = await getInstalledVersion();
      expect(result).toBeNull();
    });
  });

  describe('saveInstalledVersion', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should save version info to file', async () => {
      const writeJsonMock = vi.spyOn(fs, 'writeJson').mockResolvedValue();

      await saveInstalledVersion('1.0.0', ['agents', 'rules']);

      expect(writeJsonMock).toHaveBeenCalledWith(
        expect.stringContaining('.auto-version'),
        expect.objectContaining({
          version: '1.0.0',
          components: ['agents', 'rules'],
          installedFiles: [],
          installedAt: expect.any(String)
        }),
        { spaces: 2 }
      );
    });

    it('should save installed files list for precise uninstall', async () => {
      const writeJsonMock = vi.spyOn(fs, 'writeJson').mockResolvedValue();

      const installedFiles = [
        '/Users/test/.claude/skills/test-skill.md',
        '/Users/test/.claude/agents/test-agent.md'
      ];

      await saveInstalledVersion('1.0.0', ['skills', 'agents'], installedFiles);

      expect(writeJsonMock).toHaveBeenCalledWith(
        expect.stringContaining('.auto-version'),
        expect.objectContaining({
          version: '1.0.0',
          components: ['skills', 'agents'],
          installedFiles: installedFiles,
          installedAt: expect.any(String)
        }),
        { spaces: 2 }
      );
    });
  });

  describe('analyzeMcpServers', () => {
    const testMcpFile = path.join(os.tmpdir(), '.auto-test-mcp-' + Date.now() + '.json');

    afterEach(async () => {
      await fs.remove(testMcpFile);
    });

    it('should return empty arrays when file does not exist', async () => {
      const result = await analyzeMcpServers('/nonexistent/path.json');

      expect(result.ready).toEqual([]);
      expect(result.needsConfig).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should classify servers with YOUR_ placeholder as needsConfig', async () => {
      const config = {
        mcpServers: {
          github: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-github'],
            env: { GITHUB_PERSONAL_ACCESS_TOKEN: 'YOUR_GITHUB_PAT_HERE' },
            description: 'GitHub operations'
          },
          memory: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-memory'],
            description: 'Persistent memory'
          }
        }
      };
      await fs.writeJson(testMcpFile, config);

      const result = await analyzeMcpServers(testMcpFile);

      expect(result.total).toBe(2);
      expect(result.ready).toHaveLength(1);
      expect(result.ready[0].name).toBe('memory');
      expect(result.needsConfig).toHaveLength(1);
      expect(result.needsConfig[0].name).toBe('github');
    });

    it('should detect type field when present', async () => {
      const config = {
        mcpServers: {
          vercel: {
            type: 'http',
            url: 'https://mcp.vercel.com',
            description: 'Vercel deployments'
          }
        }
      };
      await fs.writeJson(testMcpFile, config);

      const result = await analyzeMcpServers(testMcpFile);

      expect(result.ready[0].type).toBe('http');
      expect(result.ready[0].command).toBe('');
    });

    it('should return empty on invalid JSON', async () => {
      await fs.writeFile(testMcpFile, 'not json');

      const result = await analyzeMcpServers(testMcpFile);

      expect(result.total).toBe(0);
    });
  });

  describe('getMcpServerCategories', () => {
    const testMcpFile = path.join(os.tmpdir(), '.auto-test-mcp-cat-' + Date.now() + '.json');

    afterEach(async () => {
      await fs.remove(testMcpFile);
    });

    it('should categorize servers into correct groups', async () => {
      const config = {
        mcpServers: {
          supabase: {
            command: 'npx',
            args: ['-y', '@supabase/mcp-server-supabase@latest'],
            description: 'Supabase'
          },
          'brave-search': {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-brave-search'],
            env: { BRAVE_API_KEY: 'YOUR_BRAVE_API_KEY_HERE' },
            description: 'Search'
          },
          memory: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-memory'],
            description: 'Memory'
          }
        }
      };
      await fs.writeJson(testMcpFile, config);

      const { categories, summary } = await getMcpServerCategories(testMcpFile);

      expect(summary.total).toBe(3);
      expect(summary.ready).toBe(2);
      expect(summary.needsConfig).toBe(1);
      expect(categories.database.total).toBe(1);
      expect(categories.search.total).toBe(1);
      expect(categories.ai.total).toBe(1);
    });

    it('should return zero counts when file does not exist', async () => {
      const { summary } = await getMcpServerCategories('/nonexistent.json');

      expect(summary.total).toBe(0);
    });
  });

  describe('countMcpServers', () => {
    const testMcpFile = path.join(os.tmpdir(), '.auto-test-mcp-count-' + Date.now() + '.json');

    afterEach(async () => {
      await fs.remove(testMcpFile);
    });

    it('should return correct counts', async () => {
      const config = {
        mcpServers: {
          memory: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-memory'] },
          github: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-github'],
            env: { GITHUB_PERSONAL_ACCESS_TOKEN: 'YOUR_GITHUB_PAT_HERE' }
          }
        }
      };
      await fs.writeJson(testMcpFile, config);

      const result = await countMcpServers(testMcpFile);

      expect(result.mcp_servers).toBe(2);
      expect(result.mcp_ready).toBe(1);
      expect(result.mcp_needs_config).toBe(1);
    });

    it('should return zeros when file missing', async () => {
      const result = await countMcpServers('/nonexistent.json');

      expect(result.mcp_servers).toBe(0);
      expect(result.mcp_ready).toBe(0);
      expect(result.mcp_needs_config).toBe(0);
    });
  });
});
