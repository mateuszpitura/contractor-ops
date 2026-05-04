// packages/api/src/routers/__tests__/invoice-intake.test.ts
//
// Phase 62 · Plan 62-05 Task 1 — tRPC router tests for the invoice intake
// surface. Mocks the service layer via `vi.mock` so we test the router's
// auth/Zod/error-mapping responsibilities in isolation. The service itself
// is covered by `services/__tests__/invoice-intake-service.test.ts`.
//
// Cross-org isolation is exercised explicitly: the mocked service throws
// `{ code: 'NOT_FOUND' }` when intake.organizationId !== orgId, and the
// router translates it to `TRPCError { code: 'NOT_FOUND' }`.

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORG_A = 'clxxxxxxxxxxxxxxxxxxxxxxxa';
const ORG_B = 'clxxxxxxxxxxxxxxxxxxxxxxxb';
const USER_A = 'clyyyyyyyyyyyyyyyyyyyyyyya';
const INTAKE_ID = 'clintakeaaaaaaaaaaaaaaaaaa';
const INTAKE_ID_B = 'clintakebbbbbbbbbbbbbbbbbb';

// ---------------------------------------------------------------------------
// Hoisted service + Prisma mocks
// ---------------------------------------------------------------------------

const {
  mockPrisma,
  mockUploadAndPersist,
  mockConfirmMatch,
  mockAcknowledgeValidation,
  mockConvertToInvoice,
  mockReject,
  mockRankIntakeCandidates,
  mockSignExistingDownload,
} = vi.hoisted(() => {
  type Rec = Record<string, unknown>;
  const mockPrisma: Rec = {
    invoiceIntakeRequest: {
      findUnique: vi.fn(),
      findMany: vi.fn(async () => []),
    },
    organization: {
      findUnique: vi.fn(async () => ({ dataRegion: 'EU', status: 'ACTIVE' })),
    },
    member: { findFirst: vi.fn(async () => ({ role: 'admin' })) },
    $transaction: vi.fn(async (fn: (tx: Rec) => Promise<unknown>) => fn(mockPrisma)),
  };
  return {
    mockPrisma,
    mockUploadAndPersist: vi.fn(),
    mockConfirmMatch: vi.fn(),
    mockAcknowledgeValidation: vi.fn(),
    mockConvertToInvoice: vi.fn(),
    mockReject: vi.fn(),
    mockRankIntakeCandidates: vi.fn(async () => []),
    mockSignExistingDownload: vi.fn(async (key: string) => ({
      signedUrl: `https://r2.test/${key}?sig=mock`,
      expiresInSeconds: 300,
    })),
  };
});

// ---------------------------------------------------------------------------
// Module mocks
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

// F-DB-03 / F-SEC-12 — org-cache must report ACTIVE so tenant middleware
// does not throw orgSuspended.
vi.mock('../../services/org-cache.js', () => ({
  getOrgMeta: vi.fn(async (orgId: string) => ({
    id: orgId,
    dataRegion: 'EU',
    status: 'ACTIVE',
    name: 'Test Org',
  })),
  invalidateOrgMeta: vi.fn(async () => undefined),
  ORG_META_TTL_SECONDS: 300,
  orgMetaKey: (orgId: string) => `org:${orgId}:meta`,
}));

vi.mock('../../services/invoice-intake-service.js', () => ({
  uploadAndPersist: mockUploadAndPersist,
  confirmMatch: mockConfirmMatch,
  acknowledgeValidation: mockAcknowledgeValidation,
  convertToInvoice: mockConvertToInvoice,
  reject: mockReject,
}));

vi.mock('../../services/invoice-intake-matcher.js', () => ({
  rankIntakeCandidates: mockRankIntakeCandidates,
}));

