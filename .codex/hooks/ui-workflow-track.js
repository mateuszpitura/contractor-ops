#!/usr/bin/env node
// PostToolUse — mark semble + frontend-design (Read, Skill tool, Semble tool, Bash).
const {
  sessionId,
  saveState,
  loadState,
  isFrontendDesignSkillEvent,
  isSembleToolEvent,
} = require('./ui-workflow-lib');

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
    if (isFrontendDesignSkillEvent(data)) {
      patch.frontendDesign = true;
    }
    if (isSembleToolEvent(data)) {
      patch.semble = true;
    }
    if (Object.keys(patch).length > 0) {
      saveState(id, patch);
    }
  } catch {
    /* ignore */
  }
  process.exit(0);
});
