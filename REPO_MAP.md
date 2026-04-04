# REPO_MAP.md

> 2026-04-04 | 32 files, 299 symbols | 8f88974

## ./
  eslint.config.js: 
    <- @eslint/js, globals
  vitest.config.js: defineConfig
    <- vitest/config

## bin/
  cli.js: 
    <- commander, ../src/index.js(7), ../src/utils.js(3), ../src/config.js, ../src/knowledge/knowledge-steward.js, chalk

## hooks/lib/
  tdd-guard.js: TDDGuardOptions, TDDGuard, checkTDD, analyzeTDD, class TDDGuard { constructor(options), isExempt(filePath), getTestFilePaths(sourcePath), checkTestFile(sourcePath), analyzeDirectory(dirPath), generateReport(violations), createBlockMessage(sourcePath, check) }, async checkTDD(filePath, options), async analyzeTDD(dirPath, options)
    <- node:path, node:fs/promises, fs-extra

## src/
  config.js: PROJECT_ROOT, DOCS_URL, LOG_LEVEL, DEFAULT_MAX_RETRIES, DEFAULT_TIMEOUT, CLAUDE_DIR
    <- url, path, os
  index.js: interactiveMode, runInstall, runUpdate, runUninstall, runDocs, runRoute, runAnalyze, WorkflowOrchestrator, RepoIndexer, async interactiveMode(), async runInstall(options), async runUpdate(options), async runUninstall(options), async runDocs(), async runRoute(userIntent, options), async runAnalyze(task, options)
    <- installer.js, prompts.js(5), utils.js(3), logger.js, config.js, workflow/workflow-orchestrator.js, chalk
  installer.js: install, uninstall, checkStatus, async install(selectedComponents, options), async backupFile(filePath), async copyRecursive(src, dest, options, depth), async uninstall(selectedComponents), async getSourceFilesList(sourcePath, recursive), async traverse(currentPath, relativePath, depth), async cleanupEmptySubDirs(dirPath), async cleanupEmptyDirs(claudeDir, selectedComponents), async checkStatus(), async countFiles(dirPath, recursive, depth)
    <- utils.js(6), path, fs-extra, ora, chalk
  logger.js: Logger, logger, LOG_LEVELS, class Logger { constructor(options), setLevel(level), _formatMessage(message, meta), debug(message, meta), info(message, meta), warn(message, meta), error(message, meta), success(message, meta), log(message, meta), infoRaw(message) }
    <- config.js, chalk
  prompts.js: showBanner, promptConfirmation, promptUninstallConfirmation, promptComponentSelection, promptMainMenu, showBanner(), async promptConfirmation(message), async promptUninstallConfirmation(), async promptComponentSelection(), async promptMainMenu()
    <- utils.js(4), inquirer, chalk
  types.d.ts: 
  utils.js: getClaudeDir, getAutoDir, getCustomDir, getVersionFilePath, getInstalledVersion, saveInstalledVersion, getPackageVersion, COMPONENTS, getSourceDir, openBrowser, getClaudeDir(), getAutoDir(), getCustomDir(), getVersionFilePath(), async getInstalledVersion(), async saveInstalledVersion(version, components, installedFiles), getPackageVersion(), getSourceDir(), async openBrowser(url)
    <- child_process, url, os, path, fs-extra

## src/budget/
  context-compressor.js: COMPRESSION_LEVELS, STATUS_TO_LEVEL, COMPRESSION_NAMES, TOOL_OUTPUT_TYPES, COMPRESSION_DEFAULTS, selectCompressionLevel, createCompressionResult, truncateLargeOutputs, snipOldToolOutputs, microCompactHistory, collapseConsecutive, autoCompactRecommend, createSessionSummary, createResumeDirective, compressContext, ContextCompressor, class ContextCompressor { constructor(config), compress(monitor), getConfig() }, selectCompressionLevel(contextStatus), createCompressionResult(params), truncateLargeOutputs(snapshot, config), snipOldToolOutputs(snapshot, config), microCompactHistory(snapshot, config), collapseConsecutive(snapshot, config), autoCompactRecommend(snapshot), createSessionSummary(sessionState), createResumeDirective(summary), compressContext(snapshot, contextStatus, config)
    <- context-monitor.js, ../logger.js
  context-monitor.js: DEFAULT_CONTEXT_LIMIT, CONTEXT_THRESHOLDS, CONTEXT_STATUS, CONTEXT_ACTIONS, estimateTokens, createContextSnapshot, recordUsage, getContextStatus, getSuggestedAction, getContextSummary, applyCompaction, ContextMonitor, class ContextMonitor { constructor(options), record(chars, label), getStatus(), getSummary(), getAction(), compact(reducedTokens), getSnapshot() }, estimateTokens(chars), createContextSnapshot(options), recordUsage(snapshot, chars, label), getContextStatus(snapshot), getSuggestedAction(snapshot), getContextSummary(snapshot), applyCompaction(snapshot, reducedTokens)
    <- ../logger.js
  token-budget.js: DEFAULT_TOTAL_BUDGET, PHASE_QUOTAS, ALERT_THRESHOLDS, BUDGET_STATUS, createBudget, consumeTokens, getBudgetStatus, getPhaseStatus, canAfford, getBudgetSummary, TokenBudgetManager, class TokenBudgetManager { constructor(options), consume(phase, tokens, label), canAfford(phase, estimatedTokens), getSnapshot(), getStatus(), getPhaseStatus(phase), getSummary() }, createBudget(options), consumeTokens(budget, phase, tokens, label), getBudgetStatus(budget), getPhaseStatus(budget, phase), canAfford(budget, phase, estimatedTokens), getBudgetSummary(budget)
    <- ../logger.js