vi.mock('../../services/r2.js', () => ({
  maxBytesForMime: vi.fn(() => 10485760),
  MAX_BYTES_BY_MIME: { 'application/pdf': 52428800 },
  signExistingDownload: mockSignExistingDownload,
  createPresignedUploadUrl: vi.fn(async () => ({
    url: 'https://r2.example.com/upload',
    key: 'mock-key',
  })),
  createPresignedDownloadUrl: vi.fn(async () => 'https://r2.example.com/download'),
  generateStorageKey: vi.fn(() => 'mock-storage-key'),
  headObject: vi.fn(async () => ({ ContentLength: 1024 })),
  deleteObject: vi.fn(async () => undefined),
  putObjectString: vi.fn(async () => undefined),
  putObjectAndSignDownload: vi.fn(async () => ({
    signedUrl: 'https://r2.example.com/pdf',
    expiresInSeconds: 300,
  })),
  getObjectAsString: vi.fn(async () => '<xml/>'),
}));

// The einvoice router imports from these — satisfy module resolution.
vi.mock('@sentry/nextjs', () => {
  const mockSpan = { setStatus: vi.fn(), setAttribute: vi.fn(), end: vi.fn() };
  return {
    startSpan: vi.fn((_o: unknown, fn: (span: typeof mockSpan) => unknown) => fn(mockSpan)),
    captureException: vi.fn(),
  };
});

vi.mock('@contractor-ops/logger', () => {
  const child = (_o: unknown) => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: (_x: unknown) => child(_x),
  });
  const l = child({});
  return {
    logger: l,
    createLogger: vi.fn(() => l),
    createTrpcLogger: vi.fn(() => l),
    createWebhookLogger: vi.fn(() => l),
    createCronLogger: vi.fn(() => l),
    createIntegrationLogger: vi.fn(() => l),
    withBodyLogging: vi.fn((_o: unknown, fn: unknown) => fn),
    logIntegrationCall: vi.fn(),
    subscribeOpossumEvents: vi.fn(),
    runWithRequestContext: vi.fn((_c: unknown, fn: () => unknown) => fn()),
    getRequestId: vi.fn(() => undefined),
    getTraceparent: vi.fn(() => undefined),
    buildContextFromHeaders: vi.fn(() => ({})),
    getOutboundHeaders: vi.fn(() => ({})),
    generateRequestId: vi.fn(() => 'test-request-id'),
    LOG_BODY_INCLUDE_PREFIXES: [],
    PII_MASK_KEYWORDS: [],
    PII_MASK_PATHS: [],
  };
});

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { increment: vi.fn(), histogram: vi.fn(), distribution: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import { TRPCError } from '@trpc/server';
import { createCallerFactory } from '../../init.js';
import { invoiceIntakeRouter } from '../finance/invoice-intake.js';

const createCaller = createCallerFactory(invoiceIntakeRouter);

function makeCaller(userId = USER_A, orgId = ORG_A) {
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const intakeRow = (overrides: Record<string, unknown> = {}) => ({
  id: INTAKE_ID,
  organizationId: ORG_A,
  rawFileKey: 'einvoice-intake/org_A/abc.pdf',
  extractedXmlKey: 'einvoice-intake/org_A/abc-extracted.xml',
  validationReportKey: 'einvoice-intake/org_A/abc-report.html',
  sourceKind: 'UPLOAD_PDF',
  extractedSupplierName: 'Alpha GmbH',
  extractedSupplierVatId: 'DE123456789',
  extractedSupplierLeitwegId: null,
  status: 'PARSED',
  validationStatus: 'VALID',
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
});

// ===========================================================================
// 1. upload
// ===========================================================================

describe('invoiceIntake.upload', () => {
  it('1. happy path returns CREATED from service', async () => {
    mockUploadAndPersist.mockResolvedValueOnce({
      kind: 'CREATED',
      intakeId: INTAKE_ID,
      profileLevel: 'XRECHNUNG',
      validationStatus: 'VALID',
      warnings: [],
    });

    const caller = makeCaller();
    const result = await caller.upload({
      fileKind: 'xml',
      fileBase64: Buffer.from('<?xml?><a/>').toString('base64'),
      mime: 'application/xml',
      originalFilename: 'a.xml',
    });

    expect(result.kind).toBe('CREATED');
    expect(mockUploadAndPersist).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        orgId: ORG_A,
        userId: USER_A,
        fileKind: 'xml',
        mime: 'application/xml',
      }),
    );
  });

  it('2. rejects fileBase64 over 7_000_000 chars at the Zod layer before calling service', async () => {
    const caller = makeCaller();
    const tooBig = 'A'.repeat(7_000_001);
    await expect(
      caller.upload({
        fileKind: 'pdf',
        fileBase64: tooBig,
        mime: 'application/pdf',
        originalFilename: 'big.pdf',
      }),
    ).rejects.toThrow();
    expect(mockUploadAndPersist).not.toHaveBeenCalled();
  });

  it('3. maps service FILE_TOO_LARGE → PAYLOAD_TOO_LARGE', async () => {
    mockUploadAndPersist.mockRejectedValueOnce({
      code: 'FILE_TOO_LARGE',
      message: 'too big',
    });

    const caller = makeCaller();
    try {
      await caller.upload({
        fileKind: 'pdf',
        fileBase64: 'YWJj',
        mime: 'application/pdf',
        originalFilename: 'a.pdf',
      });
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(TRPCError);
      expect((err as TRPCError).code).toBe('PAYLOAD_TOO_LARGE');
    }
  });

  it('3b. maps service UNSUPPORTED_MIME → BAD_REQUEST', async () => {
    mockUploadAndPersist.mockRejectedValueOnce({
      code: 'UNSUPPORTED_MIME',
      message: 'nope',
    });

    const caller = makeCaller();
    try {
      await caller.upload({
        fileKind: 'pdf',
        fileBase64: 'YWJj',
        mime: 'application/octet-stream',
        originalFilename: 'a.bin',
      });
      throw new Error('expected throw');
    } catch (err) {
      expect((err as TRPCError).code).toBe('BAD_REQUEST');
    }
  });

  it('3c. maps parser ZUGFERD_NO_XML_ATTACHMENT → UNPROCESSABLE_CONTENT', async () => {
    mockUploadAndPersist.mockRejectedValueOnce({
      code: 'ZUGFERD_NO_XML_ATTACHMENT',
      message: 'no attachment',
    });

    const caller = makeCaller();
    try {
      await caller.upload({
        fileKind: 'pdf',
        fileBase64: 'YWJj',
        mime: 'application/pdf',
        originalFilename: 'a.pdf',
      });
      throw new Error('expected throw');
    } catch (err) {
      expect((err as TRPCError).code).toBe('UNPROCESSABLE_CONTENT');
    }
  });
});

