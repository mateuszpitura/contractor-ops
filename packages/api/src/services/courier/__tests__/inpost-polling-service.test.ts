import { describe, it, expect, vi, beforeEach } from "vitest";

import { pollInPostShipmentStatuses } from "../inpost-polling-service";

// ---------------------------------------------------------------------------
// InPost Polling Service Tests
// ---------------------------------------------------------------------------

// Mock InPostClient
vi.mock("../inpost-client", () => ({
  InPostClient: vi.fn().mockImplementation(() => ({
    getStatus: vi.fn(),
  })),
}));

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

describe("pollInPostShipmentStatuses", () => {
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    db = createMockDb();
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("fetches all active InPost shipments (not DELIVERED/FAILED/RETURNED)", async () => {
    db.courierConfig.findUnique.mockResolvedValue({
      configJson: {
        apiToken: "token-123",
        shipxOrganizationId: "org-shipx",
        sandbox: true,
      },
    });
    db.shipment.findMany.mockResolvedValue([]);

    const result = await pollInPostShipmentStatuses(db as any, "org-1");

    expect(db.shipment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: "org-1",
          carrier: "InPost",
          currentStatus: {
            notIn: ["DELIVERED", "FAILED", "RETURNED"],
          },
          externalId: { not: null },
        }),
      }),
    );

    expect(result).toEqual({ checked: 0, updated: 0 });
  });

  it("creates missing events for statuses newer than last recorded", async () => {
    db.courierConfig.findUnique.mockResolvedValue({
      configJson: {
        apiToken: "token-123",
        shipxOrganizationId: "org-shipx",
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

    // Mock InPostClient.getStatus via module mock
    const { InPostClient } = await import("../inpost-client");
    const mockGetStatus = vi.fn().mockResolvedValue({
      externalId: "ext-1",
      status: "delivered",
      trackingNumber: "T1",
    });
    vi.mocked(InPostClient).mockImplementation(
      () => ({ getStatus: mockGetStatus } as any),
    );

    db.shipmentEvent.findFirst.mockResolvedValue(null); // no duplicate
    db.shipmentEvent.create.mockResolvedValue({});
    db.shipment.update.mockResolvedValue({});
    db.equipment.findUnique.mockResolvedValue({
      id: "equip-1",
      status: "IN_TRANSIT",
    });
    db.equipment.update.mockResolvedValue({});

    const result = await pollInPostShipmentStatuses(db as any, "org-1");

    expect(mockGetStatus).toHaveBeenCalledWith("ext-1");
    expect(db.shipmentEvent.create).toHaveBeenCalled();
    expect(result.checked).toBe(1);
    expect(result.updated).toBe(1);
  });

  it("skips shipments without externalId", async () => {
    db.courierConfig.findUnique.mockResolvedValue({
      configJson: {
        apiToken: "token-123",
        shipxOrganizationId: "org-shipx",
        sandbox: true,
      },
    });

    // The query itself filters out null externalIds, so findMany returns empty
    db.shipment.findMany.mockResolvedValue([]);

    const result = await pollInPostShipmentStatuses(db as any, "org-1");

    expect(result).toEqual({ checked: 0, updated: 0 });
  });

  it("returns early if no courier config found", async () => {
    db.courierConfig.findUnique.mockResolvedValue(null);

    const result = await pollInPostShipmentStatuses(db as any, "org-1");

    expect(result).toEqual({ checked: 0, updated: 0 });
    expect(db.shipment.findMany).not.toHaveBeenCalled();
  });

  it("does not update if status has not changed", async () => {
    db.courierConfig.findUnique.mockResolvedValue({
      configJson: {
        apiToken: "token-123",
        shipxOrganizationId: "org-shipx",
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

    const { InPostClient } = await import("../inpost-client");
    vi.mocked(InPostClient).mockImplementation(
      () =>
        ({
          getStatus: vi.fn().mockResolvedValue({
            externalId: "ext-1",
            status: "adopted_at_source_branch", // maps to IN_TRANSIT — same as current
          }),
        }) as any,
    );

    const result = await pollInPostShipmentStatuses(db as any, "org-1");

    expect(result.checked).toBe(1);
    expect(result.updated).toBe(0);
    expect(db.shipmentEvent.create).not.toHaveBeenCalled();
  });
});
