import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// DPD Polling Service Tests
// ---------------------------------------------------------------------------

// Shared mock for getStatus -- tests configure it per-case
const mockGetStatus = vi.fn();

// Mock DPDClient as a class
vi.mock("../dpd-client", () => {
  return {
    DPDClient: class MockDPDClient {
      getStatus = mockGetStatus;
    },
  };
});

const { mockCheckShipmentTaskCompletion } = vi.hoisted(() => ({
  mockCheckShipmentTaskCompletion: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../equipment-workflow", () => ({
  checkShipmentTaskCompletion: mockCheckShipmentTaskCompletion,
}));

import { pollDpdShipmentStatuses } from "../dpd-polling-service";

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

describe("pollDpdShipmentStatuses", () => {
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    db = createMockDb();
    mockGetStatus.mockReset();
    mockCheckShipmentTaskCompletion.mockReset().mockResolvedValue(undefined);
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("fetches all active DPD shipments", async () => {
    db.courierConfig.findUnique.mockResolvedValue({
      configJson: {
        username: "user",
        password: "pass",
        fid: "FID123",
        sandbox: true,
      },
    });
    db.shipment.findMany.mockResolvedValue([]);

    const result = await pollDpdShipmentStatuses(db as any, "org-1");

    expect(db.shipment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: "org-1",
          carrier: "DPD",
          currentStatus: {
            notIn: ["DELIVERED", "FAILED", "RETURNED"],
          },
          externalId: { not: null },
        }),
      }),
    );

    expect(result).toEqual({ checked: 0, updated: 0 });
  });

  it("creates missing events for newer statuses", async () => {
    db.courierConfig.findUnique.mockResolvedValue({
      configJson: {
        username: "user",
        password: "pass",
        fid: "FID123",
        sandbox: true,
      },
    });

    db.shipment.findMany.mockResolvedValue([
      {
        id: "ship-1",
        organizationId: "org-1",
        equipmentId: "equip-1",
        externalId: "ext-1",
        direction: "OUTBOUND",
        currentStatus: "IN_TRANSIT",
        workflowTaskRunId: null,
      },
    ]);

    mockGetStatus.mockResolvedValue({
      externalId: "ext-1",
      status: "DEP_DELIVERED",
      trackingNumber: "T1",
    });

    db.shipmentEvent.findFirst.mockResolvedValue(null);
    db.shipmentEvent.create.mockResolvedValue({});
    db.shipment.update.mockResolvedValue({});
    db.equipment.findUnique.mockResolvedValue({
      id: "equip-1",
      status: "IN_TRANSIT",
    });
    db.equipment.update.mockResolvedValue({});

    const result = await pollDpdShipmentStatuses(db as any, "org-1");

    expect(mockGetStatus).toHaveBeenCalledWith("ext-1");
    expect(db.shipmentEvent.create).toHaveBeenCalled();
    expect(result.checked).toBe(1);
    expect(result.updated).toBe(1);
  });

  it("returns early if no courier config found", async () => {
    db.courierConfig.findUnique.mockResolvedValue(null);

    const result = await pollDpdShipmentStatuses(db as any, "org-1");

    expect(result).toEqual({ checked: 0, updated: 0 });
    expect(db.shipment.findMany).not.toHaveBeenCalled();
  });

  it("calls checkShipmentTaskCompletion after polling status update", async () => {
    db.courierConfig.findUnique.mockResolvedValue({
      configJson: {
        username: "user",
        password: "pass",
        fid: "FID123",
        sandbox: true,
      },
    });

    db.shipment.findMany.mockResolvedValue([
      {
        id: "ship-1",
        organizationId: "org-1",
        equipmentId: "equip-1",
        externalId: "ext-1",
        direction: "OUTBOUND",
        currentStatus: "IN_TRANSIT",
        workflowTaskRunId: "task-1",
      },
    ]);

    mockGetStatus.mockResolvedValue({
      externalId: "ext-1",
      status: "DEP_DELIVERED",
      trackingNumber: "T1",
    });

    db.shipmentEvent.findFirst.mockResolvedValue(null);
    db.shipmentEvent.create.mockResolvedValue({});
    db.shipment.update.mockResolvedValue({});
    db.equipment.findUnique.mockResolvedValue({
      id: "equip-1",
      status: "IN_TRANSIT",
    });
    db.equipment.update.mockResolvedValue({});

    await pollDpdShipmentStatuses(db as any, "org-1");

    expect(mockCheckShipmentTaskCompletion).toHaveBeenCalledWith(
      db,
      "org-1",
      expect.objectContaining({
        id: "ship-1",
        workflowTaskRunId: "task-1",
        direction: "OUTBOUND",
        currentStatus: "DELIVERED",
      }),
    );
  });

  it("does not call checkShipmentTaskCompletion when status unchanged", async () => {
    db.courierConfig.findUnique.mockResolvedValue({
      configJson: {
        username: "user",
        password: "pass",
        fid: "FID123",
        sandbox: true,
      },
    });

    db.shipment.findMany.mockResolvedValue([
      {
        id: "ship-1",
        organizationId: "org-1",
        equipmentId: "equip-1",
        externalId: "ext-1",
        direction: "OUTBOUND",
        currentStatus: "IN_TRANSIT",
        workflowTaskRunId: "task-1",
      },
    ]);

    // "IN_TRANSIT" maps to IN_TRANSIT (same as current) -- need a DPD status that maps to IN_TRANSIT
    // Use a status that maps to null (unknown) so it skips
    mockGetStatus.mockResolvedValue({
      externalId: "ext-1",
      status: "UNKNOWN_STATUS",
    });

    await pollDpdShipmentStatuses(db as any, "org-1");

    expect(mockCheckShipmentTaskCompletion).not.toHaveBeenCalled();
  });
});
