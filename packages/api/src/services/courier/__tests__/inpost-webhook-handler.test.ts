import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCheckShipmentTaskCompletion } = vi.hoisted(() => ({
  mockCheckShipmentTaskCompletion: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../equipment-workflow", () => ({
  checkShipmentTaskCompletion: mockCheckShipmentTaskCompletion,
}));

import { handleInPostWebhook, verifyInPostSignature } from "../inpost-webhook-handler";

// ---------------------------------------------------------------------------
// InPost Webhook Handler Tests
// ---------------------------------------------------------------------------

function createMockDb() {
  return {
    shipment: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    shipmentEvent: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    equipment: {
      update: vi.fn(),
      findUnique: vi.fn(),
    },
  };
}

describe("verifyInPostSignature", () => {
  it("returns true for valid HMAC-SHA256 signature", () => {
    const crypto = require("node:crypto");
    const secret = "test-secret-123";
    const rawBody = '{"shipment_id":"12345","status":"delivered"}';
    const expectedSignature = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

    const result = verifyInPostSignature(
      rawBody,
      {
        "x-inpost-signature": expectedSignature,
      },
      secret,
    );

    expect(result).toBe(true);
  });

  it("returns false for invalid signature", () => {
    const result = verifyInPostSignature(
      '{"test":"data"}',
      { "x-inpost-signature": "invalid-signature" },
      "test-secret",
    );

    expect(result).toBe(false);
  });

  it("returns true when no secret is configured (graceful degradation)", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = verifyInPostSignature(
      '{"test":"data"}',
      { "x-inpost-signature": "anything" },
      "",
    );

    expect(result).toBe(true);
    warnSpy.mockRestore();
  });
});

