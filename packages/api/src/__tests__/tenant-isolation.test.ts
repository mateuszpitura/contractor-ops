/**
 * Cross-tenant isolation tests.
 *
 * Verifies that the Prisma tenant extension (via AsyncLocalStorage) and
 * explicit organizationId guards in routers prevent data from leaking
 * across organizations.
 *
 * Strategy:
 *  - Mock `@contractor-ops/db` so we control what Prisma returns.
 *  - Mock `@contractor-ops/auth` so RBAC/permission checks pass.
 *  - Mock service modules that perform side effects (R2, notifications, etc.).
 *  - Create two tRPC callers (orgA, orgB) via `createCallerFactory`.
 *  - Seed the mock with data belonging to each org.
 *  - Assert that a caller for orgA never receives orgB data and vice versa,
 *    and that cross-org mutations are rejected with NOT_FOUND.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORG_A_ID = 'org-a-00000000-0000-0000-0000-000000000001';
const ORG_B_ID = 'org-b-00000000-0000-0000-0000-000000000002';
const USER_A_ID = 'user-a-00000000-0000-0000-0000-000000000001';
const USER_B_ID = 'user-b-00000000-0000-0000-0000-000000000002';
const CONTRACTOR_A_ID = 'contractor-a-001';
const CONTRACTOR_B_ID = 'contractor-b-001';
const INVOICE_A_ID = 'invoice-a-001';
const INVOICE_B_ID = 'invoice-b-001';
const DOCUMENT_A_ID = 'document-a-001';
const DOCUMENT_B_ID = 'document-b-001';
const APPROVAL_STEP_A_ID = 'step-a-001';
const APPROVAL_STEP_B_ID = 'step-b-001';
const _APPROVAL_FLOW_A_ID = 'flow-a-001';
const _APPROVAL_FLOW_B_ID = 'flow-b-001';
const APPROVAL_CHAIN_A_ID = 'chain-a-001';
const APPROVAL_CHAIN_B_ID = 'chain-b-001';

// ---------------------------------------------------------------------------
// Mock Prisma — built via vi.hoisted so vi.mock factories can reference it
// ---------------------------------------------------------------------------

const { mockPrisma } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Rec = Record<string, unknown>;

  const OrgA = 'org-a-00000000-0000-0000-0000-000000000001';
  const OrgB = 'org-b-00000000-0000-0000-0000-000000000002';
  const UserA = 'user-a-00000000-0000-0000-0000-000000000001';
  const UserB = 'user-b-00000000-0000-0000-0000-000000000002';

  const contractorA: Rec = {
    id: 'contractor-a-001',
    organizationId: OrgA,
    legalName: 'Alpha Consulting Sp. z o.o.',
    taxId: '1111111111',
    status: 'ACTIVE',
    lifecycleStage: 'ACTIVE',
    deletedAt: null,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-06-01'),
    owner: null,
    primaryTeam: null,
    billingProfiles: [],
    _count: { complianceItems: 0 },
  };
  const contractorB: Rec = {
    id: 'contractor-b-001',
    organizationId: OrgB,
    legalName: 'Beta Services S.A.',
    taxId: '2222222222',
    status: 'ACTIVE',
    lifecycleStage: 'ACTIVE',
    deletedAt: null,
    createdAt: new Date('2025-02-01'),
    updatedAt: new Date('2025-07-01'),
    owner: null,
    primaryTeam: null,
    billingProfiles: [],
    _count: { complianceItems: 0 },
  };
  const invoiceA: Rec = {
    id: 'invoice-a-001',
    organizationId: OrgA,
    contractorId: 'contractor-a-001',
    invoiceNumber: 'FV/2025/001',
    status: 'RECEIVED',
    paymentStatus: 'UNPAID',
    totalMinor: 100000,
    currency: 'PLN',
    deletedAt: null,
    createdAt: new Date('2025-03-01'),
  };
  const invoiceB: Rec = {
    id: 'invoice-b-001',
    organizationId: OrgB,
    contractorId: 'contractor-b-001',
    invoiceNumber: 'FV/2025/002',
    status: 'RECEIVED',
    paymentStatus: 'UNPAID',
    totalMinor: 200000,
    currency: 'EUR',
    deletedAt: null,
    createdAt: new Date('2025-04-01'),
  };
  const documentA: Rec = {
    id: 'document-a-001',
    organizationId: OrgA,
    storageKey: 'org-a/docs/file-a.pdf',
    filename: 'contract-a.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 1024,
    virusScanStatus: 'CLEAN',
    deletedAt: null,
  };
  const documentB: Rec = {
    id: 'document-b-001',
    organizationId: OrgB,
    storageKey: 'org-b/docs/file-b.pdf',
    filename: 'contract-b.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 2048,
    virusScanStatus: 'CLEAN',
    deletedAt: null,
  };
  const auditLogA: Rec = {
    id: 'audit-a-001',
    organizationId: OrgA,
    action: 'contractor.created',
    actorId: UserA,
    actorName: 'User A',
    resourceType: 'Contractor',
    resourceId: 'contractor-a-001',
    resourceName: 'Alpha Consulting',
    createdAt: new Date('2025-05-01'),
  };
  const auditLogB: Rec = {
    id: 'audit-b-001',
    organizationId: OrgB,
    action: 'contractor.created',
    actorId: UserB,
    actorName: 'User B',
    resourceType: 'Contractor',
    resourceId: 'contractor-b-001',
    resourceName: 'Beta Services',
    createdAt: new Date('2025-05-02'),
  };
  const chainA: Rec = {
    id: 'chain-a-001',
    organizationId: OrgA,
    resourceType: 'INVOICE',
    name: 'Org A Chain',
    isDefault: true,
    stepsJson: [],
    conditionsJson: null,
    createdAt: new Date('2025-01-01'),
  };
  const chainB: Rec = {
    id: 'chain-b-001',
    organizationId: OrgB,
    resourceType: 'INVOICE',
    name: 'Org B Chain',
    isDefault: true,
    stepsJson: [],
    conditionsJson: null,
    createdAt: new Date('2025-01-01'),
  };
  const flowA: Rec = {
    id: 'flow-a-001',
    organizationId: OrgA,
    resourceId: 'invoice-a-001',
    resourceType: 'INVOICE',
    chainConfigId: 'chain-a-001',
    status: 'IN_PROGRESS',
  };
  const flowB: Rec = {
    id: 'flow-b-001',
    organizationId: OrgB,
    resourceId: 'invoice-b-001',
    resourceType: 'INVOICE',
    chainConfigId: 'chain-b-001',
    status: 'IN_PROGRESS',
  };
  const stepA: Rec = {
    id: 'step-a-001',
    organizationId: OrgA,
    approvalFlowId: 'flow-a-001',
    approverUserId: UserA,
    stepOrder: 1,
    status: 'PENDING',
    slaDeadline: null,
    approvalFlow: flowA,
  };
  const stepB: Rec = {
    id: 'step-b-001',
    organizationId: OrgB,
    approvalFlowId: 'flow-b-001',
    approverUserId: UserB,
    stepOrder: 1,
    status: 'PENDING',
    slaDeadline: null,
    approvalFlow: flowB,
  };

  /** Primary DB routing rows — tenant middleware reads dataRegion via prisma.organization */
  const orgARecord: Rec = { id: OrgA, dataRegion: 'EU', status: 'ACTIVE' };
  const orgBRecord: Rec = { id: OrgB, dataRegion: 'EU', status: 'ACTIVE' };

  // -- Where-clause filter --
  type OperatorCheck = (itemValue: unknown, operand: unknown) => boolean;

  const OperatorChecks: Record<string, OperatorCheck> = {
    in: (v, op) => Array.isArray(op) && op.includes(v),
    notIn: (v, op) => !(Array.isArray(op) && op.includes(v)),
    not: (v, op) => v !== op,
    contains: (v, op) => typeof v === 'string' && v.includes(op as string),
    startsWith: (v, op) => typeof v === 'string' && v.startsWith(op as string),
    endsWith: (v, op) => typeof v === 'string' && v.endsWith(op as string),
    gt: (v, op) => typeof v === 'number' && v > (op as number),
    gte: (v, op) => typeof v === 'number' && v >= (op as number),
    lt: (v, op) => typeof v === 'number' && v < (op as number),
    lte: (v, op) => typeof v === 'number' && v <= (op as number),
    equals: (v, op) => v === op,
  };

  function matchesOperator(itemValue: unknown, operator: Rec): boolean {
    for (const [op, operand] of Object.entries(operator)) {
      const check = OperatorChecks[op];
      if (check && !check(itemValue, operand)) return false;
    }
    return true;
  }

  function filterByWhere(collection: Rec[], where?: Rec): Rec[] {
    if (!where) return [...collection];
    return collection.filter(item => {
      for (const [key, value] of Object.entries(where)) {
        if (['OR', 'AND', 'NOT'].includes(key)) continue;
        if (key === 'deletedAt' && value === null) {
          if (item.deletedAt !== null) return false;
          continue;
        }
        if (typeof value === 'object' && value !== null) {
          if (!matchesOperator(item[key], value as Rec)) return false;
          continue;
        }
        if (item[key] !== value) return false;
      }
      return true;
    });
  }

  function model(collection: Rec[]) {
    return {
      findMany: vi.fn(
        async (opts?: {
          where?: Rec;
          orderBy?: unknown;
          skip?: number;
          take?: number;
          include?: unknown;
          select?: unknown;
        }) => filterByWhere(collection, opts?.where),
      ),
      findFirst: vi.fn(async (opts?: { where?: Rec; include?: unknown }) => {
        const results = filterByWhere(collection, opts?.where);
        return results[0] ?? null;
      }),
      findUnique: vi.fn(async (opts?: { where?: Rec; select?: unknown }) => {
        const results = filterByWhere(collection, opts?.where);
        return results[0] ?? null;
      }),
      findFirstOrThrow: vi.fn(async (opts?: { where?: Rec }) => {
        const results = filterByWhere(collection, opts?.where);
        if (results.length === 0) throw new Error('Record not found');
        return results[0];
      }),
      count: vi.fn(async (opts?: { where?: Rec }) => filterByWhere(collection, opts?.where).length),
      create: vi.fn(async (opts: { data: Rec }) => ({
        id: `new-${Math.random().toString(36).slice(2, 10)}`,
        ...opts.data,
      })),
      update: vi.fn(async (opts: { where: Rec; data: Rec }) => {
        const results = filterByWhere(collection, opts.where);
        if (results.length === 0) throw new Error('Record not found for update');
        return { ...results[0], ...opts.data };
      }),
      updateMany: vi.fn(async () => ({ count: 0 })),
      delete: vi.fn(async () => ({})),
      deleteMany: vi.fn(async () => ({ count: 0 })),
      aggregate: vi.fn(async () => ({ _count: 0 })),
      groupBy: vi.fn(async () => []),
    };
  }

  const mockPrisma: Rec = {
    organization: model([orgARecord, orgBRecord]),
    contractor: model([contractorA, contractorB]),
    invoice: model([invoiceA, invoiceB]),
    document: model([documentA, documentB]),
    auditLog: model([auditLogA, auditLogB]),
    approvalChainConfig: model([chainA, chainB]),
    approvalStep: model([stepA, stepB]),
    approvalFlow: model([flowA, flowB]),
    approvalDecision: model([]),
    contractorComplianceItem: { ...model([]), groupBy: vi.fn(async () => []) },
    documentLink: model([]),
    member: model([]),
    contract: model([]),
    invoiceFile: model([]),
    matchResult: model([]),
    notification: model([]),
    complianceItem: model([]),
    billingProfile: model([]),
    workflowTaskRun: model([]),
    $queryRaw: vi.fn(async () => []),
    $transaction: vi.fn(async (fn: (tx: Rec) => Promise<unknown>) => fn(mockPrisma)),
  };

  return { mockPrisma };
});

