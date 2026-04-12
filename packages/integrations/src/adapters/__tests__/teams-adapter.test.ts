import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TeamsAdapter } from '../teams-adapter.js';

vi.mock('../../services/credential-service.js', () => ({
  getCredentials: vi.fn(async () => ({
    accessToken: 'enc',
    refreshToken: 'stored-refresh',
  })),
}));

function mockFetch(response: { ok: boolean; body: unknown }) {
  return vi.fn().mockResolvedValue({
    ok: response.ok,
    status: response.ok ? 200 : 400,
    json: () => Promise.resolve(response.body),
    text: () =>
      Promise.resolve(
        typeof response.body === 'string' ? response.body : JSON.stringify(response.body),
      ),
  });
}

describe('TeamsAdapter', () => {
  let adapter: TeamsAdapter;

  beforeEach(() => {
    adapter = new TeamsAdapter();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete process.env.AZURE_BOT_APP_ID;
    delete process.env.AZURE_BOT_APP_SECRET;
  });

  it('getOAuthConfig uses Azure AD endpoints', () => {
    const c = adapter.getOAuthConfig();
    expect(c.authorizationUrl).toContain('login.microsoftonline.com');
    expect(c.tokenUrl).toContain('oauth2/v2.0/token');
    expect(c.scopes.join(' ')).toContain('graph.microsoft.com');
  });

  it('exchangeCodeForTokens throws without Azure env', async () => {
    await expect(adapter.exchangeCodeForTokens('c', 'http://localhost/cb')).rejects.toThrow(
      /AZURE_BOT_APP_ID/,
    );
  });

  it('exchangeCodeForTokens returns tokens on success', async () => {
    process.env.AZURE_BOT_APP_ID = 'app';
    process.env.AZURE_BOT_APP_SECRET = 'secret';
    const fetchMock = mockFetch({
      ok: true,
      body: {
        access_token: 'at',
        refresh_token: 'rt',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'offline_access',
      },
    });
    vi.stubGlobal('fetch', fetchMock);

    const out = await adapter.exchangeCodeForTokens('code', 'http://localhost/cb');
    expect(out.accessToken).toBe('at');
    expect(out.refreshToken).toBe('rt');
    const [url] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain('token');
  });

  it('refreshToken exchanges refresh via form body', async () => {
    process.env.AZURE_BOT_APP_ID = 'app';
    process.env.AZURE_BOT_APP_SECRET = 'secret';
    const fetchMock = mockFetch({
      ok: true,
      body: {
        access_token: 'new-at',
        refresh_token: 'new-rt',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 's',
      },
    });
    vi.stubGlobal('fetch', fetchMock);

    const out = await adapter.refreshToken({
      accessToken: 'encrypted-blob',
      tokenType: 'Bearer',
      scope: '',
      expiresAt: new Date().toISOString(),
    });

    expect(out.accessToken).toBe('new-at');
    const [, opts] = fetchMock.mock.calls[0]!;
    expect((opts as { body: string }).body).toContain('grant_type=refresh_token');
    expect((opts as { body: string }).body).toContain('stored-refresh');
  });
});