describe("handleInPostWebhook", () => {
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    db = createMockDb();
    mockCheckShipmentTaskCompletion.mockReset().mockResolvedValue(undefined);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
  });

  const validPayload = {
    id: 1,
    shipment_id: "12345678",
    status: "delivered",
    tracking_number: "620123456789012345678",
    created_at: "2026-04-04T10:00:00Z",
  };

  it("creates ShipmentEvent for valid status update", async () => {
    const mockShipment = {
      id: "ship-1",
      organizationId: "org-1",
      equipmentId: "equip-1",
      direction: "OUTBOUND",
      currentStatus: "IN_TRANSIT",
      workflowTaskRunId: null,
      externalId: "12345678",
    };

    db.shipment.findFirst.mockResolvedValue(mockShipment);
    db.shipmentEvent.findFirst.mockResolvedValue(null); // no duplicate
    db.shipmentEvent.create.mockResolvedValue({});
    db.shipment.update.mockResolvedValue({});
    db.equipment.findUnique.mockResolvedValue({
      id: "equip-1",
      status: "IN_TRANSIT",
    });
    db.equipment.update.mockResolvedValue({});

    await handleInPostWebhook(db as any, "org-1", validPayload);

    expect(db.shipmentEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: "org-1",
        shipmentId: "ship-1",
        status: "DELIVERED",
      }),
    });
  });

  it("skips duplicate events (same shipment + same mapped status already exists)", async () => {
    const mockShipment = {
      id: "ship-1",
      organizationId: "org-1",
      equipmentId: "equip-1",
      direction: "OUTBOUND",
      currentStatus: "DELIVERED",
      workflowTaskRunId: null,
      externalId: "12345678",
    };

    db.shipment.findFirst.mockResolvedValue(mockShipment);
    db.shipmentEvent.findFirst.mockResolvedValue({ id: "existing-event" }); // duplicate

    await handleInPostWebhook(db as any, "org-1", validPayload);

    expect(db.shipmentEvent.create).not.toHaveBeenCalled();
  });

  it("updates Shipment.currentStatus", async () => {
    const mockShipment = {
      id: "ship-1",
      organizationId: "org-1",
      equipmentId: "equip-1",
      direction: "OUTBOUND",
      currentStatus: "IN_TRANSIT",
      workflowTaskRunId: null,
      externalId: "12345678",
    };

    db.shipment.findFirst.mockResolvedValue(mockShipment);
    db.shipmentEvent.findFirst.mockResolvedValue(null);
    db.shipmentEvent.create.mockResolvedValue({});
    db.shipment.update.mockResolvedValue({});
    db.equipment.findUnique.mockResolvedValue({
      id: "equip-1",
      status: "IN_TRANSIT",
    });
    db.equipment.update.mockResolvedValue({});

    await handleInPostWebhook(db as any, "org-1", validPayload);

    expect(db.shipment.update).toHaveBeenCalledWith({
      where: { id: "ship-1" },
      data: expect.objectContaining({ currentStatus: "DELIVERED" }),
    });
  });

  it("auto-advances equipment status for DELIVERED + OUTBOUND", async () => {
    const mockShipment = {
      id: "ship-1",
      organizationId: "org-1",
      equipmentId: "equip-1",
      direction: "OUTBOUND",
      currentStatus: "IN_TRANSIT",
      workflowTaskRunId: null,
      externalId: "12345678",
    };

    db.shipment.findFirst.mockResolvedValue(mockShipment);
    db.shipmentEvent.findFirst.mockResolvedValue(null);
    db.shipmentEvent.create.mockResolvedValue({});
    db.shipment.update.mockResolvedValue({});
    db.equipment.findUnique.mockResolvedValue({
      id: "equip-1",
      status: "IN_TRANSIT",
    });
    db.equipment.update.mockResolvedValue({});

    await handleInPostWebhook(db as any, "org-1", validPayload);

    expect(db.equipment.update).toHaveBeenCalledWith({
      where: { id: "equip-1" },
      data: { status: "DELIVERED" },
    });
  });

  it("returns early for invalid payload", async () => {
    await handleInPostWebhook(db as any, "org-1", {
      invalid: "data",
    } as any);

    expect(db.shipment.findFirst).not.toHaveBeenCalled();
  });

  it("returns early for unknown ShipX status", async () => {
    const mockShipment = {
      id: "ship-1",
      organizationId: "org-1",
      equipmentId: "equip-1",
      direction: "OUTBOUND",
      currentStatus: "CREATED",
      workflowTaskRunId: null,
      externalId: "12345678",
    };

    db.shipment.findFirst.mockResolvedValue(mockShipment);

    await handleInPostWebhook(db as any, "org-1", {
      ...validPayload,
      status: "totally_unknown_status",
    });

    expect(db.shipmentEvent.create).not.toHaveBeenCalled();
  });

  it("falls back to trackingNumber lookup if externalId not found", async () => {
    db.shipment.findFirst
      .mockResolvedValueOnce(null) // First call: externalId lookup fails
      .mockResolvedValueOnce({
        id: "ship-2",
        organizationId: "org-1",
        equipmentId: "equip-2",
        direction: "RETURN",
        currentStatus: "PICKED_UP",
        workflowTaskRunId: null,
        externalId: null,
      });

    db.shipmentEvent.findFirst.mockResolvedValue(null);
    db.shipmentEvent.create.mockResolvedValue({});
    db.shipment.update.mockResolvedValue({});
    db.equipment.findUnique.mockResolvedValue({
      id: "equip-2",
      status: "RETURN_IN_TRANSIT",
    });
    db.equipment.update.mockResolvedValue({});

    await handleInPostWebhook(db as any, "org-1", validPayload);

    // Second findFirst should be called with trackingNumber
    expect(db.shipment.findFirst).toHaveBeenCalledTimes(2);
    expect(db.shipmentEvent.create).toHaveBeenCalled();
  });

  it("calls checkShipmentTaskCompletion after status update", async () => {
    const mockShipment = {
      id: "ship-1",
      organizationId: "org-1",
      equipmentId: "equip-1",
      direction: "OUTBOUND",
      currentStatus: "IN_TRANSIT",
      workflowTaskRunId: "task-1",
      externalId: "12345678",
    };

    db.shipment.findFirst.mockResolvedValue(mockShipment);
    db.shipmentEvent.findFirst.mockResolvedValue(null);
    db.shipmentEvent.create.mockResolvedValue({});
    db.shipment.update.mockResolvedValue({});
    db.equipment.findUnique.mockResolvedValue({
      id: "equip-1",
      status: "IN_TRANSIT",
    });
    db.equipment.update.mockResolvedValue({});

    await handleInPostWebhook(db as any, "org-1", validPayload);

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

  it("does not call checkShipmentTaskCompletion when shipment not found", async () => {
    db.shipment.findFirst.mockResolvedValue(null);

    await handleInPostWebhook(db as any, "org-1", validPayload);

    expect(mockCheckShipmentTaskCompletion).not.toHaveBeenCalled();
  });
});
