#!/usr/bin/env node
// Build persistent context index for faster SCAN phase

import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CACHE_DIR = '.auto/cache';
const INDEX_FILE = path.join(CACHE_DIR, 'index.json');

function computeFileHash(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return createHash('sha256').update(content).digest('hex').substring(0, 16);
  } catch (e) {
    return null;
  }
}

function getGitStatus() {
  try {
    const output = execSync('git status --porcelain', { encoding: 'utf8' });
    const modified = [];
    const added = [];
    const deleted = [];

    output.split('\n').forEach(line => {
      if (!line) return;
      const status = line.substring(0, 2);
      const file = line.substring(3);

      if (status.includes('M')) modified.push(file);
      if (status.includes('A')) added.push(file);
      if (status.includes('D')) deleted.push(file);
    });

    return { modified, added, deleted };
  } catch (e) {
    return { modified: [], added: [], deleted: [] };
  }
}

function scanDirectory(dir, extensions = ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.go', '.rs', '.md']) {
  const files = [];

  function walk(currentPath) {
    if (!fs.existsSync(currentPath)) return;

    const stats = fs.statSync(currentPath);
    if (stats.isDirectory()) {
      // Skip common ignore directories
      const basename = path.basename(currentPath);
      if (['node_modules', '.git', 'dist', 'build', 'target', '.next', 'coverage'].includes(basename)) {
        return;
      }

      const entries = fs.readdirSync(currentPath);
      entries.forEach(entry => {
        walk(path.join(currentPath, entry));
      });
    } else if (stats.isFile()) {
      const ext = path.extname(currentPath);
      if (extensions.includes(ext)) {
        files.push({
          path: currentPath,
          size: stats.size,
          lastModified: stats.mtime.toISOString(),
          hash: computeFileHash(currentPath)
        });
      }
    }
  }

  walk(dir);
  return files;
}

function detectTechStack() {
  const techStack = [];

  if (fs.existsSync('package.json')) {
    try {
      const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      if (pkg.dependencies) {
        if (pkg.dependencies.react) techStack.push('react');
        if (pkg.dependencies.vue) techStack.push('vue');
        if (pkg.dependencies.express) techStack.push('express');
        if (pkg.dependencies.next) techStack.push('nextjs');
      }
      if (pkg.devDependencies) {
        if (pkg.devDependencies.typescript) techStack.push('typescript');
        if (pkg.devDependencies.jest) techStack.push('jest');
        if (pkg.devDependencies.vitest) techStack.push('vitest');
      }
    } catch (e) {
      // ignore
    }
  }

  if (fs.existsSync('pom.xml')) techStack.push('java', 'maven');
  if (fs.existsSync('build.gradle')) techStack.push('java', 'gradle');
  if (fs.existsSync('go.mod')) techStack.push('go');
  if (fs.existsSync('Cargo.toml')) techStack.push('rust');
  if (fs.existsSync('requirements.txt')) techStack.push('python');
  if (fs.existsSync('pyproject.toml')) techStack.push('python');

  return [...new Set(techStack)];
}

function buildArchitecture() {
  const architecture = {
    root: [],
    dev: [],
    infra: [],
    config: []
  };

  // Detect common directories
  if (fs.existsSync('src')) architecture.root.push('src/');
  if (fs.existsSync('lib')) architecture.root.push('lib/');
  if (fs.existsSync('app')) architecture.root.push('app/');
  if (fs.existsSync('pages')) architecture.root.push('pages/');
  if (fs.existsSync('components')) architecture.root.push('components/');

  if (fs.existsSync('test')) architecture.dev.push('test/');
  if (fs.existsSync('tests')) architecture.dev.push('tests/');
  if (fs.existsSync('__tests__')) architecture.dev.push('__tests__/');
  if (fs.existsSync('scripts')) architecture.dev.push('scripts/');

  if (fs.existsSync('.github')) architecture.infra.push('.github/');
  if (fs.existsSync('docker')) architecture.infra.push('docker/');
  if (fs.existsSync('k8s')) architecture.infra.push('k8s/');

  if (fs.existsSync('config')) architecture.config.push('config/');
  if (fs.existsSync('.env')) architecture.config.push('.env');
  if (fs.existsSync('tsconfig.json')) architecture.config.push('tsconfig.json');

  return architecture;
}

function getDependencies() {
  const dependencies = [];

  if (fs.existsSync('package.json')) {
    try {
      const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      if (pkg.dependencies) {
        Object.keys(pkg.dependencies).forEach(dep => {
          dependencies.push(`${dep}@${pkg.dependencies[dep]}`);
        });
      }
    } catch (e) {
      // ignore
    }
  }

  return dependencies;
}

function buildIndex() {
  console.log('Building context index...');

  // Ensure cache directory exists
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }

  // Get git status
  const gitStatus = getGitStatus();

  // Scan project files
  const files = scanDirectory('.');

  // Build index
  const index = {
    version: '1.0',
    timestamp: new Date().toISOString(),
    project: {
      root: process.cwd(),
      name: path.basename(process.cwd())
    },
    techStack: detectTechStack(),
    architecture: buildArchitecture(),
    dependencies: getDependencies().slice(0, 50), // Limit to top 50
    files: {
      total: files.length,
      byExtension: {},
      list: files
    },
    git: {
      modified: gitStatus.modified.length,
      added: gitStatus.added.length,
      deleted: gitStatus.deleted.length,
      changedFiles: [...gitStatus.modified, ...gitStatus.added].slice(0, 100) // Limit to 100
    },
    stats: {
      totalSize: files.reduce((sum, f) => sum + f.size, 0),
      avgFileSize: files.length > 0 ? Math.round(files.reduce((sum, f) => sum + f.size, 0) / files.length) : 0
    }
  };

  // Count by extension
  files.forEach(file => {
    const ext = path.extname(file.path);
    index.files.byExtension[ext] = (index.files.byExtension[ext] || 0) + 1;
  });

  // Write index
  fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2));

  console.log(`✅ Index built: ${INDEX_FILE}`);
  console.log(`   Total files: ${index.files.total}`);
  console.log(`   Tech stack: ${index.techStack.join(', ') || 'unknown'}`);
  console.log(`   Changed files: ${index.git.changedFiles.length}`);
  console.log(`   Cache size: ${Math.round(fs.statSync(INDEX_FILE).size / 1024)} KB`);
}

function invalidateIndex() {
  if (fs.existsSync(INDEX_FILE)) {
    fs.unlinkSync(INDEX_FILE);
    console.log(`✅ Index invalidated: ${INDEX_FILE}`);
  } else {
    console.log('No index to invalidate');
  }
}

// CLI
const command = process.argv[2];

if (command === 'invalidate' || command === 'clear') {
  invalidateIndex();
} else {
  buildIndex();
}
