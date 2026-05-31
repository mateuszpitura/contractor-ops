/**
 * Phase 77 D-04/D-05 — GoogleWorkspaceAdapter Deprovisionable behavior.
 *
 * Replaces the Phase 76 D-16 stub-template assertions (404→SUCCEEDED,
 * 429→RATE_LIMITED-FAILED) with the real 77-02 contract: errors classified via
 * the closed-enum classifier — 404→LIKELY_GONE, 429/503→THROW (QStash retries),
 * 401→PERMANENT_AUTH_EXPIRED, 403→PERMANENT_FORBIDDEN — and revokeAllSessions as
 * two sub-actions (OAuth-grant revoke + sign-out), both required for SUCCEEDED.
 *
 * LOCAL-ONLY constraint: tests run against MSW handlers, never live sandboxes.
 */

import { createMockServer, HttpResponse, http } from '@contractor-ops/test-utils';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { GoogleWorkspaceAdapter } from '../google-workspace-adapter.js';

const { server } = createMockServer({ handlersOnly: true });

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// URL predicates (MSW v2 + path-to-regexp v8 crashes on regex/glob path literals).
const ADMIN_HOST = 'admin.googleapis.com';
const isUserPath = (url: string) => {
  const u = new URL(url);
  return u.hostname === ADMIN_HOST && /^\/admin\/directory\/v1\/users\/[^/]+$/.test(u.pathname);
};
const isTokensListPath = (url: string) => {
  const u = new URL(url);
  return (
    u.hostname === ADMIN_HOST && /^\/admin\/directory\/v1\/users\/[^/]+\/tokens$/.test(u.pathname)
  );
};
const isTokenDeletePath = (url: string) => {
  const u = new URL(url);
  return (
    u.hostname === ADMIN_HOST &&
    /^\/admin\/directory\/v1\/users\/[^/]+\/tokens\/[^/]+$/.test(u.pathname)
  );
};
const isSignOutPath = (url: string) => {
  const u = new URL(url);
  return (
    u.hostname === ADMIN_HOST && /^\/admin\/directory\/v1\/users\/[^/]+\/signOut$/.test(u.pathname)
  );
};

const adapter = () => new GoogleWorkspaceAdapter().withAccessToken('fake-token');
const USER = 'u@example.com';

