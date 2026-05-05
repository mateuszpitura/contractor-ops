/** @vitest-environment node */

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockFindFirst, mockGetCredentials, mockSubmitOutboundInvoice } = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
  mockGetCredentials: vi.fn(),
  mockSubmitOutboundInvoice: vi.fn(),
}));

vi.mock('@upstash/qstash/nextjs', () => ({
  verifySignatureAppRouter: (fn: (req: NextRequest) => Promise<Response>) => fn,
}));

// F-SCALE-19 — backpressure helper reads server env at module load; bypass in tests.
vi.mock('@contractor-ops/api/services/qstash-backpressure', () => ({
  withBackpressure: <T,>(_routeKey: string, _max: number, fn: () => Promise<T>) => fn(),
  BackpressureRejectedError: class BackpressureRejectedError extends Error {},
  isBackpressureRejected: (_e: unknown) => false,
  BackpressureRoutes: {
    EXPORTS_PROCESS: { key: 'exports-process', max: 5 },
    OCR_PROCESS: { key: 'ocr-process', max: 10 },
    PEPPOL_OUTBOUND: { key: 'peppol-outbound', max: 3 },
    LATE_INTEREST_RENDER: { key: 'late-interest-render-claim-pdf', max: 5 },
  },
}));

vi.mock('@contractor-ops/db', () => ({
  prisma: {
    integrationConnection: {
      findFirst: mockFindFirst,
    },
  },
}));

vi.mock('@contractor-ops/integrations', () => ({
  getCredentials: mockGetCredentials,
}));

vi.mock('@contractor-ops/einvoice', () => ({
  StorecoveAdapter: class {},
}));

vi.mock('@contractor-ops/api/services/peppol-orchestrator', () => ({
  PeppolOrchestrator: class {
    submitOutboundInvoice = mockSubmitOutboundInvoice;
  },
}));

import { POST } from '../route';

function postJson(body: unknown) {
  return new NextRequest('http://localhost/api/peppol/outbound', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

describe('POST /api/peppol/outbound', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockFindFirst.mockResolvedValue({
      id: 'conn-1',
      organizationId: 'org-1',
      credentialsRef: 'ref-1',
      configJson: { environment: 'sandbox' },
    });

    mockGetCredentials.mockResolvedValue({ accessToken: 'tok-123' });
    mockSubmitOutboundInvoice.mockResolvedValue({ id: 'tx-1' });
  });

  it('returns 400 when required fields are missing', async () => {
    const res = await POST(postJson({ organizationId: 'org-1', invoiceId: 'inv-1' }));
    expect(res.status).toBe(400);
    expect((await res.json()) as { error: string }).toMatchObject({
      error: expect.stringContaining('Missing'),
    });
  });

  it('returns error when no active Peppol connection exists', async () => {
    mockFindFirst.mockResolvedValue(null);

    const res = await POST(
      postJson({
        organizationId: 'org-1',
        invoiceId: 'inv-1',
        receiverParticipantId: 'rcv-1',
      }),
    );

    const json = (await res.json()) as { error: string };
    expect(json.error).toBe('No Peppol connection');
  });

  it('returns processed:true with transmissionId on success', async () => {
    const res = await POST(
      postJson({
        organizationId: 'org-1',
        invoiceId: 'inv-1',
        receiverParticipantId: 'rcv-1',
      }),
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as { processed: boolean; transmissionId: string };
    expect(json.processed).toBe(true);
    expect(json.transmissionId).toBe('tx-1');

    expect(mockGetCredentials).toHaveBeenCalledWith('ref-1', 'peppol');
    expect(mockSubmitOutboundInvoice).toHaveBeenCalledWith({
      organizationId: 'org-1',
      invoiceId: 'inv-1',
      receiverParticipantId: 'rcv-1',
    });
  });

  it('returns 200 with error message when orchestrator throws (no QStash retry)', async () => {
    mockSubmitOutboundInvoice.mockRejectedValueOnce(new Error('validation failed'));

    const res = await POST(
      postJson({
        organizationId: 'org-1',
        invoiceId: 'inv-1',
        receiverParticipantId: 'rcv-1',
      }),
    );

    // Returns 200 to prevent QStash retry on business errors
    expect(res.status).toBe(200);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe('validation failed');
  });
});
