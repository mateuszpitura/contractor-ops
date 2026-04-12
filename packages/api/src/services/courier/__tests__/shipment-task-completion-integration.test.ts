import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Integration Tests: Shipment Task Completion
//
// These tests exercise the REAL checkShipmentTaskCompletion function (not mocked)
// through both webhook and polling paths, verifying task status changes to DONE
// and workflow progress recomputes.
// ---------------------------------------------------------------------------

// Mock only external courier clients -- NOT equipment-workflow
const mockInPostGetStatus = vi.fn();
vi.mock("../inpost-client", () => ({
  InPostClient: class MockInPostClient {
    getStatus = mockInPostGetStatus;
  },
}));

import { pollInPostShipmentStatuses } from "../inpost-polling-service";
import { handleInPostWebhook } from "../inpost-webhook-handler";

/**
 * Create a mock DB with state tracking for integration tests.
 * The real checkShipmentTaskCompletion runs against this mock.
 */
function createIntegrationMockDb(opts: {
  shipment: {
    id: string;
    workflowTaskRunId: string | null;
    direction: string;
    currentStatus: string;
    carrier: string;
    externalId: string;
    trackingNumber: string;
    equipmentId: string;
    organizationId: string;
  };
  allLinkedShipments: Array<{
    id: string;
    direction: string;
    currentStatus: string;
  }>;
}) {
  let taskStatus = "IN_PROGRESS";

  return {
    shipment: {
      findFirst: vi.fn(async () => opts.shipment),
      findMany: vi.fn(async (args: any) => {
        // When called by checkShipmentTaskCompletion (for linked shipments)
        if (args?.where?.workflowTaskRunId) return opts.allLinkedShipments;
        // When called by polling service (for active shipments)
        return [opts.shipment];
      }),
      update: vi.fn(async (args: any) => {
        const updated = { ...opts.shipment, ...args.data };
        // Reflect status change in allLinkedShipments
        const linked = opts.allLinkedShipments.find((s) => s.id === opts.shipment.id);
        if (linked && args.data?.currentStatus) {
          linked.currentStatus = args.data.currentStatus;
        }
        return updated;
      }),
    },
    shipmentEvent: {
      findFirst: vi.fn(async () => null), // no duplicates
      create: vi.fn(async () => ({})),
    },
    equipment: {
      findMany: vi.fn(async () => []),
      findUnique: vi.fn(async () => ({
        id: opts.shipment.equipmentId,
        status: "IN_TRANSIT",
      })),
      update: vi.fn(async () => ({})),
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
    courierConfig: {
      findUnique: vi.fn(async () => ({
        carrier: opts.shipment.carrier,
        configJson: {
          apiToken: "token",
          shipxOrganizationId: "org-shipx",
          sandbox: true,
        },
      })),
    },
    workflowTaskRun: {
      updateMany: vi.fn(async () => {
        taskStatus = "DONE";
        return { count: 1 };
      }),
      findUnique: vi.fn(async () => ({ workflowRunId: "wf-run-1" })),
      findMany: vi.fn(async () => [{ status: taskStatus, required: true }]),
    },
    workflowRun: {
      update: vi.fn(async () => ({})),
    },
    organization: {
      findMany: vi.fn(async () => [{ id: "org-1" }]),
    },
  };
}

describe("Shipment Task Completion Integration", () => {
  beforeEach(() => {
    mockInPostGetStatus.mockReset();
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("webhook path -- InPost DELIVERED triggers task completion end-to-end", async () => {
    const db = createIntegrationMockDb({
      shipment: {
        id: "ship-1",
        workflowTaskRunId: "task-1",
        direction: "OUTBOUND",
        currentStatus: "IN_TRANSIT",
        carrier: "INPOST",
        externalId: "12345678",
        trackingNumber: "620123456789012345678",
        equipmentId: "equip-1",
        organizationId: "org-1",
      },
      allLinkedShipments: [{ id: "ship-1", direction: "OUTBOUND", currentStatus: "IN_TRANSIT" }],
    });

    const webhookPayload = {
      id: 1,
      shipment_id: "12345678",
      status: "delivered",
      tracking_number: "620123456789012345678",
      created_at: "2026-04-04T10:00:00Z",
    };

    await handleInPostWebhook(db as any, "org-1", webhookPayload);

    // Wait for fire-and-forget to execute
    await new Promise((r) => setTimeout(r, 50));

    expect(db.workflowTaskRun.updateMany).toHaveBeenCalledWith({
      where: {
        id: "task-1",
        organizationId: "org-1",
        status: "IN_PROGRESS",
      },
      data: expect.objectContaining({ status: "DONE" }),
    });

    expect(db.workflowRun.update).toHaveBeenCalled();
  });

  it("polling path -- InPost polling DELIVERED triggers task completion end-to-end", async () => {
    const db = createIntegrationMockDb({
      shipment: {
        id: "ship-1",
        workflowTaskRunId: "task-1",
        direction: "OUTBOUND",
        currentStatus: "IN_TRANSIT",
        carrier: "InPost",
        externalId: "ext-1",
        trackingNumber: "T1",
        equipmentId: "equip-1",
        organizationId: "org-1",
      },
      allLinkedShipments: [{ id: "ship-1", direction: "OUTBOUND", currentStatus: "IN_TRANSIT" }],
    });

    mockInPostGetStatus.mockResolvedValue({
      externalId: "ext-1",
      status: "delivered",
      trackingNumber: "T1",
    });

    await pollInPostShipmentStatuses(db as any, "org-1");

    // Wait for fire-and-forget to execute
    await new Promise((r) => setTimeout(r, 50));

    expect(db.workflowTaskRun.updateMany).toHaveBeenCalledWith({
      where: {
        id: "task-1",
        organizationId: "org-1",
        status: "IN_PROGRESS",
      },
      data: expect.objectContaining({ status: "DONE" }),
    });

    expect(db.workflowRun.update).toHaveBeenCalled();
  });

  it("webhook path -- RETURNED triggers task completion for return shipment", async () => {
    const db = createIntegrationMockDb({
      shipment: {
        id: "ship-1",
        workflowTaskRunId: "task-1",
        direction: "RETURN",
        currentStatus: "IN_TRANSIT",
        carrier: "INPOST",
        externalId: "12345678",
        trackingNumber: "620123456789012345678",
        equipmentId: "equip-1",
        organizationId: "org-1",
      },
      allLinkedShipments: [{ id: "ship-1", direction: "RETURN", currentStatus: "IN_TRANSIT" }],
    });

    // "returned_to_sender" maps to RETURNED via mapInPostStatus
    const webhookPayload = {
      id: 1,
      shipment_id: "12345678",
      status: "returned_to_sender",
      tracking_number: "620123456789012345678",
      created_at: "2026-04-04T10:00:00Z",
    };

    await handleInPostWebhook(db as any, "org-1", webhookPayload);

    // Wait for fire-and-forget to execute
    await new Promise((r) => setTimeout(r, 50));

    expect(db.workflowTaskRun.updateMany).toHaveBeenCalledWith({
      where: {
        id: "task-1",
        organizationId: "org-1",
        status: "IN_PROGRESS",
      },
      data: expect.objectContaining({ status: "DONE" }),
    });
  });

  it("polling path -- task NOT completed when other linked shipments still in transit", async () => {
    const db = createIntegrationMockDb({
      shipment: {
        id: "ship-1",
        workflowTaskRunId: "task-1",
        direction: "OUTBOUND",
        currentStatus: "IN_TRANSIT",
        carrier: "InPost",
        externalId: "ext-1",
        trackingNumber: "T1",
        equipmentId: "equip-1",
        organizationId: "org-1",
      },
      allLinkedShipments: [
        { id: "ship-1", direction: "OUTBOUND", currentStatus: "IN_TRANSIT" },
        { id: "ship-2", direction: "OUTBOUND", currentStatus: "IN_TRANSIT" },
      ],
    });

    mockInPostGetStatus.mockResolvedValue({
      externalId: "ext-1",
      status: "delivered",
      trackingNumber: "T1",
    });

    await pollInPostShipmentStatuses(db as any, "org-1");

    // Wait for fire-and-forget to execute
    await new Promise((r) => setTimeout(r, 50));

    // ship-1 becomes DELIVERED but ship-2 is still IN_TRANSIT
    // Task should NOT be completed
    expect(db.workflowTaskRun.updateMany).not.toHaveBeenCalled();
  });
});
