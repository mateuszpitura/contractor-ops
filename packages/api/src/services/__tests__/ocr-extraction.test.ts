import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockCreate,
  mockUpdate,
  mockUpdateMany,
  mockFindFirst,
  mockDocumentFindFirst,
  mockOrgFindUnique,
  mockCheckCredit,
  mockPublishJSON,
  mockPresignedUrl,
  mockExtractInvoice,
  mockEvaluate,
} = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockUpdateMany: vi.fn(),
  mockFindFirst: vi.fn(),
  mockDocumentFindFirst: vi.fn(),
  mockOrgFindUnique: vi.fn(),
  mockCheckCredit: vi.fn(),
  mockPublishJSON: vi.fn(),
  mockPresignedUrl: vi.fn(),
  mockExtractInvoice: vi.fn(),
  mockEvaluate: vi.fn(),
}));

const mockDb = {
  document: { findFirst: mockDocumentFindFirst },
  ocrExtraction: { create: mockCreate },
};

const mockGetQStashClient = vi.hoisted(() => vi.fn(() => ({ publishJSON: mockPublishJSON })));

vi.mock('@contractor-ops/db', () => {
  const MockDbPrisma = {
    ocrExtraction: {
      create: mockCreate,
      update: mockUpdate,
      updateMany: mockUpdateMany,
      findFirst: mockFindFirst,
    },
    organization: {
      findUnique: mockOrgFindUnique,
    },
  };
  return {
    withRlsTransactions: <T>(c: T) => c,
    withRlsReads: <T>(c: T) => c,
    prisma: MockDbPrisma,
    prismaRaw: MockDbPrisma,
  };
});

vi.mock('@contractor-ops/feature-flags', () => ({
  evaluate: mockEvaluate,
}));

vi.mock('@contractor-ops/logger', () => ({
  getIdpAuditLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(),
  })),
  createTrpcLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createWebhookLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createCronLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
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
  createLogger: () => ({ info: vi.fn(), error: vi.fn() }),
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { increment: vi.fn(), distribution: vi.fn() },
}));

vi.mock('@sentry/node', () => ({
  getCurrentScope: vi.fn(() => ({
    setUser: vi.fn(),
    setTag: vi.fn(),
    setTags: vi.fn(),
    setContext: vi.fn(),
    setExtra: vi.fn(),
    clear: vi.fn(),
  })),
  setUser: vi.fn(),
  setTag: vi.fn(),
  setTags: vi.fn(),
  setContext: vi.fn(),
  captureException: vi.fn(),
}));

vi.mock('@contractor-ops/integrations/services/qstash-client', () => ({
  getQStashClient: mockGetQStashClient,
}));

vi.mock('../credit-service', () => ({
  checkAndDeductCredit: mockCheckCredit,
}));

vi.mock('../regional-storage', () => ({
  createRegionalPresignedDownloadUrl: mockPresignedUrl,
}));

vi.mock('@contractor-ops/integrations/services/ocr-service', () => ({
  extractInvoice: mockExtractInvoice,
}));

import {
  getExtractionByDocument,
  getExtractionResult,
  processOcrExtraction,
  triggerOcrExtraction,
} from '../ocr-extraction';

