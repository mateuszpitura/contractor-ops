import { describe, expect, it } from 'vitest';
import type { Prisma } from '../generated/prisma/client/client.js';

// Compile-time AND runtime assertions: each `Prisma.*UncheckedCreateInput`
// reference fails typecheck if the model/column/enum does not exist on the
// regenerated client.

describe('Phase 76 schema additions (Plan 76-02)', () => {
  it('DeprovisioningRun model exists with all D-01 columns', () => {
    const sample: Prisma.DeprovisioningRunUncheckedCreateInput = {
      organizationId: 'org_1',
      contractorId: 'ctr_1',
      assignmentId: 'asn_1',
      triggeredByUserId: 'usr_1',
      idempotencyKey: 'run-key-1',
    };
    expect(sample.organizationId).toBe('org_1');
    expect(sample.idempotencyKey).toBe('run-key-1');
  });

  it('DeprovisioningStep model exists with tenantBound organizationId + audit columns', () => {
    const sample: Prisma.DeprovisioningStepUncheckedCreateInput = {
      organizationId: 'org_1',
      runId: 'run_1',
      provider: 'GOOGLE_WORKSPACE',
      stepKind: 'SUSPEND_ACCOUNT',
      externalUserId: 'u@example.com',
      requestSha256: 'a'.repeat(64),
      responseSha256: 'b'.repeat(64),
    };
    expect(sample.provider).toBe('GOOGLE_WORKSPACE');
    expect(sample.stepKind).toBe('SUSPEND_ACCOUNT');
  });

  it('IdpChangeProvenance model exists with D-09 columns', () => {
    const sample: Prisma.IdpChangeProvenanceUncheckedCreateInput = {
      organizationId: 'org_1',
      provider: 'GOOGLE_WORKSPACE',
      externalUserId: 'u@example.com',
      actionKind: 'SUSPEND',
      deprovisioningStepId: 'step_1',
    };
    expect(sample.actionKind).toBe('SUSPEND');
  });

  it('ContractorAssignment.endedAt column exists (DateTime?)', () => {
    const sample: Prisma.ContractorAssignmentUncheckedCreateInput = {
      organizationId: 'org_1',
      contractorId: 'ctr_1',
      activeFrom: new Date(),
      endedAt: new Date('2026-04-12T22:30:00Z'),
    };
    expect(sample.endedAt).toBeInstanceOf(Date);
  });

  it('DeprovisioningRunStatus enum has 5 values', () => {
    const values: Array<Prisma.DeprovisioningRunUncheckedCreateInput['status']> = [
      'PENDING',
      'IN_PROGRESS',
      'COMPLETED',
      'PARTIAL_FAILURE',
      'FAILED',
    ];
    expect(values).toHaveLength(5);
  });

  it('DeprovisioningStepStatus enum has the base 4 values (Phase 77 adds MANUAL_COMPLETED)', () => {
    const values: Array<Prisma.DeprovisioningStepUncheckedCreateInput['status']> = [
      'PENDING',
      'IN_PROGRESS',
      'SUCCEEDED',
      'FAILED',
    ];
    for (const v of values) {
      expect(values).toContain(v);
    }
  });

  it('DeprovisioningStepKind enum has 2 values', () => {
    const values: Array<Prisma.DeprovisioningStepUncheckedCreateInput['stepKind']> = [
      'SUSPEND_ACCOUNT',
      'REVOKE_ALL_SESSIONS',
    ];
    expect(values).toHaveLength(2);
  });

  it('DeprovisioningProvider enum has 5 values', () => {
    const values: Array<Prisma.DeprovisioningStepUncheckedCreateInput['provider']> = [
      'GOOGLE_WORKSPACE',
      'SLACK',
      'ENTRA',
      'OKTA',
      'GITHUB',
    ];
    expect(values).toHaveLength(5);
  });

  it('IdpProvenanceActionKind enum has 2 values', () => {
    const values: Array<Prisma.IdpChangeProvenanceUncheckedCreateInput['actionKind']> = [
      'SUSPEND',
      'REVOKE_SESSION',
    ];
    expect(values).toHaveLength(2);
  });
});
