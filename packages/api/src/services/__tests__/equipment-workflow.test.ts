/**
 * Equipment workflow integration — task start + shipment-driven completion.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockLogWarn } = vi.hoisted(() => ({ mockLogWarn: vi.fn() }));

vi.mock('@contractor-ops/logger', () => {
  const stub = {
    info: vi.fn(),
    warn: mockLogWarn,
    error: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
  };
  return {
    runWithRequestContext: vi.fn((_c, fn) => fn()),
    getRequestId: vi.fn(() => undefined),
    getTraceparent: vi.fn(() => undefined),
    buildContextFromHeaders: vi.fn(() => ({})),
    getOutboundHeaders: vi.fn(() => ({})),
    generateRequestId: vi.fn(() => 'test-request-id'),
    withBodyLogging: vi.fn((_o, fn) => fn),
    logIntegrationCall: vi.fn(),
    subscribeOpossumEvents: vi.fn(),
    LOG_BODY_INCLUDE_PREFIXES: [],
    PII_MASK_KEYWORDS: [],
    PII_MASK_PATHS: [],

    createLogger: vi.fn(() => stub),

    createTrpcLogger: vi.fn(() => stub),
    createCronLogger: vi.fn(() => stub),
    createWebhookLogger: vi.fn(() => stub),
    createIntegrationLogger: vi.fn(() => stub),
  };
});

import { checkShipmentTaskCompletion, handleEquipmentTaskStart } from '../equipment-workflow';

const ORG_ID = 'org-eq-001';
const TASK_ID = 'task-eq-001';
const WF_RUN_ID = 'wf-run-001';
const CONTRACTOR_ID = 'contractor-eq-001';

function buildTxMock(
  overrides: {
    assignments?: Array<{
      equipment: { id: string; name: string; status: string };
    }>;
    allTasksForRecompute?: Array<{ status: string; required: boolean }>;
  } = {},
) {
  const assignments = overrides.assignments ?? [];
  const allTasksForRecompute = overrides.allTasksForRecompute ?? [
    { status: 'DONE', required: true },
  ];

  const workflowTaskRun = {
    update: vi.fn(async () => ({ id: TASK_ID })),
    findMany: vi.fn(async () => allTasksForRecompute),
    updateMany: vi.fn(async () => ({ count: 1 })),
    findUnique: vi.fn(async () => ({ workflowRunId: WF_RUN_ID })),
  };

  const tx = {
    equipmentAssignment: {
      findMany: vi.fn(async () => assignments),
    },
    workflowTaskRun,
    equipment: {
      updateMany: vi.fn(async () => ({ count: assignments.length })),
    },
    workflowRun: {
      update: vi.fn(async () => ({})),
    },
  };

  return tx;
}

describe('handleEquipmentTaskStart', () => {
  it('no-ops when taskType is not EQUIPMENT', async () => {
    const tx = buildTxMock();
    const db = { $transaction: vi.fn(async (fn: (t: unknown) => Promise<void>) => fn(tx)) };

    await handleEquipmentTaskStart(
      db as never,
      ORG_ID,
      { id: TASK_ID, taskType: 'OTHER' },
      {
        id: WF_RUN_ID,
        contractorId: CONTRACTOR_ID,
        templateType: 'ONBOARDING',
      },
    );

    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('skips when workflow has no contractor', async () => {
    const db = { $transaction: vi.fn() };

    await handleEquipmentTaskStart(
      db as never,
      ORG_ID,
      { id: TASK_ID, taskType: 'EQUIPMENT' },
      {
        id: WF_RUN_ID,
        contractorId: null,
        templateType: 'ONBOARDING',
      },
    );

    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('auto-completes task when contractor has no assigned equipment', async () => {
    const tx = buildTxMock({ assignments: [] });
    const db = { $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<void>) => fn(tx)) };

    await handleEquipmentTaskStart(
      db as never,
      ORG_ID,
      { id: TASK_ID, taskType: 'EQUIPMENT' },
      {
        id: WF_RUN_ID,
        contractorId: CONTRACTOR_ID,
        templateType: 'ONBOARDING',
      },
    );

    expect(tx.workflowTaskRun.update).toHaveBeenCalledWith({
      where: { id: TASK_ID },
      data: expect.objectContaining({
        status: 'DONE',
        resultJson: expect.objectContaining({
          autoCompleted: true,
          reason: 'no_equipment_assigned',
          direction: 'OUTBOUND',
        }),
      }),
    });
    expect(tx.workflowRun.update).toHaveBeenCalled();
  });

  it('sets IN_PROGRESS with OUTBOUND metadata for onboarding when equipment exists', async () => {
    const tx = buildTxMock({
      assignments: [{ equipment: { id: 'eq-1', name: 'Laptop', status: 'ASSIGNED' } }],
    });
    const db = { $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<void>) => fn(tx)) };

    await handleEquipmentTaskStart(
      db as never,
      ORG_ID,
      { id: TASK_ID, taskType: 'EQUIPMENT' },
      {
        id: WF_RUN_ID,
        contractorId: CONTRACTOR_ID,
        templateType: 'ONBOARDING',
      },
    );

    expect(tx.workflowTaskRun.update).toHaveBeenCalledWith({
      where: { id: TASK_ID },
      data: expect.objectContaining({
        status: 'IN_PROGRESS',
        resultJson: { equipmentIds: ['eq-1'], direction: 'OUTBOUND' },
      }),
    });
    expect(tx.equipment.updateMany).not.toHaveBeenCalled();
  });

  it('marks equipment RETURN_REQUESTED for offboarding with assignments', async () => {
    const tx = buildTxMock({
      assignments: [{ equipment: { id: 'eq-2', name: 'Phone', status: 'ASSIGNED' } }],
    });
    const db = { $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<void>) => fn(tx)) };

    await handleEquipmentTaskStart(
      db as never,
      ORG_ID,
      { id: TASK_ID, taskType: 'EQUIPMENT' },
      {
        id: WF_RUN_ID,
        contractorId: CONTRACTOR_ID,
        templateType: 'OFFBOARDING',
      },
    );

    expect(tx.equipment.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['eq-2'] }, organizationId: ORG_ID },
      data: { status: 'RETURN_REQUESTED' },
    });
  });
});

// ---------------------------------------------------------------------------
// autoCreateInPostReturnShipment (called internally by handleEquipmentTaskStart)
// ---------------------------------------------------------------------------

// We test autoCreateInPostReturnShipment indirectly through handleEquipmentTaskStart
// with OFFBOARDING template type and equipment assignments present.

const { mockCreateShipment } = vi.hoisted(() => ({
  mockCreateShipment: vi.fn(),
}));

vi.mock('../courier/inpost-client', () => {
  const MockInPostClient = vi.fn().mockImplementation(function (this: {
    createShipment: typeof mockCreateShipment;
  }) {
    this.createShipment = mockCreateShipment;
  });
  return { InPostClient: MockInPostClient };
});

function buildFullTxMock(
  overrides: {
    assignments?: Array<{ equipment: { id: string; name: string; status: string } }>;
    courierConfig?: Record<string, unknown> | null;
    contractor?: Record<string, unknown> | null;
    organization?: Record<string, unknown> | null;
    allTasksForRecompute?: Array<{ status: string; required: boolean }>;
  } = {},
) {
  const assignments = overrides.assignments ?? [];
  const allTasksForRecompute = overrides.allTasksForRecompute ?? [
    { status: 'DONE', required: true },
  ];

  return {
    equipmentAssignment: {
      findMany: vi.fn(async () => assignments),
    },
    workflowTaskRun: {
      update: vi.fn(async () => ({ id: TASK_ID })),
      findMany: vi.fn(async () => allTasksForRecompute),
      updateMany: vi.fn(async () => ({ count: 1 })),
      findUnique: vi.fn(async () => ({ workflowRunId: WF_RUN_ID })),
    },
    equipment: {
      updateMany: vi.fn(async () => ({ count: assignments.length })),
      update: vi.fn(async () => ({})),
    },
    workflowRun: {
      update: vi.fn(async () => ({})),
    },
    courierConfig: {
      findUnique: vi.fn(async () => overrides.courierConfig ?? null),
    },
    contractor: {
      findUnique: vi.fn(async () => overrides.contractor ?? null),
    },
    organization: {
      findUnique: vi.fn(async () => overrides.organization ?? { id: ORG_ID, name: 'Test Org' }),
    },
    shipment: {
      create: vi.fn(async () => ({ id: 'ship-auto-1' })),
    },
    shipmentEvent: {
      create: vi.fn(async () => ({})),
    },
    returnRequest: {
      create: vi.fn(async () => ({})),
    },
  };
}

describe('autoCreateInPostReturnShipment (via handleEquipmentTaskStart)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLogWarn.mockClear();
  });

  it('skips auto-shipment when org has no InPost courier config', async () => {
    const tx = buildFullTxMock({
      assignments: [{ equipment: { id: 'eq-1', name: 'Laptop', status: 'ASSIGNED' } }],
      courierConfig: null,
    });
    const db = { $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<void>) => fn(tx)) };

    await handleEquipmentTaskStart(
      db as never,
      ORG_ID,
      { id: TASK_ID, taskType: 'EQUIPMENT' },
      {
        id: WF_RUN_ID,
        contractorId: CONTRACTOR_ID,
        templateType: 'OFFBOARDING',
      },
    );

    // Equipment should be marked RETURN_REQUESTED
    expect(tx.equipment.updateMany).toHaveBeenCalled();
    // But no shipment should be created
    expect(tx.shipment.create).not.toHaveBeenCalled();
    expect(tx.returnRequest.create).not.toHaveBeenCalled();
  });

  it('skips auto-shipment when contractor has no preferred Paczkomat', async () => {
    const tx = buildFullTxMock({
      assignments: [{ equipment: { id: 'eq-1', name: 'Laptop', status: 'ASSIGNED' } }],
      courierConfig: { id: 'cc-1', carrier: 'inpost', configJson: { apiKey: 'key', orgId: 123 } },
      contractor: {
        displayName: 'John Doe',
        email: 'john@example.com',
        phone: '+48123456789',
        preferredPaczkomatId: null,
        preferredPaczkomatName: null,
        preferredPaczkomatAddress: null,
      },
    });
    const db = { $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<void>) => fn(tx)) };

    await handleEquipmentTaskStart(
      db as never,
      ORG_ID,
      { id: TASK_ID, taskType: 'EQUIPMENT' },
      {
        id: WF_RUN_ID,
        contractorId: CONTRACTOR_ID,
        templateType: 'OFFBOARDING',
      },
    );

    expect(tx.shipment.create).not.toHaveBeenCalled();
    expect(mockLogWarn).toHaveBeenCalledWith(
      expect.objectContaining({ contractorId: CONTRACTOR_ID }),
      expect.stringContaining('no preferred Paczkomat'),
    );
  });

  it('creates shipment, shipment events, and return request on happy path', async () => {
    mockCreateShipment.mockResolvedValue({
      trackingNumber: 'TRACK-001',
      externalId: 'ext-001',
      labelUrl: 'https://label.url/001',
    });

    const tx = buildFullTxMock({
      assignments: [{ equipment: { id: 'eq-1', name: 'Laptop', status: 'ASSIGNED' } }],
      courierConfig: {
        id: 'cc-1',
        carrier: 'inpost',
        configJson: { apiKey: 'key', organizationId: 123 },
      },
      contractor: {
        displayName: 'John Doe',
        email: 'john@example.com',
        phone: '+48123456789',
        preferredPaczkomatId: 'KRA01A',
        preferredPaczkomatName: 'Kraków Paczkomat 01A',
        preferredPaczkomatAddress: 'ul. Testowa 1, 30-001 Kraków',
      },
    });
    const db = { $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<void>) => fn(tx)) };

    await handleEquipmentTaskStart(
      db as never,
      ORG_ID,
      { id: TASK_ID, taskType: 'EQUIPMENT' },
      {
        id: WF_RUN_ID,
        contractorId: CONTRACTOR_ID,
        templateType: 'OFFBOARDING',
      },
    );

    // Shipment created for the equipment item
    expect(tx.shipment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: ORG_ID,
        equipmentId: 'eq-1',
        workflowTaskRunId: TASK_ID,
        direction: 'RETURN',
        carrier: 'InPost',
        trackingNumber: 'TRACK-001',
        externalId: 'ext-001',
        currentStatus: 'CREATED',
      }),
    });

    // Two shipment events per equipment item (CREATED + LABEL_GENERATED)
    expect(tx.shipmentEvent.create).toHaveBeenCalledTimes(2);

    // Equipment status updated to RETURN_IN_TRANSIT
    expect(tx.equipment.update).toHaveBeenCalledWith({
      where: { id: 'eq-1' },
      data: { status: 'RETURN_IN_TRANSIT' },
    });

    // ReturnRequest created with SHIPMENT_CREATED status (skipping PENDING_APPROVAL)
    expect(tx.returnRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: ORG_ID,
        contractorId: CONTRACTOR_ID,
        status: 'SHIPMENT_CREATED',
        targetPointId: 'KRA01A',
        shipmentId: 'ship-auto-1',
      }),
    });
  });

  it('does not fail the task start when InPost API errors', async () => {
    mockCreateShipment.mockRejectedValue(new Error('ShipX API timeout'));

    const tx = buildFullTxMock({
      assignments: [{ equipment: { id: 'eq-1', name: 'Laptop', status: 'ASSIGNED' } }],
      courierConfig: {
        id: 'cc-1',
        carrier: 'inpost',
        configJson: { apiKey: 'key', organizationId: 123 },
      },
      contractor: {
        displayName: 'John Doe',
        email: 'john@example.com',
        phone: '+48123456789',
        preferredPaczkomatId: 'KRA01A',
        preferredPaczkomatName: 'Kraków Paczkomat 01A',
        preferredPaczkomatAddress: 'ul. Testowa 1, 30-001 Kraków',
      },
    });
    const db = { $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<void>) => fn(tx)) };

    // Should NOT throw — error is caught internally
    await handleEquipmentTaskStart(
      db as never,
      ORG_ID,
      { id: TASK_ID, taskType: 'EQUIPMENT' },
      {
        id: WF_RUN_ID,
        contractorId: CONTRACTOR_ID,
        templateType: 'OFFBOARDING',
      },
    );

    // Task should still be set to IN_PROGRESS (the task start itself succeeds)
    expect(tx.workflowTaskRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'IN_PROGRESS' }),
      }),
    );
  });

  it('creates shipments for multiple equipment items with same tracking number', async () => {
    mockCreateShipment.mockResolvedValue({
      trackingNumber: 'TRACK-MULTI',
      externalId: 'ext-multi',
      labelUrl: 'https://label.url/multi',
    });

    const tx = buildFullTxMock({
      assignments: [
        { equipment: { id: 'eq-1', name: 'Laptop', status: 'ASSIGNED' } },
        { equipment: { id: 'eq-2', name: 'Phone', status: 'ASSIGNED' } },
      ],
      courierConfig: {
        id: 'cc-1',
        carrier: 'inpost',
        configJson: { apiKey: 'key', organizationId: 123 },
      },
      contractor: {
        displayName: 'Jane Doe',
        email: 'jane@example.com',
        phone: '+48987654321',
        preferredPaczkomatId: 'WAW05B',
        preferredPaczkomatName: 'Warszawa Paczkomat 05B',
        preferredPaczkomatAddress: 'ul. Przykładowa 5, 00-001 Warszawa',
      },
    });
    const db = { $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<void>) => fn(tx)) };

    await handleEquipmentTaskStart(
      db as never,
      ORG_ID,
      { id: TASK_ID, taskType: 'EQUIPMENT' },
      {
        id: WF_RUN_ID,
        contractorId: CONTRACTOR_ID,
        templateType: 'OFFBOARDING',
      },
    );

    // One shipment record per equipment item
    expect(tx.shipment.create).toHaveBeenCalledTimes(2);
    // Two shipment events per equipment item (CREATED + LABEL_GENERATED)
    expect(tx.shipmentEvent.create).toHaveBeenCalledTimes(4);
    // Each equipment updated to RETURN_IN_TRANSIT
    expect(tx.equipment.update).toHaveBeenCalledTimes(2);
    // Only one return request for the whole batch
    expect(tx.returnRequest.create).toHaveBeenCalledTimes(1);
  });
});

describe('checkShipmentTaskCompletion', () => {
  it('returns early when shipment has no workflow task link', async () => {
    const db = { shipment: { findMany: vi.fn() }, workflowTaskRun: {} };

    await checkShipmentTaskCompletion(db as never, ORG_ID, {
      id: 'ship-1',
      workflowTaskRunId: null,
      direction: 'OUTBOUND',
      currentStatus: 'DELIVERED',
    });

    expect(db.shipment.findMany).not.toHaveBeenCalled();
  });

  it('returns early when shipment has not reached target status', async () => {
    const db = { shipment: { findMany: vi.fn() }, workflowTaskRun: {} };

    await checkShipmentTaskCompletion(db as never, ORG_ID, {
      id: 'ship-1',
      workflowTaskRunId: TASK_ID,
      direction: 'OUTBOUND',
      currentStatus: 'IN_TRANSIT',
    });

    expect(db.shipment.findMany).not.toHaveBeenCalled();
  });

  it('waits until all linked shipments reach their direction-specific targets', async () => {
    const db = {
      shipment: {
        findMany: vi.fn(async () => [
          { id: 'a', direction: 'OUTBOUND', currentStatus: 'DELIVERED' },
          { id: 'b', direction: 'OUTBOUND', currentStatus: 'IN_TRANSIT' },
        ]),
      },
      workflowTaskRun: { updateMany: vi.fn(), findUnique: vi.fn() },
      workflowRun: { update: vi.fn() },
    };

    await checkShipmentTaskCompletion(db as never, ORG_ID, {
      id: 'ship-a',
      workflowTaskRunId: TASK_ID,
      direction: 'OUTBOUND',
      currentStatus: 'DELIVERED',
    });

    expect(db.workflowTaskRun.updateMany).not.toHaveBeenCalled();
  });

  it('completes task and recomputes workflow when all linked shipments are done', async () => {
    const db = {
      shipment: {
        findMany: vi.fn(async () => [
          { id: 'a', direction: 'OUTBOUND', currentStatus: 'DELIVERED' },
          { id: 'b', direction: 'RETURN', currentStatus: 'RETURNED' },
        ]),
      },
      workflowTaskRun: {
        updateMany: vi.fn(async () => ({ count: 1 })),
        findUnique: vi.fn(async () => ({ workflowRunId: WF_RUN_ID })),
        findMany: vi.fn(async () => [{ status: 'DONE', required: true }]),
      },
      workflowRun: { update: vi.fn(async () => ({})) },
    };

    await checkShipmentTaskCompletion(db as never, ORG_ID, {
      id: 'ship-b',
      workflowTaskRunId: TASK_ID,
      direction: 'RETURN',
      currentStatus: 'RETURNED',
    });

    expect(db.workflowTaskRun.updateMany).toHaveBeenCalledWith({
      where: {
        id: TASK_ID,
        organizationId: ORG_ID,
        status: 'IN_PROGRESS',
      },
      data: expect.objectContaining({
        status: 'DONE',
      }),
    });
    expect(db.workflowRun.update).toHaveBeenCalled();
  });

  it('is idempotent when task is not IN_PROGRESS', async () => {
    const db = {
      shipment: {
        findMany: vi.fn(async () => [
          { id: 'a', direction: 'OUTBOUND', currentStatus: 'DELIVERED' },
        ]),
      },
      workflowTaskRun: {
        updateMany: vi.fn(async () => ({ count: 0 })),
        findUnique: vi.fn(),
      },
      workflowRun: { update: vi.fn() },
    };

    await checkShipmentTaskCompletion(db as never, ORG_ID, {
      id: 'ship-a',
      workflowTaskRunId: TASK_ID,
      direction: 'OUTBOUND',
      currentStatus: 'DELIVERED',
    });

    expect(db.workflowTaskRun.findUnique).not.toHaveBeenCalled();
  });
});
