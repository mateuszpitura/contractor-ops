/**
 * Mass-assignment defense.
 *
 * Every public write DTO must be `.strict()` and OMIT `organizationId`,
 * `workerType`, and any server-derived money field entirely, so a client cannot
 * forge the tenant, worker classification, or an amount by piggy-backing extra
 * body keys.
 *
 * An invoice's amounts are legitimate content, so the money-rejection
 * assertion belongs on the payment_run create DTO (where money is
 * server-derived from eligible invoices), NOT on invoice. org/workerType
 * rejection lives on the contractor create DTO.
 */

import {
  publicApiContractorCreateInputSchema,
  publicApiInvoiceCreateInputSchema,
  publicApiPaymentRunCreateInputSchema,
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

  it('invoice.create DTO rejects a forged organizationId (tenant is server-owned)', () => {
    // An invoice legitimately carries amounts, so money keys are NOT forbidden
    // here — but the tenant must never be client-supplied.
    expect(
      publicApiInvoiceCreateInputSchema.safeParse({ organizationId: 'org-attacker' }).success,
    ).toBe(false);
  });

  it('paymentRun.create DTO rejects organizationId + server-derived money keys', () => {
    // A payment run's money is derived server-side from eligible invoices; the
    // DTO omits money entirely, so any money/tenant key is a mass-assignment.
    for (const forged of [
      { organizationId: 'org-attacker' },
      { totalMinor: 999999 },
      { amountMinor: 12345 },
    ]) {
      expect(publicApiPaymentRunCreateInputSchema.safeParse(forged).success).toBe(false);
    }
  });
});
