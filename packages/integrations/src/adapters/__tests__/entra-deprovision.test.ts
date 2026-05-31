import { describe, it } from 'vitest';

// Phase 78 IDP-05 — RED scaffold. Plan 78-03 flips these `it.todo` placeholders
// to real `it(...)` assertions against the entra MSW handlers.
describe('EntraIdAdapter — Deprovisionable contract (Phase 78 IDP-05)', () => {
  it.todo(
    'implements Deprovisionable (suspendAccount/revokeAllSessions/verifyDeprovisioned/describeImpact)',
  );
  it.todo('suspendAccount PATCHes accountEnabled:false → SUCCEEDED with request/response hashes');
  it.todo('revokeAllSessions POSTs /revokeSignInSessions → SUCCEEDED');
  it.todo('pre-flight: onPremisesSyncEnabled === true HARD BLOCKS before any mutation (hybrid-AD)');
  it.todo(
    'describeImpact surfaces conditionalAccessPolicies that apply to the user (non-blocking warning)',
  );
  it.todo('verifyDeprovisioned: accountEnabled === false OR 404 → true (LIKELY_GONE)');
  it.todo(
    'error classification: 401→PERMANENT_AUTH_EXPIRED, 403 Authorization_RequestDenied→PERMANENT_FORBIDDEN, 404→PERMANENT_NOT_FOUND, 429→TRANSIENT_RATE_LIMIT',
  );
});
