import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// InPost Polling Service Tests
// ---------------------------------------------------------------------------

// Shared mock for getStatus — tests configure it per-case
const mockGetStatus = vi.fn();

// Mock InPostClient as a class
vi.mock('../inpost-client', () => {
  return {
    InPostClient: class MockInPostClient {
      getStatus = mockGetStatus;
    },
  };
});

const { mockCheckShipmentTaskCompletion } = vi.hoisted(() => ({
  mockCheckShipmentTaskCompletion: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../equipment-workflow', () => ({
  checkShipmentTaskCompletion: mockCheckShipmentTaskCompletion,
}));

const { mockDispatchShipmentNotification } = vi.hoisted(() => ({
  mockDispatchShipmentNotification: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../shipment-notification', () => ({
  dispatchShipmentNotification: mockDispatchShipmentNotification,
}));

import { pollInPostShipmentStatuses } from '../inpost-polling-service';

function createMockDb() {
  return {
    courierConfig: {
      findUnique: vi.fn(),
    },
    shipment: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    shipmentEvent: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    equipment: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  };
}

describe('pollInPostShipmentStatuses', () => {
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    db = createMockDb();
    mockGetStatus.mockReset();
    mockCheckShipmentTaskCompletion.mockReset().mockResolvedValue(undefined);
    mockDispatchShipmentNotification.mockReset().mockResolvedValue(undefined);
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('fetches all active InPost shipments (not DELIVERED/FAILED/RETURNED)', async () => {
    db.courierConfig.findUnique.mockResolvedValue({
      configJson: {
        apiToken: 'token-123',
        shipxOrganizationId: 'org-shipx',
        sandbox: true,
      },
    });
    db.shipment.findMany.mockResolvedValue([]);

    const result = await pollInPostShipmentStatuses(db as unknown, 'org-1');

    expect(db.shipment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 'org-1',
          carrier: 'InPost',
          currentStatus: {
            notIn: ['DELIVERED', 'FAILED', 'RETURNED'],
          },
          externalId: { not: null },
        }),
      }),
    );

    expect(result).toEqual({ checked: 0, updated: 0 });
  });

  it('creates missing events for statuses newer than last recorded', async () => {
    db.courierConfig.findUnique.mockResolvedValue({
      configJson: {
        apiToken: 'token-123',
        shipxOrganizationId: 'org-shipx',
        sandbox: true,
      },
    });

    db.shipment.findMany.mockResolvedValue([
      {
        id: 'ship-1',
        organizationId: 'org-1',
        equipmentId: 'equip-1',
        externalId: 'ext-1',
        direction: 'OUTBOUND',
        currentStatus: 'IN_TRANSIT',
        workflowTaskRunId: null,
      },
    ]);

    mockGetStatus.mockResolvedValue({
      externalId: 'ext-1',
      status: 'delivered',
      trackingNumber: 'T1',
    });

    db.shipmentEvent.findFirst.mockResolvedValue(null); // no duplicate
    db.shipmentEvent.create.mockResolvedValue({});
    db.shipment.update.mockResolvedValue({});
    db.equipment.findUnique.mockResolvedValue({
      id: 'equip-1',
      status: 'IN_TRANSIT',
    });
    db.equipment.update.mockResolvedValue({});

    const result = await pollInPostShipmentStatuses(db as unknown, 'org-1');

    expect(mockGetStatus).toHaveBeenCalledWith('ext-1');
    expect(db.shipmentEvent.create).toHaveBeenCalled();
    expect(result.checked).toBe(1);
    expect(result.updated).toBe(1);
  });

  it('skips shipments without externalId', async () => {
    db.courierConfig.findUnique.mockResolvedValue({
      configJson: {
        apiToken: 'token-123',
        shipxOrganizationId: 'org-shipx',
        sandbox: true,
      },
    });

    // The query itself filters out null externalIds, so findMany returns empty
    db.shipment.findMany.mockResolvedValue([]);

    const result = await pollInPostShipmentStatuses(db as unknown, 'org-1');

    expect(result).toEqual({ checked: 0, updated: 0 });
  });

  it('returns early if no courier config found', async () => {
    db.courierConfig.findUnique.mockResolvedValue(null);

    const result = await pollInPostShipmentStatuses(db as unknown, 'org-1');

    expect(result).toEqual({ checked: 0, updated: 0 });
    expect(db.shipment.findMany).not.toHaveBeenCalled();
  });

  it('does not update if status has not changed', async () => {
    db.courierConfig.findUnique.mockResolvedValue({
      configJson: {
        apiToken: 'token-123',
        shipxOrganizationId: 'org-shipx',
        sandbox: true,
      },
    });

    db.shipment.findMany.mockResolvedValue([
      {
        id: 'ship-1',
        organizationId: 'org-1',
        equipmentId: 'equip-1',
        externalId: 'ext-1',
        direction: 'OUTBOUND',
        currentStatus: 'IN_TRANSIT',
        workflowTaskRunId: null,
      },
    ]);

    mockGetStatus.mockResolvedValue({
      externalId: 'ext-1',
      status: 'adopted_at_source_branch', // maps to IN_TRANSIT — same as current
    });

    const result = await pollInPostShipmentStatuses(db as unknown, 'org-1');

    expect(result.checked).toBe(1);
    expect(result.updated).toBe(0);
    expect(db.shipmentEvent.create).not.toHaveBeenCalled();
  });

  it('calls checkShipmentTaskCompletion after polling status update', async () => {
    db.courierConfig.findUnique.mockResolvedValue({
      configJson: {
        apiToken: 'token-123',
        shipxOrganizationId: 'org-shipx',
        sandbox: true,
      },
    });

    db.shipment.findMany.mockResolvedValue([
      {
        id: 'ship-1',
        organizationId: 'org-1',
        equipmentId: 'equip-1',
        externalId: 'ext-1',
        direction: 'OUTBOUND',
        currentStatus: 'IN_TRANSIT',
        workflowTaskRunId: 'task-1',
      },
    ]);

    mockGetStatus.mockResolvedValue({
      externalId: 'ext-1',
      status: 'delivered',
      trackingNumber: 'T1',
    });

    db.shipmentEvent.findFirst.mockResolvedValue(null);
    db.shipmentEvent.create.mockResolvedValue({});
    db.shipment.update.mockResolvedValue({});
    db.equipment.findUnique.mockResolvedValue({
      id: 'equip-1',
      status: 'IN_TRANSIT',
    });
    db.equipment.update.mockResolvedValue({});

    await pollInPostShipmentStatuses(db as unknown, 'org-1');

    expect(mockCheckShipmentTaskCompletion).toHaveBeenCalledWith(
      db,
      'org-1',
      expect.objectContaining({
        id: 'ship-1',
        workflowTaskRunId: 'task-1',
        direction: 'OUTBOUND',
        currentStatus: 'DELIVERED',
      }),
    );
  });

  it('does not call checkShipmentTaskCompletion when status unchanged', async () => {
    db.courierConfig.findUnique.mockResolvedValue({
      configJson: {
        apiToken: 'token-123',
        shipxOrganizationId: 'org-shipx',
        sandbox: true,
      },
    });

    db.shipment.findMany.mockResolvedValue([
      {
        id: 'ship-1',
        organizationId: 'org-1',
        equipmentId: 'equip-1',
        externalId: 'ext-1',
        direction: 'OUTBOUND',
        currentStatus: 'IN_TRANSIT',
        workflowTaskRunId: 'task-1',
      },
    ]);

    mockGetStatus.mockResolvedValue({
      externalId: 'ext-1',
      status: 'adopted_at_source_branch', // maps to IN_TRANSIT — same as current
    });

    await pollInPostShipmentStatuses(db as unknown, 'org-1');

    expect(mockCheckShipmentTaskCompletion).not.toHaveBeenCalled();
  });

  it('dispatches notification on terminal status (DELIVERED)', async () => {
    db.courierConfig.findUnique.mockResolvedValue({
      configJson: {
        apiToken: 'token-123',
        shipxOrganizationId: 'org-shipx',
        sandbox: true,
      },
    });

    db.shipment.findMany.mockResolvedValue([
      {
        id: 'ship-1',
        organizationId: 'org-1',
        equipmentId: 'equip-1',
        externalId: 'ext-1',
        trackingNumber: 'TRK-001',
        direction: 'OUTBOUND',
        currentStatus: 'IN_TRANSIT',
        workflowTaskRunId: null,
      },
    ]);

    mockGetStatus.mockResolvedValue({
      externalId: 'ext-1',
      status: 'delivered',
      trackingNumber: 'T1',
    });

    db.shipmentEvent.findFirst.mockResolvedValue(null);
    db.shipmentEvent.create.mockResolvedValue({});
    db.shipment.update.mockResolvedValue({});
    db.equipment.findUnique.mockResolvedValue({
      id: 'equip-1',
      status: 'IN_TRANSIT',
    });
    db.equipment.update.mockResolvedValue({});

    await pollInPostShipmentStatuses(db as unknown, 'org-1');

    expect(mockDispatchShipmentNotification).toHaveBeenCalledWith(
      db,
      'org-1',
      expect.objectContaining({
        id: 'ship-1',
        trackingNumber: 'TRK-001',
        currentStatus: 'IN_TRANSIT',
      }),
      'DELIVERED',
      'InPost',
    );
  });

  it('does NOT dispatch notification on non-terminal status', async () => {
    db.courierConfig.findUnique.mockResolvedValue({
      configJson: {
        apiToken: 'token-123',
        shipxOrganizationId: 'org-shipx',
        sandbox: true,
      },
    });

    db.shipment.findMany.mockResolvedValue([
      {
        id: 'ship-1',
        organizationId: 'org-1',
        equipmentId: 'equip-1',
        externalId: 'ext-1',
        trackingNumber: 'TRK-001',
        direction: 'OUTBOUND',
        currentStatus: 'SENT',
        workflowTaskRunId: null,
      },
    ]);

    mockGetStatus.mockResolvedValue({
      externalId: 'ext-1',
      status: 'adopted_at_source_branch',
    });

    db.shipmentEvent.findFirst.mockResolvedValue(null);
    db.shipmentEvent.create.mockResolvedValue({});
    db.shipment.update.mockResolvedValue({});

    await pollInPostShipmentStatuses(db as unknown, 'org-1');

    expect(mockDispatchShipmentNotification).not.toHaveBeenCalled();
  });

  it('continues polling when notification dispatch fails', async () => {
    db.courierConfig.findUnique.mockResolvedValue({
      configJson: {
        apiToken: 'token-123',
        shipxOrganizationId: 'org-shipx',
        sandbox: true,
      },
    });

    db.shipment.findMany.mockResolvedValue([
      {
        id: 'ship-1',
        externalId: 'ext-1',
        trackingNumber: 'TRK-001',
        currentStatus: 'IN_TRANSIT',
        equipmentId: 'equip-1',
        direction: 'OUTBOUND',
        workflowTaskRunId: null,
      },
      {
        id: 'ship-2',
        externalId: 'ext-2',
        trackingNumber: 'TRK-002',
        currentStatus: 'IN_TRANSIT',
        equipmentId: 'equip-2',
        direction: 'OUTBOUND',
        workflowTaskRunId: null,
      },
    ]);

    mockGetStatus.mockResolvedValue({
      status: 'delivered',
    });

    db.shipmentEvent.findFirst.mockResolvedValue(null);
    db.shipmentEvent.create.mockResolvedValue({});
    db.shipment.update.mockResolvedValue({});
    db.equipment.findUnique.mockResolvedValue({
      id: 'equip-1',
      status: 'IN_TRANSIT',
    });
    db.equipment.update.mockResolvedValue({});

    await pollInPostShipmentStatuses(db as unknown, 'org-1');

    expect(db.shipment.update).toHaveBeenCalledTimes(2);
  });
});
