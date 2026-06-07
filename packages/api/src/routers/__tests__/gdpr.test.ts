/**
 * GDPR router tests — export + erasure flows with tenant-scoped Prisma mocks.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { ORG_ID, USER_ID, mockPrisma, mockRetentionMap } = vi.hoisted(() => {
  const OrgId = 'org-gdpr-00000000-0000-0000-0000-000000000001';
  const UserId = 'user-gdpr-00000000-0000-0000-0000-000000000001';

  // US-INFRA-03 fixture retention map — mutated per-test; EMPTY by default so
  // the existing erasure tests keep their current behaviour.
  const mockRetentionMap: Record<string, string> = {};

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Rec = Record<string, unknown>;

  const mockPrisma: Rec = {
    organization: {
      findUnique: vi.fn(),
    },
    contractor: {
      findMany: vi.fn(async () => []),
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
    contract: {
      findMany: vi.fn(async () => []),
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
    document: {
      findMany: vi.fn(async () => []),
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
    invoice: {
      findMany: vi.fn(async () => []),
      updateMany: vi.fn(async () => ({ count: 0 })),
      deleteMany: vi.fn(async () => ({ count: 0 })),
      count: vi.fn(async () => 0),
    },
    invoiceLine: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    invoiceMatchResult: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    invoiceFile: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    documentLink: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    notification: {
      deleteMany: vi.fn(async () => ({ count: 0 })),
    },
    auditLog: {
      findMany: vi.fn(async () => []),
      deleteMany: vi.fn(async () => ({ count: 0 })),
      create: vi.fn(async () => ({})),
    },
    member: {
      findMany: vi.fn(async () => []),
      deleteMany: vi.fn(async () => ({ count: 0 })),
    },
    timeEntry: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    timesheet: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    paymentExport: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    paymentRunItem: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    paymentRun: {
      deleteMany: vi.fn(async () => ({ count: 0 })),
      count: vi.fn(async () => 0),
    },
    shipmentEvent: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    returnRequest: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    shipment: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    equipmentAssignment: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    equipment: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    courierConfig: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    approvalDecision: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    approvalStep: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    approvalFlow: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    approvalChainConfig: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    comment: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    complianceRequirementTemplate: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    contractorAssignment: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    contractorBillingProfile: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    contractorChangeRequest: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    contractorComplianceItem: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    contractorContact: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    contractorNotificationPreference: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    contractorTag: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    externalLink: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    integrationConnection: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    integrationSyncLog: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    ocrExtraction: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    portalMagicToken: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    portalSession: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    reminderInstance: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    reminderRule: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    signingEnvelope: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    signingEvent: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    signingRecipient: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    userNotificationPreference: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    webhookDelivery: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    workflowAttachment: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    workflowComment: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    workflowRun: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    workflowTaskRun: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    workflowTaskTemplate: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    workflowTemplate: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    $transaction: vi.fn(async (fn: (tx: Rec) => Promise<unknown>) => fn(mockPrisma)),
  };

  return { ORG_ID: OrgId, USER_ID: UserId, mockPrisma, mockRetentionMap };
});

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
  withRlsTransactions: <T>(c: T) => c,
  withRlsReads: <T>(c: T) => c,
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
  // US-INFRA-03 — fixture retention map. Production ships EMPTY (D-06); here we
  // map the representative `Invoice` fixture to a retained record type so the
  // statutory-exemption branch is exercised without a real tax table.
  MODEL_RETENTION_TYPE: mockRetentionMap,
  getRetentionCutoff: vi.fn(() => null),
}));

// F-DB-03 / F-SEC-12 — org-cache must report ACTIVE so tenant middleware
// does not throw orgSuspended.
vi.mock('../../services/org-cache', () => ({
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

vi.mock('@sentry/node', () => {
  const mockSpan = { setStatus: vi.fn(), setAttribute: vi.fn(), end: vi.fn() };
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
    startSpan: vi.fn((_o: unknown, fn: (span: typeof mockSpan) => unknown) => fn(mockSpan)),
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
  createIntegrationLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
  createTrpcLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { increment: vi.fn(), distribution: vi.fn(), histogram: vi.fn() },
}));

vi.mock('../../services/cache', () => ({
  cacheKey: vi.fn((...s: string[]) => s.join(':')),
  cachedSingleflight: vi.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
  cached: vi.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
  invalidate: vi.fn(async () => undefined),
  invalidateByPrefix: vi.fn(async () => undefined),
  CacheKeys: {},
  CacheTTL: {},
}));

vi.mock('../../services/r2', () => ({
  maxBytesForMime: vi.fn(() => 10485760),
  MAX_BYTES_BY_MIME: { 'application/pdf': 52428800 },
  deleteObject: vi.fn(async () => undefined),
}));

vi.mock('../../services/regional-storage', () => ({
  deleteRegionalObject: vi.fn(async () => undefined),
}));

import { createCallerFactory } from '../../init';
import { deleteRegionalObject } from '../../services/regional-storage';
import { gdprRouter } from '../compliance/gdpr';

const createCaller = createCallerFactory(gdprRouter);

function makeCaller(orgId: string) {
  const session = {
    session: {
      id: 'sess-gdpr',
      userId: USER_ID,
      activeOrganizationId: orgId,
      expiresAt: new Date('2099-01-01'),
      token: 'mock-token',
      createdAt: new Date(),
      updatedAt: new Date(),
      ipAddress: null,
      userAgent: null,
    },
    user: {
      id: USER_ID,
      name: 'GDPR User',
      email: 'gdpr@example.com',
      emailVerified: true,
      image: null,
      banned: false,
      banReason: null,
      banExpires: null,
      role: 'owner',
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

describe('gdprRouter', () => {
  const caller = makeCaller(ORG_ID);

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the fixture retention map to EMPTY (production default, D-06).
    for (const k of Object.keys(mockRetentionMap)) delete mockRetentionMap[k];
    mockPrisma.organization.findUnique.mockResolvedValue({
      id: ORG_ID,
      name: 'Org',
      slug: 'org',
      createdAt: new Date(),
    });
    mockPrisma.contractor.findMany.mockResolvedValue([]);
    mockPrisma.contract.findMany.mockResolvedValue([]);
    mockPrisma.invoice.findMany.mockResolvedValue([]);
    mockPrisma.document.findMany.mockResolvedValue([]);
    mockPrisma.auditLog.findMany.mockResolvedValue([]);
    mockPrisma.member.findMany.mockResolvedValue([]);
    mockPrisma.contractor.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.contract.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.document.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.invoice.count.mockResolvedValue(2);
    mockPrisma.notification.deleteMany.mockResolvedValue({ count: 1 });
    mockPrisma.auditLog.deleteMany.mockResolvedValue({ count: 1 });
    mockPrisma.auditLog.create.mockResolvedValue({});
  });

  it('exportData queries all entity lists scoped to organizationId', async () => {
    const result = await caller.exportData();

    expect(mockPrisma.organization.findUnique).toHaveBeenCalledWith({
      where: { id: ORG_ID },
      select: expect.any(Object),
    });
    expect(mockPrisma.contractor.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: ORG_ID, deletedAt: null },
      }),
    );
    expect(result.counts).toMatchObject({
      contractors: 0,
      contracts: 0,
      invoices: 0,
      documents: 0,
      auditLogs: 0,
      members: 0,
    });
    expect(result.format).toBe('contractor-ops-export-v1');
  });

  it('exportData select clauses include critical portability fields per table', async () => {
    await caller.exportData();

    expect(mockPrisma.organization.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        select: {
          id: true,
          name: true,
          slug: true,
          createdAt: true,
        },
      }),
    );
    expect(mockPrisma.contractor.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: {
          id: true,
          legalName: true,
          displayName: true,
          taxId: true,
          email: true,
          status: true,
          lifecycleStage: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    );
    expect(mockPrisma.contract.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: {
          id: true,
          contractNumber: true,
          title: true,
          contractorId: true,
          startDate: true,
          endDate: true,
          status: true,
          currency: true,
          rateValueMinor: true,
          createdAt: true,
        },
      }),
    );
    expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: {
          id: true,
          invoiceNumber: true,
          contractorId: true,
          issueDate: true,
          dueDate: true,
          totalMinor: true,
          currency: true,
          status: true,
          paymentStatus: true,
          createdAt: true,
        },
      }),
    );
    expect(mockPrisma.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: {
          id: true,
          originalFileName: true,
          mimeType: true,
          fileSizeBytes: true,
          documentType: true,
          createdAt: true,
        },
      }),
    );
    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: {
          id: true,
          action: true,
          actorName: true,
          resourceType: true,
          resourceName: true,
          createdAt: true,
        },
      }),
    );
    expect(mockPrisma.member.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: {
          userId: true,
          role: true,
          createdAt: true,
        },
      }),
    );
  });

  it('requestErasure runs transaction and logs audit', async () => {
    const out = await caller.requestErasure({
      confirmPhrase: 'DELETE ALL DATA',
      retainFinancialRecords: true,
    });

    expect(out.success).toBe(true);
    expect(mockPrisma.$transaction).toHaveBeenCalled();
    expect(mockPrisma.contractor.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: ORG_ID, deletedAt: null },
      }),
    );
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: ORG_ID,
          action: 'organization.erasure_requested',
        }),
      }),
    );

    // Financial records must be preserved when retainFinancialRecords is true
    expect(mockPrisma.invoice.updateMany).not.toHaveBeenCalled();
    expect(mockPrisma.invoice.deleteMany).not.toHaveBeenCalled();
  });

  // US-INFRA-03 (D-05 #3) — a model under a statutory-retention rule is
  // soft-deleted-with-exemption (never hard-deleted), surfaced with its citation
  // in the summary, and the retention-blocked attempt is audit-logged.
  describe('requestErasure statutory-retention exemption (US-INFRA-03)', () => {
    it('retains a statutorily-held model even when retainFinancialRecords is false; surfaces citation + audits', async () => {
      // Fixture: Invoice held under the 1099-NEC 4-year rule (production map empty).
      mockRetentionMap.Invoice = '1099-NEC';
      mockPrisma.invoice.count.mockResolvedValue(5);

      const out = await caller.requestErasure({
        confirmPhrase: 'DELETE ALL DATA',
        retainFinancialRecords: false, // statutory hold must supersede this
      });

      expect(out.success).toBe(true);

      // Invoice is retained (counted), NOT hard- or soft-deleted via the purge path.
      expect(mockPrisma.invoice.count).toHaveBeenCalledWith({
        where: { organizationId: ORG_ID, deletedAt: null },
      });
      expect(mockPrisma.invoice.deleteMany).not.toHaveBeenCalled();
      expect(mockPrisma.invoice.updateMany).not.toHaveBeenCalled();

      // Summary surfaces the statutory citation; never claims invoices erased.
      const summary = out.summary as {
        invoices: number;
        invoicesRetained: number;
        retainedUnderStatute: Record<string, string>;
      };
      expect(summary.invoices).toBe(0);
      expect(summary.invoicesRetained).toBe(5);
      expect(summary.retainedUnderStatute.Invoice).toContain('26 CFR 1.6001-1');
      expect(out.message).toContain('Invoice');
      expect(out.message).toContain('statutory-retention');

      // Two audit writes: the erasure request + the retention-blocked attempt.
      expect(mockPrisma.auditLog.create).toHaveBeenCalledTimes(2);
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: ORG_ID,
            action: 'organization.erasure_retained_under_statute',
          }),
        }),
      );
    });

    it('does not record any statutory hold when the retention map is empty (production default)', async () => {
      const out = await caller.requestErasure({
        confirmPhrase: 'DELETE ALL DATA',
        retainFinancialRecords: true,
      });

      const summary = out.summary as { retainedUnderStatute: Record<string, string> };
      expect(Object.keys(summary.retainedUnderStatute)).toHaveLength(0);
      // Only the standard erasure-request audit write — no statutory-hold record.
      expect(mockPrisma.auditLog.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.auditLog.create).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'organization.erasure_retained_under_statute',
          }),
        }),
      );
    });
  });

  describe('requestErasure R2 cleanup', () => {
    const mockDeleteRegionalObject = vi.mocked(deleteRegionalObject);

    it('calls deleteRegionalObject for each document with a storageKey', async () => {
      mockPrisma.document.findMany.mockResolvedValue([
        { storageKey: 'eu/doc-001.pdf' },
        { storageKey: 'eu/doc-002.pdf' },
        { storageKey: null },
        { storageKey: 'eu/doc-003.pdf' },
      ]);

      const out = await caller.requestErasure({
        confirmPhrase: 'DELETE ALL DATA',
        retainFinancialRecords: true,
      });

      expect(mockDeleteRegionalObject).toHaveBeenCalledTimes(3);
      expect(mockDeleteRegionalObject).toHaveBeenCalledWith('eu/doc-001.pdf');
      expect(mockDeleteRegionalObject).toHaveBeenCalledWith('eu/doc-002.pdf');
      expect(mockDeleteRegionalObject).toHaveBeenCalledWith('eu/doc-003.pdf');
      expect(out.summary.r2ObjectsCleaned).toBe(3);
    });

    it('continues cleaning remaining documents when deleteRegionalObject throws for one', async () => {
      mockPrisma.document.findMany.mockResolvedValue([
        { storageKey: 'eu/doc-a.pdf' },
        { storageKey: 'eu/doc-b.pdf' },
        { storageKey: 'eu/doc-c.pdf' },
      ]);

      mockDeleteRegionalObject
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('R2 network timeout'))
        .mockResolvedValueOnce(undefined);

      const out = await caller.requestErasure({
        confirmPhrase: 'DELETE ALL DATA',
        retainFinancialRecords: true,
      });

      expect(mockDeleteRegionalObject).toHaveBeenCalledTimes(3);
      expect(out.summary.r2ObjectsCleaned).toBe(2);
    });

    it('reports r2ObjectsCleaned as 0 when no documents have storageKeys', async () => {
      mockPrisma.document.findMany.mockResolvedValue([{ storageKey: null }, { storageKey: null }]);

      const out = await caller.requestErasure({
        confirmPhrase: 'DELETE ALL DATA',
        retainFinancialRecords: true,
      });

      expect(mockDeleteRegionalObject).not.toHaveBeenCalled();
      expect(out.summary.r2ObjectsCleaned).toBe(0);
    });
  });
});
