#!/usr/bin/env node
// UserPromptSubmit — [shield] / [shield-strict]: skill + scope before logic-path edits.
const {
  sessionId,
  saveState,
  shieldWorkflowMode,
  SHIELD_SKILL_HINT,
  SHIELD_SCOPE_HINT,
} = require('./shield-workflow-lib');

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
    const mode = shieldWorkflowMode(prompt);

    if (!mode) {
      saveState(id, {
        active: false,
        mode: null,
        shieldSkillRead: false,
        shieldScope: false,
      });
      process.exit(0);
    }

    saveState(id, {
      active: true,
      mode,
      shieldSkillRead: false,
      shieldScope: false,
    });

    const label = mode === 'strict' ? '[shield-strict]' : '[shield]';
    const scopeExample = JSON.stringify(
      {
        flow: 'invoice approve → payment run → SEPA export',
        surfaces: ['staff tRPC', 'cron'],
        seams: ['payment export IBAN'],
        patternsAtRisk: ['S1', 'S4', 'T1', 'T2', 'T11'],
        testsToRun: ['packages/api/src/routers/__tests__/payment.test.ts'],
        reference: 'wiki/domains/payments-and-bank-files',
      },
      null,
      2,
    );

    const ctx = [
      `${label} ON — fixed order:`,
      `1) Read Skill business-logic-shield OR Read ${SHIELD_SKILL_HINT}`,
      `2) Write ${SHIELD_SCOPE_HINT} (JSON with flow, surfaces, patternsAtRisk; optional seams, reference). Example:`,
      scopeExample,
      '3) Then Grep/Read/analysis and edits on logic paths (packages/api, cron, einvoice, …).',
      '4) Before Shield Verdict: vitest run every file in testsToRun (T11 — mandatory).',
      'Hooks block logic-path Write/Edit until 1–2 complete.',
      mode === 'strict'
        ? 'Strict: Grep/Glob also blocked until step 1.'
        : '',
      'Off: next prompt without prefix, or /shield-workflow-off.',
    ]
      .filter(Boolean)
      .join(' ');

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
