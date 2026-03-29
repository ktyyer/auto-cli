# 仓库符号地图 (REPO_MAP.md)

> 自动生成于 2026-03-28
> 语言: javascript

## 符号概览

| 类型 | 名称 | 文件 |
|------|------|------|
| export | `advanceLoopState` | src\loop-state-machine.js |
| export | `analyzeMcpServers` | src\utils.js |
| function | `assertValidState` | src\loop-state-machine.js |
| export | `canTransition` | src\loop-state-machine.js |
| export | `checkStatus` | src\installer.js |
| export | `CLAUDE_DIR` | src\config.js |
| export | `COMPONENTS` | src\utils.js |
| export | `countMcpServers` | src\utils.js |
| export | `createLoopState` | src\loop-state-machine.js |
| function | `createRunId` | src\loop-state-machine.js |
| export | `DEFAULT_LOOP_STATE_FILE` | src\loop-state-machine.js |
| export | `DEFAULT_MAX_RETRIES` | src\config.js |
| export | `DEFAULT_PORT` | src\utils.js |
| export | `DEFAULT_TIMEOUT` | src\config.js |
| export | `DOCS_URL` | src\config.js |
| export | `formatLoopState` | src\loop-state-machine.js |
| export | `getAutoDir` | src\utils.js |
| export | `getClaudeDir` | src\utils.js |
| export | `getCustomDir` | src\utils.js |
| export | `getInstalledVersion` | src\utils.js |
| export | `getMcpServerCategories` | src\utils.js |
| export | `getPackageVersion` | src\utils.js |
| export | `getRetryCount` | src\loop-state-machine.js |
| export | `getSourceDir` | src\utils.js |
| function | `getStepTitle` | src\loop-state-machine.js |
| export | `getVersionFilePath` | src\utils.js |
| export | `install` | src\installer.js |
| export | `interactiveMode` | src\index.js |
| export | `loadLoopState` | src\loop-state-machine.js |
| export | `LOG_LEVEL` | src\config.js |
| class | `Logger` | src\logger.js |
| export | `LOOP_STATES` | src\loop-state-machine.js |
| function | `markRecoverRetry` | src\loop-state-machine.js |
| function | `nextActionForState` | src\loop-state-machine.js |
| function | `normalizeSteps` | src\loop-state-machine.js |
| function | `nowIso` | src\loop-state-machine.js |
| export | `openBrowser` | src\utils.js |
| export | `PROJECT_ROOT` | src\config.js |
| export | `promptConfirmation` | src\prompts.js |
| export | `promptMainMenu` | src\prompts.js |
| export | `promptUninstallConfirmation` | src\prompts.js |
| export | `runDocs` | src\index.js |
| export | `runInstall` | src\index.js |
| export | `runUninstall` | src\index.js |
| export | `runUpdate` | src\index.js |
| export | `saveInstalledVersion` | src\utils.js |
| export | `saveLoopState` | src\loop-state-machine.js |
| export | `showBanner` | src\prompts.js |
| function | `stepKey` | src\loop-state-machine.js |
| export | `transitionLoopState` | src\loop-state-machine.js |
| export | `uninstall` | src\installer.js |
| export | `SkillDiscovery` | src\skills\skill-discovery.js |
| export | `SKILL_DOMAINS` | src\skills\skill-types.js |
| export | `RuleEngine` | src\governance\rule-engine.js |
| export | `RULE_ACTIONS` | src\governance\rule-types.js |
| export | `RULE_PRIORITIES` | src\governance\rule-types.js |
| export | `VCOAdapter` | src\runtime\vco-adapter.js |
| export | `CONDITION_OPS` | src\runtime\workflow-types.js |
| export | `ORCHESTRATION_MODES` | src\runtime\workflow-types.js |
| export | `ORCHESTRATION_MODE_NAMES` | src\runtime\workflow-types.js |
| export | `STAGE_STATES` | src\runtime\workflow-types.js |
| export | `STAGE_STATE_NAMES` | src\runtime\workflow-types.js |
| export | `STAGE_TYPES` | src\runtime\workflow-types.js |
| export | `WORKFLOW_RESULT` | src\runtime\workflow-types.js |
| export | `WORKFLOW_RESULT_NAMES` | src\runtime\workflow-types.js |
| export | `EcosystemOrchestrator` | src\ecosystem\ecosystem-orchestrator.js |
| export | `ModuleRegistry` | src\ecosystem\module-registry.js |
| export | `DEPENDENCY_TYPES` | src\ecosystem\module-types.js |
| export | `DATA_FLOW_TYPES` | src\ecosystem\module-types.js |
| export | `ECOSYSTEM_EVENTS` | src\ecosystem\module-types.js |
| export | `MODULE_IDS` | src\ecosystem\module-types.js |
| export | `MODULE_STATES` | src\ecosystem\module-types.js |
| export | `MODULE_STATE_NAMES` | src\ecosystem\module-types.js |

---

## 使用说明

1. 将此文件保存为 `REPO_MAP.md`
2. 加入 `.gitignore`（这是生成的文件）
3. AI 可以使用此地图快速定位代码