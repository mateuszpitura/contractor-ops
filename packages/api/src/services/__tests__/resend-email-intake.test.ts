import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mock variables
// ---------------------------------------------------------------------------

const { mockR2Send, mockAttachmentsGet, mockFetch } = vi.hoisted(() => ({
  mockR2Send: vi.fn().mockResolvedValue({}),
  mockAttachmentsGet: vi.fn(),
  mockFetch: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../r2', () => ({
  createR2Client: vi.fn().mockReturnValue({ send: mockR2Send }),
  getR2BucketName: vi.fn().mockReturnValue('test-bucket'),
}));

vi.mock('../resend-client', () => ({
  getResend: vi.fn().mockReturnValue({
    emails: {
      receiving: {
        attachments: {
          get: mockAttachmentsGet,
        },
      },
    },
  }),
}));

// Mock global fetch for download URLs
vi.stubGlobal('fetch', mockFetch);

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import {
  checkResendEmailIntakeRateLimit,
  processResendEmailReceivedAttachments,
  processResendWebhookDelivery,
  RESEND_EMAIL_RATE_MAX_PER_HOUR,
} from '../resend-email-intake';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePrisma() {
  return {
    document: {
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
        id: `doc-${Math.random().toString(36).slice(2, 8)}`,
        ...data,
      })),
    },
    invoice: {
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
        id: `inv-${Math.random().toString(36).slice(2, 8)}`,
        ...data,
      })),
    },
    invoiceFile: {
      create: vi.fn().mockResolvedValue({}),
    },
    documentLink: {
      create: vi.fn().mockResolvedValue({}),
    },
  } as never;
}

function makeEmailData(overrides: Record<string, unknown> = {}) {
  return {
    from: 'vendor@example.com',
    email_id: 'email-001',
    to: ['invoices@myorg.contractor-ops.app'],
    attachments: [
      { id: 'att-pdf-1', content_type: 'application/pdf', filename: 'invoice.pdf', size: 1024 },
    ],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

describe('checkResendEmailIntakeRateLimit', () => {
  it('allows requests under the limit and returns remaining count', () => {
    // Use unique org ID per test to avoid cross-test pollution
    const orgId = `org-rate-under-${Date.now()}`;
    const result = checkResendEmailIntakeRateLimit(orgId);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(RESEND_EMAIL_RATE_MAX_PER_HOUR - 1);
  });

  it('blocks requests over the limit', () => {
    const orgId = `org-rate-over-${Date.now()}`;

    // Fill up to the limit
    for (let i = 0; i < RESEND_EMAIL_RATE_MAX_PER_HOUR; i++) {
      checkResendEmailIntakeRateLimit(orgId);
    }

    // Next request should be blocked
    const result = checkResendEmailIntakeRateLimit(orgId);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('returns correct remaining count', () => {
    const orgId = `org-rate-count-${Date.now()}`;

    const first = checkResendEmailIntakeRateLimit(orgId);
    expect(first.remaining).toBe(RESEND_EMAIL_RATE_MAX_PER_HOUR - 1);

    const second = checkResendEmailIntakeRateLimit(orgId);
    expect(second.remaining).toBe(RESEND_EMAIL_RATE_MAX_PER_HOUR - 2);
  });
});

describe('processResendEmailReceivedAttachments', () => {
  it('processes PDF attachments, creates Document + Invoice', async () => {
    const prisma = makePrisma();
    const emailData = makeEmailData();

    mockAttachmentsGet.mockResolvedValue({
      data: {
        download_url: 'https://r2.test/download/invoice.pdf',
        filename: 'invoice.pdf',
        content_type: 'application/pdf',
        size: 1024,
      },
    });
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)),
    });

    const result = await processResendEmailReceivedAttachments(prisma, 'org-1', emailData);

    expect(result.processedCount).toBe(1);
    expect(
      (prisma as Record<string, Record<string, ReturnType<typeof vi.fn>>>).document.create,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 'org-1',
          mimeType: 'application/pdf',
          documentType: 'INVOICE',
          source: 'EMAIL_INTAKE',
        }),
      }),
    );
    expect(
      (prisma as Record<string, Record<string, ReturnType<typeof vi.fn>>>).invoice.create,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 'org-1',
          source: 'EMAIL_INTAKE',
          status: 'RECEIVED',
          submittedByEmail: 'vendor@example.com',
        }),
      }),
    );
    expect(
      (prisma as Record<string, Record<string, ReturnType<typeof vi.fn>>>).invoiceFile.create,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          role: 'SOURCE_ORIGINAL',
        }),
      }),
    );
  });

  it('returns processedCount 0 when no PDF attachments', async () => {
    const prisma = makePrisma();
    const emailData = makeEmailData({
      attachments: [
        { id: 'att-jpg-1', content_type: 'image/jpeg', filename: 'photo.jpg', size: 500 },
      ],
    });

    const result = await processResendEmailReceivedAttachments(prisma, 'org-1', emailData);

    expect(result.processedCount).toBe(0);
  });

  it('returns processedCount 0 when no email_id', async () => {
    const prisma = makePrisma();
    const emailData = makeEmailData({ email_id: undefined });

    const result = await processResendEmailReceivedAttachments(prisma, 'org-1', emailData);

    expect(result.processedCount).toBe(0);
  });

  it('handles non-PDF as supporting docs alongside PDF', async () => {
    const prisma = makePrisma();
    const emailData = makeEmailData({
      attachments: [
        { id: 'att-pdf-1', content_type: 'application/pdf', filename: 'invoice.pdf', size: 1024 },
        {
          id: 'att-xlsx-1',
          content_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          filename: 'breakdown.xlsx',
          size: 2048,
        },
      ],
    });

    // Mock for PDF attachment
    mockAttachmentsGet.mockImplementation(({ id }: { id: string }) => {
      if (id === 'att-pdf-1') {
        return Promise.resolve({
          data: {
            download_url: 'https://r2.test/invoice.pdf',
            filename: 'invoice.pdf',
            content_type: 'application/pdf',
            size: 1024,
          },
        });
      }
      return Promise.resolve({
        data: {
          download_url: 'https://r2.test/breakdown.xlsx',
          filename: 'breakdown.xlsx',
          content_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          size: 2048,
        },
      });
    });
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)),
    });

    const result = await processResendEmailReceivedAttachments(prisma, 'org-1', emailData);

    expect(result.processedCount).toBe(1);
    // Should have created supporting attachment document with SUPPORTING_ATTACHMENT role
    const invoiceFileCreateCalls = (
      prisma as Record<string, Record<string, ReturnType<typeof vi.fn>>>
    ).invoiceFile.create.mock.calls;
    const roles = invoiceFileCreateCalls.map(
      (c: Array<{ data: { role: string } }>) => c[0].data.role,
    );
    expect(roles).toContain('SOURCE_ORIGINAL');
    expect(roles).toContain('SUPPORTING_ATTACHMENT');
  });
});