// ---------------------------------------------------------------------------
// Module mocks — these factories are hoisted; only reference hoisted values
// ---------------------------------------------------------------------------

vi.mock('@contractor-ops/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
      hasPermission: vi.fn().mockResolvedValue({ success: true }),
    },
  },
  authApi: {
    getSession: vi.fn(),
    hasPermission: vi.fn().mockResolvedValue({ success: true }),
    getFullOrganization: vi.fn(),
  },
}));

vi.mock('@contractor-ops/db', () => ({
  withRlsTransactions: <T,>(c: T) => c,
  prisma: mockPrisma,
  tenantStore: {
    run: (_ctx: unknown, fn: () => unknown) => fn(),
    getStore: vi.fn(),
  },
  withTenantScope: vi.fn((c: unknown) => c),
  withSoftDelete: vi.fn((c: unknown) => c),
  createTenantClient: vi.fn(() => mockPrisma),
  createTenantClientFrom: vi.fn(() => mockPrisma),
  /** tenantMiddleware — return same mock client as regional base */
  getRegionalClient: vi.fn(() => mockPrisma),
  preWarmRegionalClients: vi.fn(),
}));

vi.mock('../services/r2.js', () => ({
  maxBytesForMime: vi.fn(() => 10485760),
  MAX_BYTES_BY_MIME: { 'application/pdf': 52428800 },
  createPresignedUploadUrl: vi.fn(async () => ({
    url: 'https://r2.example.com/upload',
    key: 'mock-key',
  })),
  createPresignedDownloadUrl: vi.fn(async () => 'https://r2.example.com/download'),
  generateStorageKey: vi.fn(() => 'mock-storage-key'),
  headObject: vi.fn(async () => ({ ContentLength: 1024 })),
  deleteObject: vi.fn(async () => undefined),
}));

