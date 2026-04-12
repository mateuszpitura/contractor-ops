/** @vitest-environment node */

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetAdapter, mockPublishJSON, mockCreate } = vi.hoisted(() => ({
  mockGetAdapter: vi.fn(),
  mockPublishJSON: vi.fn(async () => undefined),
  mockCreate: vi.fn(async () => ({ id: 'del-1' })),
}));

vi.mock('@contractor-ops/integrations/adapters/register-all', () => ({
  registerAllAdapters: vi.fn(),
}));

vi.mock('@contractor-ops/integrations/registry', () => ({
  getAdapter: (...args: any[]) => mockGetAdapter(...args),
}));

vi.mock('@contractor-ops/integrations/services/qstash-client', () => ({
  getQStashClient: vi.fn(() => ({
    publishJSON: mockPublishJSON,
  })),
}));

vi.mock('@contractor-ops/db', () => ({
  prisma: {
    webhookDelivery: {
      create: (...args: any[]) => mockCreate(...args),
    },
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

  it('stores PENDING organizationId when adapter omits org for Slack webhook', async () => {
    const verify = vi.fn(() => ({
      valid: true,
      eventType: 'block_actions',
    }));

    mockGetAdapter.mockReturnValue({
      slug: 'slack',
      supportsWebhooks: true,
      verifyWebhookSignature: verify,
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
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 'PENDING',
          provider: 'SLACK',
        }),
      }),
    );
  });

  it('persists delivery with organizationId from verification for Resend webhook', async () => {
    const verify = vi.fn(() => ({
      valid: true,
      eventType: 'email.received',
      organizationId: 'org-cuid-acme',
    }));

    mockGetAdapter.mockReturnValue({
      slug: 'resend',
      supportsWebhooks: true,
      verifyWebhookSignature: verify,
    });

    const req = makeRequest(JSON.stringify({ data: { to: ['x@acme.contractorhub.io'] } }));
    const res = await POST(req, {
      params: Promise.resolve({ provider: 'resend' }),
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as { received?: boolean };
    expect(json.received).toBe(true);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 'org-cuid-acme',
        }),
      }),
    );
  });

  it('stores PENDING organizationId when Resend verification omits orgId', async () => {
    mockGetAdapter.mockReturnValue({
      slug: 'resend',
      supportsWebhooks: true,
      verifyWebhookSignature: vi.fn(() => ({
        valid: true,
        eventType: 'email.received',
      })),
    });

    const req = makeRequest('{}');
    const res = await POST(req, {
      params: Promise.resolve({ provider: 'resend' }),
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as { received?: boolean };
    expect(json.received).toBe(true);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 'PENDING',
        }),
      }),
    );
  });
});
