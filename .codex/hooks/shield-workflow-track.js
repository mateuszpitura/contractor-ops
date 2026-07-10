#!/usr/bin/env node
// PostToolUse — mark business-logic-shield skill read + shield-scope.json written.
const {
  sessionId,
  saveState,
  loadState,
  isShieldSkillEvent,
  isShieldScopeWriteEvent,
} = require('./shield-workflow-lib');

let input = '';
const stdinTimeout = setTimeout(() => process.exit(0), 3000);
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => (input += chunk));
process.stdin.on('end', () => {
  clearTimeout(stdinTimeout);
  try {
    const data = JSON.parse(input);
    const id = sessionId(data);
    const state = loadState(id);
    if (!state.active) {
      process.exit(0);
    }

    const patch = {};
    if (isShieldSkillEvent(data)) {
      patch.shieldSkillRead = true;
    }
    if (isShieldScopeWriteEvent(data)) {
      patch.shieldScope = true;
    }
    if (Object.keys(patch).length > 0) {
      saveState(id, patch);
    }
  } catch {
    /* ignore */
  }
  process.exit(0);
});
