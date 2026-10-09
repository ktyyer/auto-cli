import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validateTarball } from '../../scripts/validate-package-contents.js';
import { managedBlock } from '../../scripts/install-plan.js';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const bridgePath = 'scripts/templates/codex-global-bridge.md';

function fixture(t, copySource = true) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-cli-package-'));
  t.after(() => {
    const relative = path.relative(os.tmpdir(), root);
    assert.ok(relative.startsWith('auto-cli-package-') && !path.isAbsolute(relative));
    fs.rmSync(root, { recursive: true, force: true });
  });
  const source = path.join(root, 'source');
  fs.mkdirSync(source);
  if (copySource) {
    const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
    for (const file of ['package.json', 'README.md', 'LICENSE', ...pkg.files]) {
      const origin = path.join(repoRoot, file);
      if (fs.existsSync(origin)) fs.cpSync(origin, path.join(source, file), { recursive: true });
    }
  }
  return { root, source };
}

function pack(source) {
  const result = spawnSync('npm', ['pack', '--json', '--ignore-scripts'], {
    cwd: source,
    encoding: 'utf8',
    shell: process.platform === 'win32'
  });
  assert.equal(result.status, 0, result.error?.message || result.stdout + result.stderr);
  const [info] = JSON.parse(result.stdout);
  return path.join(source, info.filename);
}

function extract(f, tarball) {
  const output = path.join(f.root, 'unpacked');
  fs.mkdirSync(output);
  const result = spawnSync('tar', ['-xzf', tarball, '-C', output], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.error?.message || result.stdout + result.stderr);
  return path.join(output, 'package');
}

function isolatedHost(f) {
  const home = path.join(f.root, 'home');
  fs.mkdirSync(home);
  fs.writeFileSync(
    path.join(home, '.auto-cli-install-test-root'),
    'auto-cli isolated installation fixture\n'
  );
  for (const name of ['.codex', '.claude']) fs.mkdirSync(path.join(home, name));
  const run = (source, script) =>
    spawnSync(process.execPath, [path.join(source, 'scripts', script)], {
      cwd: source,
      encoding: 'utf8',
      env: {
        ...process.env,
        AUTO_CLI_INSTALL_TEST_MODE: '1',
        AUTO_CLI_INSTALL_HOME: home,
        CODEX_HOME: path.join(home, '.codex'),
        CLAUDE_CONFIG_DIR: path.join(home, '.claude')
      }
    });
  return { home, run };
}

test('a source package missing its global bridge cannot pass package validation', (t) => {
  const f = fixture(t);
  fs.rmSync(path.join(f.source, bridgePath), { force: true });
  const result = spawnSync(process.execPath, ['scripts/validate-package-contents.js'], {
    cwd: f.source,
    encoding: 'utf8'
  });
  assert.notEqual(result.status, 0, 'a missing mandatory bridge must fail validation');
  assert.match(result.stdout + result.stderr, /scripts\/templates\/codex-global-bridge\.md/);
});