vi.mock('../services/regional-storage.js', () => ({
  createRegionalPresignedUploadUrl: vi.fn(async () => 'https://r2.example.com/upload'),
  createRegionalPresignedDownloadUrl: vi.fn(async () => 'https://r2.example.com/download'),
  headRegionalObject: vi.fn(async () => ({ ContentLength: 1024 })),
  deleteRegionalObject: vi.fn(async () => undefined),
  getRegionalObject: vi.fn(async () => ({ Body: new Uint8Array(100) })),
}));

vi.mock('../services/notification-service.js', () => ({
  dispatch: vi.fn(async () => undefined),
}));

vi.mock('../services/invoice-matching.js', () => ({
  computeDuplicateCheckHash: vi.fn(() => 'hash'),
  runAutoMatch: vi.fn(async () => undefined),
}));

vi.mock('../services/bank-account-crypto.js', () => ({
  encryptBankAccount: vi.fn((v: string) => `encrypted:${v}`),
}));

vi.mock('../services/sanitize.js', () => ({
  sanitizeStrings: vi.fn(<T>(v: T) => v),
}));

vi.mock('../services/approval-engine.js', () => ({
  routeToChain: vi.fn(async () => null),
  createApprovalFlow: vi.fn(async () => ({})),
  advanceFlow: vi.fn(async () => undefined),
  computeSlaStatus: vi.fn(() => 'ON_TIME'),
}));

