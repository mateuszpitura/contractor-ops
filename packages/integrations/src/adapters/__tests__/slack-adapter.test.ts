import { createHmac } from 'node:crypto';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createMockServer, HttpResponse, http } from '@contractor-ops/test-utils';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
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

  describe('deprovision execution path — contract surface (D-08)', () => {
    // 81-02 multi-provider runs resolve `new SlackAdapter().withOrgGridToken(token)`
    // directly in the step-runner (idp-deprovisioning-step-runner.ts:204-216). These
    // assertions lock that the Deprovisionable contract surface stays wired to the
    // org-grid token so a refactor of the adapter shape fails here, fast.
    it('exposes the four Deprovisionable methods after withOrgGridToken', () => {
      const a = new SlackAdapter().withOrgGridToken('org-grid-token');
      expect(typeof a.suspendAccount).toBe('function');
      expect(typeof a.revokeAllSessions).toBe('function');
      expect(typeof a.verifyDeprovisioned).toBe('function');
      expect(typeof a.describeImpact).toBe('function');
    });

    it('withOrgGridToken is chainable and returns the same adapter instance', () => {
      const a = new SlackAdapter();
      expect(a.withOrgGridToken('org-grid-token')).toBe(a);
    });

    it('keeps the dedicated deprovision regression suites in place', () => {
      // Guards against silent deletion of the behavioral coverage these
      // assertions intentionally do NOT duplicate (suspend SCIM active=false,
      // revoke admin.users.session.invalidate, describeImpact SLACK shape, the
      // org-grid-bearer + error-class mapping, enterprise-grid detection).
      const here = fileURLToPath(new URL('.', import.meta.url));
      for (const sibling of [
        'slack-deprovision.test.ts',
        'slack-describe-impact.test.ts',
        'slack-enterprise-grid-detection.test.ts',
      ]) {
        expect(existsSync(new URL(sibling, `file://${here}`))).toBe(true);
      }
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

// ---------------------------------------------------------------------------
// D-08 regression lock — suspend / revoke / impact fire with the org-grid bearer.
//
// The full behavioral matrix (error-class mapping, email→SCIM-id resolution,
// rate-limit throws, enterprise-grid detection) lives in the dedicated
// slack-deprovision / slack-describe-impact / slack-enterprise-grid-detection
// suites. This block re-asserts ONLY the three must-have truths the multi-provider
// run (81-02) depends on, against the canonical MSW harness — no behavior change
// to slack-adapter.ts. Kept outside the `vi.stubGlobal('fetch')` describe above so
// the MSW server owns the network for these cases.
// ---------------------------------------------------------------------------

const isScimUserPath = (url: string) => {
  const u = new URL(url);
  return u.hostname === 'api.slack.com' && /^\/scim\/v2\/Users\/[^/]+$/.test(u.pathname);
};

const ORG_GRID_TOKEN = 'org-grid-token';
const DEPROVISION_USER_ID = 'W08001';

describe('SlackAdapter — deprovision execution path fires with the org-grid bearer (D-08)', () => {
  const { server } = createMockServer({ handlersOnly: true });
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('suspendAccount issues a SCIM PATCH active=false with the org-grid bearer', async () => {
    let seenAuth: string | null = null;
    let seenMethod: string | null = null;
    let seenBody: unknown;
    server.use(
      http.patch(
        ({ request }) => isScimUserPath(request.url),
        async ({ request }) => {
          seenAuth = request.headers.get('authorization');
          seenMethod = request.method;
          seenBody = await request.json();
          return HttpResponse.json({ active: false });
        },
      ),
    );

    const result = await new SlackAdapter()
      .withOrgGridToken(ORG_GRID_TOKEN)
      .suspendAccount(DEPROVISION_USER_ID);

    expect(result.status).toBe('SUCCEEDED');
    expect(seenMethod).toBe('PATCH');
    expect(seenAuth).toBe(`Bearer ${ORG_GRID_TOKEN}`);
    expect(seenBody).toMatchObject({
      Operations: [{ op: 'replace', path: 'active', value: false }],
    });
  });

  it('revokeAllSessions calls admin.users.session.invalidate with the org-grid bearer', async () => {
    let seenAuth: string | null = null;
    let seenBody: unknown;
    server.use(
      http.post('https://slack.com/api/admin.users.session.invalidate', async ({ request }) => {
        seenAuth = request.headers.get('authorization');
        seenBody = await request.json();
        return HttpResponse.json({ ok: true });
      }),
    );

    const result = await new SlackAdapter()
      .withOrgGridToken(ORG_GRID_TOKEN)
      .revokeAllSessions(DEPROVISION_USER_ID);

    expect(result.status).toBe('SUCCEEDED');
    expect(seenAuth).toBe(`Bearer ${ORG_GRID_TOKEN}`);
    expect(seenBody).toMatchObject({ user_id: DEPROVISION_USER_ID });
  });

  it('describeImpact returns the SLACK impact shape with the org-grid bearer on every read', async () => {
    const seenAuth = new Set<string | null>();
    const captureAuth = ({ request }: { request: Request }) => {
      seenAuth.add(request.headers.get('authorization'));
    };
    server.use(
      http.post('https://slack.com/api/users.info', ({ request }) => {
        captureAuth({ request });
        return HttpResponse.json({
          ok: true,
          user: { deleted: false, is_admin: true, is_owner: false },
        });
      }),
      http.post('https://slack.com/api/users.conversations', ({ request }) => {
        captureAuth({ request });
        return HttpResponse.json({ ok: true, channels: [{ id: 'C1' }] });
      }),
      http.post('https://slack.com/api/apps.permissions.users.list', ({ request }) => {
        captureAuth({ request });
        return HttpResponse.json({ ok: true, apps: [] });
      }),
    );

    const preview = await new SlackAdapter()
      .withOrgGridToken(ORG_GRID_TOKEN)
      .describeImpact(DEPROVISION_USER_ID);

    expect(preview.provider).toBe('SLACK');
    expect(preview.commonMetrics.accountStatus).toBe('ACTIVE');
    if (preview.provider === 'SLACK') {
      expect(preview.customMetrics.isWorkspaceAdmin).toBe(true);
      expect(preview.customMetrics.channelsMemberCount).toBe(1);
    }
    expect(preview.fetchedAt).toEqual(expect.any(String));
    // Every admin Web-API read carried the org-grid bearer (never a workspace token).
    expect([...seenAuth]).toEqual([`Bearer ${ORG_GRID_TOKEN}`]);
  });
});
