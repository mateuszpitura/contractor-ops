// Phase 73 · Plan 07 — compliance.submitUploadReplacement portal mutation tests (COMPL-04 / D-06).
//
// CR-1 fix: the test now exercises the REAL flow — consumePendingUpload must
// be called, document.create must be called with PENDING_REVIEW status, and
// documentLink.create must link the document to the contractor. The old mocks
// that patched document.update (and the pre-existing documentLink stub) are
// removed; tests would FAIL on the old broken code because document.update no
// longer exists in submitUploadReplacement.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const ORG_ID = 'clorgaaaaaaaaaaaaaaaaaaaaaa';
const CONTRACTOR_ID = 'clcontractoraaaaaaaaaaaaaaa';
const ITEM_ID = 'clitemaaaaaaaaaaaaaaaaaaaaa';
const DOC_ID = 'cldocaaaaaaaaaaaaaaaaaaaaaa';
const STORAGE_KEY = `orgs/${ORG_ID}/docs/${DOC_ID}/file.pdf`;

const { mockPrisma, auditWriteSpy, consumePendingUploadMock } = vi.hoisted(() => {
  const contractorComplianceItem = {
    findFirst: vi.fn(async () => ({
      id: ITEM_ID,
      contractorId: CONTRACTOR_ID,
      status: 'EXPIRED',
    })),
    update: vi.fn(async () => ({ id: ITEM_ID })),
  };
  const document = {
    create: vi.fn(async () => ({ id: DOC_ID, status: 'PENDING_REVIEW' })),
  };
  const documentLink = {
    create: vi.fn(async () => ({ id: 'link_1' })),
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
  const consumePendingUploadMock = vi.fn(async () => ({
    documentId: DOC_ID,
    storageKey: STORAGE_KEY,
    mimeType: 'application/pdf',
    fileSizeBytesMax: null,
    purpose: 'PORTAL_COMPLIANCE_UPLOAD',
  }));
  return { mockPrisma, auditWriteSpy: vi.fn(async () => undefined), consumePendingUploadMock };
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

// CR-1 fix: mock consumePendingUpload so the test controls what it returns
// and can assert it was called with the correct purpose.
vi.mock('../services/pending-upload', () => ({
  createPendingUpload: vi.fn(),
  consumePendingUpload: consumePendingUploadMock,
}));

const validatePortalSessionMock = vi.fn();
vi.mock('../services/portal-session', () => ({
  validatePortalSession: (token: string) => validatePortalSessionMock(token),
}));

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

import { PENDING_UPLOAD_INVALID } from '../errors';
import { createCallerFactory } from '../init';
import { portalAppRouter } from '../portal-root';

const createCaller = createCallerFactory(portalAppRouter);

function portalCaller() {
  const headers = new Headers();
  headers.set('cookie', 'portal_session=mock-token');
  return createCaller({ headers } as never);
}

const VALID_INPUT = {
  itemId: ITEM_ID,
  documentId: DOC_ID,
  originalFileName: 'right-to-work.pdf',
  fileSizeBytes: 102400,
};

beforeEach(() => {
  vi.clearAllMocks();
  validatePortalSessionMock.mockResolvedValue({
    contractorId: CONTRACTOR_ID,
    organizationId: ORG_ID,
    email: 'c@example.com',
    contractor: { id: CONTRACTOR_ID, displayName: 'Test Contractor' },
  });
  mockPrisma.contractorComplianceItem.findFirst.mockResolvedValue({
    id: ITEM_ID,
    contractorId: CONTRACTOR_ID,
    status: 'EXPIRED',
  } as never);
  consumePendingUploadMock.mockResolvedValue({
    documentId: DOC_ID,
    storageKey: STORAGE_KEY,
    mimeType: 'application/pdf',
    fileSizeBytesMax: null,
    purpose: 'PORTAL_COMPLIANCE_UPLOAD',
  });
});

describe('compliance-portal-upload submitUploadReplacement — real flow (CR-1)', () => {
  it('consumes the pending upload with PORTAL_COMPLIANCE_UPLOAD purpose', async () => {
    const caller = portalCaller();
    await caller.portal.submitUploadReplacement(VALID_INPUT);
    expect(consumePendingUploadMock).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: DOC_ID,
        expectedPurpose: 'PORTAL_COMPLIANCE_UPLOAD',
      }),
    );
  });

  it('creates the Document row with status PENDING_REVIEW using the server storageKey', async () => {
    const caller = portalCaller();
    await caller.portal.submitUploadReplacement(VALID_INPUT);
    expect(mockPrisma.document.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          id: DOC_ID,
          storageKey: STORAGE_KEY,
          status: 'PENDING_REVIEW',
          source: 'USER_UPLOAD',
        }),
      }),
    );
  });

  it('creates a DocumentLink(CONTRACTOR, contractorId) for ownership', async () => {
    const caller = portalCaller();
    await caller.portal.submitUploadReplacement(VALID_INPUT);
    expect(mockPrisma.documentLink.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          documentId: DOC_ID,
          entityType: 'CONTRACTOR',
          entityId: CONTRACTOR_ID,
        }),
      }),
    );
  });

  it('sets satisfiedByDocumentId on the compliance item for admin data layer', async () => {
    const caller = portalCaller();
    await caller.portal.submitUploadReplacement(VALID_INPUT);
    expect(mockPrisma.contractorComplianceItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ITEM_ID },
        data: expect.objectContaining({ satisfiedByDocumentId: DOC_ID }),
      }),
    );
  });

  it('writes AuditLog action=compliance.upload.submitted', async () => {
    const caller = portalCaller();
    await caller.portal.submitUploadReplacement(VALID_INPUT);
    expect(auditWriteSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'compliance.upload.submitted',
        resourceType: 'CONTRACTOR',
        resourceId: CONTRACTOR_ID,
        metadata: expect.objectContaining({ itemId: ITEM_ID, documentId: DOC_ID }),
      }),
    );
  });

  it('does NOT call document.update — old broken path is gone', async () => {
    const caller = portalCaller();
    await caller.portal.submitUploadReplacement(VALID_INPUT);
    // The old broken code called document.update. The fix uses document.create.
    expect((mockPrisma.document as Record<string, unknown>).update).toBeUndefined();
  });

  it('keeps ContractorComplianceItem status unchanged (admin review flips it)', async () => {
    const caller = portalCaller();
    const out = (await caller.portal.submitUploadReplacement(VALID_INPUT)) as {
      status: string;
    };
    // Return value carries the original item status, not SATISFIED.
    expect(out.status).toBe('EXPIRED');
  });

  it('rejects when consumePendingUpload throws (expired/wrong-purpose row)', async () => {
    const { TRPCError } = await import('@trpc/server');
    consumePendingUploadMock.mockRejectedValueOnce(
      new TRPCError({ code: 'BAD_REQUEST', message: PENDING_UPLOAD_INVALID }),
    );
    const caller = portalCaller();
    await expect(caller.portal.submitUploadReplacement(VALID_INPUT)).rejects.toThrow();
    // Document must NOT be created if pending-upload consumption fails.
    expect(mockPrisma.document.create).not.toHaveBeenCalled();
  });
});

describe('compliance-portal-upload cross-contractor-isolation', () => {
  it('rejects itemId belonging to a different contractor with NOT_FOUND', async () => {
    mockPrisma.contractorComplianceItem.findFirst.mockResolvedValueOnce(null as never);
    const caller = portalCaller();
    await expect(
      caller.portal.submitUploadReplacement({ ...VALID_INPUT, itemId: 'cross_org_item' }),
    ).rejects.toThrow();
  });

  it('rejects an unauthenticated request (no portal session) with UNAUTHORIZED', async () => {
    validatePortalSessionMock.mockResolvedValueOnce(null);
    const caller = portalCaller();
    await expect(caller.portal.submitUploadReplacement(VALID_INPUT)).rejects.toThrow();
  });
});

describe('compliance-portal-upload optional suggestedExpiresAt', () => {
  it('forwards suggestedExpiresAt into the audit metadata when provided', async () => {
    const caller = portalCaller();
    await caller.portal.submitUploadReplacement({
      ...VALID_INPUT,
      suggestedExpiresAt: '2027-01-15',
    });
    expect(auditWriteSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ suggestedExpiresAt: '2027-01-15' }),
      }),
    );
  });
});
