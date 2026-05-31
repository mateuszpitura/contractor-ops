import { describe, it } from 'vitest';

describe('completeTask — soft-credential-warning gate (Phase 75 D-12)', () => {
  it.todo('completing a workflow with PENDING CredentialReference rows returns warning payload');
  it.todo('warning payload includes count + list of { vaultProvider, label } per pending row');
  it.todo(
    'admin confirmation requires reason (audit field) — empty reason rejected with BAD_REQUEST',
  );
  it.todo('audit log row workflow.completed_with_pending_credentials written with reason + count');
  it.todo('zero PENDING credentials → no warning, normal completion');
  it.todo('all credentials ROTATED or NOT_APPLICABLE → no warning');
  it.todo('admin choosing NOT to confirm → completion is cancelled, workflow stays in IN_PROGRESS');
});
