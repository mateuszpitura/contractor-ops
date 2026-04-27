import { describe, it } from 'vitest';

// This file establishes the RED state for Plan 71-05. Once 71-05 ships
// the `recreateComplianceAssessment` mutation, these tests turn GREEN.

describe('classification.recreateComplianceAssessment — Phase 71 admin recompute (D-13..D-16)', () => {
  it.todo('admin can call mutation with single contractorId and reason policy_version_bump');
  it.todo(
    'admin can call mutation with bulk contractorIds (N>1) and reason classification_outcome_change',
  );
  it.todo('non-admin caller rejected via adminProcedure middleware');
  it.todo(
    'idempotency: second invocation with reason=policy_version_bump on already-current contractor returns noop:true',
  );
  it.todo(
    'emits exactly 1 AuditLog row per invocation with action=compliance.recompute and deltas in metadataJson',
  );
  it.todo(
    'bulk: per-contractor transaction failure does not block siblings; failed entry returned in results',
  );
  it.todo('reason validation: reject invalid enum value with BAD_REQUEST');
  it.todo('reason validation: missing reason rejected by Zod input schema');
});
