/**
 * SlackAdapter Deprovisionable behavior.
 * SCIM deactivate + admin.users.session.invalidate via the ORG-GRID token only.
 * LOCAL-ONLY: MSW handlers, never live Slack/SCIM.
 */

import { createMockServer, HttpResponse, http } from '@contractor-ops/test-utils';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { SlackAdapter } from '../slack-adapter.js';

const { server, capture } = createMockServer({ handlersOnly: true });
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  capture.clear();
});
afterAll(() => server.close());

const isScimUserPath = (url: string) => {
  const u = new URL(url);
  return u.hostname === 'api.slack.com' && /^\/scim\/v2\/Users\/[^/]+$/.test(u.pathname);
};
const isScimQuery = (url: string) => {
  const u = new URL(url);
  return u.hostname === 'api.slack.com' && u.pathname === '/scim/v2/Users';
};

const adapter = () => new SlackAdapter().withOrgGridToken('org-grid-token');
const USER_ID = 'W08001';

describe('SlackAdapter — Deprovisionable', () => {
  it('implements all four Deprovisionable methods', () => {
    const a = adapter();
    expect(typeof a.suspendAccount).toBe('function');
    expect(typeof a.revokeAllSessions).toBe('function');
    expect(typeof a.verifyDeprovisioned).toBe('function');
    expect(typeof a.describeImpact).toBe('function');
  });

  it('suspendAccount → SCIM PATCH active=false → SUCCEEDED + PII-free hashes', async () => {
    let sawScimContentType = false;
    let sawPatchBody: unknown;
    server.use(
      http.patch(
        ({ request }) => isScimUserPath(request.url),
        async ({ request }) => {
          sawScimContentType = request.headers.get('content-type') === 'application/scim+json';
          sawPatchBody = await request.json();
          return HttpResponse.json({ active: false });
        },
      ),
    );
    const result = await adapter().suspendAccount(USER_ID);
    expect(result.status).toBe('SUCCEEDED');
    expect(result.requestSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.responseSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(sawScimContentType).toBe(true);
    expect(sawPatchBody).toMatchObject({
      Operations: [{ op: 'replace', path: 'active', value: false }],
    });
  });

  it('suspendAccount resolves SCIM id from an email before patching', async () => {
    server.use(
      http.get(
        ({ request }) => isScimQuery(request.url),
        () => HttpResponse.json({ Resources: [{ id: 'W-RESOLVED' }] }),
      ),
      http.patch(
        ({ request }) => isScimUserPath(request.url),
        () => HttpResponse.json({ active: false }),
      ),
    );
    const result = await adapter().suspendAccount('contractor@example.com');
    expect(result.status).toBe('SUCCEEDED');
  });

  it('suspendAccount uses the org-grid token, not a workspace token', async () => {
    let seenAuth: string | null = null;
    server.use(
      http.patch(
        ({ request }) => isScimUserPath(request.url),
        ({ request }) => {
          seenAuth = request.headers.get('authorization');
          return HttpResponse.json({ active: false });
        },
      ),
    );
    await new SlackAdapter().withOrgGridToken('THE-ORG-GRID-TOKEN').suspendAccount(USER_ID);
    expect(seenAuth).toBe('Bearer THE-ORG-GRID-TOKEN');
  });

  it('SCIM 403 cannot_perform_operation → FAILED PERMANENT_FORBIDDEN (not-on-grid signal)', async () => {
    server.use(
      http.patch(
        ({ request }) => isScimUserPath(request.url),
        () => HttpResponse.json({ scimType: 'cannot_perform_operation' }, { status: 403 }),
      ),
    );
    const result = await adapter().suspendAccount(USER_ID);
    expect(result.status).toBe('FAILED');
    expect(result.errorClass).toBe('PERMANENT_FORBIDDEN');
  });

  it('SCIM 401 → FAILED PERMANENT_AUTH_EXPIRED', async () => {
    server.use(
      http.patch(
        ({ request }) => isScimUserPath(request.url),
        () => new HttpResponse('unauthorized', { status: 401 }),
      ),
    );
    const result = await adapter().suspendAccount(USER_ID);
    expect(result.status).toBe('FAILED');
    expect(result.errorClass).toBe('PERMANENT_AUTH_EXPIRED');
  });

  it('SCIM 429 → throws (QStash retries)', async () => {
    server.use(
      http.patch(
        ({ request }) => isScimUserPath(request.url),
        () => new HttpResponse('rate limited', { status: 429 }),
      ),
    );
    await expect(adapter().suspendAccount(USER_ID)).rejects.toThrow(/transient/i);
  });

  it('revokeAllSessions → admin.users.session.invalidate ok:true → SUCCEEDED', async () => {
    server.use(
      http.post('https://slack.com/api/admin.users.session.invalidate', () =>
        HttpResponse.json({ ok: true }),
      ),
    );
    const result = await adapter().revokeAllSessions(USER_ID);
    expect(result.status).toBe('SUCCEEDED');
    expect(result.requestSha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it('revokeAllSessions user_not_found → LIKELY_GONE', async () => {
    server.use(
      http.post('https://slack.com/api/admin.users.session.invalidate', () =>
        HttpResponse.json({ ok: false, error: 'user_not_found' }),
      ),
    );
    const result = await adapter().revokeAllSessions(USER_ID);
    expect(result.status).toBe('LIKELY_GONE');
  });

  it('revokeAllSessions missing_scope → FAILED PERMANENT_FORBIDDEN', async () => {
    server.use(
      http.post('https://slack.com/api/admin.users.session.invalidate', () =>
        HttpResponse.json({ ok: false, error: 'missing_scope' }),
      ),
    );
    const result = await adapter().revokeAllSessions(USER_ID);
    expect(result.status).toBe('FAILED');
    expect(result.errorClass).toBe('PERMANENT_FORBIDDEN');
  });

  it('revokeAllSessions ratelimited → throws', async () => {
    server.use(
      http.post('https://slack.com/api/admin.users.session.invalidate', () =>
        HttpResponse.json({ ok: false, error: 'ratelimited' }),
      ),
    );
    await expect(adapter().revokeAllSessions(USER_ID)).rejects.toThrow(/transient/i);
  });

  it('verifyDeprovisioned true when user.deleted === true', async () => {
    server.use(
      http.post('https://slack.com/api/users.info', () =>
        HttpResponse.json({ ok: true, user: { deleted: true } }),
      ),
    );
    expect(await adapter().verifyDeprovisioned(USER_ID)).toBe(true);
  });

  it('verifyDeprovisioned true on user_not_found', async () => {
    server.use(
      http.post('https://slack.com/api/users.info', () =>
        HttpResponse.json({ ok: false, error: 'user_not_found' }),
      ),
    );
    expect(await adapter().verifyDeprovisioned(USER_ID)).toBe(true);
  });

  it('suspendAccount hash does not embed the org-grid token (token-independent)', async () => {
    server.use(
      http.patch(
        ({ request }) => isScimUserPath(request.url),
        () => HttpResponse.json({ active: false }),
      ),
    );
    const a = await new SlackAdapter().withOrgGridToken('token-A').suspendAccount(USER_ID);
    const b = await new SlackAdapter().withOrgGridToken('token-B').suspendAccount(USER_ID);
    expect(a.requestSha256).toBe(b.requestSha256);
  });
});
