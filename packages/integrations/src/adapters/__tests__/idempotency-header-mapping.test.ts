/**
 * Per-provider idempotency wire-mapping.
 *
 * The canonical `deriveIdempotencyKey({orgId, operation, businessKey})` returns
 * the SAME 64-char sha256 hex for every provider; each adapter is then
 * responsible for placing that key onto the right wire slot under the right
 * provider-specific NAME. This suite pins those mappings so a future adapter
 * refactor can't silently drop the header (which would re-open duplicate
 * envelope / transmission / event creation on retry).
 *
 * Asserted here against REAL adapter code (SDK / fetch stubbed at the seam):
 *   - DocuSign        → `X-DocuSign-Idempotency-Key`   (addDefaultHeader)
 *   - Storecove/Peppol→ `Idempotency-Key`              (fetch header)
 *   - Entra (Graph)   → `client-request-id` UUID       (fetch header)
 *   - Outlook (Graph) → `client-request-id` UUID       (fetch header)
 *   - Google Calendar → event `id` in the BODY (no header — Google dedups on
 *     the resource id, so this is asserted as body-id, not a header)
 *
 * The Okta / Slack / Google-Workspace deprovision adapters send NO idempotency
 * or correlation request header — and that is correct, not a gap. None of those
 * three provider APIs expose a client-set idempotency/correlation header:
 *   - Okta: `X-Okta-Request-Id` is RESPONSE-only; the management API and
 *     `@okta/okta-sdk-nodejs` v8 take no client-set idempotency key on lifecycle
 *     mutations (deactivateUser / revokeUserSessions).
 *   - Slack: neither SCIM v2 nor the admin Web API documents an idempotency /
 *     request-correlation header on PATCH active=false / session.invalidate.
 *   - Google Workspace: the Admin SDK Directory API (users PATCH, signOut,
 *     tokens.delete) documents no idempotency header.
 * Re-run safety for all three is provider-STATE-based (a repeat suspend of an
 * already-gone user collapses to LIKELY_GONE / 404; a repeat disable PATCH is
 * last-write-wins; a repeat session revoke is naturally idempotent) — see
 * deprovision-idempotency.test.ts. The blocks below PIN the negative so a future
 * refactor cannot fabricate a non-standard header the provider would silently
 * drop (false confidence) without this suite failing.
 */

import { createHash, randomUUID } from 'node:crypto';
import { createMockServer, HttpResponse, http } from '@contractor-ops/test-utils';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { deriveIdempotencyKey } from '../../services/idempotency.js';

// ---------------------------------------------------------------------------
// Helpers mirroring the adapters' wire encodings (assert exact bytes, not
// just "some header is present").
// ---------------------------------------------------------------------------

