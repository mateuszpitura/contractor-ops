/** @vitest-environment node */

/**
 * Smoke tests for the `GET /api/oauth/:provider/start` Fastify port.
 *
 * Coverage:
 *   1. No session → redirect to login.
 *   2. No active org → redirect to settings?error.
 *   3. Unknown provider → redirect to settings?error.
 *   4. Missing client credentials → redirect to settings?error.
 *   5. Challenge persist throws → redirect to settings?error.
 *   6. Happy path → 302 to IdP URL + __Host-oauth_state cookie set.
 */

import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGetSession,
  mockGetAdapter,
  mockCreateChallenge,
  mockGetServerEnv,
  mockGetServerEnvRecord,
  mockGenerateState,
} = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockGetAdapter: vi.fn(),
  mockCreateChallenge: vi.fn(async () => undefined),
  // Real-world callers of getServerEnv() inside the validator-module chain
  // (e.g. stripe-client) read STRIPE_SECRET_KEY at module load. Include a
  // sentinel value so those side-effects don't blow up during test boot.
  mockGetServerEnv: vi.fn<() => Record<string, string>>(() => ({
    PUBLIC_APP_URL: 'https://app.test',
    STRIPE_SECRET_KEY: 'sk_test_placeholder',
  })),
  mockGetServerEnvRecord: vi.fn<() => Record<string, string>>(() => ({
    STRIPE_SECRET_KEY: 'sk_test_placeholder',
  })),
  mockGenerateState: vi.fn(() => 'state-token-1'),
}));

vi.mock('@contractor-ops/auth', () => ({
  auth: { api: { getSession: mockGetSession } },
}));

vi.mock('@contractor-ops/api/services/oauth-challenge', () => ({
  createOAuthChallenge: (...a: unknown[]) =>
    (mockCreateChallenge as (...a: unknown[]) => unknown)(...a),
  consumeOAuthChallenge: vi.fn(),
  OAUTH_STATE_COOKIE_NAME: '__Host-oauth_state',
  OAUTH_STATE_COOKIE_MAX_AGE_SECONDS: 600,
}));

vi.mock('@contractor-ops/api/services/org-definition-sync', () => ({
  syncJiraProjectsToOrgDefinitions: vi.fn(),
  runScheduledOrgDefinitionSync: vi.fn(),
}));

// Full module stub — avoid `importOriginal` so the test isolates the
// OAuth route from the rest of the integrations surface (which would
// otherwise transitively load `@contractor-ops/api` → stripe-client and
// fail without STRIPE_SECRET_KEY).
vi.mock('@contractor-ops/integrations', () => ({
  registerAllAdapters: vi.fn(),
  getAdapter: (...a: unknown[]) => mockGetAdapter(...a),
  generateOAuthState: (...a: unknown[]) =>
    (mockGenerateState as (...a: unknown[]) => unknown)(...a),
  verifyOAuthState: vi.fn(),
  encryptCredentials: vi.fn(),
}));

vi.mock('@contractor-ops/db', () => ({
  prisma: {
    integrationConnection: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    organization: { findUniqueOrThrow: vi.fn() },
  },
  createTenantClientFrom: vi.fn(),
  getRegionalClient: vi.fn(),
  tenantStore: { run: vi.fn() },
  prismaRaw: {},
  SUPPORTED_REGIONS: ['EU', 'ME', 'US'],
}));

