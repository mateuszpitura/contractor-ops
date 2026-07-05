/**
 * Wave-0 RED contract (INTEG-API-01) — mass-assignment defense.
 *
 * Every public write DTO must be `.strict()` and OMIT `organizationId`,
 * `workerType`, and money/minor fields entirely, so a client cannot forge the
 * tenant, worker classification, or an amount by piggy-backing extra body keys.
 *
 * RED until 98-09 adds the write DTOs to `@contractor-ops/validators/public-api`
 * (Verdict A — validators is the single DTO source). Terminal Cannot-find-module
 * on the not-yet-existing exports is the accepted Wave-0 state.
 */

// RED: these write DTOs do not exist yet (added in 98-09).
import {
  publicApiContractorCreateInputSchema,
  publicApiInvoiceCreateInputSchema,
} from '@contractor-ops/validators/public-api';
import { describe, expect, it } from 'vitest';

describe('public write DTOs block mass-assignment (.strict())', () => {
  it('contractor.create DTO rejects organizationId / workerType extra keys', () => {
    const clean = { legalName: 'Acme GmbH', type: 'COMPANY', countryCode: 'DE', currency: 'EUR' };
    expect(publicApiContractorCreateInputSchema.safeParse(clean).success).toBe(true);

    for (const forged of [
      { ...clean, organizationId: 'org-attacker' },
      { ...clean, workerType: 'EMPLOYEE' },
    ]) {
      expect(publicApiContractorCreateInputSchema.safeParse(forged).success).toBe(false);
    }
  });

  it('invoice.create DTO rejects organizationId and money/minor extra keys', () => {
    const clean = { contractorId: 'c-1', issueDate: '2026-01-01', dueDate: '2026-02-01' };
    for (const forged of [
      { ...clean, organizationId: 'org-attacker' },
      { ...clean, totalMinor: 999999 },
      { ...clean, vatMinor: 12345 },
    ]) {
      expect(publicApiInvoiceCreateInputSchema.safeParse(forged).success).toBe(false);
    }
  });
});