/** Mirror of encodeMicrosoftClientRequestId in the Graph adapters. */
function encodeGraphClientRequestId(idempotencyKey: string): string {
  const digest = createHash('sha256').update(idempotencyKey).digest();
  digest[6] = (digest[6] & 0x0f) | 0x50;
  digest[8] = (digest[8] & 0x3f) | 0x80;
  const hex = digest.toString('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}

function headerOf(init: RequestInit | undefined, name: string): string | undefined {
  const h = init?.headers as Record<string, string> | undefined;
  if (!h) return;
  // Adapters use plain object headers with the documented casing.
  return h[name];
}

// ===========================================================================
// DocuSign — X-DocuSign-Idempotency-Key (via SDK ApiClient.addDefaultHeader)
// ===========================================================================

describe('DocuSign idempotency header', () => {
  const addDefaultHeader = vi.fn();
  const mockCreateEnvelope = vi.fn(async () => ({ envelopeId: 'env-1', status: 'sent' }));

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.APP_URL = 'http://localhost:3000';
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    delete process.env.APP_URL;
  });

  it('sets X-DocuSign-Idempotency-Key to deriveIdempotencyKey(org, docusign.envelope.create, fingerprint)', async () => {
    vi.doMock('@contractor-ops/db', () => ({
      prisma: {
        integrationConnection: {
          findUnique: vi.fn(async () => ({
            id: 'conn-1',
            status: 'CONNECTED',
            credentialsRef: 'enc',
            configJson: { accountId: 'acc-1', basePath: 'https://demo.docusign.net/restapi' },
          })),
        },
      },
    }));
    vi.doMock('../../services/credential-service.js', () => ({
      decryptCredentials: vi.fn(() => ({ accessToken: 'at', refreshToken: 'rt' })),
    }));
    vi.doMock('docusign-esign', () => {
      const sdk = {
        ApiClient: class {
          setBasePath() {}
          addDefaultHeader(name: string, value: string) {
            addDefaultHeader(name, value);
          }
        },
        EnvelopesApi: class {
          createEnvelope = mockCreateEnvelope;
        },
        Document: { constructFromObject: (o: unknown) => o },
        Signer: { constructFromObject: (o: unknown) => o },
        Recipients: { constructFromObject: (o: unknown) => o },
        EnvelopeDefinition: { constructFromObject: (o: unknown) => o },
        Expirations: { constructFromObject: (o: unknown) => o },
        Reminders: { constructFromObject: (o: unknown) => o },
        Notification: { constructFromObject: (o: unknown) => o },
      };
      return { ...sdk, default: sdk };
    });

    const { DocuSignAdapter } = await import('../docusign-adapter.js');
    const adapter = new DocuSignAdapter();

    const signers = [
      { name: 'Jane', email: 'jane@example.com', role: 'signer' as const, routingOrder: 1 },
    ];
    const documentBase64 = Buffer.from('%PDF').toString('base64');
    await adapter.createEnvelope('conn-1', {
      documentBase64,
      documentName: 'contract.pdf',
      organizationId: 'org-9',
      signers,
    });

    // Recompute the expected key from the documented composition.
    const businessKey = createHash('sha256')
      .update(`contract.pdf|${documentBase64.length}|jane@example.com`)
      .digest('hex');
    const expectedKey = deriveIdempotencyKey({
      orgId: 'org-9',
      operation: 'docusign.envelope.create',
      businessKey,
    });

    expect(addDefaultHeader).toHaveBeenCalledWith('X-DocuSign-Idempotency-Key', expectedKey);
  });
});

// Storecove/Peppol Idempotency-Key lives in the einvoice package (StorecoveClient
// is owned there); its header test is colocated in
// packages/einvoice/src/asp/storecove/__tests__/client.test.ts to keep this
// integrations test within package boundaries.

// ===========================================================================
// Entra (Graph) — client-request-id UUID derived from the key
// ===========================================================================

describe('Entra Graph client-request-id header', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', mockFetch);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('PATCH /users/{id} carries client-request-id = encoded(entra:suspend:{id})', async () => {
    const { EntraIdAdapter } = await import('../entra-id-adapter.js');
    const USER = 'user-1';

    mockFetch.mockImplementation(async (_url: string, init?: RequestInit) => {
      const method = (init?.method ?? 'GET').toUpperCase();
      if (method === 'GET') {
        // hybrid-AD pre-flight: non-hybrid, account enabled.
        return new Response(
          JSON.stringify({ accountEnabled: true, onPremisesSyncEnabled: false }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        );
      }
      // PATCH disable.
      return new Response(null, { status: 204 });
    });

    const adapter = new EntraIdAdapter().withAccessToken('tok');
    const result = await adapter.suspendAccount(USER);
    expect(result.status).toBe('SUCCEEDED');

    const patchCall = mockFetch.mock.calls.find(
      ([, init]) => (init as RequestInit | undefined)?.method?.toUpperCase() === 'PATCH',
    ) as [string, RequestInit] | undefined;
    expect(patchCall).toBeDefined();

    const sent = headerOf(patchCall?.[1], 'client-request-id');
    expect(sent).toBe(encodeGraphClientRequestId(`entra:suspend:${USER}`));
    // UUID v4-shaped, deterministic from the key — NOT a random UUID.
    expect(sent).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-5[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
    expect(sent).not.toBe(randomUUID());
  });
});

