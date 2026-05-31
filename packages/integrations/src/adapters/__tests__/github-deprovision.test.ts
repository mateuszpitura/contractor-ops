import { describe, it } from 'vitest';

// Phase 78 IDP-07 — RED scaffold. Plan 78-05 flips these `it.todo` placeholders
// to real `it(...)` assertions against the github MSW handlers.
describe('GitHubAdapter — Deprovisionable contract (Phase 78 IDP-07)', () => {
  it.todo('implements Deprovisionable');
  it.todo(
    'suspendAccount calls orgs.removeMember (DELETE /orgs/{org}/members/{username}) → SUCCEEDED',
  );
  it.todo('revokeAllSessions revokes per-PAT credential-authorizations on SAML SSO org');
  it.todo('non-SAML org: credential-authorizations unavailable → warning, run NOT failed');
  it.todo(
    'describeImpact flags outsideCollaboratorRepoCount and surfaces repo links as MANUAL item',
  );
  it.todo('verifyDeprovisioned: checkMembershipForUser 404 → true (LIKELY_GONE)');
  it.todo(
    'error classification: 401→PERMANENT_AUTH_EXPIRED, 403→PERMANENT_FORBIDDEN, 404→PERMANENT_NOT_FOUND, 429→TRANSIENT_RATE_LIMIT',
  );
});
