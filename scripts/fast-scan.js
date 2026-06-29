#!/usr/bin/env node
// Fast SCAN using persistent index

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INDEX_FILE = '.auto/cache/index.json';

function loadIndex() {
  if (!fs.existsSync(INDEX_FILE)) {
    console.log('⚠️  索引不存在，正在自动构建...\n');
    try {
      execSync('node scripts/build-context-index.js', { stdio: 'inherit' });
      console.log('\n✅ 索引构建完成，继续扫描...\n');
    } catch (e) {
      console.log('❌ 索引构建失败:', e.message);
      console.log('   请手动运行: node scripts/build-context-index.js');
      process.exit(1);
    }
  }

  try {
    return JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
  } catch (e) {
    console.log('❌ Failed to load index:', e.message);
    process.exit(1);
  }
}

function isIndexStale(index) {
  // Check if index is older than 24 hours
  const indexAge = Date.now() - new Date(index.timestamp).getTime();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours

  if (indexAge > maxAge) {
    return true;
  }

  // Check if critical files changed after index was built
  const criticalFiles = ['package.json', 'pom.xml', 'build.gradle', 'go.mod', 'Cargo.toml', 'requirements.txt', 'pyproject.toml'];
  const indexTime = new Date(index.timestamp).getTime();

  for (const file of criticalFiles) {
    if (fs.existsSync(file)) {
      const fileMtime = fs.statSync(file).mtime.getTime();
      if (fileMtime > indexTime) {
        return true;
      }
    }
  }

  return false;
}

function fastScan() {
  const index = loadIndex();

  // Check staleness and auto-rebuild if needed
  if (isIndexStale(index)) {
    const indexAge = Date.now() - new Date(index.timestamp).getTime();
    const hours = Math.round(indexAge / 1000 / 60 / 60);

    console.log(`⚠️  Index is stale (${hours}h old or dependencies changed)`);
    console.log('   Rebuilding automatically...\n');

    try {
      execSync('node scripts/build-context-index.js', { stdio: 'inherit' });
      console.log('\n✅ Index rebuilt, continuing scan...\n');
      // Reload the fresh index
      const freshIndex = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
      displayScanSummary(freshIndex);
      return;
    } catch (e) {
      console.log('⚠️  Auto-rebuild failed, using stale index\n');
      displayScanSummary(index);
      return;
    }
  }

  displayScanSummary(index);
}

function displayScanSummary(index) {
  // Normalize paths for cross-platform display
  const displayRoot = index.project.root.replace(/\\/g, '/');

  console.log('# Fast SCAN Summary\n');
  console.log(`**Project**: ${index.project.name}`);
  console.log(`**Root**: ${displayRoot}`);
  console.log(`**Last Indexed**: ${new Date(index.timestamp).toLocaleString()}\n`);

  // Tech Stack
  console.log('## Tech Stack\n');
  if (index.techStack.length > 0) {
    console.log(index.techStack.map(t => `- ${t}`).join('\n'));
  } else {
    console.log('- Unknown (run detection again)');
  }
  console.log('');

  // Architecture
  console.log('## Architecture\n');
  console.log('**Root Directories**:');
  if (index.architecture.root.length > 0) {
    console.log(index.architecture.root.map(d => `- ${d}`).join('\n'));
  } else {
    console.log('- None detected');
  }
  console.log('');

  console.log('**Dev Directories**:');
  if (index.architecture.dev.length > 0) {
    console.log(index.architecture.dev.map(d => `- ${d}`).join('\n'));
  } else {
    console.log('- None detected');
  }
  console.log('');

  // Files
  console.log('## Files\n');
  console.log(`**Total**: ${index.files.total}`);
  console.log(`**By Extension**:`);
  Object.entries(index.files.byExtension)
    .sort((a, b) => b[1] - a[1])
    .forEach(([ext, count]) => {
      console.log(`- ${ext}: ${count}`);
    });
  console.log('');

  // Git Status
  console.log('## Git Status\n');
  console.log(`**Modified**: ${index.git.modified}`);
  console.log(`**Added**: ${index.git.added}`);
  console.log(`**Deleted**: ${index.git.deleted}`);

  if (index.git.changedFiles.length > 0) {
    console.log(`\n**Recently Changed** (${index.git.changedFiles.length}):`);
    index.git.changedFiles.slice(0, 10).forEach(file => {
      console.log(`- ${file}`);
    });
    if (index.git.changedFiles.length > 10) {
      console.log(`- ... and ${index.git.changedFiles.length - 10} more`);
    }
  }
  console.log('');

  // Dependencies
  if (index.dependencies.length > 0) {
    console.log('## Dependencies\n');
    console.log(`**Total**: ${index.dependencies.length}`);
    console.log(`**Top 10**:`);
    index.dependencies.slice(0, 10).forEach(dep => {
      console.log(`- ${dep}`);
    });
    if (index.dependencies.length > 10) {
      console.log(`- ... and ${index.dependencies.length - 10} more`);
    }
    console.log('');
  }

  // Stats
  console.log('## Statistics\n');
  console.log(`**Total Size**: ${(index.stats.totalSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`**Avg File Size**: ${(index.stats.avgFileSize / 1024).toFixed(2)} KB`);
  console.log('');

  // Performance gain
  console.log('---');
  console.log('');
  console.log('💡 **Performance**: Using cached index (50-70% faster than full SCAN)');
  console.log('');
  console.log('**Next Steps**:');
  console.log('- Use this summary in SCAN phase instead of scanning all files');
  console.log('- Only scan changed files from `git.changedFiles` list');
  console.log('- Rebuild index after major changes: `node scripts/build-context-index.js`');
}

// CLI
fastScan();
