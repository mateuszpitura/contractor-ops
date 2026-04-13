/** @vitest-environment node */

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCheckRateLimit, mockProcessAttachments, mockResendVerify, mockPrisma } = vi.hoisted(
  () => {
    const mockCheckRateLimit = vi.fn();
    const mockProcessAttachments = vi.fn();
    const mockResendVerify = vi.fn();
    const mockPrisma = {
      organization: {
        findFirst: vi.fn(),
      },
    };
    return { mockCheckRateLimit, mockProcessAttachments, mockResendVerify, mockPrisma };
  },
);

vi.mock('@contractor-ops/api/services/resend-email-intake', () => ({
  checkResendEmailIntakeRateLimit: mockCheckRateLimit,
  processResendEmailReceivedAttachments: mockProcessAttachments,
  RESEND_EMAIL_RATE_MAX_PER_HOUR: 100,
}));

vi.mock('@contractor-ops/db', () => ({
  prisma: mockPrisma,
}));

vi.mock('resend', () => ({
  Resend: class {
    webhooks = { verify: mockResendVerify };
  },
}));

import { POST } from '../route';

describe('POST /api/webhooks/resend-inbound', () => {
  const emailReceivedEvent = {
    type: 'email.received',
    data: {
      to: ['invoices@acme.contractorhub.io'],
      from: 'vendor@example.com',
      subject: 'Invoice #42',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RESEND_WEBHOOK_SECRET = 'whsec_test';
    process.env.RESEND_API_KEY = 'rk_test';

    mockResendVerify.mockReturnValue(emailReceivedEvent);
    mockPrisma.organization.findFirst.mockResolvedValue({ id: 'org-acme', slug: 'acme' });
    mockCheckRateLimit.mockReturnValue({ allowed: true });
    mockProcessAttachments.mockResolvedValue({ processedCount: 2 });
  });

  it('processes a valid email.received webhook and returns processed count', async () => {
    const req = new NextRequest('http://localhost/api/webhooks/resend-inbound', {
      method: 'POST',
      body: JSON.stringify(emailReceivedEvent),
      headers: {
        'svix-id': 'msg_123',
        'svix-timestamp': '1234567890',
        'svix-signature': 'v1=abc',
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = (await res.json()) as { processed: boolean; count: number };
    expect(json).toEqual({ processed: true, count: 2 });
    expect(mockProcessAttachments).toHaveBeenCalledWith(
      mockPrisma,
      'org-acme',
      emailReceivedEvent.data,
    );
  });

  it('returns 401 when svix signature headers are missing', async () => {
    const req = new NextRequest('http://localhost/api/webhooks/resend-inbound', {
      method: 'POST',
      body: JSON.stringify(emailReceivedEvent),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);

    const json = (await res.json()) as { error: string };
    expect(json.error).toBe('Missing webhook signature headers');
  });

  it('returns 401 when signature verification fails', async () => {
    mockResendVerify.mockImplementation(() => {
      throw new Error('Invalid signature');
    });

    const req = new NextRequest('http://localhost/api/webhooks/resend-inbound', {
      method: 'POST',
      body: JSON.stringify(emailReceivedEvent),
      headers: {
        'svix-id': 'msg_123',
        'svix-timestamp': '1234567890',
        'svix-signature': 'v1=bad',
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(401);

    const json = (await res.json()) as { error: string };
    expect(json.error).toBe('Invalid signature');
  });

  it('returns 429 when rate limit is exceeded', async () => {
    mockCheckRateLimit.mockReturnValue({ allowed: false });

    const req = new NextRequest('http://localhost/api/webhooks/resend-inbound', {
      method: 'POST',
      body: JSON.stringify(emailReceivedEvent),
      headers: {
        'svix-id': 'msg_123',
        'svix-timestamp': '1234567890',
        'svix-signature': 'v1=abc',
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(429);

    const json = (await res.json()) as { error: string };
    expect(json.error).toBe('Email intake rate limit exceeded');
  });

  it('returns 200 with received:true when org slug cannot be found', async () => {
    mockPrisma.organization.findFirst.mockResolvedValue(null);

    const req = new NextRequest('http://localhost/api/webhooks/resend-inbound', {
      method: 'POST',
      body: JSON.stringify(emailReceivedEvent),
      headers: {
        'svix-id': 'msg_123',
        'svix-timestamp': '1234567890',
        'svix-signature': 'v1=abc',
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = (await res.json()) as { received: boolean };
    expect(json.received).toBe(true);
    expect(mockProcessAttachments).not.toHaveBeenCalled();
  });

  it('returns 500 when RESEND_WEBHOOK_SECRET is not set', async () => {
    delete process.env.RESEND_WEBHOOK_SECRET;

    const req = new NextRequest('http://localhost/api/webhooks/resend-inbound', {
      method: 'POST',
      body: JSON.stringify(emailReceivedEvent),
    });

    const res = await POST(req);
    expect(res.status).toBe(500);
  });
});
