// Phase 73 · Plan 08 — compliance approve/reject upload-review admin mutations (COMPL-04 / D-08).
// Router-caller harness over the staff appRouter (mirrors compliance-override-mutation.test.ts).
//
// WR-1 fix: tests now assert that approve/reject reject a documentId that is
// not PENDING_REVIEW or is not linked to the item's contractor.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const ORG_ID = 'clorgaaaaaaaaaaaaaaaaaaaaaa';
const USER_ID = 'cluseraaaaaaaaaaaaaaaaaaaaa';
const ITEM_ID = 'clitemaaaaaaaaaaaaaaaaaaaaa';
const DOC_ID = 'cldocaaaaaaaaaaaaaaaaaaaaaa';
const CONTRACTOR_ID = 'clcontractoraaaaaaaaaaaaaaa';

const { mockPrisma, auditWriteSpy, dispatchSpy, rbacSpy } = vi.hoisted(() => {
  const item = {
    id: 'clitemaaaaaaaaaaaaaaaaaaaaa',
    contractorId: 'clcontractoraaaaaaaaaaaaaaa',
    policyRuleId: 'uk.right_to_work@v1',
    status: 'EXPIRED',
  };
  const contractorComplianceItem = {
    findFirst: vi.fn(async () => ({ ...item })),
    update: vi.fn(async (args: { data: Record<string, unknown> }) => ({ ...item, ...args.data })),
  };
  // WR-1: document.findFirst returns a PENDING_REVIEW doc by default.
  const document = {
    findFirst: vi.fn(async () => ({ id: DOC_ID, status: 'PENDING_REVIEW' })),
    update: vi.fn(async () => ({ id: DOC_ID })),
  };
  // WR-1: documentLink.findFirst returns the owner link by default.
  const documentLink = {
    findFirst: vi.fn(async () => ({ id: 'link_1' })),
  };
  const organization = {
    findUnique: vi.fn(async () => ({ dataRegion: 'EU', status: 'ACTIVE' })),
    findUniqueOrThrow: vi.fn(async () => ({ countryCode: 'GB' })),
  };
  const base = { contractorComplianceItem, document, documentLink, organization };
  const mockPrisma = {
    ...base,
    $transaction: vi.fn(async (fn: (tx: typeof base) => unknown) => fn(base)),
  };
  return {
    mockPrisma,
    auditWriteSpy: vi.fn(async () => undefined),
    dispatchSpy: vi.fn(async () => undefined),
    rbacSpy: vi.fn(async () => ['admin_user_1']),
  };
});

vi.mock('@contractor-ops/db', () => ({
  withRlsTransactions: <T>(c: T) => c,
  withRlsReads: <T>(c: T) => c,
  prisma: mockPrisma,
  prismaRaw: mockPrisma,
  tenantStore: {
    run: (_c: unknown, fn: () => unknown) => fn(),
    getStore: vi.fn(() => ({ region: 'EU' })),
  },
  withTenantScope: vi.fn((c: unknown) => c),
  withSoftDelete: vi.fn((c: unknown) => c),
  createTenantClient: vi.fn(() => mockPrisma),
  createTenantClientFrom: vi.fn(() => mockPrisma),
  getRegionalClient: vi.fn(() => mockPrisma),
}));

vi.mock('@contractor-ops/auth', () => ({
  auth: {
    api: { getSession: vi.fn(), hasPermission: vi.fn().mockResolvedValue({ success: true }) },
  },
  authApi: { hasPermission: vi.fn().mockResolvedValue({ success: true }) },
}));

vi.mock('../services/audit-writer', () => ({ writeAuditLog: auditWriteSpy }));
vi.mock('../services/notification-service', () => ({ dispatch: dispatchSpy }));
vi.mock('../services/rbac-recipients', () => ({ resolveRbacRecipients: rbacSpy }));

vi.mock('@sentry/node', () => {
  const span = { setStatus: vi.fn(), setAttribute: vi.fn(), end: vi.fn() };
  return {
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
    startSpan: vi.fn((_o: unknown, fn: (s: typeof span) => unknown) => fn(span)),
    captureException: vi.fn(),
  };
});

vi.mock('@contractor-ops/logger', () => ({
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
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
  createTrpcLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createIntegrationLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
  getIdpAuditLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { increment: vi.fn(), histogram: vi.fn(), distribution: vi.fn() },
}));

