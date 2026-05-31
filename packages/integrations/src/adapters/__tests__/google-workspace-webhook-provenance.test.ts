import { describe, it } from 'vitest';

describe('GoogleWorkspaceAdapter.handleWebhook (Phase 76 D-09..D-12)', () => {
  it.todo('user.suspended event with matching IdpChangeProvenance returns { suppressed: true }');
  it.todo('user.suspended event without provenance match falls through to default v3.0 path');
  it.todo('non-user-suspended events bypass the provenance lookup');
  it.todo('provenance match sets matchedAt = now() (concurrent-webhook-safe via updateMany)');
});
