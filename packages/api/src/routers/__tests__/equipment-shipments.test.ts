/**
 * Equipment shipments router unit tests.
 *
 * Tests createShipment, addShipmentEvent, getShipment, listShipments,
 * deleteShipment, and listByContractor procedures.
 */

import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORG_ID = 'org-shipments-001';
const USER_ID = 'user-shipments-001';
const EQUIPMENT_ID = 'eq-ship-001';
const SHIPMENT_ID = 'ship-001';
const CONTRACTOR_ID = 'contractor-ship-001';

// ---------------------------------------------------------------------------
// Mock Prisma via vi.hoisted
// ---------------------------------------------------------------------------

const { mockPrisma } = vi.hoisted(() => {
  type Rec = Record<string, unknown>;

  const mockPrisma: Rec = {
    organization: {
      findUnique: vi.fn().mockResolvedValue({ id: 'org-mock', dataRegion: 'EU', status: 'ACTIVE' }),
    },
    equipment: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    equipmentAssignment: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    contractor: {
      findFirst: vi.fn(),
    },
    shipment: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    shipmentEvent: {
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    member: {
      findFirst: vi.fn().mockResolvedValue({ role: 'admin' }),
    },
    $transaction: vi.fn(async (fnOrArray: ((tx: Rec) => Promise<unknown>) | unknown[]) => {
      if (typeof fnOrArray === 'function') return fnOrArray(mockPrisma);
      return Promise.all(fnOrArray);
    }),
  };

  return { mockPrisma };
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

vi.mock('../../services/equipment-workflow', () => ({
  checkShipmentTaskCompletion: vi.fn(async () => undefined),
  handleEquipmentTaskStart: vi.fn(async () => undefined),
}));

vi.mock('../../services/notification-service', () => ({
  dispatch: vi.fn(async () => undefined),
}));

vi.mock('../../services/cache', () => ({
  cacheKey: vi.fn((...s: string[]) => s.join(':')),
  cachedSingleflight: vi.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
  cached: vi.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
  invalidate: vi.fn(async () => undefined),
  invalidateByPrefix: vi.fn(async () => undefined),
  CacheKeys: { dashboardPrefix: (orgId: string) => `dashboard:${orgId}` },
  CacheTTL: {},
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
  getIdpAuditLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(),
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

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { createCallerFactory } from '../../init';
import { equipmentShipmentsRouter } from '../equipment/equipment-shipments';

// ---------------------------------------------------------------------------
// Caller helper
// ---------------------------------------------------------------------------

const createCaller = createCallerFactory(equipmentShipmentsRouter);

function makeCaller(userId = USER_ID, orgId = ORG_ID) {
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

const caller = makeCaller();

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
// Tests
// ===========================================================================

describe('equipmentShipmentsRouter', () => {
  // =========================================================================
  // createShipment
  // =========================================================================

  describe('createShipment', () => {
    it('creates shipment with initial CREATED event and updates equipment to IN_TRANSIT for OUTBOUND', async () => {
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

      const result = await caller.createShipment({
        equipmentId: EQUIPMENT_ID,
        direction: 'OUTBOUND',
        carrier: 'DHL',
        trackingNumber: 'TRACK123',
      });

      expect(result).toMatchObject({ id: SHIPMENT_ID });

      const shipCall = mockPrisma.shipment.create.mock.calls[0]?.[0];
      expect(shipCall.data).toMatchObject({
        organizationId: ORG_ID,
        equipmentId: EQUIPMENT_ID,
        direction: 'OUTBOUND',
        carrier: 'DHL',
        currentStatus: 'CREATED',
        createdByUserId: USER_ID,
      });

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

      await caller.createShipment({
        equipmentId: EQUIPMENT_ID,
        direction: 'RETURN',
        carrier: 'UPS',
      });

      const equipCall = mockPrisma.equipment.update.mock.calls[0]?.[0];
      expect(equipCall.data).toMatchObject({ status: 'RETURN_IN_TRANSIT' });
    });

    it('throws NOT_FOUND when equipment does not exist', async () => {
      mockPrisma.equipment.findFirst.mockResolvedValueOnce(null);

      await expect(
        caller.createShipment({
          equipmentId: 'nonexistent',
          direction: 'OUTBOUND',
          carrier: 'DHL',
        }),
      ).rejects.toThrow(TRPCError);
    });

    it('creates an audit log entry', async () => {
      mockPrisma.equipment.findFirst.mockResolvedValueOnce({
        id: EQUIPMENT_ID,
        organizationId: ORG_ID,
        name: 'Laptop',
      });
      mockPrisma.shipment.create.mockResolvedValueOnce({ id: SHIPMENT_ID });
      mockPrisma.shipmentEvent.create.mockResolvedValueOnce({ id: 'evt-1' });
      mockPrisma.equipment.update.mockResolvedValueOnce({});
      mockPrisma.shipment.findUnique.mockResolvedValueOnce({ id: SHIPMENT_ID, events: [] });

      await caller.createShipment({
        equipmentId: EQUIPMENT_ID,
        direction: 'OUTBOUND',
        carrier: 'DHL',
      });

      expect(mockPrisma.auditLog.create).toHaveBeenCalledTimes(1);
      const auditCall = mockPrisma.auditLog.create.mock.calls[0]?.[0];
      expect(auditCall.data.action).toBe('shipment.create');
      expect(auditCall.data.organizationId).toBe(ORG_ID);
    });
  });

  // =========================================================================
  // addShipmentEvent
  // =========================================================================

  describe('addShipmentEvent', () => {
    it('creates event, updates shipment status, and auto-advances equipment status', async () => {
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
      mockPrisma.equipment.update.mockResolvedValueOnce({ id: EQUIPMENT_ID, status: 'DELIVERED' });
      mockPrisma.shipment.findUnique.mockResolvedValueOnce({
        id: SHIPMENT_ID,
        events: [
          { id: 'evt-1', status: 'CREATED' },
          { id: 'evt-2', status: 'DELIVERED' },
        ],
      });

      const result = await caller.addShipmentEvent({
        shipmentId: SHIPMENT_ID,
        status: 'DELIVERED',
      });

      expect(result).toBeDefined();

      const eventCall = mockPrisma.shipmentEvent.create.mock.calls[0]?.[0];
      expect(eventCall.data).toMatchObject({
        organizationId: ORG_ID,
        shipmentId: SHIPMENT_ID,
        status: 'DELIVERED',
      });

      const equipUpdate = mockPrisma.equipment.update.mock.calls[0]?.[0];
      expect(equipUpdate.data).toMatchObject({ status: 'DELIVERED' });
    });

    it('throws NOT_FOUND when shipment does not exist', async () => {
      mockPrisma.shipment.findFirst.mockResolvedValueOnce(null);

      await expect(
        caller.addShipmentEvent({
          shipmentId: 'nonexistent',
          status: 'DELIVERED',
        }),
      ).rejects.toThrow(TRPCError);
    });

    it('creates audit log for status update', async () => {
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
      mockPrisma.shipment.update.mockResolvedValueOnce({});
      mockPrisma.equipment.update.mockResolvedValueOnce({});
      mockPrisma.shipment.findUnique.mockResolvedValueOnce({ id: SHIPMENT_ID, events: [] });

      await caller.addShipmentEvent({ shipmentId: SHIPMENT_ID, status: 'DELIVERED' });

      expect(mockPrisma.auditLog.create).toHaveBeenCalledTimes(1);
      const auditCall = mockPrisma.auditLog.create.mock.calls[0]?.[0];
      expect(auditCall.data.action).toBe('shipment.updateStatus');
    });
  });

  // =========================================================================
  // getShipment
  // =========================================================================

  describe('getShipment', () => {
    it('returns shipment with events and equipment details', async () => {
      const shipment = {
        id: SHIPMENT_ID,
        organizationId: ORG_ID,
        events: [{ id: 'evt-1', status: 'CREATED' }],
        equipment: {
          id: EQUIPMENT_ID,
          name: 'Laptop',
          serialNumber: 'SN1',
          type: 'LAPTOP',
          status: 'IN_TRANSIT',
        },
      };
      mockPrisma.shipment.findFirst.mockResolvedValueOnce(shipment);

      const result = await caller.getShipment({ id: SHIPMENT_ID });

      expect(result).toMatchObject({ id: SHIPMENT_ID });
      const call = mockPrisma.shipment.findFirst.mock.calls[0]?.[0];
      expect(call.where).toMatchObject({ id: SHIPMENT_ID, organizationId: ORG_ID });
      expect(call.include.events).toBeDefined();
      expect(call.include.equipment).toBeDefined();
    });

    it('throws NOT_FOUND when shipment does not exist', async () => {
      mockPrisma.shipment.findFirst.mockResolvedValueOnce(null);

      await expect(caller.getShipment({ id: 'nonexistent' })).rejects.toThrow(TRPCError);
    });
  });

  // =========================================================================
  // listShipments
  // =========================================================================

  describe('listShipments', () => {
    it('queries shipments scoped to equipment and org', async () => {
      mockPrisma.shipment.findMany.mockResolvedValueOnce([]);

      const result = await caller.listShipments({ equipmentId: EQUIPMENT_ID });

      expect(result).toEqual([]);
      const call = mockPrisma.shipment.findMany.mock.calls[0]?.[0];
      expect(call.where).toMatchObject({
        equipmentId: EQUIPMENT_ID,
        organizationId: ORG_ID,
      });
      expect(call.orderBy).toMatchObject({ createdAt: 'desc' });
    });

    it('includes latest event per shipment', async () => {
      mockPrisma.shipment.findMany.mockResolvedValueOnce([]);

      await caller.listShipments({ equipmentId: EQUIPMENT_ID });

      const call = mockPrisma.shipment.findMany.mock.calls[0]?.[0];
      expect(call.include.events).toBeDefined();
      expect(call.include.events.take).toBe(1);
    });
  });

  // =========================================================================
  // deleteShipment
  // =========================================================================

  describe('deleteShipment', () => {
    it('deletes shipment and its events when status is CREATED', async () => {
      mockPrisma.shipment.findFirst.mockResolvedValueOnce({
        id: SHIPMENT_ID,
        organizationId: ORG_ID,
        currentStatus: 'CREATED',
      });
      mockPrisma.shipmentEvent.deleteMany.mockResolvedValueOnce({ count: 1 });
      mockPrisma.shipment.delete.mockResolvedValueOnce({});

      const result = await caller.deleteShipment({ id: SHIPMENT_ID });

      expect(result).toMatchObject({ success: true });
    });

    it('throws NOT_FOUND when shipment does not exist', async () => {
      mockPrisma.shipment.findFirst.mockResolvedValueOnce(null);

      await expect(caller.deleteShipment({ id: 'nonexistent' })).rejects.toThrow(TRPCError);
    });

    it('throws BAD_REQUEST when shipment status is not CREATED', async () => {
      mockPrisma.shipment.findFirst.mockResolvedValueOnce({
        id: SHIPMENT_ID,
        organizationId: ORG_ID,
        currentStatus: 'DELIVERED',
      });

      await expect(caller.deleteShipment({ id: SHIPMENT_ID })).rejects.toThrow(TRPCError);
    });
  });

  // =========================================================================
  // listByContractor
  // =========================================================================

  describe('listByContractor', () => {
    it('returns assignments with equipment and latest shipment', async () => {
      mockPrisma.equipmentAssignment.findMany.mockResolvedValueOnce([
        {
          id: 'assign-1',
          assignedAt: new Date(),
          equipment: {
            id: EQUIPMENT_ID,
            name: 'Laptop',
            serialNumber: 'SN1',
            type: 'LAPTOP',
            status: 'ASSIGNED',
            shipments: [
              {
                id: SHIPMENT_ID,
                direction: 'OUTBOUND',
                carrier: 'DHL',
                trackingNumber: 'TRACK1',
                currentStatus: 'DELIVERED',
                expectedDeliveryAt: null,
              },
            ],
          },
        },
      ]);

      const result = await caller.listByContractor({ contractorId: CONTRACTOR_ID });

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        assignmentId: 'assign-1',
        equipment: { id: EQUIPMENT_ID, name: 'Laptop' },
        latestShipment: { id: SHIPMENT_ID },
      });

      const call = mockPrisma.equipmentAssignment.findMany.mock.calls[0]?.[0];
      expect(call.where).toMatchObject({
        contractorId: CONTRACTOR_ID,
        organizationId: ORG_ID,
        unassignedAt: null,
      });
    });

    it('returns empty array when contractor has no assignments', async () => {
      mockPrisma.equipmentAssignment.findMany.mockResolvedValueOnce([]);

      const result = await caller.listByContractor({ contractorId: CONTRACTOR_ID });

      expect(result).toEqual([]);
    });
  });
});
