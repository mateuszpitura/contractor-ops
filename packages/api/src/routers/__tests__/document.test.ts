/**
 * Document router unit tests.
 *
 * Strategy:
 *  - Mock `@contractor-ops/db` with a vi.hoisted mockPrisma.
 *  - Mock `@contractor-ops/auth`, R2 service, MIME validator, virus scanner, logger, Sentry.
 *  - Create a tRPC caller via `createCallerFactory` + `makeCaller`.
 *  - Each test configures mock return values, calls the procedure,
 *    then asserts the arguments passed to Prisma/R2 (WHERE clauses, data).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORG_ID = 'clxxxxxxxxxxxxxxxxxxxxxxxxx';
const USER_ID = 'clyyyyyyyyyyyyyyyyyyyyyyyy';
const DOC_ID = 'cldocument0000000000000001';
const DOC_ID_NEW = 'cldocument0000000000000002';
const STORAGE_KEY = `${ORG_ID}/${DOC_ID}/invoice.pdf`;

// ---------------------------------------------------------------------------
// Mock Prisma
// ---------------------------------------------------------------------------

const { mockPrisma } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Rec = Record<string, unknown>;

  const mockPrisma: Rec = {
    auditLog: { create: vi.fn(async () => ({ id: "audit-mock" })), createMany: vi.fn(async () => ({ count: 1 })) },
    organization: {
      findUnique: vi.fn().mockResolvedValue({ id: 'org-mock', dataRegion: 'EU', status: 'ACTIVE' }),
    },
    document: {
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(async () => null),
      findUnique: vi.fn(async () => null),
      create: vi.fn(async (opts: { data: Rec }) => ({
        id: DOC_ID,
        ...opts.data,
      })),
      update: vi.fn(async (opts: { where: Rec; data: Rec }) => ({
        id: opts.where.id,
        ...opts.data,
      })),
      count: vi.fn(async () => 0),
    },
    documentLink: {
      findMany: vi.fn(async () => []),
      create: vi.fn(async (opts: { data: Rec }) => ({
        id: 'link-1',
        ...opts.data,
      })),
      createMany: vi.fn(async () => ({ count: 0 })),
      deleteMany: vi.fn(async () => ({ count: 0 })),
    },
    member: {
      findFirst: vi.fn(async () => ({ role: 'admin' })),
    },
    $transaction: vi.fn(async (fn: (tx: Rec) => Promise<unknown>) => fn(mockPrisma)),
  };

  return { mockPrisma };
});

// ---------------------------------------------------------------------------
// Mock modules
// ---------------------------------------------------------------------------

vi.mock('@contractor-ops/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
      hasPermission: vi.fn().mockResolvedValue({ success: true }),
    },
  },
  authApi: {
    hasPermission: vi.fn().mockResolvedValue({ success: true }),
  },
}));

vi.mock('@contractor-ops/db', () => ({
  withRlsTransactions: <T,>(c: T) => c,
  withRlsReads: <T,>(c: T) => c,
  prisma: mockPrisma,
  tenantStore: {
    run: (_ctx: unknown, fn: () => unknown) => fn(),
    getStore: vi.fn(() => ({ region: 'EU' })),
  },
  withTenantScope: vi.fn((c: unknown) => c),
  withSoftDelete: vi.fn((c: unknown) => c),
  createTenantClient: vi.fn(() => mockPrisma),
  createTenantClientFrom: vi.fn(() => mockPrisma),
  getRegionalClient: vi.fn(() => mockPrisma),
}));

// PDF magic bytes — `%PDF-1.4` followed by zero padding to fill the 4 KB
// Range GET that confirmUpload's F-SEC-18 sniff pulls from R2.
// `fileTypeFromBuffer` keys off this signature to return `application/pdf`,
// which lets the magic-byte sniff match the declared `application/pdf`
// MIME used throughout this suite. Hoisted so the `vi.mock` factory below
// (which is itself hoisted) can reference it.
const { PDF_MAGIC } = vi.hoisted(() => {
  const buf = new Uint8Array(4100);
  buf.set([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a], 0);
  return { PDF_MAGIC: buf };
});

vi.mock('../../services/r2.js', () => ({
  maxBytesForMime: vi.fn(() => 10485760),
  MAX_BYTES_BY_MIME: { 'application/pdf': 52428800 },
  createPresignedUploadUrl: vi.fn(async () => 'https://r2.example.com/upload?sig=abc'),
  createPresignedDownloadUrl: vi.fn(async () => 'https://r2.example.com/download?sig=xyz'),
  generateStorageKey: vi.fn(
    (orgId: string, docId: string, filename: string) => `${orgId}/${docId}/${filename}`,
  ),
  getR2BucketName: vi.fn(() => 'test-bucket'),
  headObject: vi.fn(async () => ({ ContentLength: 2048 })),
  deleteObject: vi.fn(async () => undefined),
  getObjectAsString: vi.fn(async () => ''),
  createR2Client: vi.fn(() => ({
    send: vi.fn(async () => ({
      Body: { transformToByteArray: async () => PDF_MAGIC },
    })),
  })),
}));

// F-SEC-18 — confirmUpload dynamically imports `@aws-sdk/client-s3` for
// the Range GET, and the real `file-type` package detects the PDF magic
// bytes from the buffer the mocked R2 client returns above.
vi.mock('@aws-sdk/client-s3', () => ({
  GetObjectCommand: vi.fn(function GetObjectCommand(this: unknown, args: unknown) {
    Object.assign(this as object, args ?? {});
  }),
}));

vi.mock('../../services/regional-storage.js', () => ({
  createRegionalPresignedUploadUrl: vi.fn(
    async (key: string) => `https://r2.example.com/upload/${key}?sig=abc`,
  ),
  createRegionalPresignedDownloadUrl: vi.fn(
    async (key: string) => `https://r2.example.com/download/${key}?sig=xyz`,
  ),
  headRegionalObject: vi.fn(async () => ({ ContentLength: 2048 })),
  deleteRegionalObject: vi.fn(async () => undefined),
  getRegionalObject: vi.fn(async () => ({ Body: new Uint8Array(100) })),
}));

vi.mock('../../services/mime-validator.js', () => ({
  isAllowedMimeType: vi.fn(() => true),
  validateMimeType: vi.fn(async () => ({ valid: true })),
}));

vi.mock('../../services/virus-scanner.js', () => ({
  isClamAvailable: vi.fn(async () => false),
  scanBuffer: vi.fn(async () => ({ isClean: true })),
}));

vi.mock('../../services/notification-service.js', () => ({
  dispatch: vi.fn(async () => undefined),
}));

vi.mock('../../services/invoice-matching.js', () => ({
  computeDuplicateCheckHash: vi.fn(() => 'hash'),
  runAutoMatch: vi.fn(async () => undefined),
}));

vi.mock('../../services/sanitize.js', () => ({
  sanitizeStrings: vi.fn(<T>(v: T) => v),
}));

vi.mock('../../services/stripe-client.js', () => ({
  stripe: {
    subscriptions: { retrieve: vi.fn(), update: vi.fn(), list: vi.fn(async () => ({ data: [] })) },
    customers: { create: vi.fn(), retrieve: vi.fn() },
    checkout: { sessions: { create: vi.fn() } },
    billingPortal: { sessions: { create: vi.fn() } },
    invoices: { retrieveUpcoming: vi.fn() },
  },
}));

vi.mock('../../services/billing-service.js', () => ({
  syncSeatCountForOrg: vi.fn(async () => undefined),
}));

vi.mock('../../services/cache.js', () => ({
  cacheKey: vi.fn((...s: string[]) => s.join(':')),
  cachedSingleflight: vi.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
  CacheKeys: {},
  CacheTTL: {},
  cached: vi.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
  invalidate: vi.fn(async () => undefined),
  invalidateByPrefix: vi.fn(async () => undefined),
  CacheKeys: { dashboardPrefix: (orgId: string) => `dash:${orgId}` },
  CacheTTL: { DASHBOARD: 300 },
}));

vi.mock('../../services/bank-account-crypto.js', () => ({
  encryptBankAccount: vi.fn((v: string) => `encrypted:${v}`),
}));

vi.mock('../../services/approval-engine.js', () => ({
  routeToChain: vi.fn(async () => null),
  createApprovalFlow: vi.fn(async () => ({})),
  advanceFlow: vi.fn(async () => undefined),
  computeSlaStatus: vi.fn(() => 'ON_TIME'),
}));

vi.mock('../../services/calendar-event-service.js', () => ({
  deleteCalendarEvent: vi.fn(async () => undefined),
}));

vi.mock('../../services/calendar-deadline-sync.js', () => ({
  syncPaymentDueDeadline: vi.fn(async () => undefined),
  syncApprovalSlaDeadline: vi.fn(async () => undefined),
}));

vi.mock('../../services/report-export.js', () => ({
  generateAuditCsv: vi.fn(async () => ({ base64: 'bW9jaw==', filename: 'audit-log.csv' })),
}));

vi.mock('../../services/payment-export.js', () => ({
  generateCsv: vi.fn(async () => Buffer.from('csv-data')),
  generateElixir: vi.fn(() => Buffer.from('elixir-data')),
  generateSepaXml: vi.fn(() => Buffer.from('sepa-data')),
  resolveTransferTitle: vi.fn(() => 'FV/2025/001'),
}));

vi.mock('../../services/bank-statement.js', () => ({
  parseBankStatement: vi.fn(() => []),
  matchStatementToRun: vi.fn(() => []),
}));

vi.mock('../../services/credit-service.js', () => ({
  deductCredits: vi.fn(async () => undefined),
  getBalance: vi.fn(async () => ({ credits: 0 })),
  hasCredits: vi.fn(async () => true),
}));

vi.mock('../../services/ocr-extraction.js', () => ({
  extractInvoiceData: vi.fn(async () => ({})),
}));

vi.mock('../../services/billing-webhook.js', () => ({
  handleStripeWebhook: vi.fn(async () => undefined),
}));

vi.mock('@sentry/nextjs', () => {
  const mockSpan = { setStatus: vi.fn(), setAttribute: vi.fn(), end: vi.fn() };
  return {
    getCurrentScope: vi.fn(() => ({ setUser: vi.fn(), setTag: vi.fn(), setTags: vi.fn(), setContext: vi.fn(), setExtra: vi.fn(), clear: vi.fn() })),
    setUser: vi.fn(),
    setTag: vi.fn(),
    setTags: vi.fn(),
    setContext: vi.fn(),
    startSpan: vi.fn((_o: unknown, fn: (span: typeof mockSpan) => unknown) => fn(mockSpan)),
    captureException: vi.fn(),
  };
});

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
  createTrpcLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
  createCronLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
  createWebhookLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
  createIntegrationLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { increment: vi.fn(), histogram: vi.fn(), distribution: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { createCallerFactory } from '../../init.js';
import { appRouter } from '../../root.js';
import { isAllowedMimeType } from '../../services/mime-validator.js';
import { generateStorageKey } from '../../services/r2.js';
import {
  createRegionalPresignedDownloadUrl as createPresignedDownloadUrl,
  createRegionalPresignedUploadUrl as createPresignedUploadUrl,
  deleteRegionalObject as deleteObject,
  headRegionalObject as headObject,
} from '../../services/regional-storage.js';

// ---------------------------------------------------------------------------
// Caller helper
// ---------------------------------------------------------------------------

const createCaller = createCallerFactory(appRouter);

function makeCaller(userId: string, orgId: string) {
  const session = {
    session: {
      id: `session-${userId}`,
      userId,
      activeOrganizationId: orgId,
      expiresAt: new Date('2099-01-01'),
      token: 'mock-token',
      createdAt: new Date(),
      updatedAt: new Date(),
      ipAddress: null,
      userAgent: null,
    },
    user: {
      id: userId,
      name: 'Test User',
      email: `${userId}@example.com`,
      emailVerified: true,
      image: null,
      banned: false,
      banReason: null,
      banExpires: null,
      role: 'admin',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };
  return createCaller({
    headers: new Headers(),
    session: session as never,
    user: session.user as never,
  });
}

const caller = makeCaller(USER_ID, ORG_ID);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDocument(overrides: Record<string, unknown> = {}) {
  return {
    id: DOC_ID,
    organizationId: ORG_ID,
    storageKey: STORAGE_KEY,
    originalFileName: 'invoice.pdf',
    mimeType: 'application/pdf',
    fileSizeBytes: 2048,
    checksumSha256: '',
    documentType: 'INVOICE',
    status: 'ACTIVE',
    visibility: 'PRIVATE',
    virusScanStatus: 'CLEAN',
    source: 'USER_UPLOAD',
    uploadedByUserId: USER_ID,
    deletedAt: null,
    links: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Reset all mocks between tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

// ===========================================================================
// TESTS
// ===========================================================================

describe('document.requestUpload', () => {
  const validInput = {
    filename: 'invoice.pdf',
    mimeType: 'application/pdf',
    fileSizeBytes: 2048,
    documentType: 'INVOICE' as const,
  };

  it('returns presigned URL and storage key', async () => {
    mockPrisma.document.create.mockResolvedValue(makeDocument());

    const result = await caller.document.requestUpload(validInput);

    expect(result).toHaveProperty('uploadUrl');
    expect(result).toHaveProperty('storageKey');
    expect(result).toHaveProperty('documentId');

    // F-SEC-19: presigned PUT now binds the per-MIME byte cap so R2 rejects
    // oversize uploads at the edge — signature is
    // (storageKey, mimeType, ttlSec, _checksumSha256?, maxBytes).
    expect(createPresignedUploadUrl).toHaveBeenCalledWith(
      expect.stringContaining(ORG_ID),
      'application/pdf',
      300,
      undefined,
      expect.any(Number),
    );
  });

  it('generates storage key with format {orgId}/{docId}/{filename}', async () => {
    mockPrisma.document.create.mockResolvedValue(makeDocument());

    await caller.document.requestUpload(validInput);

    expect(generateStorageKey).toHaveBeenCalledWith(ORG_ID, DOC_ID, 'invoice.pdf');
  });

  it('validates MIME type and rejects disallowed types', async () => {
    vi.mocked(isAllowedMimeType).mockReturnValueOnce(false);

    await expect(
      caller.document.requestUpload({
        ...validInput,
        mimeType: 'application/x-executable',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    expect(isAllowedMimeType).toHaveBeenCalledWith('application/x-executable');
  });
});

describe('document.confirmUpload', () => {
  it('creates Document record with correct metadata update', async () => {
    const doc = makeDocument({ storageKey: STORAGE_KEY });
    mockPrisma.document.findFirst.mockResolvedValue(doc);
    mockPrisma.document.update.mockResolvedValue({ ...doc, fileSizeBytes: 2048 });

    await caller.document.confirmUpload({ documentId: DOC_ID });

    // Verify head check on storage
    expect(headObject).toHaveBeenCalledWith(STORAGE_KEY);

    // Verify document update with actual file size from R2
    expect(mockPrisma.document.update).toHaveBeenCalledWith({
      where: { id: DOC_ID },
      data: { fileSizeBytes: 2048 },
    });
  });

  it('triggers virus scan (fire-and-forget) by checking doc exists', async () => {
    const doc = makeDocument();
    mockPrisma.document.findFirst.mockResolvedValue(doc);
    mockPrisma.document.update.mockResolvedValue(doc);

    // The scan runs fire-and-forget, so we just verify the flow completes
    // without error and the document lookup was org-scoped
    await caller.document.confirmUpload({ documentId: DOC_ID });

    expect(mockPrisma.document.findFirst).toHaveBeenCalledWith({
      where: {
        id: DOC_ID,
        organizationId: ORG_ID,
      },
    });
  });
});

describe('document.getDownloadUrl', () => {
  it('returns presigned download URL, org scoped', async () => {
    const doc = makeDocument({ virusScanStatus: 'CLEAN' });
    mockPrisma.document.findFirst.mockResolvedValue(doc);

    const result = await caller.document.getDownloadUrl({ documentId: DOC_ID });

    expect(result).toHaveProperty('url');
    expect(result.expiresIn).toBe(900);

    // Verify download URL generated for correct storage key
    expect(createPresignedDownloadUrl).toHaveBeenCalledWith(STORAGE_KEY, 900);

    // Verify org-scoped lookup
    expect(mockPrisma.document.findFirst).toHaveBeenCalledWith({
      where: {
        id: DOC_ID,
        organizationId: ORG_ID,
        deletedAt: null,
      },
    });
  });

  it('blocks download of INFECTED files', async () => {
    const doc = makeDocument({ virusScanStatus: 'INFECTED' });
    mockPrisma.document.findFirst.mockResolvedValue(doc);

    await expect(caller.document.getDownloadUrl({ documentId: DOC_ID })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });

    // Verify presigned URL was NOT generated
    expect(createPresignedDownloadUrl).not.toHaveBeenCalled();
  });
});

describe('document.list', () => {
  it('WHERE includes organizationId and optional entity filter', async () => {
    mockPrisma.document.findMany.mockResolvedValue([]);
    mockPrisma.document.count.mockResolvedValue(0);

    await caller.document.list({ page: 1, pageSize: 20 });

    const findManyCall = mockPrisma.document.findMany.mock.calls[0]?.[0];
    expect(findManyCall.where).toMatchObject({
      organizationId: ORG_ID,
      deletedAt: null,
    });
  });

  it('applies pagination', async () => {
    mockPrisma.document.findMany.mockResolvedValue([]);
    mockPrisma.document.count.mockResolvedValue(0);

    await caller.document.list({ page: 2, pageSize: 15 });

    const findManyCall = mockPrisma.document.findMany.mock.calls[0]?.[0];
    expect(findManyCall.skip).toBe(15);
    expect(findManyCall.take).toBe(15);
  });
});

describe('document.uploadNewVersion', () => {
  it('marks old version as SUPERSEDED', async () => {
    const existing = makeDocument({
      links: [
        {
          id: 'link-1',
          organizationId: ORG_ID,
          documentId: DOC_ID,
          entityType: 'CONTRACTOR',
          entityId: 'c-1',
          linkRole: 'PRIMARY',
        },
      ],
    });
    mockPrisma.document.findFirst.mockResolvedValue(existing);
    mockPrisma.document.create.mockResolvedValue(makeDocument({ id: DOC_ID_NEW }));

    await caller.document.uploadNewVersion({
      existingDocumentId: DOC_ID,
      filename: 'invoice-v2.pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: 3072,
    });

    // Verify old document was marked SUPERSEDED
    expect(mockPrisma.document.update).toHaveBeenCalledWith({
      where: { id: DOC_ID },
      data: { status: 'SUPERSEDED' },
    });
  });

  it('creates new document and copies entity links', async () => {
    const existing = makeDocument({
      links: [
        {
          id: 'link-1',
          organizationId: ORG_ID,
          documentId: DOC_ID,
          entityType: 'CONTRACTOR',
          entityId: 'c-1',
          linkRole: 'PRIMARY',
        },
        {
          id: 'link-2',
          organizationId: ORG_ID,
          documentId: DOC_ID,
          entityType: 'CONTRACT',
          entityId: 'ct-1',
          linkRole: 'ATTACHMENT',
        },
      ],
    });
    mockPrisma.document.findFirst.mockResolvedValue(existing);
    mockPrisma.document.create.mockResolvedValue(makeDocument({ id: DOC_ID_NEW }));

    await caller.document.uploadNewVersion({
      existingDocumentId: DOC_ID,
      filename: 'invoice-v2.pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: 3072,
    });

    // Verify new document was created with correct metadata
    expect(mockPrisma.document.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: ORG_ID,
          originalFileName: 'invoice-v2.pdf',
          mimeType: 'application/pdf',
          fileSizeBytes: 3072,
          status: 'ACTIVE',
          virusScanStatus: 'PENDING',
          documentType: 'INVOICE', // inherited from existing
        }),
      }),
    );

    // Verify entity links were copied to new document
    expect(mockPrisma.documentLink.createMany).toHaveBeenCalledWith({
      data: [
        {
          organizationId: ORG_ID,
          documentId: DOC_ID_NEW,
          entityType: 'CONTRACTOR',
          entityId: 'c-1',
          linkRole: 'PRIMARY',
        },
        {
          organizationId: ORG_ID,
          documentId: DOC_ID_NEW,
          entityType: 'CONTRACT',
          entityId: 'ct-1',
          linkRole: 'ATTACHMENT',
        },
      ],
    });
  });
});

describe('document.delete', () => {
  it('soft-deletes with deletedAt', async () => {
    const doc = makeDocument();
    mockPrisma.document.findFirst.mockResolvedValue(doc);

    await caller.document.delete({ documentId: DOC_ID });

    // Verify soft-delete sets deletedAt
    expect(mockPrisma.document.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: DOC_ID },
        data: { deletedAt: expect.any(Date) },
      }),
    );
  });

  it('deletes R2 object and removes document links', async () => {
    const doc = makeDocument();
    mockPrisma.document.findFirst.mockResolvedValue(doc);

    await caller.document.delete({ documentId: DOC_ID });

    // Verify R2 object deletion
    expect(deleteObject).toHaveBeenCalledWith(STORAGE_KEY);

    // Verify document links removed
    expect(mockPrisma.documentLink.deleteMany).toHaveBeenCalledWith({
      where: {
        documentId: DOC_ID,
        organizationId: ORG_ID,
      },
    });
  });

  it('throws NOT_FOUND when document does not exist', async () => {
    mockPrisma.document.findFirst.mockResolvedValue(null);

    await expect(caller.document.delete({ documentId: 'nonexistent' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });

    expect(deleteObject).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// document.linkToEntity
// ===========================================================================

describe('document.linkToEntity', () => {
  it('creates a document link scoped to organization', async () => {
    const doc = makeDocument();
    mockPrisma.document.findFirst.mockResolvedValue(doc);

    const result = await caller.document.linkToEntity({
      documentId: DOC_ID,
      entityType: 'CONTRACTOR',
      entityId: 'contractor-1',
      linkRole: 'PRIMARY',
    });

    expect(result).toMatchObject({
      documentId: DOC_ID,
      entityType: 'CONTRACTOR',
      entityId: 'contractor-1',
      linkRole: 'PRIMARY',
    });

    expect(mockPrisma.documentLink.create).toHaveBeenCalledWith({
      data: {
        organizationId: ORG_ID,
        documentId: DOC_ID,
        entityType: 'CONTRACTOR',
        entityId: 'contractor-1',
        linkRole: 'PRIMARY',
      },
    });
  });

  it('throws NOT_FOUND when document does not exist', async () => {
    mockPrisma.document.findFirst.mockResolvedValue(null);

    await expect(
      caller.document.linkToEntity({
        documentId: 'nonexistent',
        entityType: 'CONTRACT',
        entityId: 'contract-1',
        linkRole: 'SUPPORTING',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });

    expect(mockPrisma.documentLink.create).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// document.getDownloadUrl — NOT_FOUND
// ===========================================================================

describe('document.getDownloadUrl — NOT_FOUND', () => {
  it('throws NOT_FOUND when document does not exist', async () => {
    mockPrisma.document.findFirst.mockResolvedValue(null);

    await expect(
      caller.document.getDownloadUrl({ documentId: 'nonexistent' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });

    expect(createPresignedDownloadUrl).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// document.confirmUpload — error paths
// ===========================================================================

describe('document.confirmUpload — error paths', () => {
  it('throws NOT_FOUND when document does not exist', async () => {
    mockPrisma.document.findFirst.mockResolvedValue(null);

    await expect(
      caller.document.confirmUpload({ documentId: 'nonexistent' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('throws NOT_FOUND when object is missing from R2', async () => {
    const doc = makeDocument();
    mockPrisma.document.findFirst.mockResolvedValue(doc);
    vi.mocked(headObject).mockRejectedValueOnce(new Error('NoSuchKey'));

    await expect(caller.document.confirmUpload({ documentId: DOC_ID })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});

// ===========================================================================
// document.requestUpload — with entity link
// ===========================================================================

describe('document.requestUpload — with entity link', () => {
  it('creates entity link when entityType and entityId are provided', async () => {
    mockPrisma.document.create.mockResolvedValue(makeDocument());

    await caller.document.requestUpload({
      filename: 'contract.pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: 4096,
      documentType: 'MASTER_CONTRACT' as const,
      entityType: 'CONTRACTOR',
      entityId: 'contractor-1',
      linkRole: 'PRIMARY',
    });

    expect(mockPrisma.documentLink.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: ORG_ID,
        documentId: DOC_ID,
        entityType: 'CONTRACTOR',
        entityId: 'contractor-1',
        linkRole: 'PRIMARY',
      }),
    });
  });
});

// ===========================================================================
// document.uploadNewVersion — error paths
// ===========================================================================

describe('document.uploadNewVersion — error paths', () => {
  it('throws NOT_FOUND when existing document does not exist', async () => {
    mockPrisma.document.findFirst.mockResolvedValue(null);

    await expect(
      caller.document.uploadNewVersion({
        existingDocumentId: 'nonexistent',
        filename: 'v2.pdf',
        mimeType: 'application/pdf',
        fileSizeBytes: 1024,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('throws BAD_REQUEST when existing document is not ACTIVE', async () => {
    mockPrisma.document.findFirst.mockResolvedValue(makeDocument({ status: 'SUPERSEDED' }));

    await expect(
      caller.document.uploadNewVersion({
        existingDocumentId: DOC_ID,
        filename: 'v2.pdf',
        mimeType: 'application/pdf',
        fileSizeBytes: 1024,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('rejects disallowed MIME types', async () => {
    vi.mocked(isAllowedMimeType).mockReturnValueOnce(false);

    await expect(
      caller.document.uploadNewVersion({
        existingDocumentId: DOC_ID,
        filename: 'malware.exe',
        mimeType: 'application/x-executable',
        fileSizeBytes: 1024,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});

// ===========================================================================
// document.getVersionHistory
// ===========================================================================

describe('document.getVersionHistory', () => {
  it('returns single document when no links exist', async () => {
    const doc = makeDocument({ links: [] });
    mockPrisma.document.findFirst.mockResolvedValue(doc);

    const result = await caller.document.getVersionHistory({ documentId: DOC_ID });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: DOC_ID });
  });

  it('throws NOT_FOUND when document does not exist', async () => {
    mockPrisma.document.findFirst.mockResolvedValue(null);

    await expect(
      caller.document.getVersionHistory({ documentId: 'nonexistent' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('returns related documents when links exist', async () => {
    const doc = makeDocument({
      links: [{ id: 'link-1', entityType: 'CONTRACTOR', entityId: 'c-1', linkRole: 'PRIMARY' }],
    });
    mockPrisma.document.findFirst.mockResolvedValue(doc);
    mockPrisma.documentLink.findMany.mockResolvedValue([
      { documentId: DOC_ID },
      { documentId: DOC_ID_NEW },
    ]);
    mockPrisma.document.findMany.mockResolvedValue([
      makeDocument({ id: DOC_ID }),
      makeDocument({ id: DOC_ID_NEW, status: 'SUPERSEDED' }),
    ]);

    const result = await caller.document.getVersionHistory({ documentId: DOC_ID });

    expect(result).toHaveLength(2);
  });
});

// ===========================================================================
// document.list — additional filters
// ===========================================================================

describe('document.list — additional filters', () => {
  it('applies entity type and entity id filter via documentLink join', async () => {
    mockPrisma.documentLink.findMany.mockResolvedValue([{ documentId: DOC_ID }]);
    mockPrisma.document.findMany.mockResolvedValue([]);
    mockPrisma.document.count.mockResolvedValue(0);

    await caller.document.list({
      page: 1,
      pageSize: 20,
      entityType: 'CONTRACTOR',
      entityId: 'contractor-1',
    });

    expect(mockPrisma.documentLink.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: ORG_ID,
          entityType: 'CONTRACTOR',
          entityId: 'contractor-1',
        }),
      }),
    );

    const findManyCall = mockPrisma.document.findMany.mock.calls[0]?.[0];
    expect(findManyCall.where.id).toEqual({ in: [DOC_ID] });
  });

  it('applies documentType filter', async () => {
    mockPrisma.document.findMany.mockResolvedValue([]);
    mockPrisma.document.count.mockResolvedValue(0);

    await caller.document.list({
      page: 1,
      pageSize: 20,
      documentType: ['INVOICE'],
    });

    const findManyCall = mockPrisma.document.findMany.mock.calls[0]?.[0];
    expect(findManyCall.where.documentType).toEqual({ in: ['INVOICE'] });
  });
});
