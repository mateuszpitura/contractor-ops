#!/usr/bin/env node
// PreToolUse — [ui] and [ui-strict]: skill + semble BEFORE analysis (Grep/Glob) and BEFORE edits.
const {
  sessionId,
  loadState,
  isUiTargetPath,
  blockPayload,
  FRONTEND_DESIGN_SKILL_HINT,
} = require('./ui-workflow-lib');

function prerequisites(state) {
  const missing = [];
  if (!state.frontendDesign) missing.push('frontend-design (Skill tool or Read SKILL.md)');
  if (!state.semble) missing.push('semble search');
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
    if (!state.active || (state.mode !== 'fix' && state.mode !== 'strict')) {
      process.exit(0);
    }

    const missing = prerequisites(state);
    if (missing.length === 0) {
      process.exit(0);
    }

    const toolName = data.tool_name;
    const prefix = state.mode === 'strict' ? '[ui-strict]' : '[ui]';
    const need = `${prefix} first: ${missing.join(', ')}. Skill: ${FRONTEND_DESIGN_SKILL_HINT}`;

    if (toolName === 'Grep' || toolName === 'Glob') {
      process.stdout.write(
        blockPayload(
          'UI_PREREQ_BEFORE_ANALYSIS',
          `${need} — then Grep/Glob for analysis.`,
        ),
      );
      process.exit(2);
    }

    if (toolName === 'Write' || toolName === 'Edit') {
      const filePath = data.tool_input?.file_path || '';
      if (!isUiTargetPath(filePath)) {
        process.exit(0);
      }
      process.stdout.write(
        blockPayload('UI_PREREQ_BEFORE_EDIT', `${need} — then edit ${filePath}.`),
      );
      process.exit(2);
    }
  } catch {
    /* ignore */
  }
  process.exit(0);
});