## src/flow/
  circuit-breaker.js: CIRCUIT_STATES, CIRCUIT_EVENTS, DEFAULT_CIRCUIT_OPTIONS, createCircuitState, canExecute, recordSuccess, recordFailure, tryHalfOpen, recordHalfOpenAttempt, resetCircuit, getCircuitSummary, createCircuitState(options), canExecute(circuitState), recordSuccess(circuitState), recordFailure(circuitState, reason), tryHalfOpen(circuitState), recordHalfOpenAttempt(circuitState), resetCircuit(circuitState), getCircuitSummary(circuitState)
    <- ../logger.js
  flow-engine.js: FlowEngine, FLOW_STATES, FLOW_EVENTS, TRANSITIONS, class FlowEngine { constructor(id, options), transition(event, data), onTransition(listener), toSnapshot(), fromSnapshot(snapshot), getPhase(), getSummary(), getCircuitState(), _notifyListeners(transition) }
    <- flow-state.js(8), circuit-breaker.js(9), ../logger.js, node:path, fs-extra
  flow-state.js: FLOW_STATES, FLOW_EVENTS, TRANSITIONS, PHASE_TO_STATE, STATE_TO_PHASE, canTransition, getNextState, isTerminal, isResumable, canTransition(currentState, event), getNextState(currentState, event), isTerminal(state), isResumable(state)

## src/indexer/
  patterns.js: DEFAULT_INCLUDE_PATTERNS, DEFAULT_EXCLUDE_PATTERNS, extractExports, extractClasses, extractFunctions, extractImports, detectLanguage, stripComments(content), _lastNonSpaceChar(arr), _isRegexPrefix(ch), extractExports(content), extractClasses(content), extractFunctions(content), extractImports(content), detectLanguage(filePath), _truncateParams(paramsStr)
  repo-indexer.js: RepoIndexer, class RepoIndexer { constructor(projectDir, options), buildIndex(options), generateRepoMap(outputPath), generateSymbolIndex(outputPath), search(query), getSymbolsForFile(relativePath), clearCache(), _fullBuild(), _incrementalBuild(currentHashes, cachedHashes), _buildResult(entries), _emptyResult(), _scanFiles(), _walkDir(dirPath, relativeDir, results, depth), _shouldExclude(name, relPath), _shouldInclude(name), _indexFile(filePath, relativePath), _formatRepoMap(index), _computeFileHashes(), _hashesEqual(current, cached), _detectIncrementalChanges(current, cached) }, stripFilePath({ filePath: _fp, ...rest })
    <- node:crypto, child_process, ../logger.js, patterns.js(7), node:path, fs-extra

