import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

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

import {
  EQUIPMENT_STATUS_TRANSITIONS,
  isEventDuplicate,
  processShipmentStatusChange,
  SHIPMENT_TO_EQUIPMENT_STATUS,
  shouldApplyShipmentStatusUpdate,
  TERMINAL_STATUSES,
} from '../shipment-processing';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockDb() {
  const db = {
    shipmentEvent: {
      create: vi.fn().mockResolvedValue({ id: 'evt_1' }),
      findFirst: vi.fn(),
    },
    shipment: {
      update: vi.fn().mockResolvedValue({}),
    },
    equipment: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn(),
  };
  db.$transaction.mockImplementation(async (callback: (tx: typeof db) => Promise<unknown>) =>
    callback(db),
  );
  return db;
}

function baseShipment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ship_1',
    trackingNumber: 'TRACK-001',
    currentStatus: 'IN_TRANSIT',
    direction: 'OUTBOUND',
    equipmentId: 'equip_1',
    externalId: 'ext_1',
    workflowTaskRunId: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TERMINAL_STATUSES', () => {
  it('includes DELIVERED, FAILED, RETURNED', () => {
    expect(TERMINAL_STATUSES).toContain('DELIVERED');
    expect(TERMINAL_STATUSES).toContain('FAILED');
    expect(TERMINAL_STATUSES).toContain('RETURNED');
  });
});

describe('SHIPMENT_TO_EQUIPMENT_STATUS', () => {
  it('maps DELIVERED + OUTBOUND to DELIVERED', () => {
    expect(SHIPMENT_TO_EQUIPMENT_STATUS.DELIVERED?.OUTBOUND).toBe('DELIVERED');
  });

  it('maps DELIVERED + RETURN to RETURNED', () => {
    expect(SHIPMENT_TO_EQUIPMENT_STATUS.DELIVERED?.RETURN).toBe('RETURNED');
  });

  it('maps RETURNED + RETURN to RETURNED', () => {
    expect(SHIPMENT_TO_EQUIPMENT_STATUS.RETURNED?.RETURN).toBe('RETURNED');
  });

  it('returns undefined for RETURNED + OUTBOUND', () => {
    expect(SHIPMENT_TO_EQUIPMENT_STATUS.RETURNED?.OUTBOUND).toBeUndefined();
  });

  it('returns undefined for unmapped status', () => {
    expect(SHIPMENT_TO_EQUIPMENT_STATUS.IN_TRANSIT).toBeUndefined();
  });
});

describe('EQUIPMENT_STATUS_TRANSITIONS', () => {
  it('allows IN_TRANSIT -> DELIVERED', () => {
    expect(EQUIPMENT_STATUS_TRANSITIONS.IN_TRANSIT).toContain('DELIVERED');
  });

  it('does not allow RETIRED -> anything', () => {
    expect(EQUIPMENT_STATUS_TRANSITIONS.RETIRED).toEqual([]);
  });

  it('allows RETURN_IN_TRANSIT -> RETURNED', () => {
    expect(EQUIPMENT_STATUS_TRANSITIONS.RETURN_IN_TRANSIT).toContain('RETURNED');
  });
});