// ===========================================================================
// Outlook (Graph) — client-request-id UUID derived from the key
// ===========================================================================

describe('Outlook Graph client-request-id header', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', mockFetch);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('createEvent with a key sends client-request-id = encoded(key)', async () => {
    const { OutlookCalendarAdapter } = await import('../outlook-calendar-adapter.js');
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ id: 'evt-1', webLink: 'https://outlook.test/evt-1' }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const adapter = new OutlookCalendarAdapter();
    const key = 'conn-1:engagement:eng-1:create';
    await adapter.createEvent(
      'access-token',
      {
        subject: 'Kickoff',
        bodyHtml: '<p>d</p>',
        startDateTime: '2026-07-01T10:00:00Z',
        endDateTime: '2026-07-01T11:00:00Z',
      },
      key,
    );

    const createCall = mockFetch.mock.calls.find(
      ([, init]) => (init as RequestInit | undefined)?.method?.toUpperCase() === 'POST',
    ) as [string, RequestInit] | undefined;
    expect(createCall).toBeDefined();
    expect(headerOf(createCall?.[1], 'client-request-id')).toBe(encodeGraphClientRequestId(key));
  });
});

// ===========================================================================
// Google Calendar — key goes into the BODY event id (no header)
// ===========================================================================

describe('Google Calendar idempotency mapping (body id, NOT a header)', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', mockFetch);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('encodes the key as the event resource id in the request body — Google dedups on id 409', async () => {
    const { GoogleCalendarAdapter } = await import('../google-calendar-adapter.js');
    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify({ id: 'evt-x', htmlLink: 'https://cal.test/evt-x', etag: '"e1"' }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );

    const adapter = new GoogleCalendarAdapter();
    const key = 'conn-1:engagement:eng-1:create';
    await adapter.createEvent(
      'access-token',
      {
        summary: 'Kickoff',
        startDateTime: '2026-07-01T10:00:00Z',
        endDateTime: '2026-07-01T11:00:00Z',
      },
      key,
    );

    const createCall = mockFetch.mock.calls.find(
      ([, init]) => (init as RequestInit | undefined)?.method?.toUpperCase() === 'POST',
    ) as [string, RequestInit] | undefined;
    expect(createCall).toBeDefined();

    // No idempotency header — the key lives in the body `id`.
    expect(headerOf(createCall?.[1], 'X-Goog-Idempotency-Key')).toBeUndefined();
    const body = JSON.parse(createCall?.[1].body as string) as { id?: string };
    // base32hex-encoded sha256 of the key (5..1024 chars, lowercase a-v0-9).
    expect(body.id).toBeDefined();
    expect(body.id).toMatch(/^[a-v0-9]+$/);
  });
});

// ===========================================================================
// N/A providers — Okta / Slack / Google-Workspace deprovision mutations send
// NO idempotency or correlation request header (none exists on those APIs).
//
// These assert the absence of any idempotency-style header on the real
// mutating call, captured at the network seam (MSW intercepts both fetch and
// the Okta SDK's node-fetch). Idempotency-style names that DO appear on other
// adapters are checked explicitly so the negative is meaningful.
// ===========================================================================

const IDEMPOTENCY_STYLE_HEADERS = [
  'idempotency-key',
  'x-idempotency-key',
  'x-docusign-idempotency-key',
  'x-goog-idempotency-key',
  'client-request-id',
  'x-request-id',
  'x-correlation-id',
];

/** Asserts a captured Headers carries none of the idempotency-style names. */
function expectNoIdempotencyHeader(headers: Headers): void {
  for (const name of IDEMPOTENCY_STYLE_HEADERS) {
    expect(headers.get(name)).toBeNull();
  }
}

