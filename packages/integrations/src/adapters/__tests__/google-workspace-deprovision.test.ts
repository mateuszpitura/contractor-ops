import { describe, it } from 'vitest';

describe('GoogleWorkspaceAdapter — Deprovisionable contract (Phase 76 D-13/D-16)', () => {
  it.todo('class GoogleWorkspaceAdapter implements Deprovisionable');
  it.todo(
    'suspendAccount(externalUserId) → MSW user.update(suspended=true) → { status: SUCCEEDED }',
  );
  it.todo('revokeAllSessions(externalUserId) → MSW signOut endpoint → { status: SUCCEEDED }');
  it.todo(
    'verifyDeprovisioned(externalUserId) returns true within 5 min after suspend (mocked clock)',
  );
  it.todo('USER_NOT_FOUND from provider maps to status: SUCCEEDED with explanatory errorMessage');
  it.todo('5xx from provider maps to status: FAILED with failureKind: PROVIDER_ERROR');
  it.todo('429 from provider maps to status: FAILED with failureKind: RATE_LIMITED');
});
