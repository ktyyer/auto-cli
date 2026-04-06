# REPO_MAP.md

> 2026-04-06 | 65 files, 383 symbols | deabb10

## ./
  eslint.config.js: 
    <- @eslint/js, globals
  vitest.config.js: defineConfig
    <- vitest/config

## bin/
  cli.js: 
    <- commander, ../src/index.js(9), ../src/utils.js(3), ../src/config.js, ../src/knowledge/knowledge-steward.js, chalk

## hooks/lib/
  tdd-guard-cli.js: 
    <- tdd-guard.js
  tdd-guard.js: TDDGuardOptions, TDDGuard, checkTDD, analyzeTDD, class TDDGuard { constructor(options), isExempt(filePath), getTestFilePaths(sourcePath), checkTestFile(sourcePath), analyzeDirectory(dirPath), generateReport(violations), createBlockMessage(sourcePath, check) }, async checkTDD(filePath, options), async analyzeTDD(dirPath, options)
    <- node:path, node:fs/promises, fs-extra

## src/
  config.js: PROJECT_ROOT, DOCS_URL, LOG_LEVEL, DEFAULT_MAX_RETRIES, DEFAULT_TIMEOUT, CLAUDE_DIR
    <- url, path, os
  doctor.js: runDoctorChecks, formatDoctorReport, hasDoctorIssues, async runDoctorChecks(options), formatDoctorReport(report), hasDoctorIssues(report)
    <- installer.js, workflow/workflow-orchestrator.js
  index.js: interactiveMode, runInstall, runUpdate, runUninstall, runDocs, runRoute, runAnalyze, runDoctor, runResume, WorkflowOrchestrator, RepoIndexer, async interactiveMode(), async runInstall(options), async runUpdate(options), async runUninstall(options), async runDocs(), async runRoute(userIntent, options), async runAnalyze(task, options), async runDoctor(options), async runResume(directive, options)
    <- installer.js, doctor.js, resume.js, prompts.js(5), utils.js(3), logger.js, config.js, workflow/workflow-orchestrator.js, chalk
  installer.js: install, uninstall, checkStatus, async install(selectedComponents, options), async backupFile(filePath), async copyRecursive(src, dest, options, depth), async uninstall(selectedComponents), async getSourceFilesList(sourcePath, recursive), async traverse(currentPath, relativePath, depth), async cleanupEmptySubDirs(dirPath), async cleanupEmptyDirs(claudeDir, selectedComponents), async checkStatus(), async countFiles(dirPath, recursive, depth)
    <- utils.js(6), path, fs-extra, ora, chalk
  logger.js: Logger, logger, LOG_LEVELS, class Logger { constructor(options), setLevel(level), _formatMessage(message, meta), debug(message, meta), info(message, meta), warn(message, meta), error(message, meta), success(message, meta), log(message, meta), infoRaw(message) }
    <- config.js, chalk
  prompts.js: showBanner, promptConfirmation, promptUninstallConfirmation, promptComponentSelection, promptMainMenu, showBanner(), async promptConfirmation(message), async promptUninstallConfirmation(), async promptComponentSelection(), async promptMainMenu()
    <- utils.js(4), inquirer, chalk
  resume.js: runResume, async runResume(directive, options)
    <- budget/context-compressor.js, workflow/workflow-orchestrator.js
  types.d.ts: 
  utils.js: getClaudeDir, getAutoDir, getCustomDir, getVersionFilePath, getInstalledVersion, saveInstalledVersion, getPackageVersion, COMPONENTS, getSourceDir, openBrowser, getClaudeDir(), getAutoDir(), getCustomDir(), getVersionFilePath(), async getInstalledVersion(), async saveInstalledVersion(version, components, installedFiles), getPackageVersion(), getSourceDir(), async openBrowser(url)
    <- child_process, url, os, path, fs-extra