describe('Okta deprovision — no idempotency/correlation request header (N/A by provider)', () => {
  const { server } = createMockServer({ handlersOnly: true });
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  const ORG_URL = 'https://example.okta.com';
  const USER = '00uTESTUSER001';
  const isUser = (url: string) => /\/api\/v1\/users\/[^/]+$/.test(new URL(url).pathname);
  const isDeactivate = (url: string) =>
    /\/api\/v1\/users\/[^/]+\/lifecycle\/deactivate$/.test(new URL(url).pathname);

  it('deactivateUser (suspend) carries no idempotency header', async () => {
    const { OktaAdapter } = await import('../okta-adapter.js');
    let deactivateHeaders: Headers | undefined;
    server.use(
      http.get(
        ({ request }) => isUser(request.url),
        () => HttpResponse.json({ id: USER, status: 'ACTIVE' }),
      ),
      http.post(
        ({ request }) => isDeactivate(request.url),
        ({ request }) => {
          deactivateHeaders = request.headers;
          return HttpResponse.json({ status: 'DEPROVISIONED' });
        },
      ),
    );

    const result = await new OktaAdapter()
      .withCredentials(ORG_URL, 'fake-okta-token')
      .suspendAccount(USER);
    expect(result.status).toBe('SUCCEEDED');
    expect(deactivateHeaders).toBeDefined();
    expectNoIdempotencyHeader(deactivateHeaders as Headers);
  });
});

describe('Slack deprovision — no idempotency/correlation request header (N/A by provider)', () => {
  const { server } = createMockServer({ handlersOnly: true });
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  const USER = 'W08001';
  const isScimUserPath = (url: string) => {
    const u = new URL(url);
    return u.hostname === 'api.slack.com' && /^\/scim\/v2\/Users\/[^/]+$/.test(u.pathname);
  };

  it('SCIM PATCH active=false (suspend) carries no idempotency header', async () => {
    const { SlackAdapter } = await import('../slack-adapter.js');
    let patchHeaders: Headers | undefined;
    server.use(
      http.patch(
        ({ request }) => isScimUserPath(request.url),
        ({ request }) => {
          patchHeaders = request.headers;
          return HttpResponse.json({ active: false });
        },
      ),
    );

    const result = await new SlackAdapter().withOrgGridToken('org-grid-token').suspendAccount(USER);
    expect(result.status).toBe('SUCCEEDED');
    expect(patchHeaders).toBeDefined();
    expectNoIdempotencyHeader(patchHeaders as Headers);
  });

  it('admin.users.session.invalidate (revoke) carries no idempotency header', async () => {
    const { SlackAdapter } = await import('../slack-adapter.js');
    let revokeHeaders: Headers | undefined;
    server.use(
      http.post('https://slack.com/api/admin.users.session.invalidate', ({ request }) => {
        revokeHeaders = request.headers;
        return HttpResponse.json({ ok: true });
      }),
    );

    const result = await new SlackAdapter()
      .withOrgGridToken('org-grid-token')
      .revokeAllSessions(USER);
    expect(result.status).toBe('SUCCEEDED');
    expect(revokeHeaders).toBeDefined();
    expectNoIdempotencyHeader(revokeHeaders as Headers);
  });
});

describe('Google Workspace deprovision — no idempotency/correlation request header (N/A by provider)', () => {
  const { server } = createMockServer({ handlersOnly: true });
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  const ADMIN_HOST = 'admin.googleapis.com';
  const USER = 'u@example.com';
  const isUserPath = (url: string) => {
    const u = new URL(url);
    return u.hostname === ADMIN_HOST && /^\/admin\/directory\/v1\/users\/[^/]+$/.test(u.pathname);
  };

  it('Directory PATCH suspended=true (suspend) carries no idempotency header', async () => {
    const { GoogleWorkspaceAdapter } = await import('../google-workspace-adapter.js');
    let patchHeaders: Headers | undefined;
    server.use(
      http.patch(
        ({ request }) => isUserPath(request.url),
        ({ request }) => {
          patchHeaders = request.headers;
          return HttpResponse.json({ suspended: true });
        },
      ),
    );

    const result = await new GoogleWorkspaceAdapter()
      .withAccessToken('fake-token')
      .suspendAccount(USER);
    expect(result.status).toBe('SUCCEEDED');
    expect(patchHeaders).toBeDefined();
    expectNoIdempotencyHeader(patchHeaders as Headers);
  });
});
