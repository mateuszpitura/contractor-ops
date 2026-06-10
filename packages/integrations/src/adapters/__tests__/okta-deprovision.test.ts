import { createMockServer, HttpResponse, http } from '@contractor-ops/test-utils';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { OktaAdapter } from '../okta-adapter.js';

// OktaAdapter Deprovisionable behavior. The @okta/okta-sdk-nodejs client issues
// real HTTP to the org URL, intercepted by the okta MSW handlers (pathname
// predicates, host-agnostic). LOCAL-ONLY: no live Okta sandbox.

const { server } = createMockServer({ handlersOnly: true });

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const ORG_URL = 'https://example.okta.com';
const USER = '00uTESTUSER001';
const adapter = () => new OktaAdapter().withCredentials(ORG_URL, 'fake-okta-token');

// Pathname predicates mirroring the okta MSW handler matchers.
const isDeactivate = (url: string) =>
  /\/api\/v1\/users\/[^/]+\/lifecycle\/deactivate$/.test(new URL(url).pathname);
const isUser = (url: string) => /\/api\/v1\/users\/[^/]+$/.test(new URL(url).pathname);
const isSessions = (url: string) =>
  /\/api\/v1\/users\/[^/]+\/sessions$/.test(new URL(url).pathname);

describe('OktaAdapter — Deprovisionable contract', () => {
  it('implements Deprovisionable', () => {
    const a = adapter();
    expect(typeof a.suspendAccount).toBe('function');
    expect(typeof a.revokeAllSessions).toBe('function');
    expect(typeof a.verifyDeprovisioned).toBe('function');
    expect(typeof a.describeImpact).toBe('function');
  });

  it('suspendAccount calls userApi.deactivateUser → status DEPROVISIONED → SUCCEEDED with hashes', async () => {
    let deactivateCalled = false;
    server.use(
      // verify-first getUser returns ACTIVE so the deactivate path runs.
      http.get(
        ({ request }) => isUser(request.url),
        () => HttpResponse.json({ id: USER, status: 'ACTIVE' }),
      ),
      http.post(
        ({ request }) => isDeactivate(request.url),
        () => {
          deactivateCalled = true;
          return HttpResponse.json({ status: 'DEPROVISIONED' });
        },
      ),
    );

    const result = await adapter().suspendAccount(USER);
    expect(result.status).toBe('SUCCEEDED');
    expect(deactivateCalled).toBe(true);
    expect(result.requestSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.responseSha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it('already-DEPROVISIONED user short-circuits to LIKELY_GONE with NO deactivate call', async () => {
    let deactivateCalled = false;
    server.use(
      http.get(
        ({ request }) => isUser(request.url),
        () => HttpResponse.json({ id: USER, status: 'DEPROVISIONED' }),
      ),
      http.post(
        ({ request }) => isDeactivate(request.url),
        () => {
          deactivateCalled = true;
          return HttpResponse.json({ status: 'DEPROVISIONED' });
        },
      ),
    );

    const result = await adapter().suspendAccount(USER);
    expect(result.status).toBe('LIKELY_GONE');
    expect(result.skipped).toBe(true);
    expect(deactivateCalled).toBe(false);
  });

  it('revokeAllSessions calls userApi.revokeUserSessions → SUCCEEDED', async () => {
    let sessionsCalled = false;
    server.use(
      http.delete(
        ({ request }) => isSessions(request.url),
        () => {
          sessionsCalled = true;
          return new HttpResponse(null, { status: 204 });
        },
      ),
    );

    const result = await adapter().revokeAllSessions(USER);
    expect(result.status).toBe('SUCCEEDED');
    expect(sessionsCalled).toBe(true);
    expect(result.requestSha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it('verifyDeprovisioned: status DEPROVISIONED → true', async () => {
    server.use(
      http.get(
        ({ request }) => isUser(request.url),
        () => HttpResponse.json({ id: USER, status: 'DEPROVISIONED' }),
      ),
    );
    expect(await adapter().verifyDeprovisioned(USER)).toBe(true);
  });

  it('verifyDeprovisioned: getUser 404 → true (LIKELY_GONE)', async () => {
    server.use(
      http.get(
        ({ request }) => isUser(request.url),
        () => HttpResponse.json({ errorCode: 'E0000007' }, { status: 404 }),
      ),
    );
    expect(await adapter().verifyDeprovisioned(USER)).toBe(true);
  });

  it('describeImpact returns OKTA preview with populated custom metrics', async () => {
    server.use(
      http.get(
        ({ request }) => isUser(request.url),
        () =>
          HttpResponse.json({
            id: USER,
            status: 'ACTIVE',
            profile: { displayName: 'Test User', login: 'test@example.com' },
          }),
      ),
      http.get('https://example.okta.com/api/v1/users/:id/groups', () =>
        HttpResponse.json([{ id: 'g1' }, { id: 'g2' }]),
      ),
      http.get('https://example.okta.com/api/v1/users/:id/appLinks', () =>
        HttpResponse.json([{ id: 'app1' }]),
      ),
      http.get('https://example.okta.com/api/v1/users/:id/idps', () => HttpResponse.json([])),
      http.get('https://example.okta.com/api/v1/users/:id/factors', () =>
        HttpResponse.json([{ factorType: 'token:software:totp' }, { factorType: 'push' }]),
      ),
      http.get('https://example.okta.com/api/v1/users/:id/roles', () =>
        HttpResponse.json([{ type: 'SUPER_ADMIN', label: 'Super Administrator' }]),
      ),
    );

    const preview = await adapter().describeImpact(USER);
    expect(preview.provider).toBe('OKTA');
    if (preview.provider === 'OKTA') {
      expect(preview.commonMetrics.accountStatus).toBe('ACTIVE');
      expect(preview.commonMetrics.externalUserDisplayName).toBe('Test User');
      expect(preview.customMetrics.groupMembershipCount).toBe(2);
      expect(preview.customMetrics.assignedAppCount).toBe(1);
      expect(preview.customMetrics.enrolledFactorTypes).toEqual(['token:software:totp', 'push']);
      expect(preview.customMetrics.adminRoles).toEqual(['Super Administrator']);
      expect(preview.customMetrics.linkedIdpCount).toBe(0);
    }
  });

  it('error classification: deactivate 401 → AUTH_REVOKED (PERMANENT_AUTH_EXPIRED)', async () => {
    server.use(
      http.get(
        ({ request }) => isUser(request.url),
        () => HttpResponse.json({ id: USER, status: 'ACTIVE' }),
      ),
      http.post(
        ({ request }) => isDeactivate(request.url),
        () => HttpResponse.json({ errorCode: 'E0000011' }, { status: 401 }),
      ),
    );
    const result = await adapter().suspendAccount(USER);
    expect(result.status).toBe('FAILED');
    expect(result.errorClass).toBe('PERMANENT_AUTH_EXPIRED');
    expect(result.failureKind).toBe('AUTH_REVOKED');
  });

  it('error classification: deactivate 403 → PERMANENT_FORBIDDEN', async () => {
    server.use(
      http.get(
        ({ request }) => isUser(request.url),
        () => HttpResponse.json({ id: USER, status: 'ACTIVE' }),
      ),
      http.post(
        ({ request }) => isDeactivate(request.url),
        () => HttpResponse.json({ errorCode: 'E0000006' }, { status: 403 }),
      ),
    );
    const result = await adapter().suspendAccount(USER);
    expect(result.status).toBe('FAILED');
    expect(result.errorClass).toBe('PERMANENT_FORBIDDEN');
  });

  it('error classification: deactivate 429 → throws (TRANSIENT_RATE_LIMIT, QStash retries)', async () => {
    server.use(
      http.get(
        ({ request }) => isUser(request.url),
        () => HttpResponse.json({ id: USER, status: 'ACTIVE' }),
      ),
      http.post(
        ({ request }) => isDeactivate(request.url),
        () => HttpResponse.json({ errorCode: 'E0000047' }, { status: 429 }),
      ),
    );
    await expect(adapter().suspendAccount(USER)).rejects.toThrow(/transient/i);
  });
});
