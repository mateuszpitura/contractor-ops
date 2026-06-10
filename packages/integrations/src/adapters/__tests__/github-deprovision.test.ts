import { createMockServer, HttpResponse, http } from '@contractor-ops/test-utils';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { GitHubAdapter } from '../github-adapter.js';

// GitHubAdapter Deprovisionable behavior. @octokit/rest issues real HTTP to
// api.github.com, intercepted by the github MSW handlers + per-test overrides.
// LOCAL-ONLY: no live GitHub org.

const { server } = createMockServer({ handlersOnly: true });

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const ORG = 'acme-corp';
const USER = 'octocat';
const adapter = () => new GitHubAdapter().withCredentials(ORG, 'fake-gh-token');

const GH = 'https://api.github.com';

describe('GitHubAdapter — Deprovisionable contract', () => {
  it('implements Deprovisionable', () => {
    const a = adapter();
    expect(typeof a.suspendAccount).toBe('function');
    expect(typeof a.revokeAllSessions).toBe('function');
    expect(typeof a.verifyDeprovisioned).toBe('function');
    expect(typeof a.describeImpact).toBe('function');
  });

  it('suspendAccount calls orgs.removeMember (DELETE /orgs/{org}/members/{username}) → SUCCEEDED', async () => {
    let removed = false;
    server.use(
      http.delete(`${GH}/orgs/${ORG}/members/${USER}`, () => {
        removed = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const result = await adapter().suspendAccount(USER);
    expect(result.status).toBe('SUCCEEDED');
    expect(removed).toBe(true);
    expect(result.requestSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.responseSha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it('suspendAccount removeMember 404 → LIKELY_GONE', async () => {
    server.use(
      http.delete(`${GH}/orgs/${ORG}/members/${USER}`, () =>
        HttpResponse.json({ message: 'Not Found' }, { status: 404 }),
      ),
    );
    const result = await adapter().suspendAccount(USER);
    expect(result.status).toBe('LIKELY_GONE');
    expect(result.failureKind).toBe('USER_NOT_FOUND');
  });

  it('revokeAllSessions on a SAML org revokes the matching per-PAT credential authorizations', async () => {
    const deletedIds: number[] = [];
    server.use(
      http.get(`${GH}/orgs/${ORG}/credential-authorizations`, () =>
        HttpResponse.json([
          { login: USER, credential_id: 101, token_last_eight: 'aaaa1111' },
          { login: USER, credential_id: 102, token_last_eight: 'bbbb2222' },
          { login: 'someone-else', credential_id: 999, token_last_eight: 'cccc3333' },
        ]),
      ),
      http.delete(`${GH}/orgs/${ORG}/credential-authorizations/:id`, ({ params }) => {
        deletedIds.push(Number(params.id));
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const result = await adapter().revokeAllSessions(USER);
    expect(result.status).toBe('SUCCEEDED');
    expect(deletedIds.sort()).toEqual([101, 102]);
    expect(deletedIds).not.toContain(999);
  });

  it('non-SAML org: credential-authorizations 404 → SUCCEEDED with warning, run NOT failed', async () => {
    server.use(
      http.get(`${GH}/orgs/${ORG}/credential-authorizations`, () =>
        HttpResponse.json({ message: 'Not Found' }, { status: 404 }),
      ),
    );
    const result = await adapter().revokeAllSessions(USER);
    expect(result.status).toBe('SUCCEEDED');
    expect(result.reason).toMatch(/not on SAML SSO/i);
  });

  it('non-SAML org: credential-authorizations 403 → SUCCEEDED with warning (not FAILED)', async () => {
    server.use(
      http.get(`${GH}/orgs/${ORG}/credential-authorizations`, () =>
        HttpResponse.json({ message: 'Forbidden' }, { status: 403 }),
      ),
    );
    const result = await adapter().revokeAllSessions(USER);
    expect(result.status).toBe('SUCCEEDED');
    expect(result.reason).toMatch(/not on SAML SSO/i);
  });

  it('describeImpact flags outsideCollaboratorRepoCount and surfaces GITHUB metrics', async () => {
    server.use(
      http.get(`${GH}/orgs/${ORG}/memberships/${USER}`, () =>
        HttpResponse.json({ state: 'active', role: 'member' }),
      ),
      http.get(`${GH}/orgs/${ORG}/repos`, () =>
        HttpResponse.json([{ name: 'repo-a' }, { name: 'repo-b' }]),
      ),
      http.get(`${GH}/orgs/${ORG}/teams`, () => HttpResponse.json([{ id: 1 }])),
      http.get(`${GH}/orgs/${ORG}/outside_collaborators`, () =>
        HttpResponse.json([{ login: USER }]),
      ),
      // User collaborates on repo-a (204) but not repo-b (404).
      http.get(
        `${GH}/repos/${ORG}/repo-a/collaborators/${USER}`,
        () => new HttpResponse(null, { status: 204 }),
      ),
      http.get(`${GH}/repos/${ORG}/repo-b/collaborators/${USER}`, () =>
        HttpResponse.json({ message: 'Not Found' }, { status: 404 }),
      ),
      http.get(`${GH}/orgs/${ORG}/invitations`, () =>
        HttpResponse.json([{ login: USER }, { login: 'other' }]),
      ),
      http.get(`${GH}/orgs/${ORG}/credential-authorizations`, () =>
        HttpResponse.json([{ login: USER, credential_id: 1 }]),
      ),
    );

    const preview = await adapter().describeImpact(USER);
    expect(preview.provider).toBe('GITHUB');
    if (preview.provider === 'GITHUB') {
      expect(preview.commonMetrics.accountStatus).toBe('ACTIVE');
      expect(preview.customMetrics.repositoryCount).toBe(2);
      expect(preview.customMetrics.teamMembershipCount).toBe(1);
      expect(preview.customMetrics.outsideCollaboratorRepoCount).toBe(1); // repo-a only
      expect(preview.customMetrics.pendingOrgInvitations).toBe(1); // USER only
      expect(preview.customMetrics.authorizedPatCount).toBe(1);
      expect(preview.customMetrics.isOrgOwner).toBe(false);
    }
  });

  it('describeImpact: non-SAML org → authorizedPatCount null', async () => {
    server.use(
      http.get(`${GH}/orgs/${ORG}/memberships/${USER}`, () =>
        HttpResponse.json({ state: 'active', role: 'admin' }),
      ),
      http.get(`${GH}/orgs/${ORG}/repos`, () => HttpResponse.json([])),
      http.get(`${GH}/orgs/${ORG}/teams`, () => HttpResponse.json([])),
      http.get(`${GH}/orgs/${ORG}/outside_collaborators`, () => HttpResponse.json([])),
      http.get(`${GH}/orgs/${ORG}/invitations`, () => HttpResponse.json([])),
      http.get(`${GH}/orgs/${ORG}/credential-authorizations`, () =>
        HttpResponse.json({ message: 'Not Found' }, { status: 404 }),
      ),
    );
    const preview = await adapter().describeImpact(USER);
    if (preview.provider === 'GITHUB') {
      expect(preview.customMetrics.authorizedPatCount).toBeNull();
      expect(preview.customMetrics.isOrgOwner).toBe(true);
    }
  });

  it('describeImpact: 403 on checkCollaborator aborts outside-collab scan → reports 0, not a silent under-count (78 WR-6)', async () => {
    server.use(
      http.get(`${GH}/orgs/${ORG}/memberships/${USER}`, () =>
        HttpResponse.json({ state: 'active', role: 'member' }),
      ),
      http.get(`${GH}/orgs/${ORG}/repos`, () =>
        HttpResponse.json([{ name: 'repo-a' }, { name: 'repo-b' }]),
      ),
      http.get(`${GH}/orgs/${ORG}/teams`, () => HttpResponse.json([])),
      http.get(`${GH}/orgs/${ORG}/outside_collaborators`, () =>
        HttpResponse.json([{ login: USER }]),
      ),
      // repo-a: 403 rate-limit — should abort the scan
      http.get(`${GH}/repos/${ORG}/repo-a/collaborators/${USER}`, () =>
        HttpResponse.json({ message: 'rate limited' }, { status: 403 }),
      ),
      // repo-b would return 204 but should NOT be reached after the 403 abort
      http.get(
        `${GH}/repos/${ORG}/repo-b/collaborators/${USER}`,
        () => new HttpResponse(null, { status: 204 }),
      ),
      http.get(`${GH}/orgs/${ORG}/invitations`, () => HttpResponse.json([])),
      http.get(`${GH}/orgs/${ORG}/credential-authorizations`, () => HttpResponse.json([])),
    );
    const preview = await adapter().describeImpact(USER);
    expect(preview.provider).toBe('GITHUB');
    if (preview.provider === 'GITHUB') {
      // 403 aborted the scan → 0 (not the falsely-low count of 0 that also happens
      // when no repos match — the important assertion is it doesn't report 1 from repo-b
      // while silently skipping the rate-limit signal from repo-a).
      expect(preview.customMetrics.outsideCollaboratorRepoCount).toBe(0);
    }
  });

  it('verifyDeprovisioned: checkMembershipForUser 404 → true (LIKELY_GONE)', async () => {
    server.use(
      http.get(`${GH}/orgs/${ORG}/members/${USER}`, () =>
        HttpResponse.json({ message: 'Not Found' }, { status: 404 }),
      ),
      http.get(`${GH}/orgs/${ORG}/memberships/${USER}`, () =>
        HttpResponse.json({ message: 'Not Found' }, { status: 404 }),
      ),
    );
    expect(await adapter().verifyDeprovisioned(USER)).toBe(true);
  });

  it('error classification: 403 with x-ratelimit-remaining:0 → throws (TRANSIENT_RATE_LIMIT)', async () => {
    server.use(
      http.delete(`${GH}/orgs/${ORG}/members/${USER}`, () =>
        HttpResponse.json(
          { message: 'rate limited' },
          { status: 403, headers: { 'x-ratelimit-remaining': '0' } },
        ),
      ),
    );
    await expect(adapter().suspendAccount(USER)).rejects.toThrow(/transient/i);
  });

  it('error classification: 403 forbidden (no rate-limit header) → PERMANENT_FORBIDDEN', async () => {
    server.use(
      http.delete(`${GH}/orgs/${ORG}/members/${USER}`, () =>
        HttpResponse.json({ message: 'Forbidden' }, { status: 403 }),
      ),
    );
    const result = await adapter().suspendAccount(USER);
    expect(result.status).toBe('FAILED');
    expect(result.errorClass).toBe('PERMANENT_FORBIDDEN');
  });

  it('error classification: 401 → PERMANENT_AUTH_EXPIRED', async () => {
    server.use(
      http.delete(`${GH}/orgs/${ORG}/members/${USER}`, () =>
        HttpResponse.json({ message: 'Bad credentials' }, { status: 401 }),
      ),
    );
    const result = await adapter().suspendAccount(USER);
    expect(result.status).toBe('FAILED');
    expect(result.errorClass).toBe('PERMANENT_AUTH_EXPIRED');
    expect(result.failureKind).toBe('AUTH_REVOKED');
  });
});