// ===========================================================================
// 2. listByOrg
// ===========================================================================

describe('invoiceIntake.listByOrg', () => {
  it('4. filters by status and respects limit + cursor', async () => {
    mockPrisma.invoiceIntakeRequest.findMany = vi.fn(async () => [
      { id: 'intake_1' },
      { id: 'intake_2' },
    ]);

    const caller = makeCaller();
    const result = await caller.listByOrg({ status: 'PARSED', limit: 2 });

    expect(result.items).toHaveLength(2);
    expect(result.nextCursor).toBeUndefined();

    // Was called with org filter + status filter
    const lastCall = vi.mocked(mockPrisma.invoiceIntakeRequest.findMany).mock.calls[0]?.[0];
    expect(lastCall).toMatchObject({
      where: { organizationId: ORG_A, status: 'PARSED' },
      take: 3,
    });
  });

  it('5. cross-org isolation — findMany is scoped to the caller org', async () => {
    const findManyMock = vi.fn(async (args: { where: { organizationId: string } }) => {
      if (args.where.organizationId === ORG_A) {
        return [{ id: 'intake_orgA_1' }];
      }
      if (args.where.organizationId === ORG_B) {
        return [{ id: 'intake_orgB_1' }];
      }
      return [];
    });
    mockPrisma.invoiceIntakeRequest.findMany = findManyMock;

    const callerA = makeCaller(USER_A, ORG_A);
    const callerB = makeCaller('user_B', ORG_B);

    const resultA = await callerA.listByOrg({ limit: 25 });
    const resultB = await callerB.listByOrg({ limit: 25 });

    expect(resultA.items.map((r: { id: string }) => r.id)).toEqual(['intake_orgA_1']);
    expect(resultB.items.map((r: { id: string }) => r.id)).toEqual(['intake_orgB_1']);

    // Each call filtered by its own orgId — cross-org leak impossible.
    expect(findManyMock.mock.calls[0]?.[0].where.organizationId).toBe(ORG_A);
    expect(findManyMock.mock.calls[1]?.[0].where.organizationId).toBe(ORG_B);
  });
});

