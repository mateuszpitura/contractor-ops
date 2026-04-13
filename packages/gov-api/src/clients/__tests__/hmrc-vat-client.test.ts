// Phase 57 · Plan 01 — PAY-03 RED scaffolds for HmrcVatClient.
// See .planning/phases/57-government-api-clients/57-VALIDATION.md.
//
// These tests intentionally FAIL with `RED — Phase 57` until Plan 57-02 lands
// the HmrcVatClient implementation.

import { describe, it } from 'vitest';

describe('HmrcVatClient — OAuth 2.0 token acquisition (PAY-03)', () => {
  it('issues POST /oauth/token with Bearer credentials and caches access_token until expiry', () => {
    throw new Error('RED — Phase 57: implemented in Wave 1 Plan 57-02');
  });

  it('refreshes the token once on 401 and retries the original request', () => {
    throw new Error('RED — Phase 57: implemented in Wave 1 Plan 57-02');
  });
});

describe('HmrcVatClient — check-vat-number/lookup (PAY-03)', () => {
  it('issues GET /organisations/vat/check-vat-number/lookup/:vrn with Bearer + Accept headers', () => {
    throw new Error('RED — Phase 57: implemented in Wave 1 Plan 57-02');
  });

  it('short-circuits format-invalid GB VRNs via isValidGbVat before making any fetch call', () => {
    throw new Error('RED — Phase 57: implemented in Wave 1 Plan 57-02');
  });
});