vi.mock('../services/calendar-event-service.js', () => ({
  deleteCalendarEvent: vi.fn(async () => undefined),
}));

vi.mock('../services/calendar-deadline-sync.js', () => ({
  syncPaymentDueDeadline: vi.fn(async () => undefined),
  syncApprovalSlaDeadline: vi.fn(async () => undefined),
}));

vi.mock('../services/report-export.js', () => ({
  generateAuditCsv: vi.fn(async () => ({
    base64: 'bW9jaw==',
    filename: 'audit-log-2025-01-01.csv',
  })),
}));

vi.mock('../services/billing-service.js', () => ({
  syncSeatCountForOrg: vi.fn(async () => undefined),
}));

vi.mock('../services/cache.js', () => ({
  cacheKey: vi.fn((...s: string[]) => s.join(':')),
  cachedSingleflight: vi.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
  CacheKeys: {},
  CacheTTL: {},
  cached: vi.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
  invalidate: vi.fn(async () => undefined),
  invalidateByPrefix: vi.fn(async () => undefined),
  CacheKeys: { approvalChains: (orgId: string) => `approval-chains:${orgId}` },
  CacheTTL: { APPROVAL_CHAINS: 300 },
}));

vi.mock('../services/mime-validator.js', () => ({
  isAllowedMimeType: vi.fn(() => true),
  validateMimeType: vi.fn(async () => ({ valid: true })),
}));

