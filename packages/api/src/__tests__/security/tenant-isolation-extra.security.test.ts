/**
 * Cross-tenant isolation (IDOR) regression coverage for resources NOT covered
 * by `../tenant-isolation.test.ts` — equipment, payment runs, contracts,
 * reminders, notifications, and timesheets.
 *
 * Same strategy as the sibling suite: mock `@contractor-ops/db` with an
 * in-memory org-scoped collection so we control what Prisma returns, mock
 * `@contractor-ops/auth` so RBAC passes, then drive the real `appRouter`
 * through two callers (orgA / orgB).
 *
 * A mocked Prisma cannot prove a real leak (the mock echoes the `where` it is
 * handed), so these tests regression-LOCK the presence of the org guard: the
 * list returns only the caller's rows, a cross-org get-by-id rejects
 * NOT_FOUND, and the findMany/findFirst `where` always carries the caller
 * organizationId.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORG_A_ID = 'org-a-00000000-0000-0000-0000-000000000001';
const ORG_B_ID = 'org-b-00000000-0000-0000-0000-000000000002';
const USER_A_ID = 'user-a-00000000-0000-0000-0000-000000000001';
const USER_B_ID = 'user-b-00000000-0000-0000-0000-000000000002';
const EQUIPMENT_A_ID = 'equipment-a-001';
const EQUIPMENT_B_ID = 'equipment-b-001';
// payment.get input is z.cuid() — these must satisfy the cuid format.
const PAYMENT_RUN_A_ID = 'cm5xj9k2a0000abcd1234efga';
const PAYMENT_RUN_B_ID = 'cm5xj9k2a0000abcd1234efgb';
const CONTRACT_A_ID = 'contract-a-001';
const CONTRACT_B_ID = 'contract-b-001';
const REMINDER_RULE_A_ID = 'reminder-a-001';
const REMINDER_RULE_B_ID = 'reminder-b-001';
const NOTIFICATION_A_ID = 'notification-a-001';
const NOTIFICATION_B_ID = 'notification-b-001';
const TIMESHEET_A_ID = 'timesheet-a-001';
const TIMESHEET_B_ID = 'timesheet-b-001';

// ---------------------------------------------------------------------------
// Mock Prisma — built via vi.hoisted so vi.mock factories can reference it
// ---------------------------------------------------------------------------

const { mockPrisma } = vi.hoisted(() => {
  type Rec = Record<string, unknown>;

  const OrgA = 'org-a-00000000-0000-0000-0000-000000000001';
  const OrgB = 'org-b-00000000-0000-0000-0000-000000000002';
  const UserA = 'user-a-00000000-0000-0000-0000-000000000001';
  const UserB = 'user-b-00000000-0000-0000-0000-000000000002';

  const equipmentA: Rec = {
    id: 'equipment-a-001',
    organizationId: OrgA,
    name: 'MacBook Pro A',
    serialNumber: 'SN-A-001',
    type: 'LAPTOP',
    customType: null,
    status: 'AVAILABLE',
    notes: null,
    purchaseDate: null,
    deletedAt: null,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-06-01'),
    assignments: [],
    shipments: [],
    _count: { shipments: 0 },
  };
  const equipmentB: Rec = {
    id: 'equipment-b-001',
    organizationId: OrgB,
    name: 'MacBook Pro B',
    serialNumber: 'SN-B-001',
    type: 'LAPTOP',
    customType: null,
    status: 'AVAILABLE',
    notes: null,
    purchaseDate: null,
    deletedAt: null,
    createdAt: new Date('2025-02-01'),
    updatedAt: new Date('2025-07-01'),
    assignments: [],
    shipments: [],
    _count: { shipments: 0 },
  };

  const paymentRunA: Rec = {
    id: 'cm5xj9k2a0000abcd1234efga',
    organizationId: OrgA,
    runNumber: 'PR-A-001',
    name: 'Org A run',
    status: 'DRAFT',
    currency: 'PLN',
    totalMinor: 100000,
    invoiceCount: 1,
    createdByUserId: UserA,
    createdAt: new Date('2025-03-01'),
    items: [],
    exports: [],
    _count: { items: 0 },
  };
  const paymentRunB: Rec = {
    id: 'cm5xj9k2a0000abcd1234efgb',
    organizationId: OrgB,
    runNumber: 'PR-B-001',
    name: 'Org B run',
    status: 'DRAFT',
    currency: 'EUR',
    totalMinor: 200000,
    invoiceCount: 1,
    createdByUserId: UserB,
    createdAt: new Date('2025-04-01'),
    items: [],
    exports: [],
    _count: { items: 0 },
  };

  const contractA: Rec = {
    id: 'contract-a-001',
    organizationId: OrgA,
    contractorId: 'contractor-a-001',
    title: 'Org A Engagement',
    type: 'SERVICE',
    status: 'DRAFT',
    startDate: new Date('2025-01-01'),
    endDate: null,
    metadataJson: null,
    deletedAt: null,
    createdAt: new Date('2025-01-01'),
    contractor: null,
    amendments: [],
    internalOwner: null,
    _count: { invoices: 0 },
  };
  const contractB: Rec = {
    id: 'contract-b-001',
    organizationId: OrgB,
    contractorId: 'contractor-b-001',
    title: 'Org B Engagement',
    type: 'SERVICE',
    status: 'DRAFT',
    startDate: new Date('2025-02-01'),
    endDate: null,
    metadataJson: null,
    deletedAt: null,
    createdAt: new Date('2025-02-01'),
    contractor: null,
    amendments: [],
    internalOwner: null,
    _count: { invoices: 0 },
  };

  const reminderRuleA: Rec = {
    id: 'reminder-a-001',
    organizationId: OrgA,
    name: 'Org A reminder',
    entityType: 'CONTRACT',
    triggerType: 'BEFORE_EXPIRY',
    channel: 'EMAIL',
    active: true,
    createdAt: new Date('2025-01-01'),
  };
  const reminderRuleB: Rec = {
    id: 'reminder-b-001',
    organizationId: OrgB,
    name: 'Org B reminder',
    entityType: 'CONTRACT',
    triggerType: 'BEFORE_EXPIRY',
    channel: 'EMAIL',
    active: true,
    createdAt: new Date('2025-01-01'),
  };

  const notificationA: Rec = {
    id: 'notification-a-001',
    organizationId: OrgA,
    userId: UserA,
    type: 'CONTRACT_EXPIRING',
    status: 'SENT',
    readAt: null,
    createdAt: new Date('2025-05-01'),
  };
  const notificationB: Rec = {
    id: 'notification-b-001',
    organizationId: OrgB,
    userId: UserB,
    type: 'CONTRACT_EXPIRING',
    status: 'SENT',
    readAt: null,
    createdAt: new Date('2025-05-02'),
  };

  const timesheetA: Rec = {
    id: 'timesheet-a-001',
    organizationId: OrgA,
    contractorId: 'contractor-a-001',
    status: 'SUBMITTED',
    weekStartDate: new Date('2025-05-05'),
    submittedAt: new Date('2025-05-09'),
    contractor: { id: 'contractor-a-001', legalName: 'Alpha', email: 'a@example.com' },
    entries: [],
    _count: { entries: 0 },
  };
  const timesheetB: Rec = {
    id: 'timesheet-b-001',
    organizationId: OrgB,
    contractorId: 'contractor-b-001',
    status: 'SUBMITTED',
    weekStartDate: new Date('2025-05-05'),
    submittedAt: new Date('2025-05-09'),
    contractor: { id: 'contractor-b-001', legalName: 'Beta', email: 'b@example.com' },
    entries: [],
    _count: { entries: 0 },
  };

  /** Primary DB routing rows — getOrgMeta reads dataRegion/status via prisma.organization */
  const orgARecord: Rec = {
    id: OrgA,
    dataRegion: 'EU',
    status: 'ACTIVE',
    name: 'Org A',
    slug: 'org-a',
    logo: null,
    countryCode: 'PL',
  };
  const orgBRecord: Rec = {
    id: OrgB,
    dataRegion: 'EU',
    status: 'ACTIVE',
    name: 'Org B',
    slug: 'org-b',
    logo: null,
    countryCode: 'DE',
  };

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
      findMany: vi.fn(async (opts?: { where?: Rec }) => filterByWhere(collection, opts?.where)),
      findFirst: vi.fn(async (opts?: { where?: Rec }) => {
        const results = filterByWhere(collection, opts?.where);
        return results[0] ?? null;
      }),
      findUnique: vi.fn(async (opts?: { where?: Rec }) => {
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
    equipment: model([equipmentA, equipmentB]),
    equipmentAssignment: model([]),
    paymentRun: model([paymentRunA, paymentRunB]),
    paymentRunItem: model([]),
    contract: model([contractA, contractB]),
    contractAmendment: model([]),
    reminderRule: model([reminderRuleA, reminderRuleB]),
    reminderInstance: model([]),
    notification: model([notificationA, notificationB]),
    timesheet: model([timesheetA, timesheetB]),
    documentLink: model([]),
    invoice: model([]),
    contractor: model([]),
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
  withRlsTransactions: <T>(c: T) => c,
  withRlsReads: <T>(c: T) => c,
  prisma: mockPrisma,
  prismaRaw: mockPrisma,
  tenantStore: {
    run: (_ctx: unknown, fn: () => unknown) => fn(),
    getStore: vi.fn(),
  },
  withTenantScope: vi.fn((c: unknown) => c),
  withSoftDelete: vi.fn((c: unknown) => c),
  createTenantClient: vi.fn(() => mockPrisma),
  createTenantClientFrom: vi.fn(() => mockPrisma),
  getRegionalClient: vi.fn(() => mockPrisma),
  preWarmRegionalClients: vi.fn(),
}));