vi.mock('@contractor-ops/validators', async importOriginal => {
  const actual = await importOriginal<typeof import('@contractor-ops/validators')>();
  return {
    ...actual,
    getServerEnv: (...a: unknown[]) => (mockGetServerEnv as (...a: unknown[]) => unknown)(...a),
    getServerEnvRecord: (...a: unknown[]) =>
      (mockGetServerEnvRecord as (...a: unknown[]) => unknown)(...a),
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
  mockGetSession.mockResolvedValue(null);
  mockGetAdapter.mockReturnValue(null);
  mockCreateChallenge.mockResolvedValue(undefined);
  mockGetServerEnv.mockReturnValue({ PUBLIC_APP_URL: 'https://app.test' });
  mockGetServerEnvRecord.mockReturnValue({});
  mockGenerateState.mockReturnValue('state-token-1');
  process.env.PUBLIC_APP_URL = 'https://app.test';
});

function get(provider: string) {
  return app.inject({ method: 'GET', url: `/api/oauth/${provider}/start` });
}

describe('GET /api/oauth/:provider/start', () => {
  it('redirects to /login when there is no session', async () => {
    mockGetSession.mockResolvedValueOnce(null);
    const res = await get('jira');
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain('/login');
  });

  it('redirects to settings?error when session has no active org', async () => {
    mockGetSession.mockResolvedValueOnce({
      user: { id: 'u1' },
      session: { activeOrganizationId: null },
    });
    const res = await get('jira');
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain('jira=error');
  });

  it('redirects to settings?error when adapter is unknown', async () => {
    mockGetSession.mockResolvedValueOnce({
      user: { id: 'u1' },
      session: { activeOrganizationId: 'org-1' },
    });
    mockGetAdapter.mockReturnValueOnce(null);
    const res = await get('unknown');
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain('unknown=error');
  });

  it('redirects to settings?error when client credentials are missing', async () => {
    mockGetSession.mockResolvedValueOnce({
      user: { id: 'u1' },
      session: { activeOrganizationId: 'org-1' },
    });
    mockGetAdapter.mockReturnValueOnce({
      slug: 'jira',
      supportsOAuth: true,
      getOAuthConfig: () => ({
        clientIdEnvVar: 'JIRA_CLIENT_ID',
        clientSecretEnvVar: 'JIRA_CLIENT_SECRET',
        scopes: ['read:jira'],
        redirectPath: '/api/oauth/jira/callback',
        authorizationUrl: 'https://auth.atlassian.com/authorize',
      }),
    });
    mockGetServerEnvRecord.mockReturnValueOnce({}); // no creds
    const res = await get('jira');
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain('jira=error');
  });

  it('redirects to settings?error when challenge persist throws', async () => {
    mockGetSession.mockResolvedValueOnce({
      user: { id: 'u1' },
      session: { activeOrganizationId: 'org-1' },
    });
    mockGetAdapter.mockReturnValueOnce({
      slug: 'jira',
      supportsOAuth: true,
      getOAuthConfig: () => ({
        clientIdEnvVar: 'JIRA_CLIENT_ID',
        clientSecretEnvVar: 'JIRA_CLIENT_SECRET',
        scopes: ['read:jira'],
        redirectPath: '/api/oauth/jira/callback',
        authorizationUrl: 'https://auth.atlassian.com/authorize',
      }),
    });
    mockGetServerEnvRecord.mockReturnValueOnce({
      JIRA_CLIENT_ID: 'cid',
      JIRA_CLIENT_SECRET: 'csecret',
    });
    mockCreateChallenge.mockRejectedValueOnce(new Error('neon down'));
    const res = await get('jira');
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain('jira=error');
  });

  it('redirects to IdP + sets __Host-oauth_state cookie on happy path', async () => {
    mockGetSession.mockResolvedValueOnce({
      user: { id: 'u1' },
      session: { activeOrganizationId: 'org-1' },
    });
    mockGetAdapter.mockReturnValueOnce({
      slug: 'jira',
      supportsOAuth: true,
      getOAuthConfig: () => ({
        clientIdEnvVar: 'JIRA_CLIENT_ID',
        clientSecretEnvVar: 'JIRA_CLIENT_SECRET',
        scopes: ['read:jira', 'read:me'],
        redirectPath: '/api/oauth/jira/callback',
        authorizationUrl: 'https://auth.atlassian.com/authorize',
        extraAuthParams: { audience: 'api.atlassian.com', prompt: 'consent' },
      }),
    });
    mockGetServerEnvRecord.mockReturnValueOnce({
      JIRA_CLIENT_ID: 'cid',
      JIRA_CLIENT_SECRET: 'csecret',
    });

    const res = await get('jira');
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain('https://auth.atlassian.com/authorize');
    expect(res.headers.location).toContain('client_id=cid');
    expect(res.headers.location).toContain('state=state-token-1');
    expect(res.headers.location).toContain('audience=api.atlassian.com');
    expect(res.headers.location).toContain(
      'redirect_uri=https%3A%2F%2Fapi.example.test%2Fapi%2Foauth%2Fjira%2Fcallback',
    );

    const setCookie = res.headers['set-cookie'];
    expect(setCookie).toBeTruthy();
    const cookieStr = Array.isArray(setCookie) ? setCookie.join('\n') : String(setCookie);
    expect(cookieStr).toContain('__Host-oauth_state=state-token-1');
    expect(cookieStr).toContain('Path=/api/oauth');
    expect(cookieStr).toContain('HttpOnly');
  });
});
