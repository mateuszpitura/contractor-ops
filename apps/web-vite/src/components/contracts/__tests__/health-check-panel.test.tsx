import { describe, it } from 'vitest';

describe('<HealthCheckPanel /> (Phase 75 D-09 + D-16)', () => {
  it.todo('renders LIKELY_PRESENT verdict with green badge and cited clauses list');
  it.todo(
    'renders LIKELY_MISSING verdict with WARNING badge and "no IP-assignment language found" message',
  );
  it.todo('renders MANUAL_REVIEW_REQUIRED with crossJurisdictionMismatch flag prominent');
  it.todo(
    'cited clauses show jurisdiction badge + source badge (regex+LLM | LLM only) + confidence bar',
  );
  it.todo('renders PENDING-phrase footer flag when resultsJson.pendingPhrasesCited[] is non-empty');
  it.todo('cited clause carries subscript marker (¹) when its phraseId is in pendingPhrasesCited');
  it.todo(
    '"View in document" button opens PDF in new tab when regexMatchSpan is null (D-09 fallback)',
  );
  it.todo(
    '"Re-run health check" button calls contract.rerunHealthCheck mutation with current contractId',
  );
  it.todo('AuditLog drill-in renders the same panel from historical resultsJson (immutable view)');
});
