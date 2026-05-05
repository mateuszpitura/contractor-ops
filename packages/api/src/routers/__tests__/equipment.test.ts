/**
 * Equipment router unit tests.
 *
 * Strategy:
 *  - Mock `@contractor-ops/db` with a vi.hoisted mockPrisma.
 *  - Mock `@contractor-ops/auth`, logger, Sentry, and service modules.
 *  - Create a tRPC caller via `createCallerFactory` + `makeCaller`.
 *  - Each test configures mock return values, calls the procedure,
 *    then asserts the arguments passed to Prisma (WHERE clauses, data).
 */

import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORG_ID = 'clxxxxxxxxxxxxxxxxxxxxxxxxx';
const USER_ID = 'clyyyyyyyyyyyyyyyyyyyyyyyy';
const EQUIPMENT_ID = 'cleq0000000000000000000001';
const CONTRACTOR_ID = 'clcontractor000000000001';
const ASSIGNMENT_ID = 'clasgn00000000000000000001';
const SHIPMENT_ID = 'clship00000000000000000001';

// ---------------------------------------------------------------------------
// Mock Prisma
// ---------------------------------------------------------------------------

const { mockPrisma } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Rec = Record<string, unknown>;

  const mockPrisma: Rec = {
    organization: {
      findUnique: vi.fn().mockResolvedValue({ id: 'org-mock', dataRegion: 'EU', status: 'ACTIVE' }),
    },
    equipment: {
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(async () => null),
      findUnique: vi.fn(async () => null),
      create: vi.fn(async (opts: { data: Rec }) => ({
        id: EQUIPMENT_ID,
        ...opts.data,
      })),
      update: vi.fn(async (opts: { where: Rec; data: Rec }) => ({
        id: opts.where.id,
        name: 'Test Equipment',
        ...opts.data,
      })),
      count: vi.fn(async () => 0),
    },
    equipmentAssignment: {
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(async () => null),
      create: vi.fn(async (opts: { data: Rec }) => ({
        id: ASSIGNMENT_ID,
        ...opts.data,
      })),
      update: vi.fn(async (opts: { where: Rec; data: Rec }) => ({
        id: opts.where.id,
        ...opts.data,
      })),
    },
    contractor: {
      findFirst: vi.fn(async () => null),
    },
    shipment: {
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(async () => null),
      findUnique: vi.fn(async () => null),
      create: vi.fn(async (opts: { data: Rec }) => ({
        id: SHIPMENT_ID,
        ...opts.data,
      })),
      update: vi.fn(async (opts: { where: Rec; data: Rec }) => ({
        id: opts.where.id,
        ...opts.data,
      })),
      delete: vi.fn(async () => ({})),
    },
    shipmentEvent: {
      create: vi.fn(async (opts: { data: Rec }) => ({
        id: 'event-1',
        ...opts.data,
      })),
      deleteMany: vi.fn(async () => ({ count: 0 })),
    },
    auditLog: {
      create: vi.fn(async () => ({})),
    },
    member: {
      findFirst: vi.fn(async () => ({ role: 'admin' })),
    },
    $transaction: vi.fn(async (fnOrArray: ((tx: Rec) => Promise<unknown>) | unknown[]) => {
      if (typeof fnOrArray === 'function') return fnOrArray(mockPrisma);
      return Promise.all(fnOrArray);
    }),
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

vi.mock('../../services/equipment-workflow.js', () => ({
  checkShipmentTaskCompletion: vi.fn(async () => undefined),
}));

vi.mock('../../services/r2.js', () => ({
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

vi.mock('../../services/notification-service.js', () => ({
  dispatch: vi.fn(async () => undefined),
}));

vi.mock('../../services/invoice-matching.js', () => ({
  computeDuplicateCheckHash: vi.fn(() => 'hash'),
  runAutoMatch: vi.fn(async () => undefined),
}));

vi.mock('../../services/bank-account-crypto.js', () => ({
  encryptBankAccount: vi.fn((v: string) => `encrypted:${v}`),
}));

vi.mock('../../services/sanitize.js', () => ({
  sanitizeStrings: vi.fn(<T>(v: T) => v),
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
  CacheKeys: { approvalChains: (orgId: string) => `approval-chains:${orgId}` },
  CacheTTL: { APPROVAL_CHAINS: 300 },
}));

vi.mock('../../services/mime-validator.js', () => ({
  isAllowedMimeType: vi.fn(() => true),
  validateMimeType: vi.fn(async () => ({ valid: true })),
}));

vi.mock('../../services/virus-scanner.js', () => ({
  isClamAvailable: vi.fn(async () => false),
  scanBuffer: vi.fn(async () => ({ clean: true })),
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

vi.mock('../../services/import-processor.js', () => ({
  parseImportFile: vi.fn(async () => []),
  autoMapColumns: vi.fn(() => ({})),
  processImportFile: vi.fn(async () => ({ valid: [], invalid: [], duplicates: [] })),
}));

vi.mock('../../services/time-entry.js', () => ({
  approveTimesheet: vi.fn(async () => ({})),
  rejectTimesheet: vi.fn(async () => ({})),
  bulkApproveTimesheets: vi.fn(async () => ({ count: 0 })),
  bulkRejectTimesheets: vi.fn(async () => ({ count: 0 })),
}));

vi.mock('../../services/time-reconciliation.js', () => ({
  computeTimeReconciliation: vi.fn(async () => null),
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
// Reset mocks
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.$transaction.mockImplementation(
    async (fnOrArray: ((tx: unknown) => Promise<unknown>) | unknown[]) => {
      if (typeof fnOrArray === 'function') return fnOrArray(mockPrisma);
      return Promise.all(fnOrArray);
    },
  );
});

// ===========================================================================
// Equipment Router Tests
// ===========================================================================

describe('equipment router', () => {
  // =========================================================================
  // list
  // =========================================================================

  describe('list', () => {
    it('queries with organizationId and pagination', async () => {
      mockPrisma.equipment.findMany.mockResolvedValueOnce([]);
      mockPrisma.equipment.count.mockResolvedValueOnce(0);

      await caller.equipment.list({ page: 2, pageSize: 10 });

      const findCall = mockPrisma.equipment.findMany.mock.calls[0]?.[0];
      expect(findCall.where).toMatchObject({
        organizationId: ORG_ID,
      });
      expect(findCall.skip).toBe(10); // (page-1) * pageSize
      expect(findCall.take).toBe(10);

      const countCall = mockPrisma.equipment.count.mock.calls[0]?.[0];
      expect(countCall.where).toMatchObject({
        organizationId: ORG_ID,
      });
    });

    it('applies status filter when provided', async () => {
      mockPrisma.equipment.findMany.mockResolvedValueOnce([]);
      mockPrisma.equipment.count.mockResolvedValueOnce(0);

      await caller.equipment.list({ page: 1, pageSize: 20, status: ['AVAILABLE', 'ASSIGNED'] });

      const findCall = mockPrisma.equipment.findMany.mock.calls[0]?.[0];
      expect(findCall.where.status).toEqual({ in: ['AVAILABLE', 'ASSIGNED'] });
    });

    it('includes current assignment with contractor info', async () => {
      mockPrisma.equipment.findMany.mockResolvedValueOnce([]);
      mockPrisma.equipment.count.mockResolvedValueOnce(0);

      await caller.equipment.list({ page: 1, pageSize: 20 });

      const findCall = mockPrisma.equipment.findMany.mock.calls[0]?.[0];
      expect(findCall.include.assignments).toBeDefined();
      expect(findCall.include.assignments.where).toEqual({ unassignedAt: null });
      expect(findCall.include.assignments.include.contractor).toBeDefined();
    });
  });

  // =========================================================================
  // getById
  // =========================================================================

  describe('getById', () => {
    it('queries by id scoped to organizationId', async () => {
      mockPrisma.equipment.findFirst.mockResolvedValueOnce({
        id: EQUIPMENT_ID,
        organizationId: ORG_ID,
        assignments: [],
        shipments: [],
        _count: { shipments: 0 },
      });

      await caller.equipment.getById({ id: EQUIPMENT_ID });

      const call = mockPrisma.equipment.findFirst.mock.calls[0]?.[0];
      expect(call.where).toMatchObject({
        id: EQUIPMENT_ID,
        organizationId: ORG_ID,
      });
    });

    it('includes assignments and shipments', async () => {
      mockPrisma.equipment.findFirst.mockResolvedValueOnce({
        id: EQUIPMENT_ID,
        organizationId: ORG_ID,
        assignments: [],
        shipments: [],
        _count: { shipments: 0 },
      });

      await caller.equipment.getById({ id: EQUIPMENT_ID });

      const call = mockPrisma.equipment.findFirst.mock.calls[0]?.[0];
      expect(call.include.assignments).toBeDefined();
      expect(call.include.shipments).toBeDefined();
      expect(call.include.shipments.include.events).toBeDefined();
    });

    it('throws NOT_FOUND when equipment does not exist', async () => {
      mockPrisma.equipment.findFirst.mockResolvedValueOnce(null);

      await expect(caller.equipment.getById({ id: 'nonexistent' })).rejects.toThrow(TRPCError);
    });
  });

  // =========================================================================
  // create
  // =========================================================================

  describe('create', () => {
    it('creates equipment with organizationId and all input fields', async () => {
      const input = {
        name: 'MacBook Pro',
        serialNumber: 'SN12345',
        type: 'LAPTOP' as const,
        notes: 'Test notes',
        purchaseDate: new Date('2025-01-15'),
      };

      mockPrisma.equipment.create.mockResolvedValueOnce({
        id: EQUIPMENT_ID,
        organizationId: ORG_ID,
        ...input,
      });

      await caller.equipment.create(input);

      const call = mockPrisma.equipment.create.mock.calls[0]?.[0];
      expect(call.data).toMatchObject({
        organizationId: ORG_ID,
        name: 'MacBook Pro',
        serialNumber: 'SN12345',
        type: 'LAPTOP',
        notes: 'Test notes',
      });
    });

    it('creates an audit log entry', async () => {
      mockPrisma.equipment.create.mockResolvedValueOnce({
        id: EQUIPMENT_ID,
        organizationId: ORG_ID,
        name: 'Monitor',
      });

      await caller.equipment.create({ name: 'Monitor', type: 'MONITOR' as const });

      expect(mockPrisma.auditLog.create).toHaveBeenCalledTimes(1);
      const auditCall = mockPrisma.auditLog.create.mock.calls[0]?.[0];
      expect(auditCall.data.action).toBe('equipment.create');
      expect(auditCall.data.organizationId).toBe(ORG_ID);
    });
  });

  // =========================================================================
  // update
  // =========================================================================

  describe('update', () => {
    it('verifies equipment exists with organizationId before updating', async () => {
      mockPrisma.equipment.findFirst.mockResolvedValueOnce({
        id: EQUIPMENT_ID,
        organizationId: ORG_ID,
        name: 'Old Name',
      });
      mockPrisma.equipment.update.mockResolvedValueOnce({
        id: EQUIPMENT_ID,
        name: 'New Name',
      });

      await caller.equipment.update({ id: EQUIPMENT_ID, name: 'New Name' });

      const findCall = mockPrisma.equipment.findFirst.mock.calls[0]?.[0];
      expect(findCall.where).toMatchObject({
        id: EQUIPMENT_ID,
        organizationId: ORG_ID,
      });

      const updateCall = mockPrisma.equipment.update.mock.calls[0]?.[0];
      expect(updateCall.where).toMatchObject({ id: EQUIPMENT_ID });
      expect(updateCall.data).toMatchObject({ name: 'New Name' });
    });

    it('throws NOT_FOUND when equipment does not exist', async () => {
      mockPrisma.equipment.findFirst.mockResolvedValueOnce(null);

      await expect(caller.equipment.update({ id: 'nonexistent', name: 'Fail' })).rejects.toThrow(
        TRPCError,
      );
    });
  });

  // =========================================================================
  // assign
  // =========================================================================

  describe('assign', () => {
    it('creates EquipmentAssignment linked to contractor', async () => {
      mockPrisma.equipment.findFirst.mockResolvedValueOnce({
        id: EQUIPMENT_ID,
        organizationId: ORG_ID,
        status: 'AVAILABLE',
      });
      mockPrisma.contractor.findFirst.mockResolvedValueOnce({
        id: CONTRACTOR_ID,
        organizationId: ORG_ID,
        displayName: 'Acme Corp',
      });
      mockPrisma.equipmentAssignment.create.mockResolvedValueOnce({
        id: ASSIGNMENT_ID,
        equipmentId: EQUIPMENT_ID,
        contractorId: CONTRACTOR_ID,
      });
      mockPrisma.equipment.update.mockResolvedValueOnce({
        id: EQUIPMENT_ID,
        status: 'ASSIGNED',
        name: 'Test Equipment',
      });

      await caller.equipment.assign({
        equipmentId: EQUIPMENT_ID,
        contractorId: CONTRACTOR_ID,
        notes: 'Assigned for project',
      });

      // Verify transaction was used
      expect(mockPrisma.$transaction).toHaveBeenCalled();

      // Verify assignment creation args
      const assignCall = mockPrisma.equipmentAssignment.create.mock.calls[0]?.[0];
      expect(assignCall.data).toMatchObject({
        organizationId: ORG_ID,
        equipmentId: EQUIPMENT_ID,
        contractorId: CONTRACTOR_ID,
        assignedByUserId: USER_ID,
        notes: 'Assigned for project',
      });

      // Verify equipment status updated to ASSIGNED
      const updateCall = mockPrisma.equipment.update.mock.calls[0]?.[0];
      expect(updateCall.data).toMatchObject({ status: 'ASSIGNED' });
    });

    it('throws NOT_FOUND when contractor does not exist', async () => {
      mockPrisma.equipment.findFirst.mockResolvedValueOnce({
        id: EQUIPMENT_ID,
        organizationId: ORG_ID,
        status: 'AVAILABLE',
      });
      mockPrisma.contractor.findFirst.mockResolvedValueOnce(null);

      await expect(
        caller.equipment.assign({
          equipmentId: EQUIPMENT_ID,
          contractorId: 'nonexistent',
        }),
      ).rejects.toThrow(TRPCError);
    });

    it('throws BAD_REQUEST when equipment is not AVAILABLE', async () => {
      mockPrisma.equipment.findFirst.mockResolvedValueOnce({
        id: EQUIPMENT_ID,
        organizationId: ORG_ID,
        status: 'ASSIGNED',
      });

      await expect(
        caller.equipment.assign({
          equipmentId: EQUIPMENT_ID,
          contractorId: CONTRACTOR_ID,
        }),
      ).rejects.toThrow(TRPCError);
    });

    it.each([
      'IN_TRANSIT',
      'RETURN_IN_TRANSIT',
      'RETURN_REQUESTED',
      'DELIVERED',
      'RETURNED',
      'RETIRED',
    ])('throws BAD_REQUEST when assigning equipment with status %s', async status => {
      mockPrisma.equipment.findFirst.mockResolvedValueOnce({
        id: EQUIPMENT_ID,
        organizationId: ORG_ID,
        status,
      });

      await expect(
        caller.equipment.assign({
          equipmentId: EQUIPMENT_ID,
          contractorId: CONTRACTOR_ID,
        }),
      ).rejects.toThrow(TRPCError);
    });
  });

  // =========================================================================
  // unassign
  // =========================================================================

  describe('unassign', () => {
    it('sets assignment unassignedAt and reverts equipment to AVAILABLE', async () => {
      mockPrisma.equipment.findFirst.mockResolvedValueOnce({
        id: EQUIPMENT_ID,
        organizationId: ORG_ID,
        status: 'ASSIGNED',
        assignments: [
          {
            id: ASSIGNMENT_ID,
            contractorId: CONTRACTOR_ID,
            unassignedAt: null,
            notes: null,
          },
        ],
      });
      mockPrisma.equipmentAssignment.update.mockResolvedValueOnce({
        id: ASSIGNMENT_ID,
      });
      mockPrisma.equipment.update.mockResolvedValueOnce({
        id: EQUIPMENT_ID,
        status: 'AVAILABLE',
        name: 'Test Equipment',
      });

      await caller.equipment.unassign({ equipmentId: EQUIPMENT_ID });

      // Verify assignment updated with unassignedAt
      const assignUpdate = mockPrisma.equipmentAssignment.update.mock.calls[0]?.[0];
      expect(assignUpdate.where).toMatchObject({ id: ASSIGNMENT_ID });
      expect(assignUpdate.data.unassignedAt).toBeInstanceOf(Date);
      expect(assignUpdate.data.unassignedByUserId).toBe(USER_ID);

      // Verify equipment status reverted to AVAILABLE
      const equipUpdate = mockPrisma.equipment.update.mock.calls[0]?.[0];
      expect(equipUpdate.data).toMatchObject({ status: 'AVAILABLE' });
    });

    it('throws BAD_REQUEST when no active assignment exists', async () => {
      mockPrisma.equipment.findFirst.mockResolvedValueOnce({
        id: EQUIPMENT_ID,
        organizationId: ORG_ID,
        assignments: [],
      });

      await expect(caller.equipment.unassign({ equipmentId: EQUIPMENT_ID })).rejects.toThrow(
        TRPCError,
      );
    });
  });

  // =========================================================================
  // createShipment
  // =========================================================================

  describe('createShipment', () => {
    it('creates a Shipment with tracking info and initial event', async () => {
      mockPrisma.equipment.findFirst.mockResolvedValueOnce({
        id: EQUIPMENT_ID,
        organizationId: ORG_ID,
        name: 'Laptop',
        status: 'ASSIGNED',
      });
      mockPrisma.shipment.create.mockResolvedValueOnce({
        id: SHIPMENT_ID,
        equipmentId: EQUIPMENT_ID,
        direction: 'OUTBOUND',
        carrier: 'DHL',
        trackingNumber: 'TRACK123',
        currentStatus: 'CREATED',
      });
      mockPrisma.shipmentEvent.create.mockResolvedValueOnce({ id: 'evt-1' });
      mockPrisma.equipment.update.mockResolvedValueOnce({
        id: EQUIPMENT_ID,
        status: 'IN_TRANSIT',
      });
      mockPrisma.shipment.findUnique.mockResolvedValueOnce({
        id: SHIPMENT_ID,
        events: [{ id: 'evt-1', status: 'CREATED' }],
      });

      await caller.equipment.createShipment({
        equipmentId: EQUIPMENT_ID,
        direction: 'OUTBOUND',
        carrier: 'DHL',
        trackingNumber: 'TRACK123',
      });

      // Verify shipment creation
      const shipCall = mockPrisma.shipment.create.mock.calls[0]?.[0];
      expect(shipCall.data).toMatchObject({
        organizationId: ORG_ID,
        equipmentId: EQUIPMENT_ID,
        direction: 'OUTBOUND',
        carrier: 'DHL',
        trackingNumber: 'TRACK123',
        currentStatus: 'CREATED',
        createdByUserId: USER_ID,
      });

      // Verify initial CREATED event
      const eventCall = mockPrisma.shipmentEvent.create.mock.calls[0]?.[0];
      expect(eventCall.data).toMatchObject({
        organizationId: ORG_ID,
        shipmentId: SHIPMENT_ID,
        status: 'CREATED',
        createdByUserId: USER_ID,
      });

      // Verify equipment status set to IN_TRANSIT for OUTBOUND
      const equipCall = mockPrisma.equipment.update.mock.calls[0]?.[0];
      expect(equipCall.data).toMatchObject({ status: 'IN_TRANSIT' });
    });

    it('sets RETURN_IN_TRANSIT status for RETURN direction', async () => {
      mockPrisma.equipment.findFirst.mockResolvedValueOnce({
        id: EQUIPMENT_ID,
        organizationId: ORG_ID,
        name: 'Laptop',
        status: 'RETURN_REQUESTED',
      });
      mockPrisma.shipment.create.mockResolvedValueOnce({
        id: SHIPMENT_ID,
        direction: 'RETURN',
        currentStatus: 'CREATED',
      });
      mockPrisma.shipmentEvent.create.mockResolvedValueOnce({ id: 'evt-1' });
      mockPrisma.equipment.update.mockResolvedValueOnce({
        id: EQUIPMENT_ID,
        status: 'RETURN_IN_TRANSIT',
      });
      mockPrisma.shipment.findUnique.mockResolvedValueOnce({
        id: SHIPMENT_ID,
        events: [],
      });

      await caller.equipment.createShipment({
        equipmentId: EQUIPMENT_ID,
        direction: 'RETURN',
        carrier: 'UPS',
      });

      const equipCall = mockPrisma.equipment.update.mock.calls[0]?.[0];
      expect(equipCall.data).toMatchObject({ status: 'RETURN_IN_TRANSIT' });
    });
  });

  // =========================================================================
  // addShipmentEvent (updateShipmentStatus)
  // =========================================================================

  describe('addShipmentEvent', () => {
    it('creates ShipmentEvent and updates shipment status', async () => {
      mockPrisma.shipment.findFirst.mockResolvedValueOnce({
        id: SHIPMENT_ID,
        organizationId: ORG_ID,
        equipmentId: EQUIPMENT_ID,
        direction: 'OUTBOUND',
        currentStatus: 'CREATED',
        workflowTaskRunId: null,
        equipment: { id: EQUIPMENT_ID, name: 'Laptop', status: 'IN_TRANSIT' },
      });
      mockPrisma.shipmentEvent.create.mockResolvedValueOnce({ id: 'evt-2' });
      mockPrisma.shipment.update.mockResolvedValueOnce({
        id: SHIPMENT_ID,
        currentStatus: 'DELIVERED',
      });
      mockPrisma.equipment.update.mockResolvedValueOnce({
        id: EQUIPMENT_ID,
        status: 'DELIVERED',
      });
      mockPrisma.shipment.findUnique.mockResolvedValueOnce({
        id: SHIPMENT_ID,
        events: [
          { id: 'evt-1', status: 'CREATED' },
          { id: 'evt-2', status: 'DELIVERED' },
        ],
      });

      await caller.equipment.addShipmentEvent({
        shipmentId: SHIPMENT_ID,
        status: 'DELIVERED',
      });

      // Verify event creation
      const eventCall = mockPrisma.shipmentEvent.create.mock.calls[0]?.[0];
      expect(eventCall.data).toMatchObject({
        organizationId: ORG_ID,
        shipmentId: SHIPMENT_ID,
        status: 'DELIVERED',
        createdByUserId: USER_ID,
      });

      // Verify shipment status updated
      const shipUpdate = mockPrisma.shipment.update.mock.calls[0]?.[0];
      expect(shipUpdate.data).toMatchObject({ currentStatus: 'DELIVERED' });

      // Verify equipment status auto-advanced (OUTBOUND + DELIVERED -> DELIVERED)
      const equipUpdate = mockPrisma.equipment.update.mock.calls[0]?.[0];
      expect(equipUpdate.data).toMatchObject({ status: 'DELIVERED' });
    });

    it('throws NOT_FOUND when shipment does not exist', async () => {
      mockPrisma.shipment.findFirst.mockResolvedValueOnce(null);

      await expect(
        caller.equipment.addShipmentEvent({
          shipmentId: 'nonexistent',
          status: 'DELIVERED',
        }),
      ).rejects.toThrow(TRPCError);
    });
  });
});