vi.mock('@contractor-ops/feature-flags', async importOriginal => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  const enabledBag = {
    values: { 'module.classification-engine': true },
    isEnabled: (key: string) => key === 'module.classification-engine',
  };
  return {
    ...actual,
    buildFlagBag: vi.fn(() => enabledBag),
    lazyFlagBag: vi.fn(() => enabledBag),
    evaluate: vi.fn((key: string) =>
      key === 'module.classification-engine'
        ? { enabled: true, reason: 'mocked' }
        : { enabled: false, reason: 'mocked' },
    ),
  };
});

import { authApi } from '@contractor-ops/auth';
import { createCallerFactory } from '../init';
import { appRouter } from '../root';

const createCaller = createCallerFactory(appRouter);

function makeCaller(role = 'admin') {
  const session = {
    session: {
      id: `session-${USER_ID}`,
      userId: USER_ID,
      activeOrganizationId: ORG_ID,
      expiresAt: new Date('2099-01-01'),
      token: 'mock-token',
      createdAt: new Date(),
      updatedAt: new Date(),
      ipAddress: null,
      userAgent: null,
    },
    user: {
      id: USER_ID,
      name: 'Admin Jane',
      email: `${USER_ID}@example.com`,
      emailVerified: true,
      image: null,
      role,
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

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(authApi.hasPermission).mockResolvedValue({ success: true } as never);
  mockPrisma.contractorComplianceItem.findFirst.mockResolvedValue({
    id: ITEM_ID,
    contractorId: CONTRACTOR_ID,
    policyRuleId: 'uk.right_to_work@v1',
    status: 'EXPIRED',
  } as never);
  // Default: doc is PENDING_REVIEW and owned by the contractor.
  mockPrisma.document.findFirst.mockResolvedValue({
    id: DOC_ID,
    status: 'PENDING_REVIEW',
  } as never);
  mockPrisma.documentLink.findFirst.mockResolvedValue({ id: 'link_1' } as never);
});

// ---------------------------------------------------------------------------
// approve happy path
// ---------------------------------------------------------------------------

describe('compliance-upload-review approve — happy path', () => {
  it('flips ContractorComplianceItem to SATISFIED + sets satisfiedByDocumentId + expiresAt', async () => {
    const caller = makeCaller();
    const out = (await caller.classification.approveUploadReplacement({
      itemId: ITEM_ID,
      documentId: DOC_ID,
      expiresAt: '2027-01-15',
    })) as { status: string };
    expect(out.status).toBe('SATISFIED');
    expect(mockPrisma.contractorComplianceItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'SATISFIED', satisfiedByDocumentId: DOC_ID }),
      }),
    );
  });

  it('moves Document.status from PENDING_REVIEW to ACTIVE', async () => {
    const caller = makeCaller();
    await caller.classification.approveUploadReplacement({
      itemId: ITEM_ID,
      documentId: DOC_ID,
      expiresAt: '2027-01-15',
    });
    expect(mockPrisma.document.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'ACTIVE' } }),
    );
  });

  it('writes AuditLog action=compliance.upload.approved', async () => {
    const caller = makeCaller();
    await caller.classification.approveUploadReplacement({
      itemId: ITEM_ID,
      documentId: DOC_ID,
      expiresAt: '2027-01-15',
    });
    expect(auditWriteSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'compliance.upload.approved',
        metadata: expect.objectContaining({ itemId: ITEM_ID, documentId: DOC_ID }),
      }),
    );
  });

  it('rejects callers without compliance:override permission', async () => {
    vi.mocked(authApi.hasPermission).mockResolvedValue({ success: false } as never);
    const caller = makeCaller('readonly');
    await expect(
      caller.classification.approveUploadReplacement({
        itemId: ITEM_ID,
        documentId: DOC_ID,
        expiresAt: '2027-01-15',
      }),
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// WR-1: approve must reject a non-PENDING_REVIEW or unlinked documentId
// ---------------------------------------------------------------------------

describe('compliance-upload-review approve — WR-1 validation', () => {
  it('throws PRECONDITION_FAILED when the document does not exist', async () => {
    mockPrisma.document.findFirst.mockResolvedValueOnce(null as never);
    const caller = makeCaller();
    await expect(
      caller.classification.approveUploadReplacement({
        itemId: ITEM_ID,
        documentId: 'nonexistent-doc',
        expiresAt: '2027-01-15',
      }),
    ).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
    // Mutation must not have proceeded.
    expect(mockPrisma.contractorComplianceItem.update).not.toHaveBeenCalled();
  });

  it('throws PRECONDITION_FAILED when document status is ACTIVE (not PENDING_REVIEW)', async () => {
    mockPrisma.document.findFirst.mockResolvedValueOnce({ id: DOC_ID, status: 'ACTIVE' } as never);
    const caller = makeCaller();
    await expect(
      caller.classification.approveUploadReplacement({
        itemId: ITEM_ID,
        documentId: DOC_ID,
        expiresAt: '2027-01-15',
      }),
    ).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
    expect(mockPrisma.contractorComplianceItem.update).not.toHaveBeenCalled();
  });

  it('throws PRECONDITION_FAILED when document is not linked to the item contractor (IDOR guard)', async () => {
    // Document is PENDING_REVIEW but not owned by this contractor.
    mockPrisma.documentLink.findFirst.mockResolvedValueOnce(null as never);
    const caller = makeCaller();
    await expect(
      caller.classification.approveUploadReplacement({
        itemId: ITEM_ID,
        documentId: DOC_ID,
        expiresAt: '2027-01-15',
      }),
    ).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
    expect(mockPrisma.contractorComplianceItem.update).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// reject happy path
// ---------------------------------------------------------------------------

describe('compliance-upload-review reject — happy path', () => {
  it('moves Document.status to ARCHIVED', async () => {
    const caller = makeCaller();
    await caller.classification.rejectUploadReplacement({
      itemId: ITEM_ID,
      documentId: DOC_ID,
      reasonCategory: 'illegible',
    });
    expect(mockPrisma.document.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'ARCHIVED' } }),
    );
  });

  it('clears satisfiedByDocumentId on the compliance item after rejection', async () => {
    const caller = makeCaller();
    await caller.classification.rejectUploadReplacement({
      itemId: ITEM_ID,
      documentId: DOC_ID,
      reasonCategory: 'illegible',
    });
    expect(mockPrisma.contractorComplianceItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ITEM_ID },
        data: expect.objectContaining({ satisfiedByDocumentId: null }),
      }),
    );
  });

  it('writes AuditLog action=compliance.upload.rejected with reasonCategory + freeText', async () => {
    const caller = makeCaller();
    await caller.classification.rejectUploadReplacement({
      itemId: ITEM_ID,
      documentId: DOC_ID,
      reasonCategory: 'wrong_document_type',
      freeText: 'This is a passport, not a right-to-work share code.',
    });
    expect(auditWriteSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'compliance.upload.rejected',
        metadata: expect.objectContaining({
          reasonCategory: 'wrong_document_type',
          freeText: 'This is a passport, not a right-to-work share code.',
        }),
      }),
    );
  });

  it('dispatches a notification after the reject transaction', async () => {
    const caller = makeCaller();
    await caller.classification.rejectUploadReplacement({
      itemId: ITEM_ID,
      documentId: DOC_ID,
      reasonCategory: 'other',
    });
    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'compliance.upload.rejected' }),
    );
  });

  it('validates reasonCategory against the closed enum', async () => {
    const caller = makeCaller();
    await expect(
      caller.classification.rejectUploadReplacement({
        itemId: ITEM_ID,
        documentId: DOC_ID,
        // @ts-expect-error — invalid reason category must fail Zod
        reasonCategory: 'not-a-real-reason',
      }),
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// WR-1: reject must reject a non-PENDING_REVIEW or unlinked documentId
// ---------------------------------------------------------------------------

describe('compliance-upload-review reject — WR-1 validation', () => {
  it('throws PRECONDITION_FAILED when the document does not exist', async () => {
    mockPrisma.document.findFirst.mockResolvedValueOnce(null as never);
    const caller = makeCaller();
    await expect(
      caller.classification.rejectUploadReplacement({
        itemId: ITEM_ID,
        documentId: 'nonexistent-doc',
        reasonCategory: 'illegible',
      }),
    ).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
    expect(mockPrisma.document.update).not.toHaveBeenCalled();
  });

  it('throws PRECONDITION_FAILED when document is not PENDING_REVIEW', async () => {
    mockPrisma.document.findFirst.mockResolvedValueOnce({
      id: DOC_ID,
      status: 'ARCHIVED',
    } as never);
    const caller = makeCaller();
    await expect(
      caller.classification.rejectUploadReplacement({
        itemId: ITEM_ID,
        documentId: DOC_ID,
        reasonCategory: 'illegible',
      }),
    ).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
    expect(mockPrisma.document.update).not.toHaveBeenCalled();
  });

  it('throws PRECONDITION_FAILED when document is not linked to the item contractor', async () => {
    mockPrisma.documentLink.findFirst.mockResolvedValueOnce(null as never);
    const caller = makeCaller();
    await expect(
      caller.classification.rejectUploadReplacement({
        itemId: ITEM_ID,
        documentId: DOC_ID,
        reasonCategory: 'illegible',
      }),
    ).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
    expect(mockPrisma.document.update).not.toHaveBeenCalled();
  });
});
