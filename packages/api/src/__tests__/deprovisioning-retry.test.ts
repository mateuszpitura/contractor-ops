import { describe, it } from 'vitest';

describe('retryDeprovisioningStep mutation (Phase 76 D-04)', () => {
  it.todo('returns { noop: true } when step is not in FAILED state (idempotent precondition)');
  it.todo('resets step.attempts = 0, step.status = PENDING, step.lastErrorMessage = null');
  it.todo('enqueues fresh QStash job with deduplicationId = runId:stepId:nextAttempt');
  it.todo('emits getIdpAuditLogger entry with auditEvent: deprovision_step_retried');
  it.todo('double-click within 1s does not enqueue a duplicate job (deduplicationId race)');
});
