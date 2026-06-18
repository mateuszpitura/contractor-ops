/**
 * Portal cross-contractor IDOR coverage.
 *
 * The portal session authorises ONE contractor; every portal read must be
 * scoped to `ctx.contractorId`. Only the tax-form surface had a dedicated
 * foreign-id test — invoices, contracts, and equipment did not. This suite
 * drives the REAL `portalAppRouter` through two distinct portal sessions
 * (contractor A / contractor B) and asserts:
 *
 *   - list procedures return only the caller's rows (no foreign leak),
 *   - get-by-id of a foreign row rejects NOT_FOUND,
 *   - the underlying Prisma `where` always carries the caller's contractorId.
 *
 * Same caveat as the sibling tenant-isolation suites: a mocked Prisma echoes the
 * `where` it is handed, so this regression-LOCKS the presence of the
 * contractor-scope guard rather than proving a live DB leak (that lives in the
 * gitignored harness).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ORG_ID = 'org-portal-idor-001';
const CONTRACTOR_A = 'contractor-portal-a-001';
const CONTRACTOR_B = 'contractor-portal-b-002';
const TOKEN_A = 'portal-session-token-a';
const TOKEN_B = 'portal-session-token-b';

const INVOICE_A = 'invoice-a-001';
const INVOICE_B = 'invoice-b-001';
const CONTRACT_A = 'contract-a-001';
const CONTRACT_B = 'contract-b-001';
const ASSIGNMENT_A = 'assignment-a-001';
const ASSIGNMENT_B = 'assignment-b-001';

type Rec = Record<string, unknown>;

const { mockPrisma } = vi.hoisted(() => {
  const ORG = 'org-portal-idor-001';
  const A = 'contractor-portal-a-001';
  const B = 'contractor-portal-b-002';

  const invoiceA: Rec = {
    id: 'invoice-a-001',
    organizationId: ORG,
    contractorId: A,
    invoiceNumber: 'INV-A-1',
    contractId: 'contract-a-001',
    subtotalMinor: 1000,
    totalMinor: 1230,
    amountToPayMinor: 1230,
    currency: 'PLN',
    issueDate: new Date('2025-01-01'),
    dueDate: new Date('2025-02-01'),
    receivedAt: new Date('2025-01-02'),
    reviewedAt: null,
    approvedAt: null,
    paidAt: null,
    rejectedAt: null,
    rejectionReason: null,
    status: 'RECEIVED',
    matchStatus: 'UNMATCHED',
    approvalStatus: 'NOT_STARTED',
    paymentStatus: 'NOT_READY',
    deletedAt: null,
    contract: { id: 'contract-a-001', title: 'A Engagement' },
    files: [],
  };
  const invoiceB: Rec = {
    ...invoiceA,
    id: 'invoice-b-001',
    contractorId: B,
    invoiceNumber: 'INV-B-1',
    contractId: 'contract-b-001',
    contract: { id: 'contract-b-001', title: 'B Engagement' },
  };

  const contractA: Rec = {
    id: 'contract-a-001',
    organizationId: ORG,
    contractorId: A,
    contractNumber: 'C-A-1',
    title: 'A Engagement',
    type: 'SERVICE',
    status: 'ACTIVE',
    startDate: new Date('2025-01-01'),
    endDate: null,
    currency: 'PLN',
    billingModel: 'HOURLY',
    rateType: 'HOURLY',
    rateValueMinor: 10000,
    paymentTermsDays: 30,
    autoRenewal: false,
    noticePeriodDays: 30,
    ratePeriods: [],
  };
  const contractB: Rec = {
    ...contractA,
    id: 'contract-b-001',
    contractorId: B,
    contractNumber: 'C-B-1',
    title: 'B Engagement',
  };

  const assignmentA: Rec = {
    id: 'assignment-a-001',
    organizationId: ORG,
    contractorId: A,
    assignedAt: new Date('2025-01-01'),
    unassignedAt: null,
    equipment: {
      id: 'equip-a',
      name: 'Laptop A',
      serialNumber: 'SN-A',
      type: 'LAPTOP',
      status: 'ASSIGNED',
      shipments: [],
    },
  };
  const assignmentB: Rec = {
    ...assignmentA,
    id: 'assignment-b-001',
    contractorId: B,
    equipment: {
      id: 'equip-b',
      name: 'Laptop B',
      serialNumber: 'SN-B',
      type: 'LAPTOP',
      status: 'ASSIGNED',
      shipments: [],
    },
  };

  type OperatorCheck = (v: unknown, op: unknown) => boolean;
  const Ops: Record<string, OperatorCheck> = {
    in: (v, op) => Array.isArray(op) && op.includes(v),
    notIn: (v, op) => !(Array.isArray(op) && op.includes(v)),
    not: (v, op) => v !== op,
    gte: (v, op) => v instanceof Date && op instanceof Date && v >= op,
    lte: (v, op) => v instanceof Date && op instanceof Date && v <= op,
    equals: (v, op) => v === op,
  };
  function matchesOperator(v: unknown, operator: Rec): boolean {
    for (const [op, operand] of Object.entries(operator)) {
      const check = Ops[op];
      if (check && !check(v, operand)) return false;
    }
    return true;
  }
  function filterByWhere(collection: Rec[], where?: Rec): Rec[] {
    if (!where) return [...collection];
    return collection.filter(item => {
      for (const [key, value] of Object.entries(where)) {
        if (['OR', 'AND', 'NOT'].includes(key)) continue;
        if (value === null) {
          if (item[key] !== null && item[key] !== undefined) return false;
          continue;
        }
        if (value instanceof Date) {
          if (!(item[key] instanceof Date) || (item[key] as Date).getTime() !== value.getTime())
            return false;
          continue;
        }
        if (typeof value === 'object') {
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
      findFirst: vi.fn(
        async (opts?: { where?: Rec }) => filterByWhere(collection, opts?.where)[0] ?? null,
      ),
      findUnique: vi.fn(
        async (opts?: { where?: Rec }) => filterByWhere(collection, opts?.where)[0] ?? null,
      ),
      count: vi.fn(async (opts?: { where?: Rec }) => filterByWhere(collection, opts?.where).length),
    };
  }

  const mockPrisma: Rec = {
    organization: {
      findUnique: vi.fn(async () => ({ id: ORG, dataRegion: 'EU', status: 'ACTIVE' })),
    },
    invoice: model([invoiceA, invoiceB]),
    contract: model([contractA, contractB]),
    equipmentAssignment: model([assignmentA, assignmentB]),
    returnRequest: model([]),
    paymentRunItem: model([]),
    documentLink: model([]),
    $transaction: vi.fn(async (fn: (tx: Rec) => Promise<unknown>) => fn(mockPrisma)),
  };

  return { mockPrisma };
});

vi.mock('@contractor-ops/auth', () => ({
  auth: {
    api: { getSession: vi.fn(), hasPermission: vi.fn().mockResolvedValue({ success: true }) },
  },
  authApi: { hasPermission: vi.fn().mockResolvedValue({ success: true }) },
}));

vi.mock('@contractor-ops/db', () => ({
  withRlsTransactions: <T>(c: T) => c,
  withRlsReads: <T>(c: T) => c,
  prisma: mockPrisma,
  prismaRaw: mockPrisma,
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

vi.mock('@contractor-ops/feature-flags', () => ({
  evaluate: vi.fn(() => ({ enabled: true, reason: 'unleash' })),
  buildFlagBag: vi.fn(() => ({ isEnabled: () => true })),
}));

vi.mock('../../services/portal-session', () => ({
  validatePortalSession: vi.fn(async (token: string) => {
    if (token === TOKEN_A) {
      return {
        contractorId: CONTRACTOR_A,
        organizationId: ORG_ID,
        email: 'a@test.com',
        contractor: { id: CONTRACTOR_A, email: 'a@test.com' },
      };
    }
    if (token === TOKEN_B) {
      return {
        contractorId: CONTRACTOR_B,
        organizationId: ORG_ID,
        email: 'b@test.com',
        contractor: { id: CONTRACTOR_B, email: 'b@test.com' },
      };
    }
    return null;
  }),
  createPortalSession: vi.fn(),
  deletePortalSession: vi.fn(),
}));

vi.mock('@contractor-ops/logger', () => ({
  getIdpAuditLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
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
  createTrpcLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { increment: vi.fn(), histogram: vi.fn(), distribution: vi.fn() },
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

vi.mock('../../services/audit-writer', () => ({ writeAuditLog: vi.fn(async () => undefined) }));

import { createCallerFactory } from '../../init';
import { portalAppRouter } from '../../portal-root';

const createCaller = createCallerFactory(portalAppRouter);

function makeCaller(token: string) {
  return createCaller({
    headers: new Headers({ cookie: `portal_session=${token}`, 'x-forwarded-for': '203.0.113.9' }),
    session: null as never,
    user: null as never,
  });
}

const callerA = makeCaller(TOKEN_A);
const callerB = makeCaller(TOKEN_B);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('portal invoices — contractor scope', () => {
  it('listInvoices returns only contractor A invoices', async () => {
    const rows = (await callerA.portal.listInvoices()) as Array<{ id: string }>;
    const ids = rows.map(r => r.id);
    expect(ids).toContain(INVOICE_A);
    expect(ids).not.toContain(INVOICE_B);
  });

  it('listInvoices where clause carries the session contractorId', async () => {
    await callerA.portal.listInvoices();
    const call = mockPrisma.invoice.findMany.mock.calls[0]?.[0];
    expect(call?.where).toHaveProperty('contractorId', CONTRACTOR_A);
  });

  it('getInvoice for contractor B invoice rejects NOT_FOUND', async () => {
    await expect(callerA.portal.getInvoice({ id: INVOICE_B })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('getInvoice where clause carries the session contractorId', async () => {
    await callerA.portal.getInvoice({ id: INVOICE_A });
    const call = mockPrisma.invoice.findFirst.mock.calls[0]?.[0];
    expect(call?.where).toHaveProperty('contractorId', CONTRACTOR_A);
    expect(call?.where).toHaveProperty('id', INVOICE_A);
  });

  it('contractor B sees only their own invoice', async () => {
    const rows = (await callerB.portal.listInvoices()) as Array<{ id: string }>;
    const ids = rows.map(r => r.id);
    expect(ids).toContain(INVOICE_B);
    expect(ids).not.toContain(INVOICE_A);
  });
});

describe('portal contracts — contractor scope', () => {
  it('listContracts returns only contractor A contracts', async () => {
    const rows = (await callerA.portal.listContracts()) as Array<{ id: string }>;
    const ids = rows.map(r => r.id);
    expect(ids).toContain(CONTRACT_A);
    expect(ids).not.toContain(CONTRACT_B);
  });

  it('getContract for contractor B contract rejects NOT_FOUND', async () => {
    await expect(callerA.portal.getContract({ id: CONTRACT_B })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('getContract where clause carries the session contractorId', async () => {
    await callerA.portal.getContract({ id: CONTRACT_A });
    const call = mockPrisma.contract.findFirst.mock.calls[0]?.[0];
    expect(call?.where).toHaveProperty('contractorId', CONTRACTOR_A);
    expect(call?.where).toHaveProperty('id', CONTRACT_A);
  });
});

describe('portal equipment — contractor scope', () => {
  it('listEquipment returns only contractor A assignments', async () => {
    const rows = (await callerA.portal.listEquipment()) as Array<{ assignmentId: string }>;
    const ids = rows.map(r => r.assignmentId);
    expect(ids).toContain(ASSIGNMENT_A);
    expect(ids).not.toContain(ASSIGNMENT_B);
  });

  it('listEquipment where clause carries session contractorId AND organizationId', async () => {
    await callerA.portal.listEquipment();
    const call = mockPrisma.equipmentAssignment.findMany.mock.calls[0]?.[0];
    expect(call?.where).toHaveProperty('contractorId', CONTRACTOR_A);
    expect(call?.where).toHaveProperty('organizationId', ORG_ID);
  });

  it('contractor B sees only their own assignment', async () => {
    const rows = (await callerB.portal.listEquipment()) as Array<{ assignmentId: string }>;
    const ids = rows.map(r => r.assignmentId);
    expect(ids).toContain(ASSIGNMENT_B);
    expect(ids).not.toContain(ASSIGNMENT_A);
  });
});
