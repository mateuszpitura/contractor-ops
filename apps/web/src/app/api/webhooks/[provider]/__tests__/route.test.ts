/** @vitest-environment node */

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGetAdapter,
  mockPublishJSON,
  mockCreate,
  mockUpdate,
  mockExtractSlackTeamId,
  mockResolveSlackConnectionByTeamId,
  mockOrgFindUnique,
} = vi.hoisted(() => ({
  mockGetAdapter: vi.fn(),
  mockPublishJSON: vi.fn(async () => undefined),
  mockCreate: vi.fn(async () => ({ id: 'del-1' })),
  mockUpdate: vi.fn(async () => ({})),
  mockExtractSlackTeamId: vi.fn(() => undefined as string | undefined),
  mockResolveSlackConnectionByTeamId: vi.fn(
    async () => null as { organizationId: string; connectionId: string } | null,
  ),
  mockOrgFindUnique: vi.fn(),
}));

vi.mock('@contractor-ops/integrations/adapters/register-all', () => ({
  registerAllAdapters: vi.fn(),
}));

vi.mock('@contractor-ops/integrations/registry', () => ({
  getAdapter: (...args: unknown[]) => mockGetAdapter(...args),
}));

vi.mock('@contractor-ops/integrations/services/qstash-client', () => ({
  getQStashClient: vi.fn(() => ({
    publishJSON: mockPublishJSON,
  })),
}));

vi.mock('@contractor-ops/db', () => ({
  prisma: {
    webhookDelivery: {
      create: (...args: unknown[]) => (mockCreate as (...a: unknown[]) => unknown)(...args),
      update: (...args: unknown[]) => (mockUpdate as (...a: unknown[]) => unknown)(...args),
    },
    organization: {
      findUnique: (...args: unknown[]) =>
        (mockOrgFindUnique as (...a: unknown[]) => unknown)(...args),
    },
  },
}));

vi.mock('../../slack-webhook-context.js', () => ({
  extractSlackTeamId: (...a: unknown[]) =>
    (mockExtractSlackTeamId as (...a: unknown[]) => unknown)(...a),
  resolveSlackConnectionByTeamId: (...a: unknown[]) =>
    (mockResolveSlackConnectionByTeamId as (...a: unknown[]) => unknown)(...a),
  // F-SCALE-10 — Redis-cached lookup; route asks for orgId by slug for Resend
  resolveOrgIdBySlug: async (slug: string) => {
    const org = (await (mockOrgFindUnique as (...a: unknown[]) => unknown)({
      where: { slug },
      select: { id: true },
    })) as { id: string } | null;
    return org?.id ?? null;
  },
}));

import { POST } from '../route';

function makeRequest(body: string, headers?: Record<string, string>) {
  return new NextRequest('http://localhost/api/webhooks/stripe', {
    method: 'POST',
    body,
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
  });
}

describe('POST /api/webhooks/[provider]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.test';
    mockCreate.mockResolvedValue({ id: 'del-1' });
    mockGetAdapter.mockReturnValue(null);
    mockExtractSlackTeamId.mockReturnValue(undefined);
    mockResolveSlackConnectionByTeamId.mockResolvedValue(null);
    mockOrgFindUnique.mockResolvedValue(null);
  });

  it('returns 404 when provider is unknown', async () => {
    mockGetAdapter.mockReturnValue(null);

    const req = makeRequest('{}');
    const res = await POST(req, {
      params: Promise.resolve({ provider: 'unknown' }),
    });

    expect(res.status).toBe(404);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe('Unknown provider');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns 404 when adapter does not support webhooks', async () => {
    mockGetAdapter.mockReturnValue({
      slug: 'x',
      supportsWebhooks: false,
    });

    const req = makeRequest('{}');
    const res = await POST(req, {
      params: Promise.resolve({ provider: 'x' }),
    });

    expect(res.status).toBe(404);
  });

  it('returns 401 when signature verification fails', async () => {
    mockGetAdapter.mockReturnValue({
      slug: 'stripe',
      supportsWebhooks: true,
      verifyWebhookSignature: vi.fn(() => ({ valid: false })),
    });

    const req = makeRequest('{}');
    const res = await POST(req, {
      params: Promise.resolve({ provider: 'stripe' }),
    });

    expect(res.status).toBe(401);
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
      slug: 'stripe',
      supportsWebhooks: true,
      verifyWebhookSignature: verify,
    });

    const payload = { id: 'evt_1', type: 'invoice.paid' };
    const req = makeRequest(JSON.stringify(payload));

    const res = await POST(req, {
      params: Promise.resolve({ provider: 'stripe' }),
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as { received?: boolean };
    expect(json.received).toBe(true);

    expect(verify).toHaveBeenCalled();
    expect(mockCreate).toHaveBeenCalled();
    expect(mockPublishJSON).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://app.test/api/webhooks/_process',
        body: { deliveryId: 'del-1', provider: 'stripe' },
        retries: 3,
      }),
    );
  });

  it('resolves Slack organizationId from workspace team id when adapter omits org', async () => {
    const verify = vi.fn(() => ({
      valid: true,
      eventType: 'block_actions',
    }));

    mockGetAdapter.mockReturnValue({
      slug: 'slack',
      supportsWebhooks: true,
      verifyWebhookSignature: verify,
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

    const req = new NextRequest('http://localhost/api/webhooks/slack', {
      method: 'POST',
      body,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    });

    const res = await POST(req, {
      params: Promise.resolve({ provider: 'slack' }),
    });

    expect(res.status).toBe(200);
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

    const req = new NextRequest('http://localhost/api/webhooks/slack', {
      method: 'POST',
      body: JSON.stringify({ type: 'event_callback' }),
      headers: { 'content-type': 'application/json' },
    });

    const res = await POST(req, {
      params: Promise.resolve({ provider: 'slack' }),
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as { persisted?: boolean };
    expect(json.persisted).toBe(false);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('resolves Resend organizationId from slug via Organization lookup', async () => {
    const verify = vi.fn(() => ({
      valid: true,
      eventType: 'email.received',
      organizationSlug: 'acme',
    }));

    mockGetAdapter.mockReturnValue({
      slug: 'resend',
      supportsWebhooks: true,
      verifyWebhookSignature: verify,
    });

    mockOrgFindUnique.mockResolvedValue({ id: 'org-cuid-acme' });

    // F-INT-07: Resend webhook schema requires `type`
    const req = makeRequest(
      JSON.stringify({ type: 'email.received', data: { to: ['x@acme.contractorhub.io'] } }),
    );
    const res = await POST(req, {
      params: Promise.resolve({ provider: 'resend' }),
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as { received?: boolean; persisted?: boolean };
    expect(json.received).toBe(true);
    expect(json.persisted).not.toBe(false);

    expect(mockOrgFindUnique).toHaveBeenCalledWith({
      where: { slug: 'acme' },
      select: { id: true },
    });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 'org-cuid-acme',
        }),
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

    mockOrgFindUnique.mockResolvedValue(null);

    // F-INT-07: payload must satisfy the Resend schema (`type` required)
    const req = makeRequest(JSON.stringify({ type: 'email.received', data: {} }));
    const res = await POST(req, {
      params: Promise.resolve({ provider: 'resend' }),
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as { persisted?: boolean };
    expect(json.persisted).toBe(false);
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockPublishJSON).not.toHaveBeenCalled();
  });
});