## src/budget/
  context-compressor.js: COMPRESSION_LEVELS, STATUS_TO_LEVEL, COMPRESSION_NAMES, TOOL_OUTPUT_TYPES, COMPRESSION_DEFAULTS, ADAPTIVE_PROFILES, selectCompressionLevel, createCompressionResult, truncateLargeOutputs, snipOldToolOutputs, microCompactHistory, collapseConsecutive, autoCompactRecommend, createSessionSummary, createResumeDirective, parseResumeDirective, compressContext, ContextCompressor, class ContextCompressor { constructor(config), compress(monitor), getConfig(), detectAdaptiveProfile(projectInfo) }, selectCompressionLevel(contextStatus), createCompressionResult(params), truncateLargeOutputs(snapshot, config), snipOldToolOutputs(snapshot, config), microCompactHistory(snapshot, config), collapseConsecutive(snapshot, config), autoCompactRecommend(snapshot), createSessionSummary(sessionState), createResumeDirective(summary), parseResumeDirective(directive), compressContext(snapshot, contextStatus, config)
    <- context-monitor.js, ../logger.js
  context-monitor.js: DEFAULT_CONTEXT_LIMIT, CONTEXT_THRESHOLDS, CONTEXT_STATUS, CONTEXT_ACTIONS, estimateTokens, createContextSnapshot, recordUsage, getContextStatus, getSuggestedAction, getContextSummary, applyCompaction, ContextMonitor, class ContextMonitor { constructor(options), record(chars, label), getStatus(), getSummary(), getAction(), compact(reducedTokens), getSnapshot() }, estimateTokens(chars, sample), createContextSnapshot(options), recordUsage(snapshot, chars, label), getContextStatus(snapshot), getSuggestedAction(snapshot), getContextSummary(snapshot), applyCompaction(snapshot, reducedTokens)
    <- ../logger.js
  token-budget.js: DEFAULT_TOTAL_BUDGET, PHASE_QUOTAS, ALERT_THRESHOLDS, BUDGET_STATUS, createBudget, consumeTokens, getBudgetStatus, getPhaseStatus, canAfford, dynamicRebalance, getBudgetSummary, TokenBudgetManager, class TokenBudgetManager { constructor(options), consume(phase, tokens, label), canAfford(phase, estimatedTokens), getSnapshot(), getStatus(), getPhaseStatus(phase), rebalance(params), getSummary() }, createBudget(options), consumeTokens(budget, phase, tokens, label), getBudgetStatus(budget), getPhaseStatus(budget, phase), canAfford(budget, phase, estimatedTokens), dynamicRebalance(budget, params), getBudgetSummary(budget)
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
  knowledge-steward.js: KnowledgeSteward, class KnowledgeSteward { constructor(projectDir), ensureStructure(), save({ content, category, tags, gitCommit), list(), search(query, options), _buildFileHeader(category), _formatEntry(content, tags, contentHash), _gitCommit(filePath, categoryName), recordFeedback({ source, key, successful }), getQualityScore(source, key), getLowQualityEntries(threshold, minHits), cleanupLowQuality(entries), _loadFeedback(), _saveFeedback(data) }
    <- child_process, node:crypto, ../logger.js, categories.js, path, fs-extra

## src/memory/
  auto-dream.js: DREAM_PHASES, DREAM_GATE_DEFAULTS, checkDreamGate, scoreEntry, selectMergeGroups, selectPromotionCandidates, orient, gather, consolidate, prune, twoTurnExtract, autoDream, createDreamResult, AutoDreamScheduler, class AutoDreamScheduler { constructor(options), shouldRun(), incrementSession(), run(memoryManager, options), getLastDreamTime(), getSessionCount() }, checkDreamGate({ lastDreamTime, sessionCount, isIdle, gateConfig), scoreEntry(entry, maxAgeHours), selectMergeGroups(entries), selectPromotionCandidates(entries), async orient(memoryManager), async gather(memoryManager, options), async consolidate(memoryManager, gatheredEntries, orientResult, options), async prune(memoryManager), async twoTurnExtract(memoryManager, messages, options), extractMemoryCandidates(messages), async autoDream(memoryManager, options), createDreamResult(params)
    <- ../logger.js, memory-tiers.js(5)
  memory-manager.js: MemoryManager, class MemoryManager { constructor(options), set(key, value, options), get(key), delete(key, tier), searchByTags(tags), search(query, options), cleanup(), getStats(), _getFromTier(key, tier), _putToTier(entry), _getAllEntries(), _getCachedStore(tier, dir), _invalidateCache(tier), _loadStore(dir), _saveStore(dir, store), _cleanupStore(dir, tier) }
    <- ../logger.js, memory-tiers.js(9), node:path, fs-extra
  memory-tiers.js: MEMORY_TIERS, TIER_PRIORITY, DEFAULT_TTL, PROMOTE_THRESHOLD, createMemoryEntry, touchEntry, updateEntryValue, promoteEntry, isExpired, shouldPromote, getProjectMemoryDir, getGlobalMemoryDir, createMemoryEntry({ key, value, tier, tags, ttl }), touchEntry(entry), updateEntryValue(entry, newValue), promoteEntry(entry, targetTier), isExpired(entry), shouldPromote(entry), getProjectMemoryDir(projectDir), getGlobalMemoryDir()
    <- node:path, node:os

## src/router/
  agent-registry.js: AgentRegistry, class AgentRegistry { constructor(projectDir), initialize(), listAgents(filters), getAgent(name), registerAgent(manifest), unregisterAgent(name), findCandidates(keywords), getFallbackChain(agentName), getStats(), lazyRegister(manifest), resolveTeam({ keywords, complexity, maxSize), _flushLazyQueue(), _loadCustomAgents(), _extractFrontmatter(content), _parseAgentFile(filePath, name) }
    <- ../logger.js, agent-types.js, node:path, fs-extra
  agent-types.js: COMPLEXITY_LEVELS, COMPLEXITY_INDICATORS, assessComplexity, AGENT_STATES, assessComplexity(text)
  canonical-router.js: CanonicalRouter, class CanonicalRouter { constructor(registry), initialize(), route(userIntent, context), _analyzeIntent(userIntent, context), _applyContextFilters(candidates, intent, context), _applySecurityPriority(candidates, intent), _buildMatchReason(selected), _defaultRoute(reason), _recordRoutingAttempt(agentName, keywords, feedbackId), recordFeedback(feedbackId, feedback), getAgentPerformance(agentName), getRoutingStats(), diagnose(), _assessComplexity(text) }
    <- ../logger.js, agent-types.js(3), agent-registry.js, keyword-extractor.js
  keyword-extractor.js: extractKeywords, computeRelevance, SYNONYM_MAP, EN_STOPWORDS, ZH_STOPWORDS, CJK_DICT, segmentCJK, segmentCJK(text), expandSynonyms(keywords), filterStopwords(tokens), extractKeywords(text, options), computeRelevance(keywords, searchText), escapeRegex(str)
  model-router.js: MODEL_TIERS, MODEL_IDS, MODEL_NAMES, COMPLEXITY_TO_TIER, KEYWORD_TIERS, routeByAgent, routeByKeywords, routeModel, routeByAgent(agent), routeByKeywords(keywords), routeModel({ agent, keywords, override })
    <- agent-types.js

## src/skills/
  skill-indexer.js: SkillIndexer, class SkillIndexer { constructor(skillsDir), _loadPersistedFeedback(), _persistFeedback(), buildIndex(options), search(keywords), loadContent(relativePath), getIndexSummary(), _extractMetadata(filePath, relativePath), _computeFileHashes(), _hashesEqual(current, cached), clearCache(), recordSuccess(skillName, successful), getPopularSkills(limit) }, async computeFileHash(filePath, relativePath)
    <- node:crypto, child_process, ../logger.js, node:path, fs-extra

## src/utils/
  trace-compactor.js: FILTERED_PATTERNS, PROJECT_PATTERNS, parseFrame, createFingerprint, compactTrace, clearFingerprints, getFingerprintCount, parseFrame(line), createFingerprint(input), compactTrace(input, options), clearFingerprints(), getFingerprintCount()
    <- node:crypto

## src/workflow/
  phase-commit.js: PhaseCommit, class PhaseCommit { constructor({
    memory, tokenBudget, flowEngine, contextMonitor, projectDir, dryRun, skillIndexer
  }), run(phaseContext), _inferCommitType(ctx), _inferScope(ctx), _executeGitCommit(files, message), _ensureGitWorkflowSkill() }
    <- ../flow/flow-engine.js, ../logger.js, phase-context.js
  phase-context.js: PHASE_NAMES, EXECUTION_MODES, createPhaseContext, updatePhaseContext, detectExecutionMode, PHASE_SKILL_MAP, detectE2ECapability, detectProjectProfile, createPhaseContext(options), updatePhaseContext(ctx, updates), detectExecutionMode(task, options), detectE2ECapability(projectDir), detectProjectProfile(projectDir)
    <- ../logger.js, ../router/agent-types.js, fs-extra, node:path
  phase-discover.js: PhaseDiscover, class PhaseDiscover { constructor({ memory, tokenBudget, contextMonitor, skillIndexer, flowEngine, projectDir }), run(phaseContext), _ensureAgentRegistry(), _countCommands(), _countMarkdownFiles(dir, maxDepth), _countHooks(), _countHooksFromConfig(hooksPath), _ensureDefaultHooks(hooksDir, hooksPath), _ensureRepoMap(), runDoctorCheck(), _runDoctorCheck(), _detectTestRunner(), _detectProjectLanguages(), _injectDiscoverSkills(), _injectLanguageSkills(languages), _consumePendingInvocations() }
    <- ../flow/flow-engine.js, ../budget/context-monitor.js, ../router/agent-registry.js, ../indexer/repo-indexer.js, phase-context.js(3), ../logger.js, fs-extra, node:path
  phase-execute.js: PhaseExecute, class PhaseExecute { constructor({ memory, tokenBudget, contextMonitor, flowEngine, projectDir }), setMessageAccumulator(accumulator), setSkillIndexer(indexer), runReason(phaseContext), runExecute(phaseContext), runMicroExecute(phaseContext), _executeQuest(quest, modelRoute, _questEngine, _phaseContext), _buildAgentPrompt(quest, team, skillContents), _generateQuestMap(task, { agentRecommendation, matchedSkills, skillContents, insightContents, modelRoute, mode }), _detectE2ECapability(), _selectExecutionStrategy(questCount), _partitionQuests(questMap), _executeBatch(batch, ctx), _executeSingleQuest(quest, ctx), _ensureAgentRegistry(), _persistAgentResult(agentName, result, questId), _extractKeywords(task), _resolveDynamicAgent(capabilityKeywords, fallbackAgent), _recordAgentFeedback(agentName, outcome, reason, feedbackId) }, _generateQuestInstructions(quest, modelRoute, team), _generateSemanticDescription(agent, quest)
    <- ../flow/flow-engine.js, ../router/model-router.js, ../router/agent-registry.js, ../router/canonical-router.js, ../utils/trace-compactor.js, phase-context.js(4), ../router/keyword-extractor.js, ../knowledge/knowledge-steward.js, ../logger.js
  phase-learn.js: PhaseLearn, class PhaseLearn { constructor({ memory, tokenBudget, flowEngine, projectDir }), setMessageAccumulator(accumulator), run(phaseContext), _analyzeGitPatterns(commitCount), _detectArchitectureChange(task), _generateDeletionLog(), _persistPendingInvocation(invocation), searchRepoIndex(query) }
    <- ../flow/flow-engine.js, ../memory/auto-dream.js, ../router/canonical-router.js, ../knowledge/knowledge-steward.js, ../indexer/repo-indexer.js, phase-context.js, ../logger.js, fs-extra, node:path
  phase-verify.js: PhaseVerify, class PhaseVerify { constructor({ memory, tokenBudget, contextMonitor, flowEngine, projectDir, skillIndexer }), run(phaseContext), _detectTestRunner(), _runTests(_testRunner, withCoverage), _parseCoverageOutput(output), _runSecurityScan(), _detectE2ECapability() }
    <- ../flow/flow-engine.js, ../budget/context-monitor.js, ../router/canonical-router.js, ../utils/trace-compactor.js, phase-context.js(3), ../knowledge/knowledge-steward.js, ../logger.js, fs-extra, node:path
  workflow-orchestrator.js: WorkflowOrchestrator, class WorkflowOrchestrator { constructor(options), run(task, options), getRuntimeStatus(), _buildResult(status, error), _checkContextOverflow(contextStatus), _extractKeyConcepts(), _syncDepsToModules(), _runDiscover(), _runReason(), _runExecute(), _runMicroExecute(), _runVerify(), _runCommit(), _runLearn(), _ensureAgentRegistry(), _countCommands(), _countHooks(), _runDoctorCheck(), _detectTestRunner(), _parseCoverageOutput(output), _runSecurityScan(), _executeGitCommit(files, message), _analyzeGitPatterns(commitCount), _detectArchitectureChange(), _generateDeletionLog(), _executeQuest(quest, modelRoute, questEngine), _generateQuestMap(task, context), _extractKeywords(task), _persistAgentResult(agentName, result, questId), questEngines(), getFlowState(), getContext() }
    <- ../flow/flow-engine.js, ../memory/memory-manager.js, ../budget/token-budget.js, ../budget/context-monitor.js, ../skills/skill-indexer.js, ../utils/trace-compactor.js, ../budget/context-compressor.js(3), phase-context.js(4), ../logger.js, phase-discover.js, phase-execute.js, phase-verify.js, phase-commit.js, phase-learn.js

## tests/
  auto-command.test.js: 
    <- vitest(4), url, fs-extra, path
  auto-dream.test.js: createTestEntry(overrides)
    <- vitest(5), ../src/memory/auto-dream.js(10), ../src/memory/memory-manager.js, os, path, fs-extra
  canonical-router.test.js: 
    <- vitest(5), ../src/router/canonical-router.js, ../src/router/agent-registry.js, ../src/router/agent-types.js, path, os, fs-extra
  circuit-breaker.test.js: 
    <- vitest(3), ../src/flow/circuit-breaker.js(11), ../src/flow/flow-engine.js
  config.test.js: 
    <- vitest(4), url, path
  context-compressor.test.js: createTestSnapshot(overrides), createHistoryEntry(chars, label)
    <- vitest(3), ../src/budget/context-compressor.js(16), ../src/budget/context-monitor.js
  context-monitor.test.js: 
    <- vitest(3), ../src/budget/context-monitor.js(12)
  flow-engine.test.js: 
    <- vitest(5), ../src/flow/flow-engine.js(3), path, os, fs-extra
  flow-state.test.js: 
    <- vitest(3), ../src/flow/flow-state.js(9)
  index.test.js: class Logger
    <- vitest(6), ../src/index.js(8), ../src/installer.js, ../src/prompts.js(4), ../src/utils.js, ../src/logger.js, ../src/doctor.js, ../src/resume.js
  installer.test.js: 
    <- vitest(6), ../src/installer.js(3), path, os, fs-extra
  keyword-extractor.test.js: 
    <- vitest(3), ../src/router/keyword-extractor.js(5)
  knowledge-steward.test.js: 
    <- vitest(5), ../src/knowledge/knowledge-steward.js, ../src/knowledge/categories.js(3), path, os, fs-extra
  logger.test.js: 
    <- vitest(5), ../src/logger.js(3)
  memory-manager.test.js: 
    <- vitest(5), ../src/memory/memory-manager.js, ../src/memory/memory-tiers.js, path, os, fs-extra
  memory-tiers.test.js: 
    <- vitest(3), ../src/memory/memory-tiers.js(12)
  model-router.test.js: 
    <- vitest(3), ../src/router/model-router.js(7), ../src/router/agent-types.js
  prompts.test.js: class Separator { constructor() }
    <- vitest(6), ../src/prompts.js(4)
  repo-indexer.test.js: CLAUDE_DIR, DOCS_URL, LOG_LEVEL, DEFAULT_TIMEOUT, Router, processData, validateInput, parseConfig, debounce, Service, createService, VERSION, Empty, lib, testFn, NEW_CONST, NEW, CHANGED, default, config, class Router { constructor(options), initialize(), route(intent), diagnose() }, class Service { start(config), stop() }, class with, class without, class Empty, class methods, class Router, async processData(input, options), validateInput(data), createService(name, options), testFn(), parseConfig(raw), debounce(value, delay)
    <- vitest(5), ../src/indexer/patterns.js(5), ../src/indexer/repo-indexer.js, ../logger.js, router.js, node:path, node:os, fs-extra, node:path, fs-extra, fs-extra, types
  skill-indexer.test.js: 
    <- vitest(5), ../src/skills/skill-indexer.js, path, os, fs-extra
  token-budget.test.js: 
    <- vitest(3), ../src/budget/token-budget.js(11)
  trace-compactor.test.js: 
    <- vitest(4), ../src/utils/trace-compactor.js(7)
  utils.test.js: 
    <- vitest(6), ../src/utils.js(8), os, path, fs-extra
  workflow-orchestrator.test.js: 
    <- vitest(5), ../src/workflow/workflow-orchestrator.js, ../src/workflow/phase-context.js(5)

---
215 exports, 28 classes, 140 functions | `auto codemaps`