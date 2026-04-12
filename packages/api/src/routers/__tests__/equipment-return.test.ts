/**
 * Equipment return flow tests.
 *
 * Tests requestReturn, cancelReturn, getReturnLabel on the portal router,
 * and verifies the offboarding auto-shipment integration path.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORG_ID = 'org-return-001';
const CONTRACTOR_ID = 'contractor-return-001';
const SESSION_TOKEN = 'portal-session-token-return';

// ---------------------------------------------------------------------------
// Mock Prisma via vi.hoisted
// ---------------------------------------------------------------------------

const { mockPrisma, mockInPostClient } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Rec = Record<string, any>;

  const mockPrisma: Rec = {
    equipmentAssignment: {
      findMany: vi.fn(),
    },
    returnRequest: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    equipment: {
      updateMany: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
    shipment: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    shipmentEvent: {
      create: vi.fn(),
    },
    contractor: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    contractorBillingProfile: {
      findFirst: vi.fn(),
    },
    organization: {
      findUnique: vi.fn(),
    },
    courierConfig: {
      findUnique: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    contract: {
      count: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    invoice: {
      count: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    document: {
      findMany: vi.fn(),
    },
    portalNotificationPreference: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
    workflowTaskRun: {
      update: vi.fn(),
      updateMany: vi.fn(),
      findUnique: vi.fn(),
    },
    workflowRun: {
      update: vi.fn(),
    },
    $transaction: vi.fn(async (fnOrArray: unknown) => {
      if (typeof fnOrArray === 'function') {
        return (fnOrArray as (tx: Rec) => Promise<unknown>)(mockPrisma);
      }
      return fnOrArray;
    }),
  };

  const mockInPostClient = {
    createShipment: vi.fn(async () => ({
      externalId: 'ext-123',
      trackingNumber: 'TRACK123',
      status: 'created',
      labelUrl: 'https://shipx.test/label',
    })),
    getLabel: vi.fn(async () => Buffer.from('pdf-label-content')),
    getStatus: vi.fn(),
    cancelShipment: vi.fn(),
  };

  return { mockPrisma, mockInPostClient };
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
}));

vi.mock('@contractor-ops/db', () => ({
  prisma: mockPrisma,
  tenantStore: {
    run: (_ctx: unknown, fn: () => unknown) => fn(),
    getStore: vi.fn(),
  },
}));

vi.mock('../../services/portal-session.js', () => ({
  validatePortalSession: vi.fn(async (token: string) => {
    if (token !== SESSION_TOKEN) return null;
    return {
      contractorId: CONTRACTOR_ID,
      organizationId: ORG_ID,
      contractor: { id: CONTRACTOR_ID, email: 'contractor@test.com' },
    };
  }),
  createPortalSession: vi.fn(),
  deletePortalSession: vi.fn(),
}));

vi.mock('../../services/portal-magic-link.js', () => ({
  createMagicLinkToken: vi.fn(),
  verifyMagicLinkToken: vi.fn(),
  findContractorsByEmail: vi.fn(),
  sendPortalMagicLink: vi.fn(),
}));

vi.mock('../../services/r2.js', () => ({
  createPresignedUploadUrl: vi.fn(async () => ({ url: 'https://r2.test/upload', key: 'k' })),
  createPresignedDownloadUrl: vi.fn(async () => 'https://r2.test/download'),
  generateStorageKey: vi.fn(() => 'mock-key'),
}));

vi.mock('../../services/portal-change-request.js', () => ({
  createChangeRequest: vi.fn(),
}));

vi.mock('../../services/bank-account-crypto.js', () => ({
  encryptBankAccount: vi.fn((v: string) => `encrypted:${v}`),
}));

vi.mock('../../services/stripe-client.js', () => ({
  stripe: {
    checkout: { sessions: { create: vi.fn() } },
    billingPortal: { sessions: { create: vi.fn() } },
    invoices: { createPreview: vi.fn() },
    subscriptions: { retrieve: vi.fn(), update: vi.fn(), list: vi.fn(async () => ({ data: [] })) },
    customers: { create: vi.fn(), retrieve: vi.fn() },
    billing: { meterEvents: { create: vi.fn() } },
  },
}));

vi.mock('../../services/notification-service.js', () => ({
  dispatch: vi.fn(async () => undefined),
}));

vi.mock('../../services/courier/inpost-client.js', () => ({
  InPostClient: class MockInPostClient {
    createShipment = mockInPostClient.createShipment;
    getLabel = mockInPostClient.getLabel;
    getStatus = mockInPostClient.getStatus;
    cancelShipment = mockInPostClient.cancelShipment;
  },
}));

vi.mock('../../services/courier/dpd-client.js', () => ({
  DPDClient: class MockDPDClient {
    createShipment = vi.fn();
    getLabel = vi.fn();
    getStatus = vi.fn();
    cancelShipment = vi.fn();
  },
}));

vi.mock('../../services/courier/ups-client.js', () => ({
  UPSClient: class MockUPSClient {
    createShipment = vi.fn();
    getLabel = vi.fn();
    getStatus = vi.fn();
    cancelShipment = vi.fn();
  },
}));

vi.mock('@contractor-ops/logger', () => ({
  createTrpcLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { increment: vi.fn(), histogram: vi.fn(), distribution: vi.fn() },
}));

vi.mock('@sentry/nextjs', () => {
  const mockSpan = { setStatus: vi.fn(), setAttribute: vi.fn(), end: vi.fn() };
  return {
    startSpan: vi.fn((_o: unknown, fn: (span: typeof mockSpan) => unknown) => fn(mockSpan)),
    captureException: vi.fn(),
  };
});

// Mock Teams dependencies that may not be installed
vi.mock('@microsoft/microsoft-graph-client', () => ({
  Client: { init: vi.fn() },
}));

vi.mock('botbuilder', () => ({
  TeamsActivityHandler: class {},
  TurnContext: class {},
  CloudAdapter: class {},
  ConfigurationBotFrameworkAuthentication: class {},
}));

vi.mock('botframework-connector', () => ({
  MicrosoftAppCredentials: { trustServiceUrl: vi.fn() },
  ConnectorClient: class {},
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { createCallerFactory } from '../../init.js';
import { appRouter } from '../../root.js';

// ---------------------------------------------------------------------------
// Caller setup
// ---------------------------------------------------------------------------

const createCaller = createCallerFactory(appRouter);

function portalCaller() {
  return createCaller({
    headers: new Headers({
      cookie: `portal_session=${SESSION_TOKEN}`,
    }),
  });
}

// ---------------------------------------------------------------------------
// Tests: requestReturn
// ---------------------------------------------------------------------------

describe('portal.requestReturn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates ReturnRequest with PENDING_APPROVAL status and stores target point info', async () => {
    // Has assigned equipment
    mockPrisma.equipmentAssignment.findMany.mockResolvedValueOnce([
      {
        id: 'assign-1',
        equipmentId: 'eq-1',
        equipment: { id: 'eq-1', name: 'MacBook', status: 'DELIVERED' },
      },
    ]);

    // No existing pending return
    mockPrisma.returnRequest.findFirst.mockResolvedValueOnce(null);

    // Create return request
    mockPrisma.returnRequest.create.mockResolvedValueOnce({
      id: 'rr-1',
      organizationId: ORG_ID,
      contractorId: CONTRACTOR_ID,
      status: 'PENDING_APPROVAL',
      targetPointId: 'KRA012',
      targetPointName: 'Krakow Nowa Huta',
      targetPointAddress: 'ul. Bienczycka 15',
      createdAt: new Date('2026-04-01'),
    });

    // Equipment updateMany
    mockPrisma.equipment.updateMany.mockResolvedValueOnce({ count: 1 });

    const caller = portalCaller();
    const result = await caller.portal.requestReturn({
      targetPointId: 'KRA012',
      targetPointName: 'Krakow Nowa Huta',
      targetPointAddress: 'ul. Bienczycka 15',
    });

    expect(result).toMatchObject({
      id: 'rr-1',
      status: 'PENDING_APPROVAL',
      targetPointId: 'KRA012',
      targetPointName: 'Krakow Nowa Huta',
    });

    // Verify equipment was marked RETURN_REQUESTED
    expect(mockPrisma.equipment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: 'RETURN_REQUESTED' },
      }),
    );
  });

  it('throws if contractor already has a pending return request', async () => {
    // Has assigned equipment
    mockPrisma.equipmentAssignment.findMany.mockResolvedValueOnce([
      {
        id: 'assign-1',
        equipmentId: 'eq-1',
        equipment: { id: 'eq-1', name: 'MacBook', status: 'DELIVERED' },
      },
    ]);

    // Existing pending return
    mockPrisma.returnRequest.findFirst.mockResolvedValueOnce({
      id: 'rr-existing',
      status: 'PENDING_APPROVAL',
    });

    const caller = portalCaller();
    await expect(
      caller.portal.requestReturn({
        targetPointId: 'KRA012',
        targetPointName: 'Krakow Nowa Huta',
        targetPointAddress: 'ul. Bienczycka 15',
      }),
    ).rejects.toThrow('RETURN_ALREADY_PENDING');
  });

  it('throws if contractor has no assigned equipment', async () => {
    // No assigned equipment
    mockPrisma.equipmentAssignment.findMany.mockResolvedValueOnce([]);

    const caller = portalCaller();
    await expect(
      caller.portal.requestReturn({
        targetPointId: 'KRA012',
        targetPointName: 'Krakow Nowa Huta',
        targetPointAddress: 'ul. Bienczycka 15',
      }),
    ).rejects.toThrow('NO_EQUIPMENT_ASSIGNED');
  });
});

// ---------------------------------------------------------------------------
// Tests: cancelReturn
// ---------------------------------------------------------------------------

describe('portal.cancelReturn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('transitions PENDING_APPROVAL to CANCELLED', async () => {
    mockPrisma.returnRequest.findFirst.mockResolvedValueOnce({
      id: 'rr-1',
      organizationId: ORG_ID,
      contractorId: CONTRACTOR_ID,
      status: 'PENDING_APPROVAL',
    });

    mockPrisma.returnRequest.update.mockResolvedValueOnce({
      id: 'rr-1',
      status: 'CANCELLED',
    });

    mockPrisma.equipment.updateMany.mockResolvedValueOnce({ count: 1 });

    const caller = portalCaller();
    const result = await caller.portal.cancelReturn({ id: 'rr-1' });

    expect(result).toMatchObject({
      id: 'rr-1',
      status: 'CANCELLED',
    });
  });

  it('throws if return is not in PENDING_APPROVAL status', async () => {
    mockPrisma.returnRequest.findFirst.mockResolvedValueOnce({
      id: 'rr-1',
      organizationId: ORG_ID,
      contractorId: CONTRACTOR_ID,
      status: 'SHIPMENT_CREATED',
    });

    const caller = portalCaller();
    await expect(caller.portal.cancelReturn({ id: 'rr-1' })).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Tests: getReturnLabel
// ---------------------------------------------------------------------------

describe('portal.getReturnLabel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns label data for SHIPMENT_CREATED return', async () => {
    mockPrisma.returnRequest.findFirst.mockResolvedValueOnce({
      id: 'rr-1',
      organizationId: ORG_ID,
      contractorId: CONTRACTOR_ID,
      status: 'SHIPMENT_CREATED',
      shipmentId: 'ship-1',
    });

    mockPrisma.shipment.findFirst.mockResolvedValueOnce({
      id: 'ship-1',
      carrier: 'InPost',
      externalId: 'ext-456',
      trackingNumber: 'TRACK456',
      organizationId: ORG_ID,
    });

    mockPrisma.courierConfig.findUnique.mockResolvedValueOnce({
      configJson: {
        apiToken: 'test-token',
        shipxOrganizationId: 'shipx-org',
        sandbox: true,
      },
    });

    const caller = portalCaller();
    const result = await caller.portal.getReturnLabel({
      returnRequestId: 'rr-1',
    });

    expect(result).toMatchObject({
      contentType: 'application/pdf',
    });
    expect(result.data).toBeTruthy();
  });

  it('throws if return is not in SHIPMENT_CREATED status', async () => {
    mockPrisma.returnRequest.findFirst.mockResolvedValueOnce({
      id: 'rr-1',
      organizationId: ORG_ID,
      contractorId: CONTRACTOR_ID,
      status: 'PENDING_APPROVAL',
      shipmentId: null,
    });

    const caller = portalCaller();
    await expect(caller.portal.getReturnLabel({ returnRequestId: 'rr-1' })).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Tests: Offboarding auto-shipment integration
// ---------------------------------------------------------------------------

describe('Offboarding return skips approval', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates ReturnRequest with SHIPMENT_CREATED status when org has InPost config', async () => {
    // Import the workflow service to test directly
    const { handleEquipmentTaskStart } = await import('../../services/equipment-workflow.js');

    // Mock: assignments with equipment
    mockPrisma.equipmentAssignment.findMany.mockResolvedValueOnce([
      {
        id: 'assign-1',
        equipmentId: 'eq-1',
        equipment: { id: 'eq-1', name: 'MacBook', status: 'ASSIGNED' },
        contractor: {
          id: CONTRACTOR_ID,
          displayName: 'Jan Kowalski',
          email: 'jan@test.com',
          phone: '+48123456789',
        },
      },
    ]);

    // Mock: update task to IN_PROGRESS
    mockPrisma.workflowTaskRun.update.mockResolvedValueOnce({});

    // Mock: updateMany for RETURN_REQUESTED
    mockPrisma.equipment.updateMany.mockResolvedValueOnce({ count: 1 });

    // Mock: courier config exists for InPost
    mockPrisma.courierConfig.findUnique.mockResolvedValueOnce({
      configJson: {
        apiToken: 'test-token',
        shipxOrganizationId: 'shipx-org',
        sandbox: true,
      },
    });

    // Mock: contractor with preferred Paczkomat
    mockPrisma.contractor.findUnique.mockResolvedValueOnce({
      displayName: 'Jan Kowalski',
      email: 'jan@test.com',
      phone: '+48123456789',
      preferredPaczkomatId: 'KRA012',
      preferredPaczkomatName: 'Krakow Nowa Huta',
      preferredPaczkomatAddress: 'ul. Bienczycka 15',
    });

    // Mock: org details
    mockPrisma.organization.findUnique.mockResolvedValueOnce({
      name: 'Test Corp',
    });

    // Mock: shipment creation
    mockPrisma.shipment.create.mockResolvedValueOnce({
      id: 'ship-auto-1',
      externalId: 'ext-123',
      trackingNumber: 'TRACK123',
    });

    // Mock: shipment events
    mockPrisma.shipmentEvent.create.mockResolvedValue({});

    // Mock: equipment update for RETURN_IN_TRANSIT
    mockPrisma.equipment.update.mockResolvedValueOnce({});

    // Mock: return request creation
    mockPrisma.returnRequest.create.mockResolvedValueOnce({
      id: 'rr-auto-1',
      status: 'SHIPMENT_CREATED',
      contractorId: CONTRACTOR_ID,
      shipmentId: 'ship-auto-1',
    });

    await handleEquipmentTaskStart(
      mockPrisma,
      ORG_ID,
      { id: 'task-1', taskType: 'EQUIPMENT' },
      {
        id: 'wfrun-1',
        contractorId: CONTRACTOR_ID,
        templateType: 'OFFBOARDING',
      },
    );

    // Verify ReturnRequest was created with SHIPMENT_CREATED (skipping PENDING_APPROVAL)
    expect(mockPrisma.returnRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'SHIPMENT_CREATED',
          contractorId: CONTRACTOR_ID,
          organizationId: ORG_ID,
          targetPointId: 'KRA012',
          targetPointName: 'Krakow Nowa Huta',
          targetPointAddress: 'ul. Bienczycka 15',
          shipmentId: 'ship-auto-1',
        }),
      }),
    );

    // Verify InPostClient was called for shipment creation
    expect(mockInPostClient.createShipment).toHaveBeenCalledWith(
      expect.objectContaining({
        direction: 'RETURN',
        targetPoint: 'KRA012',
        parcelSize: 'large',
      }),
    );

    // Verify equipment was updated to RETURN_IN_TRANSIT
    expect(mockPrisma.equipment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: 'RETURN_IN_TRANSIT' },
      }),
    );
  });
});
