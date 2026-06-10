import { createMockServer, HttpResponse, http } from '@contractor-ops/test-utils';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { EntraIdAdapter } from '../entra-id-adapter.js';

// EntraIdAdapter Deprovisionable behavior. Raw Microsoft Graph fetch intercepted
// by the entra MSW handlers + per-test overrides. LOCAL-ONLY: no live Entra tenant.
// The access token is carried via withAccessToken.

const { server } = createMockServer({ handlersOnly: true });

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const USER = 'user-entra-001';
const adapter = () => new EntraIdAdapter().withAccessToken('fake-graph-token');

// Pathname predicates mirroring the entra MSW handler matchers.
const isUser = (url: string) => /^\/v1\.0\/users\/[^/]+$/.test(new URL(url).pathname);
const isRevoke = (url: string) =>
  /^\/v1\.0\/users\/[^/]+\/revokeSignInSessions$/.test(new URL(url).pathname);

describe('EntraIdAdapter — Deprovisionable contract', () => {
  it('implements Deprovisionable', () => {
    const a = adapter();
    expect(typeof a.suspendAccount).toBe('function');
    expect(typeof a.revokeAllSessions).toBe('function');
    expect(typeof a.verifyDeprovisioned).toBe('function');
    expect(typeof a.describeImpact).toBe('function');
  });

  it('suspendAccount on a NON-hybrid user PATCHes accountEnabled:false → SUCCEEDED + hashes', async () => {
    let patchBody: unknown;
    server.use(
      http.get(
        ({ request }) => isUser(request.url),
        () => HttpResponse.json({ accountEnabled: true, onPremisesSyncEnabled: false }),
      ),
      http.patch(
        ({ request }) => isUser(request.url),
        async ({ request }) => {
          patchBody = await request.json();
          return new HttpResponse(null, { status: 204 });
        },
      ),
    );

    const result = await adapter().suspendAccount(USER);
    expect(result.status).toBe('SUCCEEDED');
    expect(patchBody).toEqual({ accountEnabled: false });
    expect(result.requestSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.responseSha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it('hybrid-AD HARD BLOCK: onPremisesSyncEnabled:true → FAILED, NO PATCH fired', async () => {
    server.use(
      http.get(
        ({ request }) => isUser(request.url),
        () => HttpResponse.json({ accountEnabled: true, onPremisesSyncEnabled: true }),
      ),
      // A PATCH must NOT be issued — if it is, fail the test loudly.
      http.patch(
        ({ request }) => isUser(request.url),
        () => {
          throw new Error('PATCH must NOT fire when onPremisesSyncEnabled is true');
        },
      ),
    );

    const result = await adapter().suspendAccount(USER);
    expect(result.status).toBe('FAILED');
    expect(result.errorMessage).toMatch(/On-prem AD authoritative/i);
    expect(result.reason).toBe('hybrid_ad_authoritative');
  });

  it('hybrid-AD pre-flight drifted/garbage body → FAILED hard, NO PATCH fired (gate must NOT fail open)', async () => {
    // A body that is not valid JSON — simulates a drifted Graph response where
    // onPremisesSyncEnabled would silently coerce to undefined under a bare `as` cast.
    server.use(
      http.get(
        ({ request }) => isUser(request.url),
        () =>
          new HttpResponse('not-json-at-all', {
            status: 200,
            headers: { 'content-type': 'text/plain' },
          }),
      ),
      // PATCH must NOT fire — a parse failure is a hard-fail, not a bypass.
      http.patch(
        ({ request }) => isUser(request.url),
        () => {
          throw new Error('PATCH must NOT fire on a drifted pre-flight body');
        },
      ),
    );

    const result = await adapter().suspendAccount(USER);
    expect(result.status).toBe('FAILED');
    expect(result.errorClass).toBe('PERMANENT_OTHER');
    expect(result.errorMessage).toMatch(/schema validation/i);
  });

  it('suspendAccount 404 on pre-flight → LIKELY_GONE, no write', async () => {
    server.use(
      http.get(
        ({ request }) => isUser(request.url),
        () => HttpResponse.json({ error: { code: 'Request_ResourceNotFound' } }, { status: 404 }),
      ),
    );
    const result = await adapter().suspendAccount(USER);
    expect(result.status).toBe('LIKELY_GONE');
    expect(result.failureKind).toBe('USER_NOT_FOUND');
  });

  it('revokeAllSessions POSTs /revokeSignInSessions → SUCCEEDED; single signInActivity poll, step still SUCCEEDS when stale', async () => {
    vi.useFakeTimers();
    try {
      let revokeFired = false;
      server.use(
        http.post(
          ({ request }) => isRevoke(request.url),
          () => {
            revokeFired = true;
            return HttpResponse.json({ value: true });
          },
        ),
        // signInActivity poll returns no activity (stale/missing) — must not fail the step.
        http.get(
          ({ request }) => isUser(request.url),
          () => HttpResponse.json({}),
        ),
      );

      const promise = adapter().revokeAllSessions(USER);
      await vi.advanceTimersByTimeAsync(2_500);
      const result = await promise;

      expect(revokeFired).toBe(true);
      expect(result.status).toBe('SUCCEEDED');
      expect(result.requestSha256).toMatch(/^[a-f0-9]{64}$/);
    } finally {
      vi.useRealTimers();
    }
  });

  it('describeImpact returns ENTRA preview with applicable Conditional Access policy (non-blocking)', async () => {
    server.use(
      http.get('https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies', () =>
        HttpResponse.json({
          value: [
            {
              displayName: 'Require MFA for all users',
              state: 'enabled',
              conditions: { users: { includeUsers: ['All'] } },
              sessionControls: { signInFrequency: { isEnabled: true } },
            },
            {
              displayName: 'Disabled legacy policy',
              state: 'disabled',
              conditions: { users: { includeUsers: ['All'] } },
            },
          ],
        }),
      ),
      http.get(
        ({ request }) => isUser(request.url),
        () =>
          HttpResponse.json({
            accountEnabled: true,
            onPremisesSyncEnabled: false,
            displayName: 'Entra Test User',
            assignedLicenses: [{ skuId: 'sku-e3' }],
          }),
      ),
      // $count endpoints (memberOf / registeredDevices / appRoleAssignments).
      http.get('https://graph.microsoft.com/v1.0/users/:id/memberOf/$count', () =>
        HttpResponse.text('3'),
      ),
      http.get('https://graph.microsoft.com/v1.0/users/:id/registeredDevices/$count', () =>
        HttpResponse.text('2'),
      ),
      http.get('https://graph.microsoft.com/v1.0/users/:id/appRoleAssignments/$count', () =>
        HttpResponse.text('5'),
      ),
    );

    const preview = await adapter().describeImpact(USER);
    expect(preview.provider).toBe('ENTRA');
    if (preview.provider === 'ENTRA') {
      expect(preview.commonMetrics.accountStatus).toBe('ACTIVE');
      expect(preview.commonMetrics.externalUserDisplayName).toBe('Entra Test User');
      // Only the enabled policy is surfaced, and it applies (includeUsers: All).
      expect(preview.customMetrics.conditionalAccessPolicies).toHaveLength(1);
      const policy = preview.customMetrics.conditionalAccessPolicies[0];
      expect(policy.appliesToUser).toBe(true);
      expect(policy.hasSessionControls).toBe(true);
      expect(preview.customMetrics.assignedLicenseSkus).toEqual(['sku-e3']);
      expect(preview.customMetrics.groupMembershipCount).toBe(3);
      expect(preview.customMetrics.registeredDeviceCount).toBe(2);
      expect(preview.customMetrics.appRoleAssignmentCount).toBe(5);
      expect(preview.customMetrics.onPremisesSyncEnabled).toBe(false);
    }
  });

  it('verifyDeprovisioned: accountEnabled false → true', async () => {
    server.use(
      http.get(
        ({ request }) => isUser(request.url),
        () => HttpResponse.json({ accountEnabled: false }),
      ),
    );
    expect(await adapter().verifyDeprovisioned(USER)).toBe(true);
  });

  it('verifyDeprovisioned: 404 → true (LIKELY_GONE)', async () => {
    server.use(
      http.get(
        ({ request }) => isUser(request.url),
        () => HttpResponse.json({ error: { code: 'Request_ResourceNotFound' } }, { status: 404 }),
      ),
    );
    expect(await adapter().verifyDeprovisioned(USER)).toBe(true);
  });

  it('error classification: PATCH 401 → PERMANENT_AUTH_EXPIRED (AUTH_REVOKED)', async () => {
    server.use(
      http.get(
        ({ request }) => isUser(request.url),
        () => HttpResponse.json({ accountEnabled: true, onPremisesSyncEnabled: false }),
      ),
      http.patch(
        ({ request }) => isUser(request.url),
        () => HttpResponse.json({ error: { code: 'InvalidAuthenticationToken' } }, { status: 401 }),
      ),
    );
    const result = await adapter().suspendAccount(USER);
    expect(result.status).toBe('FAILED');
    expect(result.errorClass).toBe('PERMANENT_AUTH_EXPIRED');
    expect(result.failureKind).toBe('AUTH_REVOKED');
  });

  it('error classification: PATCH 403 Authorization_RequestDenied → PERMANENT_FORBIDDEN', async () => {
    server.use(
      http.get(
        ({ request }) => isUser(request.url),
        () => HttpResponse.json({ accountEnabled: true, onPremisesSyncEnabled: false }),
      ),
      http.patch(
        ({ request }) => isUser(request.url),
        () =>
          HttpResponse.json({ error: { code: 'Authorization_RequestDenied' } }, { status: 403 }),
      ),
    );
    const result = await adapter().suspendAccount(USER);
    expect(result.status).toBe('FAILED');
    expect(result.errorClass).toBe('PERMANENT_FORBIDDEN');
    expect(result.errorMessage).toMatch(/Graph app permissions/i);
  });

  it('error classification: PATCH 429 → throws (TRANSIENT_RATE_LIMIT, QStash retries)', async () => {
    server.use(
      http.get(
        ({ request }) => isUser(request.url),
        () => HttpResponse.json({ accountEnabled: true, onPremisesSyncEnabled: false }),
      ),
      http.patch(
        ({ request }) => isUser(request.url),
        () => HttpResponse.json({ error: { code: 'TooManyRequests' } }, { status: 429 }),
      ),
    );
    await expect(adapter().suspendAccount(USER)).rejects.toThrow(/transient/i);
  });
});
