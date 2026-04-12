import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LinearAdapter } from '../linear-adapter.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockFetch(response: { ok: boolean; status?: number; body: unknown }) {
  return vi.fn().mockResolvedValue({
    ok: response.ok,
    status: response.status ?? (response.ok ? 200 : 400),
    json: () => Promise.resolve(response.body),
    text: () =>
      Promise.resolve(
        typeof response.body === 'string' ? response.body : JSON.stringify(response.body),
      ),
  });
}

describe('LinearAdapter', () => {
  let adapter: LinearAdapter;

  beforeEach(() => {
    adapter = new LinearAdapter();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete process.env.LINEAR_CLIENT_ID;
    delete process.env.LINEAR_CLIENT_SECRET;
    delete process.env.LINEAR_WEBHOOK_SECRET;
  });

  describe('OAuth config', () => {
    it('returns correct authorization URL', () => {
      const config = adapter.getOAuthConfig();
      expect(config.authorizationUrl).toBe('https://linear.app/oauth/authorize');
    });

    it('returns correct token URL', () => {
      const config = adapter.getOAuthConfig();
      expect(config.tokenUrl).toBe('https://api.linear.app/oauth/token');
    });

    it('requests read and write scopes', () => {
      const config = adapter.getOAuthConfig();
      expect(config.scopes).toContain('read');
      expect(config.scopes).toContain('write');
    });

    it('uses url-encoded content type for token exchange', async () => {
      process.env.LINEAR_CLIENT_ID = 'client-id';
      process.env.LINEAR_CLIENT_SECRET = 'client-secret';

      const fetchMock = mockFetch({
        ok: true,
        body: {
          access_token: 'at',
          refresh_token: 'rt',
          expires_in: 3600,
          token_type: 'Bearer',
          scope: ['read', 'write'],
        },
      });
      vi.stubGlobal('fetch', fetchMock);

      await adapter.exchangeCodeForTokens('code-123', 'http://localhost/callback');

      const [, options] = fetchMock.mock.calls[0]!;
      expect(options.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    });
  });

  describe('exchangeCodeForTokens', () => {
    it('exchanges authorization code for access + refresh tokens', async () => {
      process.env.LINEAR_CLIENT_ID = 'client-id';
      process.env.LINEAR_CLIENT_SECRET = 'client-secret';

      const fetchMock = mockFetch({
        ok: true,
        body: {
          access_token: 'access-token-123',
          refresh_token: 'refresh-token-456',
          expires_in: 3600,
          token_type: 'Bearer',
          scope: ['read', 'write'],
        },
      });
      vi.stubGlobal('fetch', fetchMock);

      const result = await adapter.exchangeCodeForTokens('auth-code', 'http://localhost/callback');

      expect(result.accessToken).toBe('access-token-123');
      expect(result.refreshToken).toBe('refresh-token-456');
      expect(result.tokenType).toBe('Bearer');

      // Verify the request body
      const [url, options] = fetchMock.mock.calls[0]!;
      expect(url).toBe('https://api.linear.app/oauth/token');
      const body = new URLSearchParams(options.body as string);
      expect(body.get('grant_type')).toBe('authorization_code');
      expect(body.get('code')).toBe('auth-code');
      expect(body.get('redirect_uri')).toBe('http://localhost/callback');
    });

    it('sets correct expiresAt from expires_in', async () => {
      process.env.LINEAR_CLIENT_ID = 'client-id';
      process.env.LINEAR_CLIENT_SECRET = 'client-secret';

      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now);

      const fetchMock = mockFetch({
        ok: true,
        body: {
          access_token: 'at',
          refresh_token: 'rt',
          expires_in: 7200,
          token_type: 'Bearer',
          scope: 'read',
        },
      });
      vi.stubGlobal('fetch', fetchMock);

      const result = await adapter.exchangeCodeForTokens('code', 'http://localhost/cb');

      const expectedExpiry = new Date(now + 7200 * 1000).toISOString();
      expect(result.expiresAt).toBe(expectedExpiry);
    });

    it('joins scope array into comma-separated string', async () => {
      process.env.LINEAR_CLIENT_ID = 'client-id';
      process.env.LINEAR_CLIENT_SECRET = 'client-secret';

      const fetchMock = mockFetch({
        ok: true,
        body: {
          access_token: 'at',
          refresh_token: 'rt',
          expires_in: 3600,
          token_type: 'Bearer',
          scope: ['read', 'write', 'admin'],
        },
      });
      vi.stubGlobal('fetch', fetchMock);

      const result = await adapter.exchangeCodeForTokens('code', 'http://localhost/cb');

      expect(result.scope).toBe('read,write,admin');
    });
  });

  describe('refreshToken', () => {
    it('refreshes access token using refresh token', async () => {
      process.env.LINEAR_CLIENT_ID = 'client-id';
      process.env.LINEAR_CLIENT_SECRET = 'client-secret';

      const fetchMock = mockFetch({
        ok: true,
        body: {
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          expires_in: 3600,
          token_type: 'Bearer',
          scope: 'read,write',
        },
      });
      vi.stubGlobal('fetch', fetchMock);

      const result = await adapter.refreshToken({
        accessToken: 'old-at',
        refreshToken: 'old-rt',
        tokenType: 'Bearer',
        scope: 'read,write',
        expiresAt: '2024-01-01T00:00:00Z',
      });

      expect(result.accessToken).toBe('new-access-token');

      const [, options] = fetchMock.mock.calls[0]!;
      const body = new URLSearchParams(options.body as string);
      expect(body.get('grant_type')).toBe('refresh_token');
      expect(body.get('refresh_token')).toBe('old-rt');
    });

    it('preserves old refresh token if new one not returned', async () => {
      process.env.LINEAR_CLIENT_ID = 'client-id';
      process.env.LINEAR_CLIENT_SECRET = 'client-secret';

      const fetchMock = mockFetch({
        ok: true,
        body: {
          access_token: 'new-at',
          // no refresh_token in response
          expires_in: 3600,
          token_type: 'Bearer',
          scope: 'read',
        },
      });
      vi.stubGlobal('fetch', fetchMock);

      const result = await adapter.refreshToken({
        accessToken: 'old-at',
        refreshToken: 'original-rt',
        tokenType: 'Bearer',
        scope: 'read',
        expiresAt: '2024-01-01T00:00:00Z',
      });

      expect(result.refreshToken).toBe('original-rt');
    });

    it('throws when client credentials are missing', async () => {
      delete process.env.LINEAR_CLIENT_ID;
      delete process.env.LINEAR_CLIENT_SECRET;

      await expect(
        adapter.refreshToken({
          accessToken: 'a',
          refreshToken: 'rt',
          tokenType: 'Bearer',
          scope: 'read',
          expiresAt: '2024-01-01T00:00:00Z',
        }),
      ).rejects.toThrow(/LINEAR_CLIENT_ID and LINEAR_CLIENT_SECRET/);
    });

    it('throws when no refresh token on credential blob', async () => {
      process.env.LINEAR_CLIENT_ID = 'client-id';
      process.env.LINEAR_CLIENT_SECRET = 'client-secret';

      await expect(
        adapter.refreshToken({
          accessToken: 'a',
          refreshToken: '',
          tokenType: 'Bearer',
          scope: 'read',
          expiresAt: '2024-01-01T00:00:00Z',
        }),
      ).rejects.toThrow(/No refresh token available for Linear/);
    });

    it('throws with response body when token endpoint returns error', async () => {
      process.env.LINEAR_CLIENT_ID = 'client-id';
      process.env.LINEAR_CLIENT_SECRET = 'client-secret';

      const fetchMock = mockFetch({
        ok: false,
        status: 401,
        body: 'invalid_grant',
      });
      vi.stubGlobal('fetch', fetchMock);

      await expect(
        adapter.refreshToken({
          accessToken: 'old-at',
          refreshToken: 'old-rt',
          tokenType: 'Bearer',
          scope: 'read',
          expiresAt: '2024-01-01T00:00:00Z',
        }),
      ).rejects.toThrow(/Linear token refresh failed: invalid_grant/);
    });
  });

  describe('verifyWebhookSignature', () => {
    const webhookSecret = 'test-webhook-secret-key';

    it('validates correct HMAC-SHA256 signature', () => {
      const body = JSON.stringify({ type: 'Issue', action: 'create', data: {} });
      const signature = createHmac('sha256', webhookSecret).update(body).digest('hex');

      const result = adapter.verifyWebhookSignature(body, {
        'linear-signature': signature,
        'x-webhook-secret': webhookSecret,
      });

      expect(result.valid).toBe(true);
    });

    it('rejects invalid signature', () => {
      const body = JSON.stringify({ type: 'Issue', action: 'update' });
      const wrongSignature = createHmac('sha256', 'wrong-secret').update(body).digest('hex');

      const result = adapter.verifyWebhookSignature(body, {
        'linear-signature': wrongSignature,
        'x-webhook-secret': webhookSecret,
      });

      expect(result.valid).toBe(false);
    });

    it('extracts eventType as type.action from payload', () => {
      const body = JSON.stringify({ type: 'Issue', action: 'create', data: {} });
      const signature = createHmac('sha256', webhookSecret).update(body).digest('hex');

      const result = adapter.verifyWebhookSignature(body, {
        'linear-signature': signature,
        'x-webhook-secret': webhookSecret,
      });

      expect(result.eventType).toBe('Issue.create');
    });

    it('returns invalid when signature header is missing', () => {
      const body = JSON.stringify({ type: 'Issue', action: 'create' });

      const result = adapter.verifyWebhookSignature(body, {
        'x-webhook-secret': webhookSecret,
        // no linear-signature header
      });

      expect(result.valid).toBe(false);
    });

    it('returns invalid when no signing secret is configured', () => {
      delete process.env.LINEAR_WEBHOOK_SECRET;
      const body = JSON.stringify({ type: 'Issue', action: 'create' });
      const result = adapter.verifyWebhookSignature(body, {});
      expect(result.valid).toBe(false);
    });

    it('accepts valid signature but omits eventType when type or action is missing', () => {
      const body = JSON.stringify({ type: 'Issue', data: {} });
      const signature = createHmac('sha256', webhookSecret).update(body).digest('hex');
      const result = adapter.verifyWebhookSignature(body, {
        'linear-signature': signature,
        'x-webhook-secret': webhookSecret,
      });
      expect(result.valid).toBe(true);
      expect(result.eventType).toBeUndefined();
    });
  });

  describe('discoverWorkspace', () => {
    it('fetches teams and organization info from GraphQL', async () => {
      const fetchMock = mockFetch({
        ok: true,
        body: {
          data: {
            teams: {
              nodes: [
                {
                  id: 'team-1',
                  name: 'Engineering',
                  key: 'ENG',
                  states: {
                    nodes: [
                      { id: 's1', name: 'Todo', type: 'unstarted', color: '#aaa', position: 0 },
                      {
                        id: 's2',
                        name: 'In Progress',
                        type: 'started',
                        color: '#0f0',
                        position: 1,
                      },
                    ],
                  },
                },
              ],
            },
            organization: {
              id: 'org-1',
              name: 'Acme Corp',
              urlKey: 'acme',
            },
          },
        },
      });
      vi.stubGlobal('fetch', fetchMock);

      const result = await adapter.discoverWorkspace('access-token-123');

      // Verify GraphQL request structure
      const [url, options] = fetchMock.mock.calls[0]!;
      expect(url).toBe('https://api.linear.app/graphql');
      expect(options.method).toBe('POST');
      expect(options.headers.Authorization).toBe('Bearer access-token-123');
      expect(options.headers['Content-Type']).toBe('application/json');

      const requestBody = JSON.parse(options.body as string);
      expect(requestBody.query).toContain('teams');
      expect(requestBody.query).toContain('organization');
      expect(requestBody.query).toContain('states');

      // Verify response mapping
      expect(result.organizationId).toBe('org-1');
      expect(result.organizationName).toBe('Acme Corp');
      expect(result.urlKey).toBe('acme');
      expect(result.teams).toHaveLength(1);
      expect(result.teams[0]?.key).toBe('ENG');
      expect(result.teams[0]?.states).toHaveLength(2);
      expect(result.teams[0]?.states[0]?.type).toBe('unstarted');
    });

    it('throws when GraphQL endpoint returns non-OK', async () => {
      const fetchMock = mockFetch({
        ok: false,
        status: 401,
        body: 'Unauthorized',
      });
      vi.stubGlobal('fetch', fetchMock);

      await expect(adapter.discoverWorkspace('bad-token')).rejects.toThrow(
        /Linear workspace discovery failed: Unauthorized/,
      );
    });

    it('throws when GraphQL returns 200 but response omits data (errors-only envelope)', async () => {
      const fetchMock = mockFetch({
        ok: true,
        body: {
          errors: [{ message: 'Authentication required', extensions: { code: 'UNAUTHENTICATED' } }],
        },
      });
      vi.stubGlobal('fetch', fetchMock);

      await expect(adapter.discoverWorkspace('expired-token')).rejects.toThrow();
    });
  });
});