describe('GoogleWorkspaceAdapter — Deprovisionable contract (Phase 77 D-04/D-05)', () => {
  it('implements all four Deprovisionable methods', () => {
    const a = adapter();
    expect(typeof a.suspendAccount).toBe('function');
    expect(typeof a.revokeAllSessions).toBe('function');
    expect(typeof a.verifyDeprovisioned).toBe('function');
    expect(typeof a.describeImpact).toBe('function');
  });

  it('suspendAccount → PATCH suspended=true → SUCCEEDED + SHA hashes', async () => {
    server.use(
      http.patch(
        ({ request }) => isUserPath(request.url),
        async ({ request }) => {
          expect(await request.json()).toEqual({ suspended: true });
          return HttpResponse.json({ suspended: true });
        },
      ),
    );
    const result = await adapter().suspendAccount(USER);
    expect(result.status).toBe('SUCCEEDED');
    expect(result.requestSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.responseSha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it('suspendAccount 404 → LIKELY_GONE (PERMANENT_NOT_FOUND)', async () => {
    server.use(
      http.patch(
        ({ request }) => isUserPath(request.url),
        () => new HttpResponse('not found', { status: 404 }),
      ),
    );
    const result = await adapter().suspendAccount(USER);
    expect(result.status).toBe('LIKELY_GONE');
    expect(result.errorClass).toBe('PERMANENT_NOT_FOUND');
  });

  it('suspendAccount 401 → FAILED PERMANENT_AUTH_EXPIRED', async () => {
    server.use(
      http.patch(
        ({ request }) => isUserPath(request.url),
        () => new HttpResponse('unauthorized', { status: 401 }),
      ),
    );
    const result = await adapter().suspendAccount(USER);
    expect(result.status).toBe('FAILED');
    expect(result.errorClass).toBe('PERMANENT_AUTH_EXPIRED');
  });

  it('suspendAccount 403 forbidden → FAILED PERMANENT_FORBIDDEN', async () => {
    server.use(
      http.patch(
        ({ request }) => isUserPath(request.url),
        () => HttpResponse.json({ error: { errors: [{ reason: 'forbidden' }] } }, { status: 403 }),
      ),
    );
    const result = await adapter().suspendAccount(USER);
    expect(result.status).toBe('FAILED');
    expect(result.errorClass).toBe('PERMANENT_FORBIDDEN');
  });

  it('suspendAccount 429 → THROWS (QStash retries the step)', async () => {
    server.use(
      http.patch(
        ({ request }) => isUserPath(request.url),
        () => new HttpResponse('rate limited', { status: 429 }),
      ),
    );
    await expect(adapter().suspendAccount(USER)).rejects.toThrow(/transient/i);
  });

  it('suspendAccount hash does not embed the access token (token-independent)', async () => {
    server.use(
      http.patch(
        ({ request }) => isUserPath(request.url),
        () => HttpResponse.json({}),
      ),
    );
    const a = await new GoogleWorkspaceAdapter().withAccessToken('secret-A').suspendAccount(USER);
    const b = await new GoogleWorkspaceAdapter().withAccessToken('secret-B').suspendAccount(USER);
    expect(a.requestSha256).toBe(b.requestSha256);
  });

  it('revokeAllSessions → list tokens, delete each, signOut → SUCCEEDED + 2 sub-actions', async () => {
    server.use(
      http.get(
        ({ request }) => isTokensListPath(request.url),
        () => HttpResponse.json({ items: [{ clientId: 'app-1' }, { clientId: 'app-2' }] }),
      ),
      http.delete(
        ({ request }) => isTokenDeletePath(request.url),
        () => new HttpResponse(null, { status: 204 }),
      ),
      http.post(
        ({ request }) => isSignOutPath(request.url),
        () => new HttpResponse(null, { status: 204 }),
      ),
    );
    const result = await adapter().revokeAllSessions(USER);
    expect(result.status).toBe('SUCCEEDED');
    expect(result.subActions?.map(s => s.kind)).toEqual([
      'revoke_oauth_grants',
      'sign_out_sessions',
    ]);
    for (const sub of result.subActions ?? []) {
      expect(sub.requestSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(sub.responseSha256).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it('revokeAllSessions: token-delete 404 is idempotent success', async () => {
    server.use(
      http.get(
        ({ request }) => isTokensListPath(request.url),
        () => HttpResponse.json({ items: [{ clientId: 'gone' }] }),
      ),
      http.delete(
        ({ request }) => isTokenDeletePath(request.url),
        () => new HttpResponse(null, { status: 404 }),
      ),
      http.post(
        ({ request }) => isSignOutPath(request.url),
        () => new HttpResponse(null, { status: 204 }),
      ),
    );
    const result = await adapter().revokeAllSessions(USER);
    expect(result.status).toBe('SUCCEEDED');
  });

  it('revokeAllSessions: signOut failure ⇒ FAILED even if all token deletes succeeded', async () => {
    server.use(
      http.get(
        ({ request }) => isTokensListPath(request.url),
        () => HttpResponse.json({ items: [{ clientId: 'app-1' }] }),
      ),
      http.delete(
        ({ request }) => isTokenDeletePath(request.url),
        () => new HttpResponse(null, { status: 204 }),
      ),
      http.post(
        ({ request }) => isSignOutPath(request.url),
        () => HttpResponse.json({ error: { errors: [{ reason: 'forbidden' }] } }, { status: 403 }),
      ),
    );
    const result = await adapter().revokeAllSessions(USER);
    expect(result.status).toBe('FAILED');
    expect(result.errorClass).toBe('PERMANENT_FORBIDDEN');
    expect(result.subActions).toHaveLength(2);
  });

  it('verifyDeprovisioned true within 5 min after suspend (mocked clock)', async () => {
    server.use(
      http.patch(
        ({ request }) => isUserPath(request.url),
        () => HttpResponse.json({ suspended: true }),
      ),
      http.get(
        ({ request }) => isUserPath(request.url),
        () => HttpResponse.json({ suspended: true }),
      ),
    );
    vi.useFakeTimers();
    try {
      const a = adapter();
      expect((await a.suspendAccount(USER)).status).toBe('SUCCEEDED');
      vi.advanceTimersByTime(5 * 60 * 1000);
      expect(await a.verifyDeprovisioned(USER)).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('verifyDeprovisioned true on 404', async () => {
    server.use(
      http.get(
        ({ request }) => isUserPath(request.url),
        () => new HttpResponse('gone', { status: 404 }),
      ),
    );
    expect(await adapter().verifyDeprovisioned(USER)).toBe(true);
  });
});