test('the actual npm tarball installs an isolated global bridge and uninstalls cleanly', (t) => {
  const f = fixture(t);
  const tarball = pack(f.source);
  const report = validateTarball(tarball, { root: f.source });
  assert.deepEqual(report.missing, []);
  assert.deepEqual(report.mismatched, []);
  for (const required of [
    bridgePath,
    '.claude-plugin/plugin.json',
    '.claude-plugin/marketplace.json',
    'package.json'
  ]) {
    assert.ok(
      report.entries.some((entry) => entry.path === required),
      required
    );
  }
  assert.equal(report.sha256, createHash('sha256').update(fs.readFileSync(tarball)).digest('hex'));
  const source = extract(f, tarball);
  const host = isolatedHost(f);
  const personal = '# Keep my global rules\r\n';
  const agents = path.join(host.home, '.codex/AGENTS.md');
  fs.writeFileSync(agents, personal);
  const install = host.run(source, 'install.js');
  assert.equal(install.status, 0, install.stdout + install.stderr);
  const block = managedBlock(fs.readFileSync(agents)).text;
  assert.match(block, /<host-root>\/prompts\/auto\.md/);
  assert.doesNotMatch(block, /本仓库是纯 Markdown|不引入 JS\/Node 运行时代码|不修改.*agents\//);
  const receipt = JSON.parse(
    fs.readFileSync(path.join(host.home, '.codex/auto-cli/install-manifest.json'), 'utf8')
  );
  assert.equal(receipt.files.find((entry) => entry.path === 'AGENTS.md').source, bridgePath);
  const repeated = host.run(source, 'install.js');
  assert.equal(repeated.status, 0, repeated.stdout + repeated.stderr);
  assert.match(repeated.stdout, /0 changes/);
  const uninstall = host.run(source, 'uninstall.js');
  assert.equal(uninstall.status, 0, uninstall.stdout + uninstall.stderr);
  assert.equal(fs.readFileSync(agents, 'utf8'), personal);
  assert.equal(fs.existsSync(path.join(host.home, '.codex/prompts/auto.md')), false);
});

test('a bad tarball missing the bridge fails validation and changes neither host on install', (t) => {
  const f = fixture(t);
  fs.unlinkSync(path.join(f.source, bridgePath));
  const tarball = pack(f.source);
  assert.ok(validateTarball(tarball, { root: f.source }).missing.includes(bridgePath));
  const source = extract(f, tarball);
  const host = isolatedHost(f);
  const personal = '# Personal rules stay\n';
  const agents = path.join(host.home, '.codex/AGENTS.md');
  fs.writeFileSync(agents, personal);
  const result = host.run(source, 'install.js');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /codex-global-bridge\.md/);
  assert.equal(fs.readFileSync(agents, 'utf8'), personal);
  assert.deepEqual(fs.readdirSync(path.join(host.home, '.codex')), ['AGENTS.md']);
  assert.deepEqual(fs.readdirSync(path.join(host.home, '.claude')), []);
});

test('tarball validation detects an artifact from a different source state', (t) => {
  const f = fixture(t);
  const tarball = pack(f.source);
  fs.appendFileSync(path.join(f.source, bridgePath), '\nA later source edit.\n');
  const report = validateTarball(tarball, { root: f.source });
  assert.deepEqual(report.mismatched, [bridgePath]);
});

function artificialTarball(root, entries) {
  const blocks = [];
  for (const entry of entries) {
    const contents = Buffer.from(entry.contents || '');
    const header = Buffer.alloc(512);
    header.write(entry.name, 0, 100);
    header.write('0000644\0', 100, 8);
    header.write('0000000\0', 108, 8);
    header.write('0000000\0', 116, 8);
    header.write(`${contents.length.toString(8).padStart(11, '0')}\0`, 124, 12);
    header.write('00000000000\0', 136, 12);
    header.fill(32, 148, 156);
    header.write(entry.type || '0', 156, 1);
    if (entry.link) header.write(entry.link, 157, 100);
    header.write('ustar\0', 257, 6);
    header.write('00', 263, 2);
    const checksum = header.reduce((sum, byte) => sum + byte, 0);
    header.write(`${checksum.toString(8).padStart(6, '0')}\0 `, 148, 8);
    blocks.push(header, contents, Buffer.alloc((512 - (contents.length % 512)) % 512));
  }
  blocks.push(Buffer.alloc(1024));
  const tarball = path.join(root, 'artificial.tgz');
  fs.writeFileSync(tarball, gzipSync(Buffer.concat(blocks)));
  return tarball;
}

test('archive validation rejects traversal, links, duplicate entries and special files before extraction', (t) => {
  const f = fixture(t, false);
  const sentinel = path.join(f.root, 'outside');
  fs.writeFileSync(sentinel, 'unchanged');
  const cases = [
    [{ name: 'package/../../outside', contents: 'bad' }],
    [{ name: '/outside', contents: 'bad' }],
    [{ name: 'package/link', type: '2', link: '../../outside' }],
    [{ name: 'package/link', type: '1', link: '../../outside' }],
    [{ name: 'package/fifo', type: '6' }],
    [
      { name: 'package/a', contents: 'first' },
      { name: 'package/a', contents: 'second' }
    ]
  ];
  for (const entries of cases) {
    const tarball = artificialTarball(f.root, entries);
    assert.throws(
      () => validateTarball(tarball, { root: f.source }),
      /Unsafe package path|Unsupported package entry type|Duplicate package path|tar failed/
    );
    assert.equal(fs.readFileSync(sentinel, 'utf8'), 'unchanged');
  }
});
