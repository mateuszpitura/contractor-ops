import { describe, it } from 'vitest';

describe('Deprovisionable interface (Phase 76 D-13)', () => {
  it.todo('exports Deprovisionable with suspendAccount + revokeAllSessions + verifyDeprovisioned');
  it.todo(
    'TypeScript rejects classes that do not implement all three methods (compile-time guarantee)',
  );
  it.todo('GOOGLE_WORKSPACE_DEPROVISION_SCOPES const exports the admin.directory.user scope');
});