## src/knowledge/
  categories.js: CATEGORIES, classifyContent, getCategoryByName, classifyContent(content, hint), getCategoryByName(name)
  knowledge-steward.js: KnowledgeSteward, class KnowledgeSteward { constructor(projectDir), ensureStructure(), save({ content, category, tags, gitCommit), list(), search(query, options), _buildFileHeader(category), _formatEntry(content, tags), _gitCommit(filePath, categoryName) }
    <- child_process, ../logger.js, categories.js, path, fs-extra

## src/memory/
  auto-dream.js: DREAM_PHASES, DREAM_GATE_DEFAULTS, checkDreamGate, scoreEntry, selectMergeGroups, selectPromotionCandidates, orient, gather, consolidate, prune, twoTurnExtract, autoDream, createDreamResult, AutoDreamScheduler, class AutoDreamScheduler { constructor(options), shouldRun(), incrementSession(), run(memoryManager, options), getLastDreamTime(), getSessionCount() }, checkDreamGate({ lastDreamTime, sessionCount, isIdle, gateConfig), scoreEntry(entry, maxAgeHours), selectMergeGroups(entries), selectPromotionCandidates(entries), async orient(memoryManager), async gather(memoryManager, options), async consolidate(memoryManager, gatheredEntries, orientResult, options), async prune(memoryManager), async twoTurnExtract(memoryManager, messages, options), extractMemoryCandidates(messages), async autoDream(memoryManager, options), createDreamResult(params)
    <- ../logger.js, memory-tiers.js(5)
  memory-manager.js: MemoryManager, class MemoryManager { constructor(options), set(key, value, options), get(key), delete(key, tier), searchByTags(tags), search(query), cleanup(), getStats(), _getFromTier(key, tier), _putToTier(entry), _getAllEntries(), _getCachedStore(tier, dir), _invalidateCache(tier), _loadStore(dir), _saveStore(dir, store), _cleanupStore(dir, tier) }
    <- ../logger.js, memory-tiers.js(10), node:path, fs-extra
  memory-tiers.js: MEMORY_TIERS, TIER_PRIORITY, DEFAULT_TTL, PROMOTE_THRESHOLD, createMemoryEntry, touchEntry, updateEntryValue, promoteEntry, isExpired, shouldPromote, getProjectMemoryDir, getGlobalMemoryDir, createMemoryEntry({ key, value, tier, tags, ttl }), touchEntry(entry), updateEntryValue(entry, newValue), promoteEntry(entry, targetTier), isExpired(entry), shouldPromote(entry), getProjectMemoryDir(projectDir), getGlobalMemoryDir()
    <- node:path, node:os

## src/router/
  agent-registry.js: AgentRegistry, class AgentRegistry { constructor(projectDir), initialize(), listAgents(filters), getAgent(name), registerAgent(manifest), unregisterAgent(name), findCandidates(keywords), getFallbackChain(agentName), getStats(), lazyRegister(manifest), resolveTeam({ keywords, complexity, maxSize), _flushLazyQueue(), _loadCustomAgents(), _parseAgentFile(filePath, name) }
    <- ../logger.js, agent-types.js, node:path, fs-extra
  agent-types.js: COMPLEXITY_LEVELS, AGENT_STATES
  canonical-router.js: CanonicalRouter, class CanonicalRouter { constructor(registry), initialize(), route(userIntent, context), _analyzeIntent(userIntent, context), _assessComplexity(text), _applyContextFilters(candidates, intent, context), _applySecurityPriority(candidates, intent), _buildMatchReason(selected), _defaultRoute(reason), diagnose() }, segmentCJK(text)
    <- ../logger.js, agent-types.js, agent-registry.js
  model-router.js: MODEL_TIERS, MODEL_IDS, MODEL_NAMES, COMPLEXITY_TO_TIER, KEYWORD_TIERS, routeByAgent, routeByKeywords, routeModel, routeByAgent(agent), routeByKeywords(keywords), routeModel({ agent, keywords, override })
    <- agent-types.js

## src/skills/
  skill-indexer.js: SkillIndexer, class SkillIndexer { constructor(skillsDir), buildIndex(options), search(keywords), loadContent(relativePath), getIndexSummary(), _extractMetadata(filePath, relativePath), _computeFileHashes(), _hashesEqual(current, cached), clearCache() }, async computeFileHash(filePath, relativePath)
    <- node:crypto, child_process, ../logger.js, node:path, fs-extra

## src/utils/
  trace-compactor.js: FILTERED_PATTERNS, PROJECT_PATTERNS, parseFrame, createFingerprint, compactTrace, clearFingerprints, getFingerprintCount, parseFrame(line), createFingerprint(input), compactTrace(input, options), clearFingerprints(), getFingerprintCount()
    <- node:crypto

## src/workflow/
  phase-context.js: PHASE_NAMES, EXECUTION_MODES, createPhaseContext, updatePhaseContext, detectExecutionMode, createPhaseContext(options), updatePhaseContext(ctx, updates), assessComplexity(text), detectExecutionMode(task, options)
    <- ../logger.js, ../router/agent-types.js
  workflow-orchestrator.js: WorkflowOrchestrator, class WorkflowOrchestrator { constructor(options), run(task, options), _runDiscover(), _runReason(), _generateQuestMap(agentRoute), _classifyMemberQuest(member), _runExecute(), _executeQuest(quest, modelRoute, questEngine), _runVerify(), _runCommit(), _runLearn(), _extractKeywords(task), _buildResult(status, error), getFlowState(), getContext(), _countAgents(), _countCommands(), _countHooks() }, gitCommit(files, message), runTests(projectDir)
    <- ../flow/flow-engine.js, ../memory/memory-manager.js, ../budget/token-budget.js, ../budget/context-monitor.js, ../budget/context-compressor.js, ../memory/auto-dream.js, ../knowledge/knowledge-steward.js, ../router/model-router.js, ../router/canonical-router.js, ../router/agent-registry.js, ../skills/skill-indexer.js, ../utils/trace-compactor.js, phase-context.js(4), ../router/agent-types.js, ../logger.js, node:child_process, node:path

---
169 exports, 14 classes, 116 functions | `auto codemaps`