describe('processResendWebhookDelivery', () => {
  it('filters for email.received only, returns 0 for other event types', async () => {
    const prisma = makePrisma();

    const result = await processResendWebhookDelivery(prisma, {
      organizationId: 'org-1',
      eventType: 'email.bounced',
      payloadJson: { type: 'email.bounced', data: {} },
    });

    expect(result.processedCount).toBe(0);
  });

  it('throws when organizationId is missing', async () => {
    const prisma = makePrisma();

    await expect(
      processResendWebhookDelivery(prisma, {
        organizationId: '',
        eventType: 'email.received',
        payloadJson: { type: 'email.received', data: makeEmailData() },
      }),
    ).rejects.toThrow('organizationId');
  });

  it('throws when rate limit is exceeded', async () => {
    const prisma = makePrisma();
    const orgId = `org-webhook-rate-${Date.now()}`;

    // Fill up the rate limit
    for (let i = 0; i < RESEND_EMAIL_RATE_MAX_PER_HOUR; i++) {
      checkResendEmailIntakeRateLimit(orgId);
    }

    await expect(
      processResendWebhookDelivery(prisma, {
        organizationId: orgId,
        eventType: 'email.received',
        payloadJson: { type: 'email.received', data: makeEmailData() },
      }),
    ).rejects.toThrow('rate limit');
  });

  it('delegates to processAttachments for email.received events', async () => {
    const prisma = makePrisma();
    const orgId = `org-webhook-ok-${Date.now()}`;
    const emailData = makeEmailData();

    mockAttachmentsGet.mockResolvedValue({
      data: {
        download_url: 'https://r2.test/download/invoice.pdf',
        filename: 'invoice.pdf',
        content_type: 'application/pdf',
        size: 1024,
      },
    });
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)),
    });

    const result = await processResendWebhookDelivery(prisma, {
      organizationId: orgId,
      eventType: 'email.received',
      payloadJson: { type: 'email.received', data: emailData },
    });

    expect(result.processedCount).toBe(1);
  });

  it('returns 0 when payload data is missing', async () => {
    const prisma = makePrisma();
    const orgId = `org-webhook-nodata-${Date.now()}`;

    const result = await processResendWebhookDelivery(prisma, {
      organizationId: orgId,
      eventType: 'email.received',
      payloadJson: { type: 'email.received' },
    });

    expect(result.processedCount).toBe(0);
  });
});
