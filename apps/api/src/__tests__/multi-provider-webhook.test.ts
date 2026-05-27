/** @vitest-environment node */

/**
 * Multi-provider webhook dispatcher tests.
 *
 * Coverage:
 *   1. Unknown provider → 404, no DB write.
 *   2. Adapter that doesn't support webhooks → 404.
 *   3. Invalid signature → 401.
 *   4. Valid stripe webhook → 200, WebhookDelivery row persisted, QStash enqueued.
 *   5. Slack: org resolved from `team.id` lookup when adapter omits org.
 *   6. Slack: unresolved team → 200 + persisted:false (no DB write).
 *   7. Resend: org resolved from slug; persisted.
 *   8. Resend: unknown slug → 200 + persisted:false.
 *
 * The integrations + Prisma + slack-context modules are mocked at the
 * file level (vi.hoisted) so the route handler under test sees only the
 * test doubles.
 */

import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGetAdapter,
  mockPublishJSON,
  mockCreate,
  mockUpdate,
  mockExtractSlackTeamId,
  mockResolveSlackConnectionByTeamId,
  mockResolveOrgIdBySlug,
  mockValidateWebhookPayload,
  mockFindMany,
} = vi.hoisted(() => ({
  mockGetAdapter: vi.fn(),
  mockPublishJSON: vi.fn(async () => undefined),
  mockCreate: vi.fn(async () => ({ id: 'del-1' })),
  mockUpdate: vi.fn(async () => ({})),
  mockExtractSlackTeamId: vi.fn(() => undefined as string | undefined),
  mockResolveSlackConnectionByTeamId: vi.fn(
    async () => null as { organizationId: string; connectionId: string } | null,
  ),
  mockResolveOrgIdBySlug: vi.fn(async () => null as string | null),
  mockValidateWebhookPayload: vi.fn((_p: string, payload: unknown) => ({
    ok: true,
    payload,
  })),
  mockFindMany: vi.fn(
    async () => [] as Array<{ id: string; organizationId: string; configJson: unknown }>,
  ),
}));

vi.mock('@contractor-ops/integrations/adapters/register-all', () => ({
  registerAllAdapters: vi.fn(),
}));

vi.mock('@contractor-ops/integrations/registry', () => ({
  getAdapter: (...args: unknown[]) => mockGetAdapter(...args),
}));

vi.mock('@contractor-ops/integrations/services/qstash-client', () => ({
  getQStashClient: vi.fn(() => ({ publishJSON: mockPublishJSON })),
}));

vi.mock('@contractor-ops/integrations/services/webhook-schemas', () => ({
  validateWebhookPayload: (provider: string, payload: unknown) =>
    mockValidateWebhookPayload(provider, payload),
}));

vi.mock('@contractor-ops/db', () => ({
  prisma: {
    webhookDelivery: {
      create: (...args: unknown[]) => (mockCreate as (...a: unknown[]) => unknown)(...args),
      update: (...args: unknown[]) => (mockUpdate as (...a: unknown[]) => unknown)(...args),
    },
    integrationConnection: {
      findMany: (...args: unknown[]) => (mockFindMany as (...a: unknown[]) => unknown)(...args),
    },
  },
}));

vi.mock('../lib/webhooks/slack-webhook-context.js', () => ({
  extractSlackTeamId: (...a: unknown[]) =>
    (mockExtractSlackTeamId as (...a: unknown[]) => unknown)(...a),
  resolveSlackConnectionByTeamId: (...a: unknown[]) =>
    (mockResolveSlackConnectionByTeamId as (...a: unknown[]) => unknown)(...a),
  resolveOrgIdBySlug: (...a: unknown[]) =>
    (mockResolveOrgIdBySlug as (...a: unknown[]) => unknown)(...a),
}));

import { __resetEnvForTests } from '../env.js';
import { buildServer } from '../server.js';

let app: FastifyInstance;

beforeAll(async () => {
  process.env.API_URL = 'https://api.example.test';
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
  mockCreate.mockResolvedValue({ id: 'del-1' });
  mockGetAdapter.mockReturnValue(null);
  mockExtractSlackTeamId.mockReturnValue(undefined);
  mockResolveSlackConnectionByTeamId.mockResolvedValue(null);
  mockResolveOrgIdBySlug.mockResolvedValue(null);
  mockValidateWebhookPayload.mockImplementation((_p, payload) => ({ ok: true, payload }));
});

function post(provider: string, payload: string, headers: Record<string, string> = {}) {
  return app.inject({
    method: 'POST',
    url: `/webhooks/${provider}`,
    headers: { 'content-type': 'application/json', ...headers },
    payload,
  });
}

