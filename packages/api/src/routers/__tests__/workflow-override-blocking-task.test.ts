// TODO(Plan 74-08): implement overrideBlockingTask mutation assertions per
// CONTEXT.md D-10/D-11/D-12 + RESEARCH Pitfall 5 (server-side re-validation).

import { describe, it } from 'vitest';

describe('overrideBlockingTask mutation — D-10/D-11/D-12 + Pitfall 5', () => {
  it.todo('requires workflow:override_blocking_task permission (rejects 9 non-owner roles)');
  it.todo('rejects reason shorter than 20 chars (Zod min)');
  it.todo('rejects acknowledged: false (Zod literal)');
  it.todo(
    'writes WorkflowRun.overrideMetadata + AuditLog row + WorkflowTaskRun status SKIPPED in same $transaction',
  );
  it.todo('returns PRECONDITION_FAILED when no IP_VERIFICATION task is open');
});
