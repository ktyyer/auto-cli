import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';

vi.mock('fs-extra', () => ({
  default: {
    pathExists: vi.fn(),
    readJson: vi.fn(),
    writeJson: vi.fn(),
    ensureDir: vi.fn()
  }
}));

vi.mock('ora', () => ({
  default: () => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    warn: vi.fn().mockReturnThis()
  })
}));

vi.mock('chalk', () => ({
  default: {
    green: (s) => s,
    cyan: (s) => s,
    yellow: (s) => s,
    red: (s) => s,
    gray: (s) => s
  }
}));

vi.mock('../src/logger.js', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn()
  }
}));

vi.mock('../src/utils.js', () => ({
  getClaudeDir: () => '/mock/.claude',
  getSourceDir: () => '/mock/auto-cli',
  analyzeMcpServers: vi.fn()
}));

describe('mcp-installer', () => {
  let fs;
  let installMcpServers;
  let getAvailableMcpServers;
  let analyzeMcpServers;

  beforeEach(async () => {
    vi.clearAllMocks();
    fs = (await import('fs-extra')).default;
    analyzeMcpServers = (await import('../src/utils.js')).analyzeMcpServers;

    const mcpInstaller = await import('../src/mcp-installer.js');
    installMcpServers = mcpInstaller.installMcpServers;
    getAvailableMcpServers = mcpInstaller.getAvailableMcpServers;
  });

  describe('installMcpServers', () => {
    it('should add new servers that do not exist in user config', async () => {
      fs.pathExists
        .mockResolvedValueOnce(true) // template exists
        .mockResolvedValueOnce(true); // user config exists
      fs.readJson
        .mockResolvedValueOnce({
          mcpServers: {
            memory: { command: 'memory-server' },
            playwright: { command: 'playwright-server' }
          }
        }) // template
        .mockResolvedValueOnce({
          mcpServers: {
            memory: { command: 'existing-memory' }
          }
        }); // existing config
      fs.ensureDir.mockResolvedValue();
      fs.writeJson.mockResolvedValue();

      const result = await installMcpServers(['memory', 'playwright']);

      expect(result.added).toEqual(['playwright']);
      expect(result.skipped).toEqual(['memory']);
      expect(fs.writeJson).toHaveBeenCalledTimes(1);
    });

    it('should skip when template file does not exist', async () => {
      fs.pathExists.mockResolvedValue(false);

      const result = await installMcpServers(['memory']);

      expect(result.added).toEqual([]);
      expect(result.skipped).toEqual([]);
    });

    it('should skip servers not in template', async () => {
      fs.pathExists
        .mockResolvedValueOnce(true) // template exists
        .mockResolvedValueOnce(true); // user config exists
      fs.readJson
        .mockResolvedValueOnce({ mcpServers: { memory: { command: 'mem' } } })
        .mockResolvedValueOnce({ mcpServers: {} });
      fs.ensureDir.mockResolvedValue();
      fs.writeJson.mockResolvedValue();

      const result = await installMcpServers(['nonexistent']);

      expect(result.added).toEqual([]);
      expect(result.skipped).toEqual(['nonexistent']);
    });

    it('should create config file when it does not exist', async () => {
      fs.pathExists
        .mockResolvedValueOnce(true) // template exists
        .mockResolvedValueOnce(false); // user config does not exist
      fs.readJson.mockResolvedValueOnce({
        mcpServers: { memory: { command: 'mem' } }
      });
      fs.ensureDir.mockResolvedValue();
      fs.writeJson.mockResolvedValue();

      const result = await installMcpServers(['memory']);

      expect(result.added).toEqual(['memory']);
      expect(fs.writeJson).toHaveBeenCalledTimes(1);
    });

    it('should not write file when nothing is added', async () => {
      fs.pathExists.mockResolvedValueOnce(true).mockResolvedValueOnce(true);
      fs.readJson
        .mockResolvedValueOnce({ mcpServers: { memory: { command: 'mem' } } })
        .mockResolvedValueOnce({ mcpServers: { memory: { command: 'existing' } } });

      const result = await installMcpServers(['memory']);

      expect(result.added).toEqual([]);
      expect(result.skipped).toEqual(['memory']);
      expect(fs.writeJson).not.toHaveBeenCalled();
    });
  });

  describe('getAvailableMcpServers', () => {
    it('should delegate to analyzeMcpServers with correct path', async () => {
      analyzeMcpServers.mockResolvedValue({ ready: [], needsConfig: [], total: 0 });

      await getAvailableMcpServers();

      expect(analyzeMcpServers).toHaveBeenCalledWith(
        path.join('/mock/auto-cli', 'mcp-configs', 'mcp-servers.json')
      );
    });
  });
});
