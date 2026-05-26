/** @vitest-environment node */

/**
 * Smoke tests for the `GET /api/oauth/:provider/callback` Fastify port.
 *
 * Coverage:
 *   1. Missing `code` or `state` → redirect to settings?error.
 *   2. Unknown adapter → redirect to settings?error.
 *   3. Missing signing secret → redirect to settings?error.
 *   4. Bad HMAC state → redirect to settings?error.
 *   5. Challenge consume returns null → redirect to settings?error +
 *      cookie cleared.
 *   6. Identity mismatch (state vs challenge) → redirect to
 *      settings?error + cookie cleared.
 *   7. Happy path with no existing connection → connection created +
 *      redirect to settings?connected.
 *   8. Happy path with existing connection → connection updated +
 *      redirect to settings?connected.
 */

import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGetAdapter,
  mockVerifyState,
  mockConsumeChallenge,
  mockEncryptCredentials,
  mockConnectionFindFirst,
  mockConnectionCreate,
  mockConnectionUpdate,
} = vi.hoisted(() => ({
  mockGetAdapter: vi.fn(),
  mockVerifyState: vi.fn(),
  mockConsumeChallenge: vi.fn(),
  mockEncryptCredentials: vi.fn(() => 'encrypted'),
  mockConnectionFindFirst: vi.fn(),
  mockConnectionCreate: vi.fn(async () => ({ id: 'conn-1' })),
  mockConnectionUpdate: vi.fn(async () => ({})),
}));

vi.mock('@contractor-ops/auth', () => ({
  auth: { api: { getSession: vi.fn() } },
}));

vi.mock('@contractor-ops/api/services/oauth-challenge', () => ({
  createOAuthChallenge: vi.fn(),
  consumeOAuthChallenge: (...a: unknown[]) =>
    (mockConsumeChallenge as (...a: unknown[]) => unknown)(...a),
  OAUTH_STATE_COOKIE_NAME: '__Host-oauth_state',
  OAUTH_STATE_COOKIE_MAX_AGE_SECONDS: 600,
}));

vi.mock('@contractor-ops/api/services/org-definition-sync', () => ({
  syncJiraProjectsToOrgDefinitions: vi.fn(),
  runScheduledOrgDefinitionSync: vi.fn(),
}));

vi.mock('@contractor-ops/integrations', () => ({
  registerAllAdapters: vi.fn(),
  getAdapter: (...a: unknown[]) => mockGetAdapter(...a),
  generateOAuthState: vi.fn(),
  verifyOAuthState: (...a: unknown[]) => (mockVerifyState as (...a: unknown[]) => unknown)(...a),
  encryptCredentials: (...a: unknown[]) =>
    (mockEncryptCredentials as (...a: unknown[]) => unknown)(...a),
}));

vi.mock('@contractor-ops/db', () => ({
  prisma: {
    integrationConnection: {
      findFirst: (...a: unknown[]) =>
        (mockConnectionFindFirst as (...a: unknown[]) => unknown)(...a),
      create: (...a: unknown[]) => (mockConnectionCreate as (...a: unknown[]) => unknown)(...a),
      update: (...a: unknown[]) => (mockConnectionUpdate as (...a: unknown[]) => unknown)(...a),
    },
    organization: {
      findUniqueOrThrow: vi.fn(async () => ({ dataRegion: 'EU' })),
    },
  },
  createTenantClientFrom: vi.fn(),
  getRegionalClient: vi.fn(),
  tenantStore: { run: vi.fn() },
}));

vi.mock('@contractor-ops/validators', async importOriginal => {
  const actual = await importOriginal<typeof import('@contractor-ops/validators')>();
  return {
    ...actual,
    getServerEnv: vi.fn(() => ({
      NEXT_PUBLIC_APP_URL: 'https://app.test',
      STRIPE_SECRET_KEY: 'sk_test_placeholder',
    })),
    getServerEnvRecord: vi.fn(() => ({ STRIPE_SECRET_KEY: 'sk_test_placeholder' })),
  };
});

import { __resetEnvForTests } from '../env.js';
import { buildServer } from '../server.js';

let app: FastifyInstance;

beforeAll(async () => {
  __resetEnvForTests();
  app = await buildServer();
  await app.ready();
});

