#!/usr/bin/env node

// Rebuild .auto/cache/insight-index.json from .auto/insights/*.md
// Extracts ### headings + **标签** lines to build by_tag and by_keyword indexes.

import fs from 'fs';
import path from 'path';

const INSIGHTS_DIR = path.resolve('.auto', 'insights');
const CACHE_DIR = path.resolve('.auto', 'cache');
const OUTPUT = path.join(CACHE_DIR, 'insight-index.json');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function parseInsightFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const fileName = path.basename(filePath, '.md');
  const entries = [];

  const sections = content.split(/^### /m).slice(1);

  for (const section of sections) {
    const lines = section.split('\n');
    const title = lines[0].trim();

    let tags = [];
    let confidence = 'medium';

    for (const line of lines.slice(1, 15)) {
      const tagMatch = line.match(/\*\*标签\*\*:\s*(.+)/);
      if (tagMatch) {
        tags = tagMatch[1].split(/[,，]/).map((t) => t.trim().toLowerCase());
      }
      const confMatch = line.match(/\*\*置信度\*\*:\s*(\w+)/);
      if (confMatch) {
        confidence = confMatch[1].toLowerCase();
      }
    }

    const keywords = extractKeywords(title, tags);

    entries.push({ file: `${fileName}.md`, section: title, tags, keywords, confidence });
  }

  return entries;
}

function extractKeywords(title, tags) {
  const words = title
    .toLowerCase()
    .replace(/[^a-z0-9一-鿿\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);

  const allWords = [...new Set([...words, ...tags])];
  return allWords.filter((w) => w.length > 0);
}

function main() {
  if (!fs.existsSync(INSIGHTS_DIR)) {
    console.log('.auto/insights/ not found, skipping.');
    return;
  }

  ensureDir(CACHE_DIR);

  const files = fs
    .readdirSync(INSIGHTS_DIR)
    .filter((f) => f.endsWith('.md'));

  const byTag = {};
  const byKeyword = {};

  for (const file of files) {
    const entries = parseInsightFile(path.join(INSIGHTS_DIR, file));

    for (const entry of entries) {
      for (const tag of entry.tags) {
        if (!byTag[tag]) byTag[tag] = [];
        byTag[tag].push({
          file: entry.file,
          section: entry.section,
          confidence: entry.confidence,
        });
      }

      for (const kw of entry.keywords) {
        if (!byKeyword[kw]) byKeyword[kw] = [];
        const exists = byKeyword[kw].some(
          (e) => e.file === entry.file && e.section === entry.section
        );
        if (!exists) {
          byKeyword[kw].push({ file: entry.file, section: entry.section });
        }
      }
    }
  }

  const index = {
    version: 'auto-md/v1',
    lastUpdated: new Date().toISOString().split('T')[0],
    by_tag: byTag,
    by_keyword: byKeyword,
  };

  fs.writeFileSync(OUTPUT, JSON.stringify(index, null, 2) + '\n', 'utf-8');

  const tagCount = Object.keys(byTag).length;
  const kwCount = Object.keys(byKeyword).length;
  const sectionCount = Object.values(byTag).reduce((s, a) => s + a.length, 0);

  console.log(
    `insight-index rebuilt: ${files.length} files, ${sectionCount} sections, ${tagCount} tags, ${kwCount} keywords`
  );
}

main();
