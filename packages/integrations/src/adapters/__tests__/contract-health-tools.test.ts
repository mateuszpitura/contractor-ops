import { describe, it } from 'vitest';

describe('contract-health-tools tool_use schema (Phase 75 D-13)', () => {
  it.todo('exports CONTRACT_HEALTH_TOOL with name evaluate_ip_assignment');
  it.todo('input_schema covers verdict + citedClauses[] per D-06');
  it.todo(
    'messages.create called with tool_choice: { type: "tool", name: "evaluate_ip_assignment" }',
  );
  it.todo('PDF passed as type: document, media_type: application/pdf, source.type: base64');
  it.todo('rawModelToolUseInput preserved verbatim in resultsJson');
  it.todo(
    'LLM returns LIKELY_PRESENT but regex finds zero matches → MANUAL_REVIEW_REQUIRED (D-13 divergence rule 1)',
  );
  it.todo(
    'LLM returns LIKELY_MISSING but regex finds strong match in raw text → MANUAL_REVIEW_REQUIRED (D-13 divergence rule 2)',
  );
  it.todo(
    'handles Anthropic SDK errors with retry-able classification per QStash backoff convention',
  );
});