describe('POST /webhooks/:provider', () => {
  it('returns 404 when provider is unknown', async () => {
    mockGetAdapter.mockReturnValue(null);
    const res = await post('unknown', '{}');
    expect(res.statusCode).toBe(404);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("returns 404 when adapter doesn't support webhooks", async () => {
    mockGetAdapter.mockReturnValue({ slug: 'x', supportsWebhooks: false });
    const res = await post('x', '{}');
    expect(res.statusCode).toBe(404);
  });

  it('returns 401 when signature verification fails', async () => {
    mockGetAdapter.mockReturnValue({
      slug: 'stripe',
      supportsWebhooks: true,
      verifyWebhookSignature: vi.fn(() => ({ valid: false })),
    });
    // Use a provider slug that has NO explicit route (stripe/inpost/storecove
    // are registered as static paths and win the route match before
    // the parametric `:provider` handler).
    const res = await post('notion', '{}');
    expect(res.statusCode).toBe(401);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns 200, persists delivery, and enqueues QStash on valid webhook', async () => {
    const verify = vi.fn(() => ({
      valid: true,
      organizationId: 'org-1',
      eventType: 'invoice.paid',
      connectionId: 'conn-1',
    }));

    mockGetAdapter.mockReturnValue({
      slug: 'notion',
      supportsWebhooks: true,
      verifyWebhookSignature: verify,
    });

    // Same reason as the 401 case — explicit `/webhooks/stripe` route wins
    // over the parametric `:provider` handler, so test against a provider
    // slug that exists only as an adapter (no explicit Fastify route).
    const res = await post('notion', JSON.stringify({ id: 'evt_1', type: 'invoice.paid' }));
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { received?: boolean };
    expect(body.received).toBe(true);

    expect(verify).toHaveBeenCalled();
    expect(mockCreate).toHaveBeenCalled();
    expect(mockPublishJSON).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://api.example.test/webhooks/_process',
        body: { deliveryId: 'del-1', provider: 'notion' },
        retries: 3,
      }),
    );
  });

  it('resolves Slack organizationId from workspace team id when adapter omits org', async () => {
    mockGetAdapter.mockReturnValue({
      slug: 'slack',
      supportsWebhooks: true,
      verifyWebhookSignature: vi.fn(() => ({ valid: true, eventType: 'block_actions' })),
    });
    mockExtractSlackTeamId.mockReturnValue('T09ABCDEF');
    mockResolveSlackConnectionByTeamId.mockResolvedValue({
      organizationId: 'org-from-slack',
      connectionId: 'conn-slack-1',
    });

    const body = new URLSearchParams({
      payload: JSON.stringify({
        type: 'block_actions',
        team: { id: 'T09ABCDEF', domain: 'acme' },
      }),
    }).toString();

    const res = await post('slack', body, {
      'content-type': 'application/x-www-form-urlencoded',
    });

    expect(res.statusCode).toBe(200);
    expect(mockResolveSlackConnectionByTeamId).toHaveBeenCalledWith('T09ABCDEF');
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 'org-from-slack',
          integrationConnectionId: 'conn-slack-1',
        }),
      }),
    );
  });

  it('does not persist when Slack team cannot be resolved to an org', async () => {
    mockGetAdapter.mockReturnValue({
      slug: 'slack',
      supportsWebhooks: true,
      verifyWebhookSignature: vi.fn(() => ({ valid: true, eventType: 'event_callback' })),
    });
    mockExtractSlackTeamId.mockReturnValue(undefined);

    const res = await post('slack', JSON.stringify({ type: 'event_callback' }));
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { persisted?: boolean };
    expect(body.persisted).toBe(false);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('resolves Resend organizationId from slug via Organization lookup', async () => {
    mockGetAdapter.mockReturnValue({
      slug: 'resend',
      supportsWebhooks: true,
      verifyWebhookSignature: vi.fn(() => ({
        valid: true,
        eventType: 'email.received',
        organizationSlug: 'acme',
      })),
    });
    mockResolveOrgIdBySlug.mockResolvedValue('org-cuid-acme');

    const res = await post(
      'resend',
      JSON.stringify({ type: 'email.received', data: { to: ['x@acme.contractorhub.io'] } }),
    );
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { received?: boolean; persisted?: boolean };
    expect(body.received).toBe(true);
    expect(body.persisted).not.toBe(false);

    expect(mockResolveOrgIdBySlug).toHaveBeenCalledWith('acme');
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ organizationId: 'org-cuid-acme' }),
      }),
    );
  });

  it('returns 200 without persisting when Resend slug does not match an organization', async () => {
    mockGetAdapter.mockReturnValue({
      slug: 'resend',
      supportsWebhooks: true,
      verifyWebhookSignature: vi.fn(() => ({
        valid: true,
        eventType: 'email.received',
        organizationSlug: 'unknown-slug',
      })),
    });
    mockResolveOrgIdBySlug.mockResolvedValue(null);

    const res = await post('resend', JSON.stringify({ type: 'email.received', data: {} }));
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { persisted?: boolean };
    expect(body.persisted).toBe(false);
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockPublishJSON).not.toHaveBeenCalled();
  });
});