// ===========================================================================
// 3. getById
// ===========================================================================

describe('invoiceIntake.getById', () => {
  it('6a. returns the intake when org matches', async () => {
    mockPrisma.invoiceIntakeRequest.findUnique = vi.fn(async () => intakeRow());
    const caller = makeCaller();
    const result = (await caller.getById({ intakeId: INTAKE_ID })) as {
      id: string;
      organizationId: string;
    };
    expect(result.id).toBe(INTAKE_ID);
    expect(result.organizationId).toBe(ORG_A);
  });

  it('6b. cross-org access returns NOT_FOUND (not FORBIDDEN)', async () => {
    mockPrisma.invoiceIntakeRequest.findUnique = vi.fn(async () =>
      intakeRow({ id: INTAKE_ID_B, organizationId: ORG_B }),
    );

    const caller = makeCaller(USER_A, ORG_A);
    try {
      await caller.getById({ intakeId: INTAKE_ID_B });
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(TRPCError);
      expect((err as TRPCError).code).toBe('NOT_FOUND');
    }
  });
});

// ===========================================================================
// 4. getMatchCandidates
// ===========================================================================

describe('invoiceIntake.getMatchCandidates', () => {
  it('7. returns ranked candidate list from matcher', async () => {
    mockPrisma.invoiceIntakeRequest.findUnique = vi.fn(async () => intakeRow());
    mockRankIntakeCandidates.mockResolvedValueOnce([
      {
        contractorId: 'contractor_1',
        displayName: 'Alpha GmbH',
        vatIdentifier: 'DE123456789',
        score: 100,
        reasons: [{ reason: 'VAT_ID' }],
      },
    ]);

    const caller = makeCaller();
    const result = await caller.getMatchCandidates({ intakeId: INTAKE_ID });
    expect(result).toHaveLength(1);
    expect(result[0]?.score).toBe(100);
    expect(mockRankIntakeCandidates).toHaveBeenCalledWith(
      expect.any(Object),
      ORG_A,
      expect.objectContaining({ supplierVatId: 'DE123456789' }),
    );
  });
});

// ===========================================================================
// 5. confirmMatch
// ===========================================================================

describe('invoiceIntake.confirmMatch', () => {
  it('8a. delegates to service on happy path', async () => {
    mockConfirmMatch.mockResolvedValueOnce(undefined);
    const caller = makeCaller();
    await caller.confirmMatch({
      intakeId: INTAKE_ID,
      contractorId: 'clcontractoraaaaaaaaaaaaaaa',
    });
    expect(mockConfirmMatch).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        orgId: ORG_A,
        intakeId: INTAKE_ID,
        contractorId: 'clcontractoraaaaaaaaaaaaaaa',
      }),
    );
  });

  it('8b. cross-org → service throws NOT_FOUND → router returns NOT_FOUND', async () => {
    mockConfirmMatch.mockRejectedValueOnce({
      code: 'NOT_FOUND',
      message: 'Intake not found',
    });
    const caller = makeCaller();
    try {
      await caller.confirmMatch({
        intakeId: INTAKE_ID_B,
        contractorId: 'clcontractoraaaaaaaaaaaaaaa',
      });
      throw new Error('expected throw');
    } catch (err) {
      expect((err as TRPCError).code).toBe('NOT_FOUND');
    }
  });
});

