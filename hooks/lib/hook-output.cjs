const fs = require('node:fs');

const contextEvents = new Set([
  'PreToolUse',
  'PostToolUse',
  'SessionStart',
  'UserPromptSubmit',
  'SubagentStart'
]);

function readInput() {
  const value = JSON.parse(fs.readFileSync(0, 'utf8') || '{}');
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Hook input must be a JSON object');
  }
  return value;
}

function emit(event, message) {
  if (!message) return;
  // Stop additionalContext continues the conversation; reminders must not do that.
  const output = contextEvents.has(event)
    ? { hookSpecificOutput: { hookEventName: event, additionalContext: message } }
    : { systemMessage: message };
  process.stdout.write(JSON.stringify(output));
}

module.exports = { readInput, emit };
