import { describe, expect, it } from 'vitest';

describe('Phase 75 schema additions (Plan 75-02)', () => {
  it.todo('Contract.complianceFlagsJson column exists (Json?)');
  it.todo('Contract.complianceFlagsCheckedAt column exists (DateTime?)');
  it.todo('Contract.complianceFlagsModelVer column exists (String?)');
  it.todo('Contract.latestHealthCheckRunId column exists (String?)');
  it.todo('Contract.jurisdiction column exists (String?, 3-char ISO)');
  it.todo('ContractHealthCheckRun model exists with all D-02 columns');
  it.todo('ContractHealthCheckRun has @@index([contractId, startedAt(sort: Desc)])');
  it.todo('ContractHealthCheckRun has @@index([status])');
  it.todo(
    'ContractHealthCheckRun has @@unique([contractId, contentHash, modelVer]) where status SUCCEEDED',
  );
  it.todo(
    'CredentialReference model exists with workflowRunId (NOT offboardingRecordId per RESEARCH §4)',
  );
  it.todo('CredentialReference has @@index([workflowRunId, status])');
  it.todo(
    'IpAssignmentVerdict enum has 3 values: LIKELY_PRESENT, LIKELY_MISSING, MANUAL_REVIEW_REQUIRED',
  );
  it.todo('RunStatus enum has 3 values: PENDING, SUCCEEDED, FAILED');
  it.todo('RunTrigger enum has 3 values: UPLOAD, MANUAL, MODEL_BUMP_BULK');
  it.todo('VaultProvider enum has 7 values per D-10');
  it.todo('AccessType enum has 8 values per D-10');
  it.todo('CredentialStatus enum has 3 values: PENDING, ROTATED, NOT_APPLICABLE');
  it.todo('DocumentType enum gains IP_RATIFICATION value');

  it('placeholder — schema ships in Plan 75-02', () => {
    expect.fail('Phase 75 schema not yet applied (Plan 75-02)');
  });
});
