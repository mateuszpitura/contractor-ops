import { describe, it } from 'vitest';

describe('Cross-jurisdiction-mismatch verdict (Phase 75 D-15)', () => {
  it.todo('DE contract whose verdict cites only UK-namespace phrases → MANUAL_REVIEW_REQUIRED');
  it.todo('crossJurisdictionMismatch = { foundJurisdiction: "UK", expectedJurisdiction: "DE" }');
  it.todo('DE contract citing both UK and DE phrases → uses contract jurisdiction (DE) verdict');
  it.todo('UK contract citing only UK phrases → LIKELY_PRESENT (no mismatch flag)');
  it.todo('UK contract citing only DE phrases → MANUAL_REVIEW_REQUIRED with foundJurisdiction: DE');
  it.todo(
    'contract.jurisdiction is null → defaults to organization country (RESEARCH §3 fallback)',
  );
});
