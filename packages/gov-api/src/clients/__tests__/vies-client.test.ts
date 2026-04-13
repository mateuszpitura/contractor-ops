// Phase 57 · Plan 01 — PAY-05 RED scaffolds for ViesClient.
// See .planning/phases/57-government-api-clients/57-VALIDATION.md.

import { describe, it } from 'vitest';

describe('ViesClient — checkVatNumber (PAY-05)', () => {
  it('issues GET /rest-api/ms/:ms/vat/:vrn with no auth headers (unauthenticated API)', () => {
    throw new Error('RED — Phase 57: implemented in Wave 1 Plan 57-02');
  });

  it('passes requesterMemberStateCode + requesterNumber for qualified confirmation and surfaces requestIdentifier as confirmationRef', () => {
    throw new Error('RED — Phase 57: implemented in Wave 1 Plan 57-02');
  });

  it('maps userError=MS_UNAVAILABLE to responseStatus=unavailable and triggers stale-fallback in the orchestrator', () => {
    throw new Error('RED — Phase 57: implemented in Wave 2 Plan 57-03');
  });

  it('short-circuits format-invalid DE USt-IdNr via isValidUstIdNr before making any fetch call', () => {
    throw new Error('RED — Phase 57: implemented in Wave 1 Plan 57-02');
  });

  it('rejects a malformed VIES body via viesLookupResponseSchema Zod refinement', () => {
    throw new Error('RED — Phase 57: implemented in Wave 1 Plan 57-02');
  });
});
