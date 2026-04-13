/** @vitest-environment node */

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockFindUniqueOrThrow,
  mockFindFirst,
  mockUpdate,
  mockGetCredentials,
  mockParseWebhookPayload,
  mockProcessInboundInvoice,
} = vi.hoisted(() => ({
  mockFindUniqueOrThrow: vi.fn(),
  mockFindFirst: vi.fn(),
  mockUpdate: vi.fn(),
  mockGetCredentials: vi.fn(),
  mockParseWebhookPayload: vi.fn(),
  mockProcessInboundInvoice: vi.fn(),
}));

vi.mock('@upstash/qstash/nextjs', () => ({
  verifySignatureAppRouter: (fn: (req: NextRequest) => Promise<Response>) => fn,
}));

vi.mock('@contractor-ops/db', () => ({
  prisma: {
    webhookDelivery: {
      findUniqueOrThrow: mockFindUniqueOrThrow,
      update: mockUpdate,
    },
    integrationConnection: {
      findFirst: mockFindFirst,
    },
  },
}));

vi.mock('@contractor-ops/integrations', () => ({
  getCredentials: mockGetCredentials,
}));

vi.mock('@contractor-ops/einvoice', () => ({
  StorecoveAdapter: class {
    parseWebhookPayload = mockParseWebhookPayload;
  },
}));

vi.mock('@contractor-ops/api/services/peppol-orchestrator', () => ({
  PeppolOrchestrator: class {
    processInboundInvoice = mockProcessInboundInvoice;
  },
}));

import { POST } from '../route';

function postJson(body: unknown) {
  return new NextRequest('http://localhost/api/peppol/inbound', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

describe('POST /api/peppol/inbound', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockFindUniqueOrThrow.mockResolvedValue({
      id: 'del-1',
      payloadJson: { invoice: 'data' },
    });

    mockFindFirst.mockResolvedValue({
      id: 'conn-1',
      organizationId: 'org-1',
      credentialsRef: 'ref-1',
      configJson: { environment: 'sandbox' },
    });

    mockGetCredentials.mockResolvedValue({ accessToken: 'tok-123' });
    mockParseWebhookPayload.mockResolvedValue({ type: 'invoice', data: {} });
    mockProcessInboundInvoice.mockResolvedValue({ invoice: { id: 'inv-1' } });
    mockUpdate.mockResolvedValue({});
  });

  it('returns 400 when deliveryId or organizationId is missing', async () => {
    const res = await POST(postJson({ deliveryId: 'del-1' }));
    expect(res.status).toBe(400);
    expect((await res.json()) as { error: string }).toMatchObject({
      error: expect.stringContaining('Missing'),
    });
  });

  it('returns error when no active Peppol connection exists', async () => {
    mockFindFirst.mockResolvedValue(null);

    const res = await POST(postJson({ deliveryId: 'del-1', organizationId: 'org-1' }));
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe('No Peppol connection');
  });

  it('returns processed:true on success', async () => {
    const res = await POST(postJson({ deliveryId: 'del-1', organizationId: 'org-1' }));

    expect(res.status).toBe(200);
    const json = (await res.json()) as { processed: boolean; invoiceId: string; skipped: boolean };
    expect(json.processed).toBe(true);
    expect(json.invoiceId).toBe('inv-1');
    expect(json.skipped).toBe(false);

    expect(mockFindUniqueOrThrow).toHaveBeenCalledWith({ where: { id: 'del-1' } });
    expect(mockGetCredentials).toHaveBeenCalledWith('ref-1', 'peppol');
    expect(mockProcessInboundInvoice).toHaveBeenCalledWith({
      payload: { type: 'invoice', data: {} },
      organizationId: 'org-1',
    });

    // Verify delivery marked as PROCESSED
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'del-1' },
        data: expect.objectContaining({ deliveryStatus: 'PROCESSED' }),
      }),
    );
  });

  it('returns skipped:true when orchestrator returns null', async () => {
    mockProcessInboundInvoice.mockResolvedValue(null);

    const res = await POST(postJson({ deliveryId: 'del-1', organizationId: 'org-1' }));

    const json = (await res.json()) as { processed: boolean; invoiceId: null; skipped: boolean };
    expect(json.processed).toBe(true);
    expect(json.invoiceId).toBeNull();
    expect(json.skipped).toBe(true);
  });

  it('returns 500 and marks delivery FAILED when processing throws', async () => {
    mockProcessInboundInvoice.mockRejectedValueOnce(new Error('parse error'));

    const res = await POST(postJson({ deliveryId: 'del-1', organizationId: 'org-1' }));

    expect(res.status).toBe(500);
    expect((await res.json()) as { error: string }).toMatchObject({
      error: 'Inbound processing failed',
    });

    // Verify delivery marked as FAILED
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'del-1' },
        data: expect.objectContaining({
          deliveryStatus: 'FAILED',
          errorMessage: 'parse error',
        }),
      }),
    );
  });
});