vi.mock('../services/virus-scanner.js', () => ({
  isClamAvailable: vi.fn(async () => false),
  scanBuffer: vi.fn(async () => ({ clean: true })),
}));

vi.mock('../services/stripe-client.js', () => ({
  stripe: {
    subscriptions: { retrieve: vi.fn(), update: vi.fn(), list: vi.fn(async () => ({ data: [] })) },
    customers: { create: vi.fn(), retrieve: vi.fn() },
    checkout: { sessions: { create: vi.fn() } },
    billingPortal: { sessions: { create: vi.fn() } },
    invoices: { retrieveUpcoming: vi.fn() },
  },
}));

vi.mock('../services/credit-service.js', () => ({
  deductCredits: vi.fn(async () => undefined),
  getBalance: vi.fn(async () => ({ credits: 0 })),
  hasCredits: vi.fn(async () => true),
}));

vi.mock('../services/ocr-extraction.js', () => ({
  extractInvoiceData: vi.fn(async () => ({})),
}));

vi.mock('../services/billing-webhook.js', () => ({
  handleStripeWebhook: vi.fn(async () => undefined),
}));

vi.mock('@sentry/nextjs', () => {
  const mockSpan = { setStatus: vi.fn(), setAttribute: vi.fn(), end: vi.fn() };
  return {
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

import { createCallerFactory } from '../init.js';
import { appRouter } from '../root.js';

// ---------------------------------------------------------------------------
// Caller helpers
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
      name: `User ${userId}`,
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

const callerA = makeCaller(USER_A_ID, ORG_A_ID);
const callerB = makeCaller(USER_B_ID, ORG_B_ID);

// ---------------------------------------------------------------------------
// Reset mocks between tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.$queryRaw.mockResolvedValue([]);
  mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn(mockPrisma),
  );
});

// ===========================================================================
// 1. Contractor isolation
// ===========================================================================