// ===========================================================================
// 6. convertToInvoice
// ===========================================================================

describe('invoiceIntake.convertToInvoice', () => {
  it('9. returns invoiceId from service', async () => {
    mockConvertToInvoice.mockResolvedValueOnce({ invoiceId: 'inv_1' });
    const caller = makeCaller();
    const result = await caller.convertToInvoice({ intakeId: INTAKE_ID });
    expect(result.invoiceId).toBe('inv_1');
  });

  it('10. idempotency — calling twice returns same invoiceId', async () => {
    mockConvertToInvoice.mockResolvedValue({ invoiceId: 'inv_1' });
    const caller = makeCaller();
    const a = await caller.convertToInvoice({ intakeId: INTAKE_ID });
    const b = await caller.convertToInvoice({ intakeId: INTAKE_ID });
    expect(a.invoiceId).toBe(b.invoiceId);
  });
});

// ===========================================================================
// 7. reject
// ===========================================================================

describe('invoiceIntake.reject', () => {
  it('11a. delegates to service with reason', async () => {
    mockReject.mockResolvedValueOnce(undefined);
    const caller = makeCaller();
    await caller.reject({ intakeId: INTAKE_ID, reason: 'duplicate submission' });
    expect(mockReject).toHaveBeenCalled();
  });

  it('11b. cannot reject a CONVERTED intake — service throws INVALID_STATE_TRANSITION → CONFLICT', async () => {
    mockReject.mockRejectedValueOnce({
      code: 'INVALID_STATE_TRANSITION',
      message: 'already converted',
    });
    const caller = makeCaller();
    try {
      await caller.reject({ intakeId: INTAKE_ID, reason: 'too late' });
      throw new Error('expected throw');
    } catch (err) {
      expect((err as TRPCError).code).toBe('CONFLICT');
    }
  });

  it('11c. reason.length < 3 is rejected at the Zod layer', async () => {
    const caller = makeCaller();
    await expect(caller.reject({ intakeId: INTAKE_ID, reason: 'no' })).rejects.toThrow();
    expect(mockReject).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// 8. downloadRawFile / 9. downloadValidationReport
// ===========================================================================

describe('invoiceIntake.downloadRawFile', () => {
  it('12. returns signed URL with ~300s expiry', async () => {
    mockPrisma.invoiceIntakeRequest.findUnique = vi.fn(async () => intakeRow());
    const caller = makeCaller();
    const result = await caller.downloadRawFile({ intakeId: INTAKE_ID });
    expect(result.url).toMatch(/^https:\/\/r2\.test\//);
    expect(result.expiresInSeconds).toBe(300);
    expect(mockSignExistingDownload).toHaveBeenCalledWith('einvoice-intake/org_A/abc.pdf', 300);
  });
});

describe('invoiceIntake.downloadValidationReport', () => {
  it('13. returns null when no report exists', async () => {
    mockPrisma.invoiceIntakeRequest.findUnique = vi.fn(async () =>
      intakeRow({ validationReportKey: null }),
    );
    const caller = makeCaller();
    const result = await caller.downloadValidationReport({ intakeId: INTAKE_ID });
    expect(result).toBeNull();
  });

  it('14. cross-org download returns NOT_FOUND', async () => {
    mockPrisma.invoiceIntakeRequest.findUnique = vi.fn(async () =>
      intakeRow({ organizationId: ORG_B }),
    );
    const caller = makeCaller(USER_A, ORG_A);
    try {
      await caller.downloadValidationReport({ intakeId: INTAKE_ID });
      throw new Error('expected throw');
    } catch (err) {
      expect((err as TRPCError).code).toBe('NOT_FOUND');
    }
  });
});
