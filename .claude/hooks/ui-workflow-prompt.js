#!/usr/bin/env node
// UserPromptSubmit — [ui] / [ui-strict]: skill + semble before analysis and edits.
const {
  sessionId,
  saveState,
  uiWorkflowMode,
  FRONTEND_DESIGN_SKILL_HINT,
} = require('./ui-workflow-lib');

let input = '';
const stdinTimeout = setTimeout(() => process.exit(0), 3000);
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => (input += chunk));
process.stdin.on('end', () => {
  clearTimeout(stdinTimeout);
  try {
    const data = JSON.parse(input);
    const prompt = data.prompt || data.user_message || data.message || '';
    const id = sessionId(data);
    const mode = uiWorkflowMode(prompt);

    if (!mode) {
      saveState(id, {
        active: false,
        mode: null,
        semble: false,
        frontendDesign: false,
        designAdvised: false,
      });
      process.exit(0);
    }

    saveState(id, {
      active: true,
      mode,
      semble: false,
      frontendDesign: false,
      designAdvised: false,
    });

    const label = mode === 'strict' ? '[ui-strict]' : '[ui]';
    const ctx = [
      `${label} ON — order is fixed:`,
      '1) Load frontend-design: Skill tool `frontend-design` OR Read:',
      FRONTEND_DESIGN_SKILL_HINT,
      '2) semble search for related UI patterns in this repo.',
      '3) Then analysis (Grep/Read) and edits in apps/web or packages/ui.',
      'Hooks block Grep/Glob and UI file edits until 1–2 are done.',
      'Off: next prompt without prefix, or /ui-workflow-off.',
    ].join(' ');

    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'UserPromptSubmit',
          additionalContext: ctx,
        },
      }),
    );
  } catch {
    process.exit(0);
  }
});
