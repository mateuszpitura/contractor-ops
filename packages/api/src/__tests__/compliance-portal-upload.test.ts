// Phase 73 · Plan 07 — compliance.submitUploadReplacement portal mutation tests (COMPL-04 / D-06).
//
// Router-caller harness over the portal procedure: validatePortalSession is
// mocked to inject a portal-session contractor, and the @contractor-ops/db mock
// provides the regional client + organization lookup the portal middleware uses.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const ORG_ID = 'clorgaaaaaaaaaaaaaaaaaaaaaa';
const CONTRACTOR_ID = 'clcontractoraaaaaaaaaaaaaaa';
const ITEM_ID = 'clitemaaaaaaaaaaaaaaaaaaaaa';
const DOC_ID = 'cldocaaaaaaaaaaaaaaaaaaaaaa';

const { mockPrisma, auditWriteSpy } = vi.hoisted(() => {
  const contractorComplianceItem = {
    findFirst: vi.fn(async () => ({
      id: 'clitemaaaaaaaaaaaaaaaaaaaaa',
      contractorId: 'clcontractoraaaaaaaaaaaaaaa',
      status: 'EXPIRED',
    })),
  };
  const documentLink = { findFirst: vi.fn(async () => ({ id: 'link_1' })) };
  const document = {
    update: vi.fn(async () => ({ id: 'cldocaaaaaaaaaaaaaaaaaaaaaa', status: 'PENDING_REVIEW' })),
  };
  const organization = {
    findUnique: vi.fn(async () => ({ dataRegion: 'EU', status: 'ACTIVE' })),
    findUniqueOrThrow: vi.fn(async () => ({ countryCode: 'GB' })),
  };
  const base = { contractorComplianceItem, documentLink, document, organization };
  const mockPrisma = {
    ...base,
    $transaction: vi.fn(async (fn: (tx: typeof base) => unknown) => fn(base)),
  };
  return { mockPrisma, auditWriteSpy: vi.fn(async () => undefined) };
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

import { createCallerFactory } from '../init';
import { portalAppRouter } from '../portal-root';

const createCaller = createCallerFactory(portalAppRouter);

function portalCaller() {
  const headers = new Headers();
  headers.set('cookie', 'portal_session=mock-token');
  return createCaller({ headers } as never);
}

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
  mockPrisma.documentLink.findFirst.mockResolvedValue({ id: 'link_1' } as never);
});

describe('compliance-portal-upload submitUploadReplacement', () => {
  it('updates Document.status to PENDING_REVIEW for the contractor-uploaded doc', async () => {
    const caller = portalCaller();
    const out = (await caller.portal.submitUploadReplacement({
      itemId: ITEM_ID,
      documentId: DOC_ID,
    })) as { documentId: string };
    expect(out.documentId).toBe(DOC_ID);
    expect(mockPrisma.document.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'PENDING_REVIEW' } }),
    );
  });

  it('writes AuditLog action=compliance.upload.submitted with metadata.itemId + documentId', async () => {
    const caller = portalCaller();
    await caller.portal.submitUploadReplacement({ itemId: ITEM_ID, documentId: DOC_ID });
    expect(auditWriteSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'compliance.upload.submitted',
        resourceType: 'CONTRACTOR',
        resourceId: CONTRACTOR_ID,
        metadata: expect.objectContaining({ itemId: ITEM_ID, documentId: DOC_ID }),
      }),
    );
  });

  it('keeps ContractorComplianceItem.status MISSING/EXPIRED until admin review (no item write)', async () => {
    const caller = portalCaller();
    await caller.portal.submitUploadReplacement({ itemId: ITEM_ID, documentId: DOC_ID });
    // The item table is only read (findFirst), never updated, by this mutation.
    expect((mockPrisma.contractorComplianceItem as Record<string, unknown>).update).toBeUndefined();
  });
});

describe('compliance-portal-upload cross-contractor-isolation', () => {
  it('rejects itemId belonging to a different contractor with NOT_FOUND', async () => {
    mockPrisma.contractorComplianceItem.findFirst.mockResolvedValueOnce(null as never);
    const caller = portalCaller();
    await expect(
      caller.portal.submitUploadReplacement({ itemId: 'cross_org_item', documentId: DOC_ID }),
    ).rejects.toThrow();
  });

  it('rejects when the document is not linked to the portal contractor (NOT_FOUND)', async () => {
    mockPrisma.documentLink.findFirst.mockResolvedValueOnce(null as never);
    const caller = portalCaller();
    await expect(
      caller.portal.submitUploadReplacement({ itemId: ITEM_ID, documentId: 'someone-elses-doc' }),
    ).rejects.toThrow();
  });

  it('rejects an unauthenticated request (no portal session) with UNAUTHORIZED', async () => {
    validatePortalSessionMock.mockResolvedValueOnce(null);
    const caller = portalCaller();
    await expect(
      caller.portal.submitUploadReplacement({ itemId: ITEM_ID, documentId: DOC_ID }),
    ).rejects.toThrow();
  });
});

describe('compliance-portal-upload deep-link-payload', () => {
  it('accepts itemId + documentId + optional suggestedExpiresAt and returns the updated item ref', async () => {
    const caller = portalCaller();
    const out = (await caller.portal.submitUploadReplacement({
      itemId: ITEM_ID,
      documentId: DOC_ID,
      suggestedExpiresAt: '2027-01-15',
    })) as { itemId: string };
    expect(out.itemId).toBe(ITEM_ID);
    expect(auditWriteSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ suggestedExpiresAt: '2027-01-15' }),
      }),
    );
  });
});
