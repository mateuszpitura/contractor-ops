import { describe, expect, it } from 'vitest';
import type { Prisma } from '../generated/prisma/client/client.js';

// These assertions are compile-time AND runtime: each `Prisma.*UncheckedCreateInput`
// reference would fail typecheck if the column/model/enum did not exist on the
// regenerated client.

const baseContract = {
  organizationId: 'org_1',
  contractorId: 'ctr_1',
  title: 't',
  type: 'B2B_MASTER_SERVICE',
  startDate: new Date(),
  currency: 'EUR',
  billingModel: 'MONTHLY_RETAINER',
  rateType: 'MONTHLY_FIXED',
} satisfies Partial<Prisma.ContractUncheckedCreateInput>;

describe('Phase 75 schema additions (Plan 75-02)', () => {
  it('Contract.complianceFlagsJson column exists (Json?)', () => {
    const sample: Prisma.ContractUncheckedCreateInput = {
      ...baseContract,
      complianceFlagsJson: { foo: 'bar' },
    };
    expect(sample.complianceFlagsJson).toEqual({ foo: 'bar' });
  });

  it('Contract.complianceFlagsCheckedAt column exists (DateTime?)', () => {
    const sample: Prisma.ContractUncheckedCreateInput = {
      ...baseContract,
      complianceFlagsCheckedAt: new Date(),
    };
    expect(sample.complianceFlagsCheckedAt).toBeInstanceOf(Date);
  });

  it('Contract.complianceFlagsModelVer column exists (String?)', () => {
    const sample: Prisma.ContractUncheckedCreateInput = {
      ...baseContract,
      complianceFlagsModelVer: 'claude-sonnet-4-5-20250514',
    };
    expect(sample.complianceFlagsModelVer).toMatch(/^claude-/);
  });

  it('Contract.latestHealthCheckRunId column exists (String?)', () => {
    const sample: Prisma.ContractUncheckedCreateInput = {
      ...baseContract,
      latestHealthCheckRunId: 'run_1',
    };
    expect(sample.latestHealthCheckRunId).toBe('run_1');
  });

  it('Contract.jurisdiction column exists (String?, 3-char ISO)', () => {
    const sample: Prisma.ContractUncheckedCreateInput = {
      ...baseContract,
      jurisdiction: 'DEU',
    };
    expect(sample.jurisdiction).toBe('DEU');
  });

  it('ContractHealthCheckRun model exists with all D-02 columns', () => {
    const sample: Prisma.ContractHealthCheckRunUncheckedCreateInput = {
      organizationId: 'org_1',
      contractId: 'ct_1',
      contentHash: 'a'.repeat(64),
      modelVer: 'claude-sonnet-4-5-20250514',
      verdict: 'LIKELY_PRESENT',
      resultsJson: {},
      status: 'SUCCEEDED',
      triggeredBy: 'UPLOAD',
    };
    expect(sample.verdict).toBe('LIKELY_PRESENT');
    expect(sample.status).toBe('SUCCEEDED');
    expect(sample.triggeredBy).toBe('UPLOAD');
  });

  it('IpAssignmentVerdict enum has 3 values', () => {
    const values: Prisma.ContractHealthCheckRunUncheckedCreateInput['verdict'][] = [
      'LIKELY_PRESENT',
      'LIKELY_MISSING',
      'MANUAL_REVIEW_REQUIRED',
    ];
    expect(values).toHaveLength(3);
  });

  it('RunStatus enum has 3 values', () => {
    const values: Prisma.ContractHealthCheckRunUncheckedCreateInput['status'][] = [
      'PENDING',
      'SUCCEEDED',
      'FAILED',
    ];
    expect(values).toHaveLength(3);
  });

  it('RunTrigger enum has 3 values', () => {
    const values: Prisma.ContractHealthCheckRunUncheckedCreateInput['triggeredBy'][] = [
      'UPLOAD',
      'MANUAL',
      'MODEL_BUMP_BULK',
    ];
    expect(values).toHaveLength(3);
  });

  it('CredentialReference model exists with workflowRunId (NOT offboardingRecordId)', () => {
    const sample: Prisma.CredentialReferenceUncheckedCreateInput = {
      organizationId: 'org_1',
      workflowRunId: 'wfr_1',
      label: 'AWS prod root',
      vaultProvider: 'ONE_PASSWORD',
      vaultUrl: 'https://my.1password.com/vaults/abc',
      accessType: 'AWS',
    };
    expect(sample.workflowRunId).toBe('wfr_1');
  });

  it('VaultProvider enum has 7 values', () => {
    const values: Prisma.CredentialReferenceUncheckedCreateInput['vaultProvider'][] = [
      'ONE_PASSWORD',
      'BITWARDEN',
      'HASHICORP_VAULT',
      'AWS_SECRETS_MANAGER',
      'GCP_SECRET_MANAGER',
      'AZURE_KEY_VAULT',
      'OTHER',
    ];
    expect(values).toHaveLength(7);
  });

  it('AccessType enum has 8 values', () => {
    const values: Prisma.CredentialReferenceUncheckedCreateInput['accessType'][] = [
      'AWS',
      'GITHUB',
      'GCP',
      'AZURE',
      'DATABASE',
      'API_KEY',
      'SSH_KEY',
      'OTHER',
    ];
    expect(values).toHaveLength(8);
  });

  it('CredentialStatus enum has 3 values', () => {
    const values: Prisma.CredentialReferenceUncheckedCreateInput['status'][] = [
      'PENDING',
      'ROTATED',
      'NOT_APPLICABLE',
    ];
    expect(values).toHaveLength(3);
  });

  it('DocumentType enum gains IP_RATIFICATION value', () => {
    const value: Prisma.DocumentUncheckedCreateInput['documentType'] = 'IP_RATIFICATION';
    expect(value).toBe('IP_RATIFICATION');
  });
});
