import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JIRA_EXTRA_AUTH_PARAMS, JiraAdapter } from '../jira-adapter.js';

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

describe('JiraAdapter', () => {
  let adapter: JiraAdapter;

  beforeEach(() => {
    adapter = new JiraAdapter();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete process.env.JIRA_CLIENT_ID;
    delete process.env.JIRA_CLIENT_SECRET;
  });

  it('exposes Atlassian audience in extra auth params', () => {
    expect(JIRA_EXTRA_AUTH_PARAMS.audience).toBe('api.atlassian.com');
    expect(JIRA_EXTRA_AUTH_PARAMS.prompt).toBe('consent');
  });

  it('getOAuthConfig points to Atlassian OAuth', () => {
    const c = adapter.getOAuthConfig();
    expect(c.authorizationUrl).toContain('atlassian.com');
    expect(c.tokenUrl).toContain('atlassian.com');
    expect(c.scopes).toContain('read:jira-work');
  });

  it('exchangeCodeForTokens throws when env vars missing', async () => {
    await expect(adapter.exchangeCodeForTokens('c', 'http://localhost/cb')).rejects.toThrow(
      /JIRA_CLIENT_ID/,
    );
  });

  it('exchangeCodeForTokens maps tokens on success', async () => {
    process.env.JIRA_CLIENT_ID = 'id';
    process.env.JIRA_CLIENT_SECRET = 'sec';
    const fetchMock = mockFetch({
      ok: true,
      body: {
        access_token: 'at',
        refresh_token: 'rt',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'read:jira-work',
      },
    });
    vi.stubGlobal('fetch', fetchMock);

    const out = await adapter.exchangeCodeForTokens('code', 'http://localhost/cb');

    expect(out.accessToken).toBe('at');
    expect(out.refreshToken).toBe('rt');
    const [, opts] = fetchMock.mock.calls[0];
    expect((opts as { method: string }).method).toBe('POST');
  });

  it('refreshToken throws without refresh token in blob', async () => {
    process.env.JIRA_CLIENT_ID = 'id';
    process.env.JIRA_CLIENT_SECRET = 'sec';
    await expect(
      adapter.refreshToken({
        accessToken: 'a',
        tokenType: 'Bearer',
        scope: '',
        expiresAt: new Date().toISOString(),
      }),
    ).rejects.toThrow(/No refresh token/);
  });

  it('verifyWebhookSignature rejects when no configuredSecret is supplied (F-SEC-02)', () => {
    // F-SEC-02: previously the adapter returned valid:true when the secret was
    // missing, allowing unauthenticated payloads through. New behaviour fails closed.
    const body = JSON.stringify({ webhookEvent: 'jira:issue_updated' });
    const r = adapter.verifyWebhookSignature(body, {});
    expect(r.valid).toBe(false);
    expect(r.reason).toBe('config');
  });

  it('verifyWebhookSignature NEVER trusts inbound x-webhook-secret header (F-SEC-02)', () => {
    // F-SEC-02: An attacker must not be able to supply their own secret via
    // the request header and a matching HMAC.
    const attackerSecret = 'attacker-supplied';
    const body = JSON.stringify({ webhookEvent: 'issue_created' });
    const sig = createHmac('sha256', attackerSecret).update(body).digest('hex');

    const r = adapter.verifyWebhookSignature(
      body,
      {
        'x-webhook-secret': attackerSecret, // attacker-supplied — must be ignored
        'x-hub-signature': `sha256=${sig}`,
      },
      null, // server-side secret unresolved
    );

    expect(r.valid).toBe(false);
    expect(r.reason).toBe('config');
  });

  it('verifyWebhookSignature rejects when secret is set but hub signature header is missing', () => {
    const r = adapter.verifyWebhookSignature('{}', {}, 'whsec');
    expect(r.valid).toBe(false);
    expect(r.reason).toBe('headers');
  });

  it('verifyWebhookSignature rejects when signature method is not sha256', () => {
    const r = adapter.verifyWebhookSignature('{}', { 'x-hub-signature': 'md5=abc' }, 'whsec');
    expect(r.valid).toBe(false);
    expect(r.reason).toBe('signature');
  });

  it('verifyWebhookSignature rejects bad HMAC', () => {
    const secret = 'whsec';
    const body = '{}';
    const _sig = createHmac('sha256', secret).update(body).digest('hex');
    const r = adapter.verifyWebhookSignature(
      body,
      { 'x-hub-signature': 'sha256=deadbeef' },
      secret,
    );
    expect(r.valid).toBe(false);
    expect(r.reason).toBe('signature');
  });

  it('verifyWebhookSignature accepts valid HMAC', () => {
    const secret = 'whsec';
    const body = JSON.stringify({ webhookEvent: 'issue_created' });
    const sig = createHmac('sha256', secret).update(body).digest('hex');
    const r = adapter.verifyWebhookSignature(body, { 'x-hub-signature': `sha256=${sig}` }, secret);
    expect(r.valid).toBe(true);
    expect(r.eventType).toBe('issue_created');
  });

  it('verifyWebhookSignature accepts valid HMAC but omits eventType when body is not JSON', () => {
    const secret = 'whsec';
    const body = 'plain-text-payload';
    const sig = createHmac('sha256', secret).update(body).digest('hex');
    const r = adapter.verifyWebhookSignature(body, { 'x-hub-signature': `sha256=${sig}` }, secret);
    expect(r.valid).toBe(true);
    expect(r.eventType).toBeUndefined();
  });
});
