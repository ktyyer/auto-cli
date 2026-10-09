const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomUUID, randomBytes } = require('node:crypto');
const { spawnSync } = require('node:child_process');

const SCHEMA = 'auto-host-bindings-v1';
const MAX_RUNS = 2048;
const MAX_BINDINGS = 256;
const MAX_BYTES = 1024 * 1024;
const MAX_LOG_BYTES = 16 * MAX_BYTES;
const MAX_SCAN_BYTES = 16 * MAX_BYTES;
const receiptPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const proofPattern = /^[a-f0-9]{48}$/;
const lifecycleEvents = new Set(['SessionStart', 'UserPromptSubmit', 'Stop']);
const sessionSources = new Set(['startup', 'resume', 'clear', 'compact', 'fork']);

function identity(value, name) {
  if (typeof value !== 'string' || !value || value.length > 512 || /[\x00-\x1f]/.test(value))
    throw new Error(`Invalid ${name}`);
  return value;
}
function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}
function canonicalDirectory(value) {
  const absolute = fs.realpathSync.native(path.resolve(identity(value, 'directory')));
  if (!fs.statSync(absolute).isDirectory()) throw new Error('Directory required');
  return process.platform === 'win32' ? absolute.toLowerCase() : absolute;
}
function workspace(cwd) {
  const directory = canonicalDirectory(cwd);
  const env = { ...process.env, GIT_OPTIONAL_LOCKS: '0' };
  for (const key of Object.keys(env))
    if (key.startsWith('GIT_') && key !== 'GIT_OPTIONAL_LOCKS') delete env[key];
  const result = spawnSync('git', ['rev-parse', '--show-toplevel'], {
    cwd: directory,
    encoding: 'utf8',
    timeout: 3000,
    windowsHide: true,
    env
  });
  if (result.status === 0) return canonicalDirectory(result.stdout.trim());
  if (result.error && result.error.code !== 'ENOENT') throw result.error;
  if (result.status !== 0 && !result.error && !/not a git repository/i.test(result.stderr))
    throw new Error('Cannot determine Git worktree');
  for (let current = directory; ; current = path.dirname(current)) {
    if (fs.existsSync(path.join(current, '.auto'))) return current;
    if (path.dirname(current) === current) return directory;
  }
}
function safePath(root, ...parts) {
  const target = path.resolve(root, ...parts);
  const relative = path.relative(root, target);
  if (
    !relative ||
    relative.startsWith(`..${path.sep}`) ||
    relative === '..' ||
    path.isAbsolute(relative)
  )
    throw new Error('Path escapes its workspace');
  let current = root;
  for (const part of relative.split(path.sep)) {
    current = path.join(current, part);
    try {
      if (fs.lstatSync(current).isSymbolicLink())
        throw new Error('Binding paths cannot contain symbolic links');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  return target;
}
function readText(file, limit = MAX_BYTES) {
  const stat = fs.statSync(file);
  if (!stat.isFile() || stat.size > limit)
    throw new Error('Binding file exceeds capacity or is not a regular file');
  return fs.readFileSync(file, 'utf8');
}
function readJson(file) {
  const value = JSON.parse(readText(file));
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Expected JSON object');
  return value;
}
function atomicJson(root, file, value) {
  const contents = `${JSON.stringify(value, null, 2)}\n`;
  if (Buffer.byteLength(contents) > MAX_BYTES) throw new Error('Binding JSON exceeds capacity');
  safePath(root, file);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = safePath(root, `${file}.${randomUUID()}.tmp`);
  try {
    fs.writeFileSync(temporary, contents, { flag: 'wx', mode: 0o600 });
    fs.renameSync(temporary, file);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}
function locked(root, callback) {
  const auto = safePath(root, '.auto');
  fs.mkdirSync(auto, { recursive: true });
  const lock = safePath(root, '.auto', '.host-bindings.lock');
  let descriptor;
  const deadline = Date.now() + 2000;
  while (descriptor === undefined) {
    try {
      descriptor = fs.openSync(lock, 'wx', 0o600);
    } catch (error) {
      if (error.code !== 'EEXIST' || Date.now() >= deadline)
        throw new Error('Host binding lock unavailable');
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
    }
  }
  try {
    return callback();
  } finally {
    fs.closeSync(descriptor);
    fs.unlinkSync(lock);
  }
}
function lockedRoots(roots, callback) {
  const ordered = [...new Set(roots)].sort();
  const acquire = (index) =>
    index === ordered.length ? callback() : locked(ordered[index], () => acquire(index + 1));
  return acquire(0);
}
function runPath(root, runId) {
  if (
    typeof runId !== 'string' ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/.test(runId) ||
    runId === 'archive'
  )
    throw new Error('Invalid run ID');
  const directory = safePath(root, '.auto', 'runs', runId);
  if (!fs.existsSync(directory) || !fs.statSync(directory).isDirectory())
    throw new Error('Create the run before binding it');
  return directory;
}
function validateDocument(root, runId, document) {
  if (
    document.schema !== SCHEMA ||
    document.host !== 'claude' ||
    document.runId !== runId ||
    document.workspace !== root ||
    !Array.isArray(document.bindings) ||
    !Array.isArray(document.delegations) ||
    document.bindings.length > MAX_BINDINGS ||
    document.delegations.length > MAX_BINDINGS
  )
    throw new Error('Invalid run-local host bindings');
  const ids = new Set();
  for (const binding of document.bindings) {
    if (
      !binding ||
      typeof binding !== 'object' ||
      ids.has(binding.id) ||
      !receiptPattern.test(binding.id) ||
      !['controller', 'worker'].includes(binding.role) ||
      !['active', 'superseded', 'closed', 'invalidated'].includes(binding.status) ||
      !Number.isSafeInteger(binding.generation) ||
      binding.generation < 1 ||
      !Array.isArray(binding.promptIds) ||
      binding.promptIds.length > MAX_BINDINGS ||
      typeof binding.workspace !== 'string' ||
      !path.isAbsolute(binding.workspace) ||
      !receiptPattern.test(binding.epoch) ||
      !proofPattern.test(binding.proof) ||
      !receiptPattern.test(binding.receipt)
    )
      throw new Error('Invalid binding record');
    identity(binding.sessionId, 'binding session ID');
    for (const prompt of binding.promptIds) identity(prompt, 'binding prompt ID');
    if (
      new Set(binding.promptIds).size !== binding.promptIds.length ||
      (binding.role === 'controller' && (binding.workspace !== root || binding.agentId !== null)) ||
      (binding.role === 'worker' &&
        (!receiptPattern.test(binding.controllerId) || !receiptPattern.test(binding.delegationId)))
    )
      throw new Error('Invalid binding role or prompt identity');
    if (binding.role === 'worker') identity(binding.agentId, 'worker agent ID');
    validateReceipt(binding.identitySource, binding.workspace);
    if (
      binding.identitySource.id !== binding.receipt ||
      binding.identitySource.sessionId !== binding.sessionId ||
      binding.identitySource.agentId !== binding.agentId ||
      binding.identitySource.epoch !== binding.epoch ||
      (binding.role === 'worker') !== (binding.identitySource.kind === 'worker')
    )
      throw new Error('Binding identity source does not match');
    ids.add(binding.id);
  }
  const delegationIds = new Set();
  for (const delegation of document.delegations) {
    if (
      !delegation ||
      !receiptPattern.test(delegation.id) ||
      delegationIds.has(delegation.id) ||
      !proofPattern.test(delegation.ticket) ||
      !receiptPattern.test(delegation.controllerId) ||
      !Number.isSafeInteger(delegation.controllerGeneration) ||
      delegation.controllerGeneration < 1 ||
      !['registered', 'bound'].includes(delegation.status) ||
      delegation.role !== 'worker' ||
      typeof delegation.allowedWorkspace !== 'string' ||
      !path.isAbsolute(delegation.allowedWorkspace) ||
      (delegation.status === 'bound' && !receiptPattern.test(delegation.bindingId))
    )
      throw new Error('Invalid delegation record');
    identity(delegation.questId, 'delegation quest ID');
    delegationIds.add(delegation.id);
  }
  return document;
}
function documents(root, budget = { runs: 0, bytes: 0 }) {
  const directory = safePath(root, '.auto', 'runs');
  if (!fs.existsSync(directory)) return [];
  const output = [];
  const entries = fs.opendirSync(directory);
  try {
    let entry;
    while ((entry = entries.readSync())) {
      budget.runs++;
      if (budget.runs > MAX_RUNS)
        throw new Error('Run scan exceeds capacity; archive completed runs explicitly');
      if (entry.name === 'archive' || !entry.isDirectory()) continue;
      const file = safePath(root, '.auto', 'runs', entry.name, 'host-bindings.json');
      if (!fs.existsSync(file)) continue;
      budget.bytes += fs.statSync(file).size;
      if (budget.bytes > MAX_SCAN_BYTES) throw new Error('Total binding scan exceeds capacity');
      output.push({ root, file, document: validateDocument(root, entry.name, readJson(file)) });
    }
  } finally {
    entries.closeSync();
  }
  return output;
}
function save(item) {
  item.document.revision = (item.document.revision || 0) + 1;
  validateDocument(item.root, item.document.runId, item.document);
  atomicJson(item.root, item.file, item.document);
}
function cachePath(root, name) {
  return safePath(root, '.auto', 'cache', 'host-sessions', name);
}
function receiptFile(root, id) {
  if (!receiptPattern.test(id || '')) throw new Error('Invalid host receipt ID');
  return cachePath(root, `receipt-${id}.json`);
}
function sessionCache(root, sessionId) {
  return cachePath(root, `session-${hash(sessionId)}.json`);
}
function readSessionCache(root, sessionId) {
  try {
    const cached = readJson(sessionCache(root, sessionId));
    if (
      cached.schema !== 'auto-host-index-v1' ||
      cached.workspace !== root ||
      cached.sessionId !== sessionId ||
      !receiptPattern.test(cached.epoch) ||
      !receiptPattern.test(cached.sessionReceipt) ||
      (cached.receiptId != null && !receiptPattern.test(cached.receiptId)) ||
      !Array.isArray(cached.bindingIds) ||
      cached.bindingIds.some((id) => !receiptPattern.test(id))
    )
      return null;
    return cached;
  } catch {
    return null;
  }
}
function activeControllers(all, root, sessionId) {
  return all.flatMap((item) =>
    item.document.bindings
      .filter(
        (binding) =>
          binding.status === 'active' &&
          binding.role === 'controller' &&
          binding.workspace === root &&
          binding.sessionId === sessionId
      )
      .map((binding) => ({ ...item, binding }))
  );
}
function receiptContext(receipt) {
  return `[Auto host identity] ${JSON.stringify({
    host: 'claude',
    workspace: receipt.workspace,
    session_id: receipt.sessionId,
    agent_id: receipt.agentId,
    prompt_id: receipt.promptId,
    source: receipt.source,
    receipt: receipt.id,
    role: receipt.kind === 'worker' ? 'unbound-worker' : 'controller-session'
  })}`;
}
function observe(input, cwd, kind) {
  const expectedEvent = {
    session: 'SessionStart',
    prompt: 'UserPromptSubmit',
    worker: 'SubagentStart'
  }[kind];
  if (!expectedEvent || input.hook_event_name !== expectedEvent)
    throw new Error('Native identity event does not match its producer');
  const root = workspace(cwd);
  const sessionId = identity(input.session_id, 'session_id');
  if (kind !== 'worker' && input.agent_id != null)
    throw new Error('Worker events cannot establish controller identity');
  if (kind === 'session' && !sessionSources.has(input.source))
    throw new Error('SessionStart requires its native source');
  if (kind === 'worker') identity(input.agent_id, 'agent_id');
  if (input.prompt_id != null) identity(input.prompt_id, 'prompt_id');
  return locked(root, () => {
    const all = documents(root);
    let controllers = activeControllers(all, root, sessionId);
    if (kind === 'session' && ['startup', 'clear', 'fork'].includes(input.source)) {
      for (const item of all) {
        let changed = false;
        const invalidControllers = new Set(
          item.document.bindings
            .filter(
              (binding) =>
                binding.sessionId === sessionId &&
                binding.workspace === root &&
                binding.role === 'controller'
            )
            .map((binding) => binding.id)
        );
        for (const binding of item.document.bindings) {
          if (
            binding.status === 'active' &&
            ((binding.sessionId === sessionId && binding.workspace === root) ||
              invalidControllers.has(binding.controllerId))
          ) {
            binding.status = 'invalidated';
            changed = true;
          }
        }
        if (changed) save(item);
      }
      controllers = [];
    }
    const cachedFile = sessionCache(root, sessionId);
    const cached = readSessionCache(root, sessionId);
    const known = controllers.length === 1 ? controllers[0].binding : null;
    const continuing = kind !== 'session' || ['resume', 'compact'].includes(input.source);
    const epoch = continuing ? known?.epoch || cached?.epoch || randomUUID() : randomUUID();
    const id = randomUUID();
    const sessionReceipt =
      kind === 'session' ? id : known?.identitySource.sessionReceipt || cached?.sessionReceipt;
    if (kind === 'prompt' && !sessionReceipt)
      throw new Error('No SessionStart receipt; controller identity is unknown');
    const receipt = {
      schema: 'auto-host-receipt-v1',
      id,
      host: 'claude',
      kind,
      workspace: root,
      sessionId,
      agentId: kind === 'worker' ? input.agent_id : null,
      promptId: input.prompt_id || null,
      source: kind === 'session' ? input.source : expectedEvent,
      epoch,
      sessionReceipt: sessionReceipt || null,
      observedAt: new Date().toISOString()
    };
    atomicJson(root, receiptFile(root, receipt.id), receipt);
    if (kind !== 'worker')
      atomicJson(root, cachedFile, {
        schema: 'auto-host-index-v1',
        workspace: root,
        sessionId,
        epoch,
        sessionReceipt: kind === 'session' ? receipt.id : sessionReceipt,
        receiptId: receipt.id,
        bindingIds: controllers.map((item) => item.binding.id)
      });
    return receipt;
  });
}
function validateReceipt(receipt, root) {
  if (
    !receipt ||
    receipt.workspace !== root ||
    receipt.schema !== 'auto-host-receipt-v1' ||
    receipt.host !== 'claude' ||
    !receiptPattern.test(receipt.id) ||
    !receiptPattern.test(receipt.epoch) ||
    !['session', 'prompt', 'worker'].includes(receipt.kind)
  )
    throw new Error('Invalid host receipt');
  identity(receipt.sessionId, 'receipt session ID');
  if (receipt.promptId !== null) identity(receipt.promptId, 'receipt prompt ID');
  if (receipt.kind === 'worker') identity(receipt.agentId, 'receipt worker ID');
  else if (receipt.agentId !== null || !receiptPattern.test(receipt.sessionReceipt))
    throw new Error('Receipt controller identity is incomplete');
  if (
    (receipt.kind === 'session' &&
      (!sessionSources.has(receipt.source) || receipt.sessionReceipt !== receipt.id)) ||
    (receipt.kind === 'prompt' && receipt.source !== 'UserPromptSubmit') ||
    (receipt.kind === 'worker' && receipt.source !== 'SubagentStart') ||
    typeof receipt.observedAt !== 'string' ||
    !Number.isFinite(Date.parse(receipt.observedAt))
  )
    throw new Error('Invalid receipt lifecycle evidence');
  return receipt;
}
function readReceipt(root, id, kind) {
  const receipt = validateReceipt(readJson(receiptFile(root, id)), root);
  if (receipt.id !== id || (kind && receipt.kind !== kind))
    throw new Error('Host receipt does not match the requested role/worktree');
  const age = Date.now() - Date.parse(receipt.observedAt);
  if (age < -60000 || age > 24 * 60 * 60 * 1000)
    throw new Error('Host receipt expired or has a future timestamp; obtain a new native event');
  return receipt;
}
function publicBinding(item) {
  const binding = item.binding;
  return {
    status: 'bound',
    host: 'claude',
    root: item.root,
    runId: item.document.runId,
    runDirectory: path.dirname(item.file),
    bindingId: binding.id,
    generation: binding.generation,
    sessionId: binding.sessionId,
    agentId: binding.agentId,
    role: binding.role,
    promptIds: binding.promptIds,
    proof: binding.proof
  };
}
function bindController(options) {
  const root = workspace(options.root);
  return locked(root, () => {
    const receipt = readReceipt(root, options.receipt);
    if (!['session', 'prompt'].includes(receipt.kind) || receipt.agentId !== null)
      throw new Error('Controller needs a native session/prompt receipt');
    const cached = readSessionCache(root, receipt.sessionId);
    if (!cached || cached.epoch !== receipt.epoch || cached.receiptId !== receipt.id)
      throw new Error('Stale host receipt');
    const directory = runPath(root, options.run);
    const all = documents(root);
    let item = all.find((candidate) => candidate.document.runId === options.run);
    if (!item) {
      item = {
        root,
        file: safePath(root, directory, 'host-bindings.json'),
        document: {
          schema: SCHEMA,
          host: 'claude',
          workspace: root,
          runId: options.run,
          revision: 0,
          bindings: [],
          delegations: []
        }
      };
      all.push(item);
    }
    const active = activeControllers(all, root, receipt.sessionId);
    if (active.length > 1)
      throw new Error('Conflicting active controller bindings; close them explicitly');
    const historical = all
      .flatMap((entry) => entry.document.bindings.map((binding) => ({ ...entry, binding })))
      .filter(
        (entry) => entry.binding.sessionId === receipt.sessionId && entry.binding.workspace === root
      );
    if (
      receipt.promptId &&
      historical.some(
        (entry) =>
          entry.document.runId !== options.run && entry.binding.promptIds.includes(receipt.promptId)
      )
    )
      throw new Error(
        'One native prompt cannot identify two runs; obtain a new prompt or use explicit manual records'
      );
    if (
      historical.some(
        (entry) => entry.document.runId !== options.run && entry.binding.receipt === receipt.id
      )
    )
      throw new Error('One native receipt cannot identify two runs');
    let binding = active.find(
      (entry) => entry.document.runId === options.run && entry.binding.epoch === receipt.epoch
    )?.binding;
    if (!binding) {
      for (const entry of active) {
        for (const previous of entry.document.bindings) {
          if (
            previous.status === 'active' &&
            (previous.id === entry.binding.id || previous.controllerId === entry.binding.id)
          )
            previous.status = 'superseded';
        }
        save(entry);
      }
      binding = {
        id: randomUUID(),
        generation: Math.max(0, ...historical.map((entry) => entry.binding.generation)) + 1,
        role: 'controller',
        status: 'active',
        workspace: root,
        sessionId: receipt.sessionId,
        agentId: null,
        epoch: receipt.epoch,
        promptIds: [],
        proof: randomBytes(24).toString('hex'),
        receipt: receipt.id,
        identitySource: receipt,
        createdAt: new Date().toISOString()
      };
      item.document.bindings.push(binding);
    }
    if (receipt.promptId && !binding.promptIds.includes(receipt.promptId))
      binding.promptIds.push(receipt.promptId);
    // Keep the latest native receipt in run truth, including hosts without prompt IDs.
    // Older receipts are rejected by the session cache before historical run checks.
    binding.receipt = receipt.id;
    binding.identitySource = receipt;
    save(item);
    atomicJson(root, sessionCache(root, receipt.sessionId), {
      ...cached,
      bindingIds: [binding.id]
    });
    const result = publicBinding({ ...item, binding });
    const pending = consumePending({ ...result, workspace: root });
    return {
      ...result,
      pendingContext: typeof pending === 'string' ? pending : null,
      ...(pending?.status === 'unattributed' ? { pendingReason: pending.reason } : {})
    };
  });
}
function confirmedController(all, options) {
  const matches = all.flatMap((item) =>
    item.document.bindings
      .filter((binding) => binding.id === options.binding)
      .map((binding) => ({ ...item, binding }))
  );
  if (matches.length !== 1) throw new Error('Controller binding is missing or conflicting');
  const item = matches[0];
  if (
    item.binding.role !== 'controller' ||
    item.binding.status !== 'active' ||
    item.binding.proof !== options.proof ||
    item.binding.generation !== Number(options.generation)
  )
    throw new Error('Controller identity/generation not confirmed');
  return item;
}
function registerDelegation(options) {
  const root = workspace(options.root);
  const workerRoot = workspace(options['worker-root'] || root);
  return locked(root, () => {
    const item = confirmedController(documents(root), options);
    const delegation = {
      id: randomUUID(),
      ticket: randomBytes(24).toString('hex'),
      questId: identity(options.quest, 'quest ID'),
      controllerId: item.binding.id,
      controllerGeneration: item.binding.generation,
      allowedWorkspace: workerRoot,
      role: 'worker',
      status: 'registered',
      createdAt: new Date().toISOString()
    };
    item.document.delegations.push(delegation);
    save(item);
    return {
      status: 'registered',
      root,
      runId: item.document.runId,
      delegationId: delegation.id,
      ticket: delegation.ticket,
      questId: delegation.questId,
      workerRoot
    };
  });
}
function bindWorker(options) {
  const root = workspace(options.root);
  const workerRoot = workspace(options['worker-root'] || root);
  const receipt = readReceipt(workerRoot, options.receipt, 'worker');
  return lockedRoots([root, workerRoot], () => {
    const all = documents(root);
    const matches = all.flatMap((item) =>
      item.document.delegations
        .filter((delegation) => delegation.id === options.delegation)
        .map((delegation) => ({ ...item, delegation }))
    );
    if (matches.length !== 1) throw new Error('Delegation is missing or conflicting');
    const item = matches[0];
    const delegation = item.delegation;
    const controller = item.document.bindings.find(
      (binding) => binding.id === delegation.controllerId
    );
    if (
      !controller ||
      controller.status !== 'active' ||
      controller.generation !== delegation.controllerGeneration ||
      delegation.ticket !== options.ticket ||
      delegation.allowedWorkspace !== workerRoot ||
      delegation.role !== 'worker'
    )
      throw new Error('Delegation handshake did not confirm controller/worktree');
    const existing = item.document.bindings.find(
      (binding) => binding.delegationId === delegation.id
    );
    if (existing) {
      if (
        existing.status !== 'active' ||
        existing.sessionId !== receipt.sessionId ||
        existing.agentId !== receipt.agentId
      )
        throw new Error('Delegation already claimed by a different or inactive worker');
      if (receipt.promptId && !existing.promptIds.includes(receipt.promptId)) {
        existing.promptIds.push(receipt.promptId);
        save(item);
      }
      writeOwnerHint(workerRoot, root, existing);
      return publicBinding({ ...item, binding: existing });
    }
    if (delegation.status !== 'registered') throw new Error('Delegation is not available');
    const conflicts = all
      .flatMap((entry) => entry.document.bindings)
      .filter(
        (binding) =>
          binding.status === 'active' &&
          binding.workspace === workerRoot &&
          binding.sessionId === receipt.sessionId &&
          binding.agentId === receipt.agentId
      );
    if (conflicts.length) throw new Error('Worker already has an active binding');
    const binding = {
      id: randomUUID(),
      generation: controller.generation,
      role: 'worker',
      status: 'active',
      workspace: workerRoot,
      sessionId: receipt.sessionId,
      agentId: receipt.agentId,
      epoch: receipt.epoch,
      promptIds: receipt.promptId ? [receipt.promptId] : [],
      proof: randomBytes(24).toString('hex'),
      receipt: receipt.id,
      identitySource: receipt,
      controllerId: controller.id,
      delegationId: delegation.id,
      questId: delegation.questId,
      createdAt: new Date().toISOString()
    };
    item.document.bindings.push(binding);
    delegation.status = 'bound';
    delegation.bindingId = binding.id;
    save(item);
    writeOwnerHint(workerRoot, root, binding);
    return publicBinding({ ...item, binding });
  });
}
function writeOwnerHint(workerRoot, root, binding, repair = false) {
  if (workerRoot === root) return;
  const file = cachePath(
    workerRoot,
    `owner-${hash(`${binding.sessionId}:${binding.agentId}`)}.json`
  );
  let owners;
  try {
    owners = readOwners(workerRoot, binding.sessionId, binding.agentId);
  } catch (error) {
    if (!repair) throw error;
    owners = [];
  }
  if (!owners.some((entry) => entry.ownerWorkspace === root && entry.bindingId === binding.id))
    owners.push({ ownerWorkspace: root, bindingId: binding.id });
  if (owners.length > MAX_BINDINGS) throw new Error('Worker owner index exceeds capacity');
  atomicJson(workerRoot, file, {
    schema: 'auto-host-owner-hint-v1',
    workspace: workerRoot,
    sessionId: binding.sessionId,
    agentId: binding.agentId,
    owners
  });
}
function readOwners(root, sessionId, agentId) {
  const file = cachePath(root, `owner-${hash(`${sessionId}:${agentId}`)}.json`);
  if (!fs.existsSync(file)) return [];
  const hint = readJson(file);
  if (
    hint.schema !== 'auto-host-owner-hint-v1' ||
    hint.workspace !== root ||
    hint.sessionId !== sessionId ||
    hint.agentId !== agentId ||
    !Array.isArray(hint.owners) ||
    hint.owners.length > MAX_BINDINGS ||
    hint.owners.some(
      (entry) =>
        !entry ||
        typeof entry.ownerWorkspace !== 'string' ||
        !path.isAbsolute(entry.ownerWorkspace) ||
        !receiptPattern.test(entry.bindingId)
    )
  )
    throw new Error(
      'Invalid worker owner index; rebuild from an explicit owner after removing the damaged cache'
    );
  return hint.owners;
}
function unknown(reason) {
  return { status: 'unattributed', reason };
}
function resolve(input, cwd) {
  try {
    const root = workspace(cwd);
    const sessionId = identity(input.session_id, 'session_id');
    const agentId = input.agent_id == null ? null : identity(input.agent_id, 'agent_id');
    if (!input.auto_binding && !agentId && !lifecycleEvents.has(input.hook_event_name)) {
      // Missing worker identity is not proof of a controller, regardless of run contents.
      return unknown('controller-role-unconfirmed; use an explicit binding record');
    }
    const owners = new Set([root]);
    if (agentId) {
      for (const hint of readOwners(root, sessionId, agentId))
        owners.add(canonicalDirectory(hint.ownerWorkspace));
    }
    const budget = { runs: 0, bytes: 0 };
    const all = [...owners].flatMap((owner) => documents(owner, budget));
    let candidates = all.flatMap((item) =>
      item.document.bindings
        .filter(
          (binding) =>
            binding.status === 'active' &&
            binding.workspace === root &&
            binding.sessionId === sessionId &&
            binding.agentId === agentId
        )
        .map((binding) => ({ ...item, binding }))
    );
    if (input.auto_binding) {
      const proof = input.auto_binding;
      candidates = candidates.filter(
        (item) =>
          item.binding.id === proof.id &&
          item.binding.generation === proof.generation &&
          item.binding.proof === proof.proof
      );
    }
    if (candidates.length !== 1)
      return unknown(candidates.length ? 'conflicting-bindings' : 'no-active-binding');
    const item = candidates[0];
    if (item.binding.role === 'worker') {
      const controller = item.document.bindings.find(
        (binding) => binding.id === item.binding.controllerId
      );
      const delegation = item.document.delegations.find(
        (entry) => entry.id === item.binding.delegationId
      );
      if (
        !controller ||
        controller.role !== 'controller' ||
        controller.status !== 'active' ||
        !delegation ||
        delegation.status !== 'bound' ||
        controller.generation !== item.binding.generation ||
        delegation.bindingId !== item.binding.id ||
        delegation.controllerId !== controller.id ||
        delegation.controllerGeneration !== controller.generation ||
        delegation.allowedWorkspace !== item.binding.workspace ||
        delegation.questId !== item.binding.questId
      )
        return unknown('inactive-worker-parent');
    }
    const sessionRecovery =
      input.hook_event_name === 'SessionStart' && ['resume', 'compact'].includes(input.source);
    const explicitRecord = input.hook_event_name === 'AutoRecord' && input.auto_binding;
    if (
      !sessionRecovery &&
      !explicitRecord &&
      (!input.prompt_id || !item.binding.promptIds.includes(input.prompt_id))
    )
      return unknown('prompt-generation-unconfirmed');
    if (
      explicitRecord &&
      input.prompt_id != null &&
      !item.binding.promptIds.includes(input.prompt_id)
    )
      return unknown('explicit-prompt-not-bound');
    if (input.hook_event_name === 'SessionStart' && !sessionRecovery)
      return unknown('new-session-requires-binding');
    const file = sessionCache(root, sessionId);
    if (item.binding.role === 'controller' && fs.existsSync(file)) {
      const cached = readSessionCache(root, sessionId);
      if (cached && cached.epoch !== item.binding.epoch) return unknown('session-epoch-mismatch');
    }
    return { ...publicBinding(item), binding: item.binding, item, workspace: root };
  } catch (error) {
    return unknown(error.message);
  }
}
function withBinding(input, cwd, role, callback) {
  const first = resolve(input, cwd);
  if (first.status !== 'bound' || (role && first.role !== role))
    return unknown(first.reason || 'role-not-allowed');
  try {
    return lockedRoots([first.root, first.workspace], () => {
      const current = resolve(input, cwd);
      if (
        current.status !== 'bound' ||
        current.bindingId !== first.bindingId ||
        (role && current.role !== role)
      )
        return unknown(current.reason || 'binding-changed');
      return callback(current);
    });
  } catch (error) {
    return unknown(error.message);
  }
}
function diagnostic(input, cwd, result) {
  if (result?.status !== 'unattributed') return '';
  try {
    const root = workspace(cwd);
    const sessionId = typeof input.session_id === 'string' ? input.session_id : 'unknown';
    const file = cachePath(root, `unattributed-${hash(sessionId)}.json`);
    if (fs.existsSync(file)) {
      const prior = readJson(file);
      if (
        prior.reason === result.reason &&
        prior.event === input.hook_event_name &&
        prior.agentId === (input.agent_id || null) &&
        prior.promptId === (input.prompt_id || null)
      )
        return '';
    }
    atomicJson(root, file, {
      status: 'unattributed',
      event: input.hook_event_name || null,
      reason: result.reason,
      sessionId: input.session_id || null,
      agentId: input.agent_id || null,
      promptId: input.prompt_id || null,
      observedAt: new Date().toISOString()
    });
  } catch {
    /* Diagnostics must not turn an unknown event into a run mutation. */
  }
  return `[Hook] Auto attribution unavailable: ${result.reason}. No run was selected.`;
}
function pendingFile(binding) {
  return safePath(
    binding.root,
    binding.runDirectory,
    'host-pending',
    `${hash(`${binding.workspace}:${binding.sessionId}:${binding.bindingId}:${binding.generation}`)}.json`
  );
}
function compact(input, cwd) {
  if (!['PreCompact', 'PostCompact', 'AutoRecord'].includes(input.hook_event_name))
    return unknown('unexpected-compact-event');
  return withBinding(input, cwd, 'controller', (binding) => {
    atomicJson(binding.root, pendingFile(binding), {
      bindingId: binding.bindingId,
      generation: binding.generation,
      sessionId: binding.sessionId,
      runId: binding.runId,
      workspace: binding.workspace,
      message: `[Hook] ${input.hook_event_name === 'AutoRecord' ? 'Explicit continuity reminder' : 'Compaction hook ran'} for ${binding.runId}. Read ${path.join(binding.runDirectory, 'session-continuity.md')} and project instructions if present. A hook cannot save the model's in-memory progress.`
    });
    return { status: 'saved', runId: binding.runId };
  });
}
function consume(input, cwd) {
  if (!['SessionStart', 'UserPromptSubmit'].includes(input.hook_event_name))
    return unknown('unexpected-context-consumer-event');
  return withBinding(input, cwd, 'controller', consumePending);
}
function consumePending(binding) {
  const file = pendingFile(binding);
  if (!fs.existsSync(file)) return '';
  const pending = readJson(file);
  if (
    pending.bindingId !== binding.bindingId ||
    pending.generation !== binding.generation ||
    pending.runId !== binding.runId ||
    pending.sessionId !== binding.sessionId ||
    pending.workspace !== binding.workspace
  )
    return unknown('pending-context-identity-mismatch');
  fs.unlinkSync(file);
  return typeof pending.message === 'string' ? pending.message : '';
}
function recordDirty(input, cwd) {
  if (!['PostToolUse', 'AutoRecord'].includes(input.hook_event_name))
    return unknown('unexpected-dirty-event');
  return withBinding(input, cwd, null, (binding) => {
    const value = input.tool_input?.file_path;
    const explicit = input.hook_event_name === 'AutoRecord';
    if (typeof value !== 'string' || !value.trim()) {
      if (explicit) throw new Error('Explicit dirty record requires a file path');
      return '';
    }
    if (!explicit && !/\.(ts|tsx|js|jsx|java|py|go|rs|md)$/.test(value)) return '';
    identity(value, 'dirty file path');
    const file = safePath(binding.workspace, path.resolve(cwd, value));
    const target = safePath(binding.root, binding.runDirectory, 'dirty.txt');
    const contents = fs.existsSync(target) ? readText(target) : '';
    const lines = contents.split('\n').filter(Boolean);
    if (!lines.includes(file)) {
      if (Buffer.byteLength(`${contents}${file}\n`) > MAX_BYTES)
        throw new Error('Dirty list exceeds capacity');
      fs.appendFileSync(target, `${file}\n`);
    }
    return explicit ? { status: 'recorded', runId: binding.runId, file } : '';
  });
}
function recordTool(input, cwd) {
  if (!['PostToolUse', 'PostToolUseFailure', 'AutoRecord'].includes(input.hook_event_name))
    return unknown('unexpected-tool-event');
  return withBinding(input, cwd, null, (binding) => {
    const tool = identity(input.tool_name, 'tool_name');
    const file = safePath(binding.root, binding.runDirectory, 'host-tool-events.jsonl');
    const toolUseId = input.tool_use_id == null ? null : identity(input.tool_use_id, 'tool_use_id');
    const event = {
      schema: 'auto-host-tool-event-v1',
      host: 'claude',
      runId: binding.runId,
      bindingId: binding.bindingId,
      generation: binding.generation,
      role: binding.role,
      sessionId: binding.sessionId,
      agentId: binding.agentId,
      promptId: input.prompt_id || null,
      tool,
      toolUseId,
      event: input.hook_event_name,
      observedAt: new Date().toISOString(),
      tokens: null,
      cost: null
    };
    const contents = fs.existsSync(file) ? readText(file, MAX_LOG_BYTES) : '';
    if (toolUseId && contents) {
      const duplicate = contents
        .split('\n')
        .filter(Boolean)
        .map(JSON.parse)
        .some(
          (prior) =>
            prior.bindingId === binding.bindingId &&
            prior.toolUseId === toolUseId &&
            prior.event === event.event
        );
      if (duplicate) return '';
    }
    const line = `${JSON.stringify(event)}\n`;
    if (Buffer.byteLength(contents) + Buffer.byteLength(line) > MAX_LOG_BYTES)
      throw new Error('Tool observations exceed capacity');
    fs.appendFileSync(file, line);
    return '';
  });
}
function close(options) {
  const root = workspace(options.root);
  return locked(root, () => {
    const item = confirmedController(documents(root), options);
    for (const binding of item.document.bindings)
      if (binding.id === item.binding.id || binding.controllerId === item.binding.id)
        binding.status = 'closed';
    save(item);
    return { status: 'closed', runId: item.document.runId };
  });
}
function rebuild(options) {
  const root = workspace(options.root);
  const owner = options['owner-root'] ? workspace(options['owner-root']) : root;
  return lockedRoots([root, owner], () => {
    const all = documents(owner);
    const groups = new Map();
    for (const item of all)
      for (const binding of item.document.bindings) {
        if (binding.workspace !== root || binding.status !== 'active') continue;
        const key = JSON.stringify([binding.sessionId, binding.agentId]);
        groups.set(key, [...(groups.get(key) || []), { ...item, binding }]);
      }
    const result = [];
    for (const entries of groups.values()) {
      if (entries.length !== 1) {
        result.push({ status: 'unattributed', reason: 'conflicting-bindings' });
        continue;
      }
      const { binding } = entries[0];
      if (binding.role === 'controller')
        atomicJson(root, sessionCache(root, binding.sessionId), {
          schema: 'auto-host-index-v1',
          workspace: root,
          sessionId: binding.sessionId,
          epoch: binding.epoch,
          sessionReceipt: binding.receipt,
          bindingIds: [binding.id]
        });
      else if (owner !== root) writeOwnerHint(root, owner, binding, true);
      result.push({ status: 'indexed', bindingId: binding.id });
    }
    return { status: 'rebuilt', bindings: result };
  });
}
function record(options) {
  const root = workspace(options.root);
  const item = confirmedController(documents(root), options);
  const input = {
    cwd: root,
    session_id: item.binding.sessionId,
    prompt_id: options.prompt,
    hook_event_name: 'AutoRecord',
    auto_binding: {
      id: item.binding.id,
      generation: item.binding.generation,
      proof: options.proof
    },
    tool_input: { file_path: options.file },
    tool_name: options.tool
  };
  const actions = { continuity: compact, dirty: recordDirty, tool: recordTool };
  if (!actions[options.kind])
    throw new Error('Explicit record kind must be continuity, dirty, or tool');
  const result = actions[options.kind](input, root);
  if (result?.status === 'unattributed') throw new Error(result.reason);
  return result || { status: 'recorded', runId: item.document.runId };
}
function cli(argv) {
  const [action, ...args] = argv;
  const options = {};
  for (let index = 0; index < args.length; index += 2) {
    if (!/^--[a-z-]+$/.test(args[index]) || !args[index + 1] || args[index + 1].startsWith('--'))
      throw new Error('Use separate --name value arguments');
    const key = args[index].slice(2);
    if (Object.hasOwn(options, key)) throw new Error(`Duplicate option: ${key}`);
    options[key] = args[index + 1];
  }
  const actions = {
    'bind-controller': bindController,
    'register-delegation': registerDelegation,
    'bind-worker': bindWorker,
    close,
    rebuild,
    record
  };
  if (!actions[action]) throw new Error('Unknown binding action');
  return actions[action](options);
}

module.exports = {
  workspace,
  safePath,
  observe,
  receiptContext,
  bindController,
  registerDelegation,
  bindWorker,
  resolve,
  withBinding,
  diagnostic,
  compact,
  consume,
  recordDirty,
  recordTool,
  close,
  rebuild
};

if (require.main === module) {
  try {
    process.stdout.write(`${JSON.stringify(cli(process.argv.slice(2)))}\n`);
  } catch (error) {
    process.stderr.write(`[Auto binding] ${error.message}\n`);
    process.exitCode = 1;
  }
}
