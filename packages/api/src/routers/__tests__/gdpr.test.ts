/**
 * GDPR router tests — export + erasure flows with tenant-scoped Prisma mocks.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { ORG_ID, USER_ID, mockPrisma } = vi.hoisted(() => {
  const OrgId = 'org-gdpr-00000000-0000-0000-0000-000000000001';
  const UserId = 'user-gdpr-00000000-0000-0000-0000-000000000001';

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

  return { ORG_ID: OrgId, USER_ID: UserId, mockPrisma };
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

vi.mock('@sentry/nextjs', () => {
  const mockSpan = { setStatus: vi.fn(), setAttribute: vi.fn(), end: vi.fn() };
  return {
    startSpan: vi.fn((_o: unknown, fn: (span: typeof mockSpan) => unknown) => fn(mockSpan)),
    captureException: vi.fn(),
  };
});

vi.mock('@contractor-ops/logger', () => ({
  createTrpcLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { increment: vi.fn(), distribution: vi.fn(), histogram: vi.fn() },
}));

vi.mock('../../services/cache.js', () => ({
  cached: vi.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
  invalidate: vi.fn(async () => undefined),
  invalidateByPrefix: vi.fn(async () => undefined),
  CacheKeys: {},
  CacheTTL: {},
}));

vi.mock('../../services/r2.js', () => ({
  deleteObject: vi.fn(async () => undefined),
}));

import { createCallerFactory } from '../../init.js';
import { gdprRouter } from '../gdpr.js';

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
});
