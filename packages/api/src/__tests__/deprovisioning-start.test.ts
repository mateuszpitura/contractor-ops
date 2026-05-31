import { describe, it } from 'vitest';

describe('startDeprovisioningRun mutation (Phase 76 D-03)', () => {
  it.todo('rejects when cooldown gate returns allowed: false (FORBIDDEN)');
  it.todo('inserts DeprovisioningRun + N DeprovisioningStep rows in a single transaction');
  it.todo('enqueues N independent QStash jobs (one per step) — no Promise.allSettled');
  it.todo('returns runId + earliestDate when allowed');
  it.todo(
    'emits getIdpAuditLogger entry with runId, organizationId, contractorId, triggeredByUserId',
  );
});
