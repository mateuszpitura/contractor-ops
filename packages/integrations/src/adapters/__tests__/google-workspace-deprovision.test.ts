import { createMockServer, HttpResponse, http } from '@contractor-ops/test-utils';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { GoogleWorkspaceAdapter } from '../google-workspace-adapter.js';

const { server } = createMockServer({ handlersOnly: true });

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// URL predicates instead of string/regex paths — MSW v2 + path-to-regexp v8 crashes on
// regex/glob path literals (see packages/test-utils CLAUDE.md qstash note). The Admin SDK
// user endpoint is `/admin/directory/v1/users/<id>`; signOut is the same path + `/signOut`.
const ADMIN_HOST = 'admin.googleapis.com';
const isUserPath = (url: string) => {
  const u = new URL(url);
  return u.hostname === ADMIN_HOST && /^\/admin\/directory\/v1\/users\/[^/]+$/.test(u.pathname);
};
const isSignOutPath = (url: string) => {
  const u = new URL(url);
  return (
    u.hostname === ADMIN_HOST && /^\/admin\/directory\/v1\/users\/[^/]+\/signOut$/.test(u.pathname)
  );
};

const adapter = () => new GoogleWorkspaceAdapter().withAccessToken('fake-token');

describe('GoogleWorkspaceAdapter — Deprovisionable contract (Phase 76 D-13/D-16)', () => {
  it('class GoogleWorkspaceAdapter implements Deprovisionable', () => {
    const a = adapter();
    expect(typeof a.suspendAccount).toBe('function');
    expect(typeof a.revokeAllSessions).toBe('function');
    expect(typeof a.verifyDeprovisioned).toBe('function');
  });

  it('suspendAccount → PATCH user.update(suspended=true) → { status: SUCCEEDED } + SHA hashes', async () => {
    server.use(
      http.patch(
        ({ request }) => isUserPath(request.url),
        async ({ request }) => {
          expect(await request.json()).toEqual({ suspended: true });
          return HttpResponse.json({ primaryEmail: 'u@example.com', suspended: true });
        },
      ),
    );
    const result = await adapter().suspendAccount('u@example.com');
    expect(result.status).toBe('SUCCEEDED');
    expect(result.requestSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.responseSha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it('revokeAllSessions → POST signOut → { status: SUCCEEDED }', async () => {
    server.use(
      http.post(
        ({ request }) => isSignOutPath(request.url),
        () => new HttpResponse(null, { status: 204 }),
      ),
    );
    const result = await adapter().revokeAllSessions('u@example.com');
    expect(result.status).toBe('SUCCEEDED');
  });

  it('verifyDeprovisioned returns true within 5 min after suspend (mocked clock)', async () => {
    server.use(
      http.patch(
        ({ request }) => isUserPath(request.url),
        () => HttpResponse.json({ suspended: true }),
      ),
      http.get(
        ({ request }) => isUserPath(request.url),
        () => HttpResponse.json({ primaryEmail: 'u@example.com', suspended: true }),
      ),
    );
    vi.useFakeTimers();
    try {
      const a = adapter();
      const sus = await a.suspendAccount('u@example.com');
      expect(sus.status).toBe('SUCCEEDED');
      vi.advanceTimersByTime(5 * 60 * 1000);
      expect(await a.verifyDeprovisioned('u@example.com')).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('USER_NOT_FOUND (404) maps to status: SUCCEEDED with failureKind USER_NOT_FOUND', async () => {
    server.use(
      http.patch(
        ({ request }) => isUserPath(request.url),
        () => new HttpResponse('not found', { status: 404 }),
      ),
    );
    const result = await adapter().suspendAccount('u@example.com');
    expect(result.status).toBe('SUCCEEDED');
    expect(result.failureKind).toBe('USER_NOT_FOUND');
  });

  it('5xx maps to status: FAILED with failureKind: PROVIDER_ERROR', async () => {
    server.use(
      http.patch(
        ({ request }) => isUserPath(request.url),
        () => new HttpResponse('server error', { status: 503 }),
      ),
    );
    const result = await adapter().suspendAccount('u@example.com');
    expect(result.status).toBe('FAILED');
    expect(result.failureKind).toBe('PROVIDER_ERROR');
  });

  it('429 maps to status: FAILED with failureKind: RATE_LIMITED', async () => {
    server.use(
      http.patch(
        ({ request }) => isUserPath(request.url),
        () => new HttpResponse('rate limited', { status: 429 }),
      ),
    );
    const result = await adapter().suspendAccount('u@example.com');
    expect(result.status).toBe('FAILED');
    expect(result.failureKind).toBe('RATE_LIMITED');
  });
});
