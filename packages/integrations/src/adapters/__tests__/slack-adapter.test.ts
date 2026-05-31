import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SlackAdapter } from '../slack-adapter.js';

function mockFetch(ok: boolean, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 400,
    json: () => Promise.resolve(body),
    // parseJsonResponse (OAuth credential validation) reads the body via text().
    text: () => Promise.resolve(JSON.stringify(body)),
  });
}

describe('SlackAdapter', () => {
  let adapter: SlackAdapter;

  beforeEach(() => {
    adapter = new SlackAdapter();
    delete process.env.SLACK_CLIENT_ID;
    delete process.env.SLACK_CLIENT_SECRET;
    delete process.env.SLACK_SIGNING_SECRET;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete process.env.SLACK_CLIENT_ID;
    delete process.env.SLACK_CLIENT_SECRET;
    delete process.env.SLACK_SIGNING_SECRET;
  });

  describe('getOAuthConfig', () => {
    it('uses Slack OAuth v2 endpoints and scopes', () => {
      const c = adapter.getOAuthConfig();
      expect(c.authorizationUrl).toBe('https://slack.com/oauth/v2/authorize');
      expect(c.tokenUrl).toBe('https://slack.com/api/oauth.v2.access');
      expect(c.scopes).toContain('chat:write');
      expect(c.redirectPath).toBe('/api/oauth/slack/callback');
    });
  });

  describe('exchangeCodeForTokens', () => {
    it('throws when client env vars are missing', async () => {
      await expect(adapter.exchangeCodeForTokens('code', 'http://localhost/cb')).rejects.toThrow(
        'SLACK_CLIENT_ID',
      );
    });

    it('returns credential blob on success', async () => {
      process.env.SLACK_CLIENT_ID = 'cid';
      process.env.SLACK_CLIENT_SECRET = 'sec';

      const fetchMock = mockFetch(true, {
        ok: true,
        access_token: 'xoxb-123',
        team: { id: 'T1', name: 'Team' },
      });
      vi.stubGlobal('fetch', fetchMock);

      const blob = await adapter.exchangeCodeForTokens('auth-code', 'http://localhost/cb');

      expect(blob.accessToken).toBe('xoxb-123');
      expect(blob.extra).toMatchObject({ teamId: 'T1', teamName: 'Team' });

      const [url, opts] = fetchMock.mock.calls[0];
      expect(url).toBe('https://slack.com/api/oauth.v2.access');
      expect(opts.method).toBe('POST');
      const body = new URLSearchParams(opts.body as string);
      expect(body.get('code')).toBe('auth-code');
    });

    it('throws when Slack returns ok: false', async () => {
      process.env.SLACK_CLIENT_ID = 'cid';
      process.env.SLACK_CLIENT_SECRET = 'sec';

      vi.stubGlobal('fetch', mockFetch(true, { ok: false, error: 'invalid_code' }));

      await expect(adapter.exchangeCodeForTokens('bad', 'http://localhost/cb')).rejects.toThrow(
        'invalid_code',
      );
    });
  });

  describe('refreshToken', () => {
    it('returns credentials unchanged', async () => {
      const cred = { accessToken: 'same' } as never;
      const out = await adapter.refreshToken(cred);
      expect(out).toBe(cred);
    });
  });

  describe('verifyWebhookSignature', () => {
    it('returns invalid when signing secret is not set', () => {
      const r = adapter.verifyWebhookSignature('body', {});
      expect(r.valid).toBe(false);
    });

    it('returns invalid when timestamp or signature headers missing', () => {
      process.env.SLACK_SIGNING_SECRET = 'sec';
      const r = adapter.verifyWebhookSignature('body', {});
      expect(r.valid).toBe(false);
    });

    it('returns invalid when timestamp is stale', () => {
      process.env.SLACK_SIGNING_SECRET = 'sec';
      const old = String(Math.floor(Date.now() / 1000) - 400);
      const r = adapter.verifyWebhookSignature('x=y', {
        'x-slack-request-timestamp': old,
        'x-slack-signature': 'v0=abc',
      });
      expect(r.valid).toBe(false);
    });

    it('accepts a valid v0 signature', () => {
      process.env.SLACK_SIGNING_SECRET = 'test-secret';
      const ts = String(Math.floor(Date.now() / 1000));
      const rawBody = `payload=${encodeURIComponent(JSON.stringify({ type: 'block_actions' }))}`;
      const base = `v0:${ts}:${rawBody}`;
      const sig = `v0=${createHmac('sha256', 'test-secret').update(base).digest('hex')}`;

      const r = adapter.verifyWebhookSignature(rawBody, {
        'x-slack-request-timestamp': ts,
        'x-slack-signature': sig,
      });

      expect(r.valid).toBe(true);
      expect(r.eventType).toBe('block_actions');
    });

    it('returns invalid when signature length matches but HMAC differs', () => {
      process.env.SLACK_SIGNING_SECRET = 'test-secret';
      const ts = String(Math.floor(Date.now() / 1000));
      const rawBody = `payload=${encodeURIComponent(JSON.stringify({ type: 'block_actions' }))}`;
      const wrongSig = `v0=${'0'.repeat(64)}`;

      const r = adapter.verifyWebhookSignature(rawBody, {
        'x-slack-request-timestamp': ts,
        'x-slack-signature': wrongSig,
      });

      expect(r.valid).toBe(false);
    });

    it('accepts signature but keeps eventType unknown when payload JSON is invalid', () => {
      process.env.SLACK_SIGNING_SECRET = 'test-secret';
      const ts = String(Math.floor(Date.now() / 1000));
      const rawBody = `payload=${encodeURIComponent('{not-json')}`;
      const base = `v0:${ts}:${rawBody}`;
      const sig = `v0=${createHmac('sha256', 'test-secret').update(base).digest('hex')}`;

      const r = adapter.verifyWebhookSignature(rawBody, {
        'x-slack-request-timestamp': ts,
        'x-slack-signature': sig,
      });

      expect(r.valid).toBe(true);
      expect(r.eventType).toBe('unknown');
    });
  });
});