describe('ocr-extraction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('API_URL', 'https://api.test');
    mockCheckCredit.mockResolvedValue({
      allowed: true,
      remaining: 50,
      reason: undefined,
      stripeCustomerId: 'cus_1',
    });
    mockCreate.mockResolvedValue({ id: 'ext-new' });
    mockPublishJSON.mockResolvedValue(undefined);
    mockPresignedUrl.mockResolvedValue('https://r2.test/signed');
    mockExtractInvoice.mockResolvedValue({
      status: 'EXTRACTED',
      fields: {},
      lineItems: [],
      processingTimeMs: 12,
      pageCount: 1,
      overallConfidence: 90,
    });
    mockUpdate.mockResolvedValue({});
    mockUpdateMany.mockResolvedValue({ count: 1 });
    mockOrgFindUnique.mockResolvedValue({ dataRegion: 'EU' });
    mockEvaluate.mockReturnValue({ enabled: true, reason: 'unleash' });
    mockDocumentFindFirst.mockResolvedValue({ storageKey: 'k/pdf' });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  describe('triggerOcrExtraction', () => {
    it('returns credit error when checkAndDeductCredit blocks', async () => {
      mockCheckCredit.mockResolvedValueOnce({
        allowed: false,
        remaining: 0,
        reason: 'noSubscription',
        stripeCustomerId: null,
      });

      const out = await triggerOcrExtraction({
        db: mockDb,
        organizationId: 'org-1',
        documentId: 'doc-1',
      });

      expect(out).toEqual({ error: 'noSubscription', remaining: 0 });
      expect(mockCreate).not.toHaveBeenCalled();
      expect(mockPublishJSON).not.toHaveBeenCalled();
    });

    it('creates extraction, publishes QStash job, returns extractionId', async () => {
      const out = await triggerOcrExtraction({
        db: mockDb,
        organizationId: 'org-1',
        documentId: 'doc-1',
        invoiceId: 'inv-1',
      });

      expect(out).toEqual({ extractionId: 'ext-new' });
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: 'org-1',
            documentId: 'doc-1',
            invoiceId: 'inv-1',
            status: 'PENDING',
          }),
        }),
      );
      expect(mockGetQStashClient).toHaveBeenCalled();
      expect(mockPublishJSON).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://api.test/ocr/_process',
          body: {
            extractionId: 'ext-new',
            organizationId: 'org-1',
            storageKey: 'k/pdf',
          },
          deduplicationId: 'ocr-extraction:ext-new',
          retries: 2,
          timeout: '60s',
        }),
      );
    });

    it('throws NOT_FOUND when document is missing or has no storageKey', async () => {
      mockDocumentFindFirst.mockResolvedValueOnce(null);

      await expect(
        triggerOcrExtraction({
          db: mockDb,
          organizationId: 'org-1',
          documentId: 'doc-missing',
        }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });

      expect(mockCheckCredit).not.toHaveBeenCalled();
      expect(mockCreate).not.toHaveBeenCalled();
      expect(mockPublishJSON).not.toHaveBeenCalled();
    });
  });

  describe('processOcrExtraction', () => {
    it('claims the row via compare-and-swap on PENDING only', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          statusText: 'OK',
          arrayBuffer: () => Promise.resolve(new Uint8Array([1, 2, 3]).buffer),
        }),
      );

      await processOcrExtraction({
        extractionId: 'ext-1',
        organizationId: 'org-1',
        storageKey: 'path/doc.pdf',
      });

      expect(mockUpdateMany).toHaveBeenCalledWith({
        where: { id: 'ext-1', status: 'PENDING' },
        data: { status: 'PROCESSING' },
      });
    });

    it('aborts a redelivery when the row is no longer PENDING (no second extraction)', async () => {
      mockUpdateMany.mockResolvedValueOnce({ count: 0 });
      const fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);

      await processOcrExtraction({
        extractionId: 'ext-done',
        organizationId: 'org-1',
        storageKey: 'path/doc.pdf',
      });

      // Claim failed → no Claude Vision call, no PDF fetch, and the completed
      // result is never clobbered back to PROCESSING.
      expect(mockExtractInvoice).not.toHaveBeenCalled();
      expect(mockPresignedUrl).not.toHaveBeenCalled();
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('updates extraction with OCR result on success', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          statusText: 'OK',
          arrayBuffer: () => Promise.resolve(new Uint8Array([1, 2, 3]).buffer),
        }),
      );

      await processOcrExtraction({
        extractionId: 'ext-1',
        organizationId: 'org-1',
        storageKey: 'path/doc.pdf',
      });

      expect(mockPresignedUrl).toHaveBeenCalledWith('path/doc.pdf', 900, 'EU');
      expect(mockExtractInvoice).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'CLAUDE',
          locale: 'pl',
          fileName: 'path/doc.pdf',
        }),
      );

      expect(mockUpdate).toHaveBeenCalled();
      const completionCall = mockUpdate.mock.calls.find(
        c => (c[0] as { data?: { status?: string } }).data?.status === 'EXTRACTED',
      );
      expect(completionCall).toBeDefined();
      expect(mockEvaluate).toHaveBeenCalledWith('killswitch.ai-invoice-parser', {
        organizationId: 'org-1',
        region: 'EU',
      });
    });

    it('skips the AI call and marks SKIPPED (manual-entry) when the kill-switch is off', async () => {
      mockEvaluate.mockReturnValueOnce({ enabled: false, reason: 'kill-when-unknown' });
      const fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);

      await processOcrExtraction({
        extractionId: 'ext-1',
        organizationId: 'org-1',
        storageKey: 'path/doc.pdf',
      });

      // No AI call, no PDF fetch — the parser is disabled.
      expect(mockExtractInvoice).not.toHaveBeenCalled();
      expect(mockPresignedUrl).not.toHaveBeenCalled();
      expect(fetchSpy).not.toHaveBeenCalled();

      // Row marked SKIPPED for manual entry — NOT FAILED (no retry/alert/red badge),
      // no resultJson, descriptive errorMessage.
      const skipUpdate = mockUpdate.mock.calls.find(
        c => (c[0] as { data?: { status?: string } }).data?.status === 'SKIPPED',
      );
      expect(skipUpdate).toBeDefined();
      const data = (skipUpdate?.[0] as { data: { errorMessage?: string; resultJson?: unknown } })
        .data;
      expect(data.errorMessage).toMatch(/manually/i);
      expect(data.resultJson).toBeUndefined();

      // A flag-off skip is never recorded as a failure.
      const failUpdate = mockUpdate.mock.calls.find(
        c => (c[0] as { data?: { status?: string } }).data?.status === 'FAILED',
      );
      expect(failUpdate).toBeUndefined();
    });

    it('invokes the AI extractor when the kill-switch is on', async () => {
      mockEvaluate.mockReturnValueOnce({ enabled: true, reason: 'unleash' });
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          statusText: 'OK',
          arrayBuffer: () => Promise.resolve(new Uint8Array([1, 2, 3]).buffer),
        }),
      );

      await processOcrExtraction({
        extractionId: 'ext-1',
        organizationId: 'org-1',
        storageKey: 'path/doc.pdf',
      });

      expect(mockExtractInvoice).toHaveBeenCalledTimes(1);
    });

    it('marks FAILED when PDF download fails', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 404,
          statusText: 'Not Found',
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
        }),
      );

      await processOcrExtraction({
        extractionId: 'ext-1',
        organizationId: 'org-1',
        storageKey: 'missing.pdf',
      });

      const failUpdate = mockUpdate.mock.calls.find(
        c => (c[0] as { data?: { status?: string } }).data?.status === 'FAILED',
      );
      expect(failUpdate).toBeDefined();
    });
  });

  describe('getExtractionResult', () => {
    it('delegates to prisma with org scope', async () => {
      mockFindFirst.mockResolvedValue({ id: 'e1' });
      const row = await getExtractionResult({
        organizationId: 'org-1',
        extractionId: 'e1',
      });
      expect(row).toEqual({ id: 'e1' });
      expect(mockFindFirst).toHaveBeenCalledWith({
        where: { id: 'e1', organizationId: 'org-1' },
      });
    });
  });

  describe('getExtractionByDocument', () => {
    it('delegates to prisma with latest ordering', async () => {
      mockFindFirst.mockResolvedValue(null);
      await getExtractionByDocument({
        organizationId: 'org-1',
        documentId: 'doc-1',
      });
      expect(mockFindFirst).toHaveBeenCalledWith({
        where: { documentId: 'doc-1', organizationId: 'org-1' },
        orderBy: { createdAt: 'desc' },
      });
    });
  });
});
