import { parseResumeDirective } from './budget/context-compressor.js';
import { WorkflowOrchestrator } from './workflow/workflow-orchestrator.js';

/**
 * 运行 resume
 * @param {string} directive
 * @param {Object} [options]
 * @param {string} [options.dir]
 * @param {string} [options.mode]
 * @returns {Promise<Object>}
 */
export async function runResume(directive, options = {}) {
  const parsed = parseResumeDirective(directive);
  const taskParts = [parsed.task, ...parsed.pendingTasks].filter(Boolean);
  const task = taskParts.join('；') || parsed.task;

  const orchestrator = new WorkflowOrchestrator({
    projectDir: options.dir || process.cwd()
  });

  const result = await orchestrator.run(task, {
    mode: options.mode
  });

  return Object.freeze({
    resumedFromDirective: parsed.raw,
    parsedDirective: parsed,
    result
  });
}
