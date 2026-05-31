import { describe, it } from 'vitest';

// Phase 78 IDP-06 — RED scaffold. Plan 78-04 flips these `it.todo` placeholders
// to real `it(...)` assertions against the okta MSW handlers.
describe('OktaAdapter — Deprovisionable contract (Phase 78 IDP-06)', () => {
  it.todo('implements Deprovisionable');
  it.todo(
    'suspendAccount calls userApi.deactivateUser → status DEPROVISIONED → SUCCEEDED with hashes',
  );
  it.todo('revokeAllSessions calls userApi.revokeUserSessions → SUCCEEDED');
  it.todo('verifyDeprovisioned: status === DEPROVISIONED OR 404 → true (LIKELY_GONE)');
  it.todo(
    'describeImpact surfaces assignedAppCount/enrolledFactorTypes/groupMembershipCount/adminRoles/linkedIdpCount',
  );
  it.todo(
    'error classification: 401→PERMANENT_AUTH_EXPIRED, 403→PERMANENT_FORBIDDEN, 404→PERMANENT_NOT_FOUND, 429→TRANSIENT_RATE_LIMIT',
  );
});
