#!/usr/bin/env node
// PreToolUse — [shield]: skill + scope BEFORE logic-path Write/Edit; [shield-strict]: skill before Grep/Glob too.
const {
  sessionId,
  loadState,
  isShieldTargetPath,
  isShieldScopePath,
  blockPayload,
  SHIELD_SKILL_HINT,
  SHIELD_SCOPE_HINT,
} = require('./shield-workflow-lib');

function prerequisites(state) {
  const missing = [];
  if (!state.shieldSkillRead) {
    missing.push(
      'business-logic-shield (Skill tool or Read SKILL.md)',
    );
  }
  if (!state.shieldScope) {
    missing.push(`Shield Scope JSON at ${SHIELD_SCOPE_HINT}`);
  }
  return missing;
}

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
    if (!state.active || (state.mode !== 'shield' && state.mode !== 'strict')) {
      process.exit(0);
    }

    const toolName = data.tool_name;
    const filePath = data.tool_input?.file_path || '';

    if (isShieldScopePath(filePath)) {
      process.exit(0);
    }

    const missing = prerequisites(state);
    if (missing.length === 0) {
      process.exit(0);
    }

    const prefix = state.mode === 'strict' ? '[shield-strict]' : '[shield]';
    const need = `${prefix} first: ${missing.join('; ')}. Skill: ${SHIELD_SKILL_HINT}`;

    if (
      state.mode === 'strict' &&
      !state.shieldSkillRead &&
      (toolName === 'Grep' || toolName === 'Glob')
    ) {
      process.stdout.write(
        blockPayload(
          'SHIELD_PREREQ_BEFORE_ANALYSIS',
          `${need} — then Grep/Glob for analysis.`,
        ),
      );
      process.exit(2);
    }

    if (toolName === 'Write' || toolName === 'Edit') {
      if (!isShieldTargetPath(filePath)) {
        process.exit(0);
      }
      process.stdout.write(
        blockPayload(
          'SHIELD_PREREQ_BEFORE_EDIT',
          `${need} — then edit ${filePath}.`,
        ),
      );
      process.exit(2);
    }
  } catch {
    /* ignore */
  }
  process.exit(0);
});