describe('Contractor isolation', () => {
  it('orgA list returns only orgA contractors', async () => {
    const result = await callerA.contractor.list({ page: 1, pageSize: 25 });
    const ids = result.items.map(c => (c as { id: string }).id);
    expect(ids).toContain(CONTRACTOR_A_ID);
    expect(ids).not.toContain(CONTRACTOR_B_ID);
  });

  it('orgB list returns only orgB contractors', async () => {
    const result = await callerB.contractor.list({ page: 1, pageSize: 25 });
    const ids = result.items.map(c => (c as { id: string }).id);
    expect(ids).toContain(CONTRACTOR_B_ID);
    expect(ids).not.toContain(CONTRACTOR_A_ID);
  });

  it('orgA getById for orgB contractor returns NOT_FOUND', async () => {
    await expect(callerA.contractor.getById({ id: CONTRACTOR_B_ID })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('orgB getById for orgA contractor returns NOT_FOUND', async () => {
    await expect(callerB.contractor.getById({ id: CONTRACTOR_A_ID })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('orgA update on orgB contractor returns NOT_FOUND', async () => {
    await expect(
      callerA.contractor.update({ id: CONTRACTOR_B_ID, legalName: 'Hacked' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('orgA archive of orgB contractor returns NOT_FOUND', async () => {
    await expect(callerA.contractor.archive({ id: CONTRACTOR_B_ID })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('contractor.list where clause always includes the caller organizationId', async () => {
    await callerA.contractor.list({ page: 1, pageSize: 10 });
    const call = mockPrisma.contractor.findMany.mock.calls[0]?.[0];
    expect(call?.where).toHaveProperty('organizationId', ORG_A_ID);
  });
});

// ===========================================================================
// 2. Invoice isolation
// ===========================================================================

describe('Invoice isolation', () => {
  it('orgA getById for orgB invoice returns NOT_FOUND', async () => {
    await expect(callerA.invoice.getById({ id: INVOICE_B_ID })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('orgB getById for orgA invoice returns NOT_FOUND', async () => {
    await expect(callerB.invoice.getById({ id: INVOICE_A_ID })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('orgA update on orgB invoice returns NOT_FOUND', async () => {
    await expect(
      callerA.invoice.update({ id: INVOICE_B_ID, data: { invoiceNumber: 'HACKED' } }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('orgA list returns only orgA invoices', async () => {
    const result = await callerA.invoice.list({ page: 1, pageSize: 25 });
    const ids = result.items.map((inv: { id: string }) => inv.id);
    expect(ids).toContain(INVOICE_A_ID);
    expect(ids).not.toContain(INVOICE_B_ID);
  });

  it('orgB list returns only orgB invoices', async () => {
    const result = await callerB.invoice.list({ page: 1, pageSize: 25 });
    const ids = result.items.map((inv: { id: string }) => inv.id);
    expect(ids).toContain(INVOICE_B_ID);
    expect(ids).not.toContain(INVOICE_A_ID);
  });

  it('invoice.list where clause always includes the caller organizationId', async () => {
    await callerB.invoice.list({ page: 1, pageSize: 10 });
    const call = mockPrisma.invoice.findMany.mock.calls[0]?.[0];
    expect(call?.where).toHaveProperty('organizationId', ORG_B_ID);
  });
});

// ===========================================================================
// 3. Document / file isolation
// ===========================================================================

describe('Document / file isolation', () => {
  it('orgA cannot download orgB document (NOT_FOUND)', async () => {
    await expect(
      callerA.document.getDownloadUrl({ documentId: DOCUMENT_B_ID }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('orgB cannot download orgA document (NOT_FOUND)', async () => {
    await expect(
      callerB.document.getDownloadUrl({ documentId: DOCUMENT_A_ID }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('orgA can download own document', async () => {
    const result = await callerA.document.getDownloadUrl({ documentId: DOCUMENT_A_ID });
    expect(result).toHaveProperty('url');
    expect(result).toHaveProperty('expiresIn', 900);
  });

  it('document.getDownloadUrl queries with caller organizationId in where', async () => {
    await callerA.document.getDownloadUrl({ documentId: DOCUMENT_A_ID });
    const call = mockPrisma.document.findFirst.mock.calls[0]?.[0];
    expect(call?.where).toHaveProperty('organizationId', ORG_A_ID);
    expect(call?.where).toHaveProperty('id', DOCUMENT_A_ID);
  });

  it('document.list scopes to caller organization', async () => {
    await callerA.document.list({ page: 1, pageSize: 10 });
    const call = mockPrisma.document.findMany.mock.calls[0]?.[0];
    expect(call?.where).toHaveProperty('organizationId', ORG_A_ID);
  });
});

// ===========================================================================
// 4. Search isolation
// ===========================================================================

describe('Search isolation', () => {
  it('orgA search passes orgA organizationId to all raw queries', async () => {
    await callerA.search.global({ query: 'alpha' });
    const calls = mockPrisma.$queryRaw.mock.calls;
    // 3 parallel raw queries: contractors, contracts, invoices
    expect(calls.length).toBe(3);
    for (const call of calls) {
      const serialized = JSON.stringify(call);
      expect(serialized).toContain(ORG_A_ID);
      expect(serialized).not.toContain(ORG_B_ID);
    }
  });

  it('orgB search passes orgB organizationId and never orgA', async () => {
    await callerB.search.global({ query: 'beta' });
    const calls = mockPrisma.$queryRaw.mock.calls;
    expect(calls.length).toBe(3);
    for (const call of calls) {
      const serialized = JSON.stringify(call);
      expect(serialized).toContain(ORG_B_ID);
      expect(serialized).not.toContain(ORG_A_ID);
    }
  });

  it('search results from orgB data never appear for orgA caller', async () => {
    mockPrisma.$queryRaw.mockImplementation(async (...args: unknown[]) => {
      const serialized = JSON.stringify(args);
      if (serialized.includes(ORG_B_ID)) {
        return [
          {
            id: CONTRACTOR_B_ID,
            name: 'Beta Services S.A.',
            subtitle: '2222222222',
            type: 'contractor',
          },
        ];
      }
      return [];
    });

    const resultsA = await callerA.search.global({ query: 'beta' });
    expect(resultsA).toEqual([]);

    const resultsB = await callerB.search.global({ query: 'beta' });
    expect(resultsB.length).toBeGreaterThan(0);
    expect(resultsB.some((r: { id: string }) => r.id === CONTRACTOR_B_ID)).toBe(true);
  });
});

// ===========================================================================
// 5. Audit log isolation
// ===========================================================================

describe('Audit log isolation', () => {
  it('orgA audit.list returns only orgA entries', async () => {
    const result = await callerA.audit.list({ page: 1, pageSize: 25, sortOrder: 'desc' });
    const ids = result.items.map((e: { id: string }) => e.id);
    expect(ids).toContain('audit-a-001');
    expect(ids).not.toContain('audit-b-001');
  });

  it('orgB audit.list returns only orgB entries', async () => {
    const result = await callerB.audit.list({ page: 1, pageSize: 25, sortOrder: 'desc' });
    const ids = result.items.map((e: { id: string }) => e.id);
    expect(ids).toContain('audit-b-001');
    expect(ids).not.toContain('audit-a-001');
  });

  it('audit.list where clause scopes to caller organizationId', async () => {
    await callerA.audit.list({ page: 1, pageSize: 10, sortOrder: 'desc' });
    const call = mockPrisma.auditLog.findMany.mock.calls[0]?.[0];
    expect(call?.where).toHaveProperty('organizationId', ORG_A_ID);
  });

  it('audit.actors only returns actors from the caller org', async () => {
    await callerA.audit.actors();
    const call = mockPrisma.auditLog.findMany.mock.calls[0]?.[0];
    expect(call?.where).toHaveProperty('organizationId', ORG_A_ID);
  });
});

// ===========================================================================
// 6. Approval flow isolation
// ===========================================================================

describe('Approval flow isolation', () => {
  it('orgA listChains returns only orgA chains', async () => {
    const result = await callerA.approval.listChains();
    const ids = (result as Array<{ id: string }>).map(c => c.id);
    expect(ids).toContain(APPROVAL_CHAIN_A_ID);
    expect(ids).not.toContain(APPROVAL_CHAIN_B_ID);
  });

  it('orgB listChains returns only orgB chains', async () => {
    const result = await callerB.approval.listChains();
    const ids = (result as Array<{ id: string }>).map(c => c.id);
    expect(ids).toContain(APPROVAL_CHAIN_B_ID);
    expect(ids).not.toContain(APPROVAL_CHAIN_A_ID);
  });

  it('orgA getChain for orgB chain returns NOT_FOUND', async () => {
    await expect(callerA.approval.getChain({ id: APPROVAL_CHAIN_B_ID })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('orgA listPending returns only orgA pending steps', async () => {
    const result = await callerA.approval.listPending({
      page: 1,
      pageSize: 25,
      tab: 'all',
      status: 'pending',
    });
    const ids = result.items.map((s: { id: string }) => s.id);
    expect(ids).toContain(APPROVAL_STEP_A_ID);
    expect(ids).not.toContain(APPROVAL_STEP_B_ID);
  });

  it('orgA approve on orgB step returns NOT_FOUND', async () => {
    await expect(
      callerA.approval.approve({ stepId: APPROVAL_STEP_B_ID, comment: 'Approved' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('orgA reject on orgB step returns NOT_FOUND', async () => {
    await expect(
      callerA.approval.reject({
        stepId: APPROVAL_STEP_B_ID,
        comment: 'This invoice is not valid for our organization',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('orgA getAuditTrail for orgB invoice returns empty events', async () => {
    const result = await callerA.approval.getAuditTrail({ invoiceId: INVOICE_B_ID });
    expect(result.events).toEqual([]);
    expect(result.flow).toBeNull();
  });

  it('approval.listPending where clause includes caller organizationId', async () => {
    await callerB.approval.listPending({
      page: 1,
      pageSize: 10,
      tab: 'all',
      status: 'all',
    });
    const call = mockPrisma.approvalStep.findMany.mock.calls[0]?.[0];
    expect(call?.where).toHaveProperty('organizationId', ORG_B_ID);
  });
});

// ===========================================================================
// 7. Middleware-level isolation guarantees
// ===========================================================================

describe('Middleware-level isolation guarantees', () => {
  it('tenantProcedure rejects when no active organization is set', async () => {
    const noOrgCaller = createCaller({
      headers: new Headers(),
      session: {
        session: {
          id: 'session-no-org',
          userId: USER_A_ID,
          activeOrganizationId: null,
          expiresAt: new Date('2099-01-01'),
          token: 'mock-token',
          createdAt: new Date(),
          updatedAt: new Date(),
          ipAddress: null,
          userAgent: null,
        },
        user: {
          id: USER_A_ID,
          name: 'User A',
          email: 'a@example.com',
          emailVerified: true,
          image: null,
          banned: false,
          banReason: null,
          banExpires: null,
          role: 'admin',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      } as never,
      user: {
        id: USER_A_ID,
        name: 'User A',
        email: 'a@example.com',
        emailVerified: true,
        image: null,
        banned: false,
        banReason: null,
        banExpires: null,
        role: 'admin',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never,
    });

    await expect(noOrgCaller.contractor.list({ page: 1, pageSize: 10 })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('tenantProcedure rejects unauthenticated requests', async () => {
    const unauthCaller = createCaller({
      headers: new Headers(),
      session: null,
      user: null,
    });

    await expect(unauthCaller.contractor.list({ page: 1, pageSize: 10 })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('concurrent callers maintain independent tenant scoping', async () => {
    const [resultA, resultB] = await Promise.all([
      callerA.contractor.list({ page: 1, pageSize: 25 }),
      callerB.contractor.list({ page: 1, pageSize: 25 }),
    ]);

    const idsA = resultA.items.map(c => (c as { id: string }).id);
    const idsB = resultB.items.map(c => (c as { id: string }).id);

    expect(idsA).toContain(CONTRACTOR_A_ID);
    expect(idsA).not.toContain(CONTRACTOR_B_ID);
    expect(idsB).toContain(CONTRACTOR_B_ID);
    expect(idsB).not.toContain(CONTRACTOR_A_ID);
  });
});