afterAll(async () => {
  await app.close();
  __resetEnvForTests();
});

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_APP_URL = 'https://app.test';
  process.env.JIRA_CLIENT_SECRET = 'csecret';
  mockGetAdapter.mockReturnValue({
    slug: 'jira',
    displayName: 'Jira',
    supportsOAuth: true,
    exchangeCodeForTokens: vi.fn(async () => ({
      accessToken: 'tok',
      refreshToken: 'rtok',
      expiresAt: Date.now() + 3600_000,
      extra: { teamName: 'Acme Eng' },
    })),
    getOAuthConfig: () => ({
      clientIdEnvVar: 'JIRA_CLIENT_ID',
      clientSecretEnvVar: 'JIRA_CLIENT_SECRET',
      scopes: ['read:jira'],
      redirectPath: '/api/oauth/jira/callback',
      authorizationUrl: 'https://auth.atlassian.com/authorize',
    }),
  });
  mockVerifyState.mockReturnValue({ userId: 'u1', orgId: 'org-1' });
  mockConsumeChallenge.mockResolvedValue({
    userId: 'u1',
    organizationId: 'org-1',
    redirectUri: 'https://api.example.test/api/oauth/jira/callback',
  });
  mockEncryptCredentials.mockReturnValue('encrypted');
  mockConnectionFindFirst.mockResolvedValue(null);
  mockConnectionCreate.mockResolvedValue({ id: 'conn-1' });
  mockConnectionUpdate.mockResolvedValue({});
});

function get(query: Record<string, string>, cookies: Record<string, string> = {}) {
  const qs = new URLSearchParams(query).toString();
  const cookieHeader = Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
  return app.inject({
    method: 'GET',
    url: `/api/oauth/jira/callback${qs ? `?${qs}` : ''}`,
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  });
}

describe('GET /api/oauth/:provider/callback', () => {
  it('redirects to error when code or state is missing', async () => {
    const res = await get({ code: 'code-1' }); // no state
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain('jira=error');
  });

  it('redirects to error when adapter is unknown', async () => {
    mockGetAdapter.mockReturnValueOnce(null);
    const res = await get({ code: 'c', state: 'st' });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain('jira=error');
  });

  it('redirects to error when signing secret env var is missing', async () => {
    delete process.env.JIRA_CLIENT_SECRET;
    const res = await get({ code: 'c', state: 'st' });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain('jira=error');
  });

  it('redirects to error when HMAC state verification fails', async () => {
    mockVerifyState.mockReturnValueOnce(null);
    const res = await get({ code: 'c', state: 'st' });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain('jira=error');
  });

  it('redirects to error + clears cookie when challenge consume fails', async () => {
    mockConsumeChallenge.mockResolvedValueOnce(null);
    const res = await get({ code: 'c', state: 'st' }, { '__Host-oauth_state': 'st' });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain('jira=error');
    const setCookie = res.headers['set-cookie'];
    const cookieStr = Array.isArray(setCookie) ? setCookie.join('\n') : String(setCookie);
    expect(cookieStr).toContain('__Host-oauth_state');
  });

  it('redirects to error + clears cookie on state/challenge identity mismatch', async () => {
    mockConsumeChallenge.mockResolvedValueOnce({
      userId: 'u2',
      organizationId: 'org-1',
      redirectUri: 'https://api.example.test/api/oauth/jira/callback',
    });
    const res = await get({ code: 'c', state: 'st' }, { '__Host-oauth_state': 'st' });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain('jira=error');
  });

  it('creates a new connection + redirects to connected on first-time link', async () => {
    mockConnectionFindFirst.mockResolvedValueOnce(null);
    const res = await get({ code: 'c', state: 'st' }, { '__Host-oauth_state': 'st' });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain('jira=connected');
    expect(mockConnectionCreate).toHaveBeenCalled();
    expect(mockConnectionUpdate).not.toHaveBeenCalled();
  });

  it('updates an existing connection + redirects to connected on relink', async () => {
    mockConnectionFindFirst.mockResolvedValueOnce({ id: 'existing-conn-1' });
    const res = await get({ code: 'c', state: 'st' }, { '__Host-oauth_state': 'st' });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain('jira=connected');
    expect(mockConnectionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'existing-conn-1' } }),
    );
    expect(mockConnectionCreate).not.toHaveBeenCalled();
  });
});
