// tax-form-routing unit test.
// Owns: pnpm --filter @contractor-ops/api test src/services/__tests__/tax-form-routing.test.ts
//
// Pure routing determination (no DB). The decisive axis for W-9 vs W-8 is
// countryCode === 'US'; the foreign W-8BEN vs W-8BEN-E split routes on the
// coarse Contractor.type column (NOT the fine-grained US entity type — Pitfall 1).

import { describe, expect, it } from 'vitest';
import { determineFormType } from '../tax-form-routing';

describe('tax-form-routing — determineFormType (US-FORM-02, D-09, Pitfall 1)', () => {
  it('US contractors route to W-9 regardless of contractor type', () => {
    expect(determineFormType({ countryCode: 'US', contractorType: 'COMPANY' })).toBe('W9');
    expect(determineFormType({ countryCode: 'US', contractorType: 'SOLE_TRADER' })).toBe('W9');
    expect(determineFormType({ countryCode: 'US', contractorType: 'INDIVIDUAL_FREELANCER' })).toBe(
      'W9',
    );
    expect(determineFormType({ countryCode: 'US', contractorType: 'OTHER' })).toBe('W9');
  });

  it('foreign company routes to W-8BEN-E', () => {
    expect(determineFormType({ countryCode: 'PL', contractorType: 'COMPANY' })).toBe('W8BENE');
    expect(determineFormType({ countryCode: 'DE', contractorType: 'COMPANY' })).toBe('W8BENE');
  });

  it('foreign sole trader routes to W-8BEN', () => {
    expect(determineFormType({ countryCode: 'PL', contractorType: 'SOLE_TRADER' })).toBe('W8BEN');
  });

  it('foreign individual freelancer routes to W-8BEN', () => {
    expect(determineFormType({ countryCode: 'GB', contractorType: 'INDIVIDUAL_FREELANCER' })).toBe(
      'W8BEN',
    );
  });

  it('foreign OTHER routes to the deterministic W-8BEN default (confirm/override safety net)', () => {
    expect(determineFormType({ countryCode: 'NL', contractorType: 'OTHER' })).toBe('W8BEN');
  });
});
