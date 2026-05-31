import { describe, expect, it } from 'vitest';
import type { Prisma } from '../generated/prisma/client/client.js';

// Phase 77 — compile-time AND runtime assertions for the additive schema
// extensions (Plan 77-01-05): the MANUAL_COMPLETED step status, the ErrorClass
// + ManualOverrideCategory enums, and the five new DeprovisioningStep columns.
// Each `Prisma.*` reference fails typecheck if the column/enum is absent on the
// regenerated client.

describe('Phase 77 schema additions (Plan 77-01-05)', () => {
  it('DeprovisioningStepStatus enum includes MANUAL_COMPLETED (5 values)', () => {
    const values: Array<Prisma.DeprovisioningStepUncheckedCreateInput['status']> = [
      'PENDING',
      'IN_PROGRESS',
      'SUCCEEDED',
      'FAILED',
      'MANUAL_COMPLETED',
    ];
    expect(values).toContain('MANUAL_COMPLETED');
    expect(values).toHaveLength(5);
  });

  it('DeprovisioningStep exposes errorClass + the four manualOverride* columns', () => {
    const sample: Prisma.DeprovisioningStepUncheckedCreateInput = {
      organizationId: 'org_1',
      runId: 'run_1',
      provider: 'GOOGLE_WORKSPACE',
      stepKind: 'SUSPEND_ACCOUNT',
      externalUserId: 'u@example.com',
      errorClass: 'PERMANENT_NOT_FOUND',
      manualOverrideCategory: 'verified_via_vendor_console',
      manualOverrideNote: 'Confirmed suspended in the Google Admin console manually.',
      manualOverriddenByUserId: 'usr_admin',
      manualOverriddenAt: new Date('2026-05-31T00:00:00Z'),
    };
    expect(sample.errorClass).toBe('PERMANENT_NOT_FOUND');
    expect(sample.manualOverrideCategory).toBe('verified_via_vendor_console');
    expect(sample.manualOverriddenByUserId).toBe('usr_admin');
    expect(sample.manualOverriddenAt).toBeInstanceOf(Date);
  });

  it('ErrorClass enum carries all six D-07 values', () => {
    const values: Array<Prisma.DeprovisioningStepUncheckedCreateInput['errorClass']> = [
      'TRANSIENT_RATE_LIMIT',
      'TRANSIENT_NETWORK',
      'PERMANENT_NOT_FOUND',
      'PERMANENT_AUTH_EXPIRED',
      'PERMANENT_FORBIDDEN',
      'PERMANENT_OTHER',
    ];
    expect(values).toHaveLength(6);
  });

  it('ManualOverrideCategory enum carries all five D-10 values', () => {
    const values: Array<Prisma.DeprovisioningStepUncheckedCreateInput['manualOverrideCategory']> = [
      'verified_via_vendor_console',
      'user_already_inactive',
      'provider_endpoint_deprecated',
      'transient_provider_issue_resolved',
      'other',
    ];
    expect(values).toHaveLength(5);
  });
});
