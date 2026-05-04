/**
 * Late-payment claim PDF worker — lifecycle tests.
 *
 * These exercise the service that the QStash callback invokes:
 *
 *   - Success path:  PENDING_RENDER → READY, pdfKey populated.
 *   - Failure path:  PENDING_RENDER → FAILED, pdfError populated, re-throws
 *                    so QStash retries per its configured retry policy.
 *   - Idempotency:   if a row is already READY, the render is skipped and
 *                    the existing pdfKey is returned (no new R2 write).
 *   - Missing row:   throws a NOT FOUND-ish error (QStash will retry, but
 *                    a missing row means the claim was deleted — eventual
 *                    give-up is fine).
 *
 * We mock Prisma, R2, and @react-pdf/renderer so the test runs without a
 * DB / without burning an actual PDF render.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPrisma, mockR2, mockRenderer } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type AnyRec = Record<string, any>;

  const mockPrisma: AnyRec = {
    invoiceInterestClaim: {
      findUnique: vi.fn(),
      update: vi.fn(async (opts: { where: AnyRec; data: AnyRec }) => ({
        id: opts.where.id,
        ...opts.data,
      })),
    },
  };

  const mockR2 = {
    putObjectAndSignDownload: vi.fn(async () => ({
      signedUrl: 'https://r2/signed',
    })),
  };

  const mockRenderer = {
    renderToBuffer: vi.fn(async () => Buffer.from('pdf-bytes')),
  };

  return { mockPrisma, mockR2, mockRenderer };
});

vi.mock('@contractor-ops/db', () => ({
  withRlsTransactions: <T,>(c: T) => c,
  prisma: mockPrisma,
}));

vi.mock('@contractor-ops/logger', () => ({
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), fatal: vi.fn(), trace: vi.fn(), child: vi.fn() })),
  createTrpcLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createWebhookLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createCronLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createIntegrationLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
  withBodyLogging: vi.fn((_o, fn) => fn),
  logIntegrationCall: vi.fn(),
  subscribeOpossumEvents: vi.fn(),
  runWithRequestContext: vi.fn((_c, fn) => fn()),
  getRequestId: vi.fn(() => undefined),
  getTraceparent: vi.fn(() => undefined),
  buildContextFromHeaders: vi.fn(() => ({})),
  getOutboundHeaders: vi.fn(() => ({})),
  generateRequestId: vi.fn(() => 'test-request-id'),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  LOG_BODY_INCLUDE_PREFIXES: [],
  PII_MASK_KEYWORDS: [],
  PII_MASK_PATHS: [],
  createIntegrationLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: {
    increment: vi.fn(),
    gauge: vi.fn(),
  },
}));

vi.mock('../r2.js', () => mockR2);

vi.mock('@react-pdf/renderer', () => mockRenderer);

vi.mock('../../pdf-templates/late-payment-claim.js', () => ({
  LatePaymentClaimTemplate: vi.fn(() => ({ _template: 'late-payment-claim' })),
}));

// Imported after mocks are registered.
const { renderClaimPdf } = await import('../late-payment-claim-pdf.js');

const CLAIM_ID = 'clclaim00000000000000000001';
const ORG_ID = 'clorg00000000000000000001';
const INVOICE_ID = 'clinvoice00000000000000001';

function makeClaim(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: CLAIM_ID,
    organizationId: ORG_ID,
    invoiceId: INVOICE_ID,
    pdfStatus: 'PENDING_RENDER',
    pdfKey: null,
    pdfError: null,
    pdfReadyAt: null,
    claimedAt: new Date('2026-04-01T00:00:00Z'),
    snapshotInterestMinor: 12345,
    snapshotCompensationMinor: 4000,
    snapshotRateUsed: '8.62',
    snapshotDaysOverdue: 45,
    invoice: {
      id: INVOICE_ID,
      invoiceNumber: 'INV-2026-001',
      dueDate: new Date('2026-02-15T00:00:00Z'),
    },
    organization: { id: ORG_ID, name: 'Acme GmbH' },
    ...overrides,
  };
}

beforeEach(() => {
  mockPrisma.invoiceInterestClaim.findUnique.mockReset();
  mockPrisma.invoiceInterestClaim.update.mockClear();
  mockR2.putObjectAndSignDownload.mockClear();
  mockRenderer.renderToBuffer.mockClear();
});

describe('renderClaimPdf', () => {
  describe('success path', () => {
    it('renders PDF, uploads to R2, and flips pdfStatus to READY', async () => {
      mockPrisma.invoiceInterestClaim.findUnique.mockResolvedValue(makeClaim());

      const result = await renderClaimPdf(CLAIM_ID);

      expect(result.skipped).toBe(false);
      expect(result.claimId).toBe(CLAIM_ID);
      expect(result.pdfKey).toMatch(
        new RegExp(`^late-interest-claims/${ORG_ID}/${INVOICE_ID}/${CLAIM_ID}\\.pdf$`),
      );

      // R2 put happened with PDF content type.
      expect(mockR2.putObjectAndSignDownload).toHaveBeenCalledTimes(1);
      const r2Call = mockR2.putObjectAndSignDownload.mock.calls[0][0];
      expect(r2Call.contentType).toBe('application/pdf');
      expect(r2Call.body).toBeInstanceOf(Buffer);

      // Status flipped READY with pdfReadyAt + cleared error.
      const updateCall = mockPrisma.invoiceInterestClaim.update.mock.calls[0][0];
      expect(updateCall.where).toEqual({ id: CLAIM_ID });
      expect(updateCall.data.pdfStatus).toBe('READY');
      expect(updateCall.data.pdfError).toBeNull();
      expect(updateCall.data.pdfReadyAt).toBeInstanceOf(Date);
      expect(updateCall.data.pdfKey).toBe(result.pdfKey);
    });
  });

  describe('idempotent skip when already READY', () => {
    it('returns existing pdfKey without re-rendering or re-uploading', async () => {
      const existingKey = 'late-interest-claims/pre-existing.pdf';
      mockPrisma.invoiceInterestClaim.findUnique.mockResolvedValue(
        makeClaim({ pdfStatus: 'READY', pdfKey: existingKey }),
      );

      const result = await renderClaimPdf(CLAIM_ID);

      expect(result).toEqual({ claimId: CLAIM_ID, pdfKey: existingKey, skipped: true });
      expect(mockRenderer.renderToBuffer).not.toHaveBeenCalled();
      expect(mockR2.putObjectAndSignDownload).not.toHaveBeenCalled();
      expect(mockPrisma.invoiceInterestClaim.update).not.toHaveBeenCalled();
    });
  });

  describe('failure path', () => {
    it('on R2 failure, flips pdfStatus to FAILED, records pdfError, and re-throws', async () => {
      mockPrisma.invoiceInterestClaim.findUnique.mockResolvedValue(makeClaim());
      mockR2.putObjectAndSignDownload.mockRejectedValueOnce(new Error('R2 bucket unavailable'));

      await expect(renderClaimPdf(CLAIM_ID)).rejects.toThrow('R2 bucket unavailable');

      // Row was updated to FAILED with the truncated error message.
      const updateCall = mockPrisma.invoiceInterestClaim.update.mock.calls[0][0];
      expect(updateCall.where).toEqual({ id: CLAIM_ID });
      expect(updateCall.data.pdfStatus).toBe('FAILED');
      expect(updateCall.data.pdfError).toContain('R2 bucket unavailable');
    });

    it('truncates pdfError to 1000 chars to keep the DB column bounded', async () => {
      mockPrisma.invoiceInterestClaim.findUnique.mockResolvedValue(makeClaim());
      const hugeMessage = 'x'.repeat(5000);
      mockR2.putObjectAndSignDownload.mockRejectedValueOnce(new Error(hugeMessage));

      await expect(renderClaimPdf(CLAIM_ID)).rejects.toThrow();

      const updateCall = mockPrisma.invoiceInterestClaim.update.mock.calls[0][0];
      expect(updateCall.data.pdfError.length).toBeLessThanOrEqual(1000);
    });

    it('on render failure, propagates error and does not attempt R2 upload', async () => {
      mockPrisma.invoiceInterestClaim.findUnique.mockResolvedValue(makeClaim());
      mockRenderer.renderToBuffer.mockRejectedValueOnce(new Error('react-pdf render crashed'));

      await expect(renderClaimPdf(CLAIM_ID)).rejects.toThrow('react-pdf render crashed');
      expect(mockR2.putObjectAndSignDownload).not.toHaveBeenCalled();
    });
  });

  describe('missing row', () => {
    it('throws when findUnique returns null (claim was deleted)', async () => {
      mockPrisma.invoiceInterestClaim.findUnique.mockResolvedValue(null);

      await expect(renderClaimPdf(CLAIM_ID)).rejects.toThrow(/not found/i);
      expect(mockRenderer.renderToBuffer).not.toHaveBeenCalled();
      expect(mockR2.putObjectAndSignDownload).not.toHaveBeenCalled();
      expect(mockPrisma.invoiceInterestClaim.update).not.toHaveBeenCalled();
    });
  });
});