vi.mock('../../services/r2', () => ({
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

vi.mock('../../services/regional-storage', () => ({
  createRegionalPresignedUploadUrl: vi.fn(async () => 'https://r2.example.com/upload'),
  createRegionalPresignedDownloadUrl: vi.fn(async () => 'https://r2.example.com/download'),
  headRegionalObject: vi.fn(async () => ({ ContentLength: 1024 })),
  deleteRegionalObject: vi.fn(async () => undefined),
  getRegionalObject: vi.fn(async () => ({ Body: new Uint8Array(100) })),
}));

vi.mock('../../services/notification-service', () => ({
  dispatch: vi.fn(async () => undefined),
  getOrCreatePreferences: vi.fn(async () => ({})),
}));

vi.mock('../../services/invoice-matching', () => ({
  computeDuplicateCheckHash: vi.fn(() => 'hash'),
  runAutoMatch: vi.fn(async () => undefined),
}));

vi.mock('../../services/bank-account-crypto', () => ({
  encryptBankAccount: vi.fn((v: string) => `encrypted:${v}`),
}));

vi.mock('../../services/sanitize', () => ({
  sanitizeStrings: vi.fn(<T>(v: T) => v),
}));

vi.mock('../../services/approval-engine', () => ({
  routeToChain: vi.fn(async () => null),
  createApprovalFlow: vi.fn(async () => ({})),
  advanceFlow: vi.fn(async () => undefined),
  computeSlaStatus: vi.fn(() => 'ON_TIME'),
}));

vi.mock('../../services/calendar-event-service', () => ({
  deleteCalendarEvent: vi.fn(async () => undefined),
}));

vi.mock('../../services/calendar-deadline-sync', () => ({
  syncPaymentDueDeadline: vi.fn(async () => undefined),
  syncApprovalSlaDeadline: vi.fn(async () => undefined),
  syncContractExpiryDeadline: vi.fn(async () => undefined),
}));

vi.mock('../../services/report-export', () => ({
  generateAuditCsv: vi.fn(async () => ({
    base64: 'bW9jaw==',
    filename: 'audit-log-2025-01-01.csv',
  })),
}));

vi.mock('../../services/billing-service', () => ({
  syncSeatCountForOrg: vi.fn(async () => undefined),
}));

vi.mock('../../services/cache', () => ({
  cacheKey: vi.fn((...s: string[]) => s.join(':')),
  cachedSingleflight: vi.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
  cached: vi.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
  invalidate: vi.fn(async () => undefined),
  invalidateByPrefix: vi.fn(async () => undefined),
  CacheKeys: { approvalChains: (orgId: string) => `approval-chains:${orgId}` },
  CacheTTL: { APPROVAL_CHAINS: 300 },
}));

vi.mock('../../services/mime-validator', () => ({
  isAllowedMimeType: vi.fn(() => true),
  validateMimeType: vi.fn(async () => ({ valid: true })),
}));

vi.mock('../../services/virus-scanner', () => ({
  isClamAvailable: vi.fn(async () => false),
  scanBuffer: vi.fn(async () => ({ clean: true })),
}));

vi.mock('../../services/stripe-client', () => ({
  stripe: {
    subscriptions: { retrieve: vi.fn(), update: vi.fn(), list: vi.fn(async () => ({ data: [] })) },
    customers: { create: vi.fn(), retrieve: vi.fn() },
    checkout: { sessions: { create: vi.fn() } },
    billingPortal: { sessions: { create: vi.fn() } },
    invoices: { retrieveUpcoming: vi.fn() },
  },
}));

vi.mock('../../services/credit-service', () => ({
  deductCredits: vi.fn(async () => undefined),
  getBalance: vi.fn(async () => ({ credits: 0 })),
  hasCredits: vi.fn(async () => true),
}));

vi.mock('../../services/ocr-extraction', () => ({
  extractInvoiceData: vi.fn(async () => ({})),
}));

vi.mock('../../services/billing-webhook', () => ({
  handleStripeWebhook: vi.fn(async () => undefined),
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

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { createCallerFactory } from '../../init';
import { appRouter } from '../../root';

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
// 1. Equipment isolation
// ===========================================================================

describe('Equipment isolation', () => {
  it('orgA list returns only orgA equipment', async () => {
    const result = await callerA.equipment.list({});
    const ids = result.items.map((e: { id: string }) => e.id);
    expect(ids).toContain(EQUIPMENT_A_ID);
    expect(ids).not.toContain(EQUIPMENT_B_ID);
  });

  it('orgB list returns only orgB equipment', async () => {
    const result = await callerB.equipment.list({});
    const ids = result.items.map((e: { id: string }) => e.id);
    expect(ids).toContain(EQUIPMENT_B_ID);
    expect(ids).not.toContain(EQUIPMENT_A_ID);
  });

  it('orgA getById for orgB equipment returns NOT_FOUND', async () => {
    await expect(callerA.equipment.getById({ id: EQUIPMENT_B_ID })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('orgB getById for orgA equipment returns NOT_FOUND', async () => {
    await expect(callerB.equipment.getById({ id: EQUIPMENT_A_ID })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('orgA update on orgB equipment returns NOT_FOUND', async () => {
    await expect(
      callerA.equipment.update({ id: EQUIPMENT_B_ID, name: 'Hacked' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('equipment.list where clause always includes the caller organizationId', async () => {
    await callerA.equipment.list({});
    const call = mockPrisma.equipment.findMany.mock.calls[0]?.[0];
    expect(call?.where).toHaveProperty('organizationId', ORG_A_ID);
  });

  it('equipment.getById where clause includes the caller organizationId', async () => {
    await callerA.equipment.getById({ id: EQUIPMENT_A_ID });
    const call = mockPrisma.equipment.findFirst.mock.calls[0]?.[0];
    expect(call?.where).toHaveProperty('organizationId', ORG_A_ID);
    expect(call?.where).toHaveProperty('id', EQUIPMENT_A_ID);
  });
});

// ===========================================================================
// 2. Payment run isolation
// ===========================================================================

describe('Payment run isolation', () => {
  it('orgA list returns only orgA payment runs', async () => {
    const result = await callerA.payment.list({});
    const ids = result.items.map((r: { id: string }) => r.id);
    expect(ids).toContain(PAYMENT_RUN_A_ID);
    expect(ids).not.toContain(PAYMENT_RUN_B_ID);
  });

  it('orgB list returns only orgB payment runs', async () => {
    const result = await callerB.payment.list({});
    const ids = result.items.map((r: { id: string }) => r.id);
    expect(ids).toContain(PAYMENT_RUN_B_ID);
    expect(ids).not.toContain(PAYMENT_RUN_A_ID);
  });

  it('orgA get for orgB payment run returns NOT_FOUND', async () => {
    await expect(callerA.payment.get({ runId: PAYMENT_RUN_B_ID })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('orgB get for orgA payment run returns NOT_FOUND', async () => {
    await expect(callerB.payment.get({ runId: PAYMENT_RUN_A_ID })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('payment.list where clause always includes the caller organizationId', async () => {
    await callerB.payment.list({});
    const call = mockPrisma.paymentRun.findMany.mock.calls[0]?.[0];
    expect(call?.where).toHaveProperty('organizationId', ORG_B_ID);
  });

  it('payment.get where clause includes the caller organizationId', async () => {
    await callerA.payment.get({ runId: PAYMENT_RUN_A_ID });
    const call = mockPrisma.paymentRun.findFirst.mock.calls[0]?.[0];
    expect(call?.where).toHaveProperty('organizationId', ORG_A_ID);
    expect(call?.where).toHaveProperty('id', PAYMENT_RUN_A_ID);
  });
});

// ===========================================================================
// 3. Contract isolation
// ===========================================================================

describe('Contract isolation', () => {
  it('orgA list returns only orgA contracts', async () => {
    const result = await callerA.contract.list({});
    const ids = result.items.map((c: { id: string }) => c.id);
    expect(ids).toContain(CONTRACT_A_ID);
    expect(ids).not.toContain(CONTRACT_B_ID);
  });

  it('orgB list returns only orgB contracts', async () => {
    const result = await callerB.contract.list({});
    const ids = result.items.map((c: { id: string }) => c.id);
    expect(ids).toContain(CONTRACT_B_ID);
    expect(ids).not.toContain(CONTRACT_A_ID);
  });

  it('orgA getById for orgB contract returns NOT_FOUND', async () => {
    await expect(callerA.contract.getById({ id: CONTRACT_B_ID })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('orgB getById for orgA contract returns NOT_FOUND', async () => {
    await expect(callerB.contract.getById({ id: CONTRACT_A_ID })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('orgA update on orgB contract returns NOT_FOUND', async () => {
    await expect(
      callerA.contract.update({ id: CONTRACT_B_ID, data: { title: 'Hacked' } }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('contract.list where clause always includes the caller organizationId', async () => {
    await callerA.contract.list({});
    const call = mockPrisma.contract.findMany.mock.calls[0]?.[0];
    expect(call?.where).toHaveProperty('organizationId', ORG_A_ID);
  });

  it('contract.getById where clause includes the caller organizationId', async () => {
    await callerA.contract.getById({ id: CONTRACT_A_ID });
    const call = mockPrisma.contract.findFirst.mock.calls[0]?.[0];
    expect(call?.where).toHaveProperty('organizationId', ORG_A_ID);
    expect(call?.where).toHaveProperty('id', CONTRACT_A_ID);
  });
});

// ===========================================================================
// 4. Reminder rule isolation
// ===========================================================================

describe('Reminder rule isolation', () => {
  it('orgA list returns only orgA reminder rules', async () => {
    const result = (await callerA.reminder.list()) as Array<{ id: string }>;
    const ids = result.map(r => r.id);
    expect(ids).toContain(REMINDER_RULE_A_ID);
    expect(ids).not.toContain(REMINDER_RULE_B_ID);
  });

  it('orgB list returns only orgB reminder rules', async () => {
    const result = (await callerB.reminder.list()) as Array<{ id: string }>;
    const ids = result.map(r => r.id);
    expect(ids).toContain(REMINDER_RULE_B_ID);
    expect(ids).not.toContain(REMINDER_RULE_A_ID);
  });

  it('orgA update on orgB reminder rule returns NOT_FOUND', async () => {
    await expect(
      callerA.reminder.update({ id: REMINDER_RULE_B_ID, name: 'Hacked' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('orgA delete on orgB reminder rule returns NOT_FOUND', async () => {
    await expect(callerA.reminder.delete({ id: REMINDER_RULE_B_ID })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('reminder.list where clause always includes the caller organizationId', async () => {
    await callerA.reminder.list();
    const call = mockPrisma.reminderRule.findMany.mock.calls[0]?.[0];
    expect(call?.where).toHaveProperty('organizationId', ORG_A_ID);
  });
});

// ===========================================================================
// 5. Notification isolation
// ===========================================================================

describe('Notification isolation', () => {
  it('orgA list returns only orgA notifications', async () => {
    const result = await callerA.notification.list({});
    const ids = result.items.map((n: { id: string }) => n.id);
    expect(ids).toContain(NOTIFICATION_A_ID);
    expect(ids).not.toContain(NOTIFICATION_B_ID);
  });

  it('orgB list returns only orgB notifications', async () => {
    const result = await callerB.notification.list({});
    const ids = result.items.map((n: { id: string }) => n.id);
    expect(ids).toContain(NOTIFICATION_B_ID);
    expect(ids).not.toContain(NOTIFICATION_A_ID);
  });

  it('notification.list where clause includes the caller organizationId (and userId)', async () => {
    await callerA.notification.list({});
    const call = mockPrisma.notification.findMany.mock.calls[0]?.[0];
    expect(call?.where).toHaveProperty('organizationId', ORG_A_ID);
    expect(call?.where).toHaveProperty('userId', USER_A_ID);
  });
});

// ===========================================================================
// 6. Timesheet isolation
// ===========================================================================

describe('Timesheet isolation', () => {
  it('orgA listAll returns only orgA timesheets', async () => {
    const result = await callerA.time.listAll({});
    const ids = result.items.map((t: { id: string }) => t.id);
    expect(ids).toContain(TIMESHEET_A_ID);
    expect(ids).not.toContain(TIMESHEET_B_ID);
  });

  it('orgB listAll returns only orgB timesheets', async () => {
    const result = await callerB.time.listAll({});
    const ids = result.items.map((t: { id: string }) => t.id);
    expect(ids).toContain(TIMESHEET_B_ID);
    expect(ids).not.toContain(TIMESHEET_A_ID);
  });

  it('orgA getTimesheet for orgB timesheet returns NOT_FOUND', async () => {
    await expect(callerA.time.getTimesheet({ timesheetId: TIMESHEET_B_ID })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('orgB getTimesheet for orgA timesheet returns NOT_FOUND', async () => {
    await expect(callerB.time.getTimesheet({ timesheetId: TIMESHEET_A_ID })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('time.listAll where clause always includes the caller organizationId', async () => {
    await callerA.time.listAll({});
    const call = mockPrisma.timesheet.findMany.mock.calls[0]?.[0];
    expect(call?.where).toHaveProperty('organizationId', ORG_A_ID);
  });

  it('time.getTimesheet where clause includes the caller organizationId', async () => {
    await callerA.time.getTimesheet({ timesheetId: TIMESHEET_A_ID });
    const call = mockPrisma.timesheet.findFirst.mock.calls[0]?.[0];
    expect(call?.where).toHaveProperty('organizationId', ORG_A_ID);
    expect(call?.where).toHaveProperty('id', TIMESHEET_A_ID);
  });
});
