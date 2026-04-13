// Phase 57 · Plan 01 — PAY-03 / PAY-05 RED scaffolds for tax-id-validation.service.
// NEW orchestrator: pre-flight local validators → network (HMRC/VIES) → soft-fail.

import { describe, it } from 'vitest';

describe('tax-id-validation.service — pre-flight short-circuit (PAY-03, PAY-05)', () => {
  it('rejects format-invalid GB VRN locally without hitting HMRC', () => {
    throw new Error('RED — Phase 57: implemented in Wave 2 Plan 57-03');
  });

  it('rejects format-invalid DE USt-IdNr locally without hitting VIES', () => {
    throw new Error('RED — Phase 57: implemented in Wave 2 Plan 57-03');
  });
});

describe('tax-id-validation.service — happy path (PAY-03, PAY-05)', () => {
  it('writes a TaxIdValidation row with responseStatus=valid AND updates Contractor.latestVatValidated* atomically', () => {
    throw new Error('RED — Phase 57: implemented in Wave 2 Plan 57-03');
  });
});

describe('tax-id-validation.service — soft-fail / stale (D-08)', () => {
  it('on HMRC 503 returns the latest valid row with responseStatus=stale', () => {
    throw new Error('RED — Phase 57: implemented in Wave 2 Plan 57-03');
  });

  it('on VIES userError=MS_UNAVAILABLE returns responseStatus=unavailable without overwriting latest valid row', () => {
    throw new Error('RED — Phase 57: implemented in Wave 2 Plan 57-03');
  });
});