describe('processShipmentStatusChange', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates shipment event and updates shipment status', async () => {
    const db = createMockDb();
    db.equipment.findUnique.mockResolvedValue(null);

    const shipment = baseShipment();
    await processShipmentStatusChange(
      db as never,
      'org_1',
      shipment,
      'IN_TRANSIT',
      'DPD',
      'Package picked up',
    );

    expect(db.shipmentEvent.create).toHaveBeenCalledWith({
      data: {
        organizationId: 'org_1',
        shipmentId: 'ship_1',
        status: 'IN_TRANSIT',
        notes: 'Package picked up',
      },
    });

    expect(db.shipment.update).toHaveBeenCalledWith({
      where: { id: 'ship_1' },
      data: { currentStatus: 'IN_TRANSIT' },
    });
  });

  it('dispatches notification for DELIVERED status', async () => {
    const db = createMockDb();
    db.equipment.findUnique.mockResolvedValue(null);

    const shipment = baseShipment();
    await processShipmentStatusChange(
      db as never,
      'org_1',
      shipment,
      'DELIVERED',
      'UPS',
      'Delivered to recipient',
    );

    expect(mockDispatchShipmentNotification).toHaveBeenCalledWith(
      db,
      'org_1',
      { id: 'ship_1', trackingNumber: 'TRACK-001', currentStatus: 'IN_TRANSIT' },
      'DELIVERED',
      'UPS',
    );
  });

  it('does not dispatch notification for non-notable status', async () => {
    const db = createMockDb();
    db.equipment.findUnique.mockResolvedValue(null);

    const shipment = baseShipment();
    await processShipmentStatusChange(
      db as never,
      'org_1',
      shipment,
      'IN_TRANSIT',
      'DPD',
      'In transit',
    );

    expect(mockDispatchShipmentNotification).not.toHaveBeenCalled();
  });

  it('calls checkShipmentTaskCompletion', async () => {
    const db = createMockDb();
    db.equipment.findUnique.mockResolvedValue(null);

    const shipment = baseShipment({ workflowTaskRunId: 'task_1' });
    await processShipmentStatusChange(
      db as never,
      'org_1',
      shipment,
      'DELIVERED',
      'InPost',
      'Delivered',
    );

    expect(mockCheckShipmentTaskCompletion).toHaveBeenCalledWith(
      db,
      'org_1',
      expect.objectContaining({
        id: 'ship_1',
        workflowTaskRunId: 'task_1',
        direction: 'OUTBOUND',
        currentStatus: 'DELIVERED',
      }),
    );
  });

  it('auto-advances equipment status when transition is valid', async () => {
    const db = createMockDb();
    db.equipment.findUnique.mockResolvedValue({ id: 'equip_1', status: 'IN_TRANSIT' });

    const shipment = baseShipment({ direction: 'OUTBOUND' });
    await processShipmentStatusChange(
      db as never,
      'org_1',
      shipment,
      'DELIVERED',
      'DPD',
      'Delivered',
    );

    expect(db.equipment.update).toHaveBeenCalledWith({
      where: { id: 'equip_1' },
      data: { status: 'DELIVERED' },
    });
  });

  it('does not advance equipment when transition is not allowed', async () => {
    const db = createMockDb();
    // RETIRED cannot transition to anything
    db.equipment.findUnique.mockResolvedValue({ id: 'equip_1', status: 'RETIRED' });

    const shipment = baseShipment({ direction: 'OUTBOUND' });
    await processShipmentStatusChange(
      db as never,
      'org_1',
      shipment,
      'DELIVERED',
      'DPD',
      'Delivered',
    );

    expect(db.equipment.update).not.toHaveBeenCalled();
  });

  it('does not advance equipment when equipment not found', async () => {
    const db = createMockDb();
    db.equipment.findUnique.mockResolvedValue(null);

    const shipment = baseShipment();
    await processShipmentStatusChange(
      db as never,
      'org_1',
      shipment,
      'DELIVERED',
      'DPD',
      'Delivered',
    );

    expect(db.equipment.update).not.toHaveBeenCalled();
  });

  it('does not advance equipment when no equipment status mapping exists', async () => {
    const db = createMockDb();
    db.equipment.findUnique.mockResolvedValue({ id: 'equip_1', status: 'IN_TRANSIT' });

    const shipment = baseShipment();
    // IN_TRANSIT has no entry in SHIPMENT_TO_EQUIPMENT_STATUS
    await processShipmentStatusChange(
      db as never,
      'org_1',
      shipment,
      'IN_TRANSIT',
      'DPD',
      'In transit',
    );

    expect(db.equipment.findUnique).not.toHaveBeenCalled();
  });

  it('advances equipment on RETURN direction with DELIVERED status', async () => {
    const db = createMockDb();
    db.equipment.findUnique.mockResolvedValue({ id: 'equip_1', status: 'RETURN_IN_TRANSIT' });

    const shipment = baseShipment({ direction: 'RETURN' });
    await processShipmentStatusChange(
      db as never,
      'org_1',
      shipment,
      'DELIVERED',
      'DPD',
      'Return delivered',
    );

    expect(db.equipment.update).toHaveBeenCalledWith({
      where: { id: 'equip_1' },
      data: { status: 'RETURNED' },
    });
  });
});

describe('isEventDuplicate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns true when event already exists', async () => {
    const db = createMockDb();
    db.shipmentEvent.findFirst.mockResolvedValue({ id: 'evt_existing' });

    const result = await isEventDuplicate(db as never, 'ship_1', 'DELIVERED');

    expect(result).toBe(true);
    expect(db.shipmentEvent.findFirst).toHaveBeenCalledWith({
      where: { shipmentId: 'ship_1', status: 'DELIVERED' },
    });
  });

  it('returns false when no matching event exists', async () => {
    const db = createMockDb();
    db.shipmentEvent.findFirst.mockResolvedValue(null);

    const result = await isEventDuplicate(db as never, 'ship_1', 'DELIVERED');

    expect(result).toBe(false);
  });
});

describe('shouldApplyShipmentStatusUpdate', () => {
  it('allows forward progression and same-rank repeats', () => {
    expect(shouldApplyShipmentStatusUpdate('CREATED', 'LABEL_GENERATED')).toBe(true);
    expect(shouldApplyShipmentStatusUpdate('IN_TRANSIT', 'OUT_FOR_DELIVERY')).toBe(true);
    expect(shouldApplyShipmentStatusUpdate('IN_TRANSIT', 'IN_TRANSIT')).toBe(true);
    expect(shouldApplyShipmentStatusUpdate('OUT_FOR_DELIVERY', 'DELIVERED')).toBe(true);
  });

  it('blocks backward transitions from late out-of-order webhooks', () => {
    expect(shouldApplyShipmentStatusUpdate('OUT_FOR_DELIVERY', 'IN_TRANSIT')).toBe(false);
    expect(shouldApplyShipmentStatusUpdate('IN_TRANSIT', 'PICKED_UP')).toBe(false);
  });

  it('keeps DELIVERED and RETURNED immutable', () => {
    expect(shouldApplyShipmentStatusUpdate('DELIVERED', 'IN_TRANSIT')).toBe(false);
    expect(shouldApplyShipmentStatusUpdate('DELIVERED', 'RETURNED')).toBe(false);
    expect(shouldApplyShipmentStatusUpdate('RETURNED', 'DELIVERED')).toBe(false);
  });

  it('lets FAILED progress to a delivery outcome (courier retry / return-to-sender)', () => {
    expect(shouldApplyShipmentStatusUpdate('FAILED', 'RETURNED')).toBe(true);
    expect(shouldApplyShipmentStatusUpdate('FAILED', 'DELIVERED')).toBe(true);
    expect(shouldApplyShipmentStatusUpdate('FAILED', 'OUT_FOR_DELIVERY')).toBe(true);
    expect(shouldApplyShipmentStatusUpdate('FAILED', 'IN_TRANSIT')).toBe(false);
    expect(shouldApplyShipmentStatusUpdate('FAILED', 'CREATED')).toBe(false);
  });
});
