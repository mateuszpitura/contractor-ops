import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createTaskCalendarEvent,
  syncApprovalSlaDeadline,
  syncContractExpiryDeadline,
  syncPaymentDueDeadline,
} from "../calendar-deadline-sync.js";

vi.mock("../calendar-event-service.js", () => ({
  createCalendarEvent: vi.fn(),
  updateCalendarEvent: vi.fn(),
}));

import { createCalendarEvent, updateCalendarEvent } from "../calendar-event-service.js";

const mockCreateCalendarEvent = vi.mocked(createCalendarEvent);
const mockUpdateCalendarEvent = vi.mocked(updateCalendarEvent);

const mockPrisma = {
  externalLink: {
    count: vi.fn(),
  },
} as any;

const ORG_ID = "org-1";

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// syncContractExpiryDeadline
// ---------------------------------------------------------------------------

describe("syncContractExpiryDeadline", () => {
  const baseInput = {
    organizationId: ORG_ID,
    contractId: "c-1",
    contractName: "Dev Services",
    contractorName: "Jane Doe",
    expiryDate: new Date("2025-06-30T00:00:00.000Z"),
    userId: "user-1",
  };

  it("constructs exact title: [Contractor Ops] Contract expiry: {contractorName} - {contractName}", async () => {
    mockPrisma.externalLink.count.mockResolvedValue(0);

    await syncContractExpiryDeadline(mockPrisma, baseInput);

    const args = mockCreateCalendarEvent.mock.calls[0]?.[1] as any;
    expect(args.summary).toBe("[Contractor Ops] Contract expiry: Jane Doe - Dev Services");
  });

  it("description contains contract name, contractor name, formatted date, and deep link /contracts/{contractId}", async () => {
    mockPrisma.externalLink.count.mockResolvedValue(0);

    await syncContractExpiryDeadline(mockPrisma, baseInput);

    const args = mockCreateCalendarEvent.mock.calls[0]?.[1] as any;
    expect(args.description).toContain('"Dev Services"');
    expect(args.description).toContain("Jane Doe");
    expect(args.description).toContain("2025-06-30");
    expect(args.description).toContain("/contracts/c-1");
  });

  it("start time is 09:00 UTC on the expiry date", async () => {
    mockPrisma.externalLink.count.mockResolvedValue(0);

    await syncContractExpiryDeadline(mockPrisma, baseInput);

    const args = mockCreateCalendarEvent.mock.calls[0]?.[1] as any;
    const start = new Date(args.startDateTime);
    expect(start.getUTCFullYear()).toBe(2025);
    expect(start.getUTCMonth()).toBe(5); // June = 5
    expect(start.getUTCDate()).toBe(30);
    expect(start.getUTCHours()).toBe(9);
    expect(start.getUTCMinutes()).toBe(0);
    expect(start.getUTCSeconds()).toBe(0);
  });

  it("end time is 09:30 UTC (30 minutes after start)", async () => {
    mockPrisma.externalLink.count.mockResolvedValue(0);

    await syncContractExpiryDeadline(mockPrisma, baseInput);

    const args = mockCreateCalendarEvent.mock.calls[0]?.[1] as any;
    const start = new Date(args.startDateTime);
    const end = new Date(args.endDateTime);
    expect(end.getTime() - start.getTime()).toBe(30 * 60 * 1000);
    expect(end.getUTCHours()).toBe(9);
    expect(end.getUTCMinutes()).toBe(30);
  });

  it("passes all required fields to createCalendarEvent", async () => {
    mockPrisma.externalLink.count.mockResolvedValue(0);

    await syncContractExpiryDeadline(mockPrisma, baseInput);

    expect(mockCreateCalendarEvent).toHaveBeenCalledWith(mockPrisma, {
      organizationId: ORG_ID,
      userId: "user-1",
      entityType: "CONTRACT",
      entityId: "c-1",
      summary: "[Contractor Ops] Contract expiry: Jane Doe - Dev Services",
      description: expect.stringContaining("/contracts/c-1"),
      startDateTime: expect.any(String),
      endDateTime: expect.any(String),
    });
  });

  it("calls updateCalendarEvent (not create) when existing event exists (count > 0)", async () => {
    mockPrisma.externalLink.count.mockResolvedValue(1);

    await syncContractExpiryDeadline(mockPrisma, baseInput);

    expect(mockCreateCalendarEvent).not.toHaveBeenCalled();
    expect(mockUpdateCalendarEvent).toHaveBeenCalledTimes(1);

    const args = mockUpdateCalendarEvent.mock.calls[0]?.[1] as any;
    expect(args.summary).toBe("[Contractor Ops] Contract expiry: Jane Doe - Dev Services");
    expect(args.organizationId).toBe(ORG_ID);
    expect(args.entityType).toBe("CONTRACT");
    expect(args.entityId).toBe("c-1");
    // updateCalendarEvent does NOT receive userId
    expect(args.userId).toBeUndefined();
  });

  it("queries externalLink.count with correct entity scoping for existence check", async () => {
    mockPrisma.externalLink.count.mockResolvedValue(0);

    await syncContractExpiryDeadline(mockPrisma, baseInput);

    expect(mockPrisma.externalLink.count).toHaveBeenCalledWith({
      where: {
        organizationId: ORG_ID,
        entityType: "CONTRACT",
        entityId: "c-1",
        externalType: {
          in: ["GOOGLE_CALENDAR_EVENT", "OUTLOOK_CALENDAR_EVENT"],
        },
      },
    });
  });
});

// ---------------------------------------------------------------------------
// syncApprovalSlaDeadline
// ---------------------------------------------------------------------------

describe("syncApprovalSlaDeadline", () => {
  it("constructs title: [Contractor Ops] Approval deadline: {itemType} - {itemName}", async () => {
    mockPrisma.externalLink.count.mockResolvedValue(0);

    await syncApprovalSlaDeadline(mockPrisma, {
      organizationId: ORG_ID,
      approvalFlowId: "af-1",
      itemType: "Invoice",
      itemName: "INV-2025-001",
      deadline: new Date("2025-03-15T00:00:00.000Z"),
      userId: "user-1",
    });

    const args = mockCreateCalendarEvent.mock.calls[0]?.[1] as any;
    expect(args.summary).toBe("[Contractor Ops] Approval deadline: Invoice - INV-2025-001");
  });

  it("description contains deep link to /approvals (not entity-specific)", async () => {
    mockPrisma.externalLink.count.mockResolvedValue(0);

    await syncApprovalSlaDeadline(mockPrisma, {
      organizationId: ORG_ID,
      approvalFlowId: "af-1",
      itemType: "Invoice",
      itemName: "INV-2025-001",
      deadline: new Date("2025-03-15T00:00:00.000Z"),
    });

    const args = mockCreateCalendarEvent.mock.calls[0]?.[1] as any;
    expect(args.description).toContain("/approvals");
    expect(args.description).toContain("2025-03-15");
    expect(args.description).toContain('"INV-2025-001"');
  });

  it("uses entityType APPROVAL_FLOW and approvalFlowId as entityId", async () => {
    mockPrisma.externalLink.count.mockResolvedValue(0);

    await syncApprovalSlaDeadline(mockPrisma, {
      organizationId: ORG_ID,
      approvalFlowId: "af-99",
      itemType: "Contract",
      itemName: "C-100",
      deadline: new Date("2025-03-15T00:00:00.000Z"),
    });

    const args = mockCreateCalendarEvent.mock.calls[0]?.[1] as any;
    expect(args.entityType).toBe("APPROVAL_FLOW");
    expect(args.entityId).toBe("af-99");
  });
});

// ---------------------------------------------------------------------------
// syncPaymentDueDeadline
// ---------------------------------------------------------------------------

describe("syncPaymentDueDeadline", () => {
  it("constructs title: [Contractor Ops] Payment due: {contractorName} - {invoiceNumber}", async () => {
    mockPrisma.externalLink.count.mockResolvedValue(0);

    await syncPaymentDueDeadline(mockPrisma, {
      organizationId: ORG_ID,
      invoiceId: "inv-1",
      invoiceNumber: "INV-2025-042",
      contractorName: "Acme Corp",
      dueDate: new Date("2025-04-01T00:00:00.000Z"),
      userId: "user-1",
    });

    const args = mockCreateCalendarEvent.mock.calls[0]?.[1] as any;
    expect(args.summary).toBe("[Contractor Ops] Payment due: Acme Corp - INV-2025-042");
  });

  it("description contains deep link /invoices/{invoiceId}", async () => {
    mockPrisma.externalLink.count.mockResolvedValue(0);

    await syncPaymentDueDeadline(mockPrisma, {
      organizationId: ORG_ID,
      invoiceId: "inv-77",
      invoiceNumber: "INV-001",
      contractorName: "Jane Doe",
      dueDate: new Date("2025-04-01T00:00:00.000Z"),
    });

    const args = mockCreateCalendarEvent.mock.calls[0]?.[1] as any;
    expect(args.description).toContain("/invoices/inv-77");
    expect(args.description).toContain("INV-001");
    expect(args.description).toContain("Jane Doe");
  });

  it("start/end times are 09:00-09:30 UTC on the due date", async () => {
    mockPrisma.externalLink.count.mockResolvedValue(0);

    await syncPaymentDueDeadline(mockPrisma, {
      organizationId: ORG_ID,
      invoiceId: "inv-1",
      invoiceNumber: "INV-001",
      contractorName: "Jane Doe",
      dueDate: new Date("2025-12-25T14:30:00.000Z"), // time part should be ignored
    });

    const args = mockCreateCalendarEvent.mock.calls[0]?.[1] as any;
    const start = new Date(args.startDateTime);
    const end = new Date(args.endDateTime);
    expect(start.getUTCHours()).toBe(9);
    expect(start.getUTCMinutes()).toBe(0);
    expect(start.getUTCDate()).toBe(25);
    expect(start.getUTCMonth()).toBe(11); // December
    expect(end.getUTCHours()).toBe(9);
    expect(end.getUTCMinutes()).toBe(30);
  });

  it("updates instead of creates when event already exists", async () => {
    mockPrisma.externalLink.count.mockResolvedValue(2); // multiple existing

    await syncPaymentDueDeadline(mockPrisma, {
      organizationId: ORG_ID,
      invoiceId: "inv-1",
      invoiceNumber: "INV-001",
      contractorName: "Jane Doe",
      dueDate: new Date("2025-04-01T00:00:00.000Z"),
    });

    expect(mockCreateCalendarEvent).not.toHaveBeenCalled();
    expect(mockUpdateCalendarEvent).toHaveBeenCalledTimes(1);
    const args = mockUpdateCalendarEvent.mock.calls[0]?.[1] as any;
    expect(args.entityType).toBe("INVOICE");
    expect(args.entityId).toBe("inv-1");
  });
});

// ---------------------------------------------------------------------------
// createTaskCalendarEvent
// ---------------------------------------------------------------------------

describe("createTaskCalendarEvent", () => {
  it("skips entirely when calendarEnabled=false (no calendar API call)", async () => {
    await createTaskCalendarEvent(mockPrisma, {
      organizationId: ORG_ID,
      workflowTaskRunId: "wtr-1",
      config: {
        calendarEnabled: false,
        duration: "1h",
        attendees: [],
      },
      contractorName: "Jane Doe",
      contractName: "Dev Services",
      taskName: "Onboarding",
    });

    expect(mockCreateCalendarEvent).not.toHaveBeenCalled();
  });

  it("substitutes ALL template placeholders: {task}, {contractor}, {contract}", async () => {
    await createTaskCalendarEvent(mockPrisma, {
      organizationId: ORG_ID,
      workflowTaskRunId: "wtr-1",
      config: {
        calendarEnabled: true,
        duration: "1h",
        titleTemplate: "Review {task} for {contractor} under {contract}",
        attendees: [],
      },
      contractorName: "Alice Smith",
      contractName: "Consulting Agreement",
      taskName: "Background Check",
    });

    const args = mockCreateCalendarEvent.mock.calls[0]?.[1] as any;
    expect(args.summary).toBe(
      "[Contractor Ops] Review Background Check for Alice Smith under Consulting Agreement",
    );
    // Ensure no unresolved placeholders remain
    expect(args.summary).not.toMatch(/\{(task|contractor|contract)\}/);
  });

  it("uses default template when titleTemplate is undefined", async () => {
    await createTaskCalendarEvent(mockPrisma, {
      organizationId: ORG_ID,
      workflowTaskRunId: "wtr-1",
      config: {
        calendarEnabled: true,
        duration: "1h",
        attendees: [],
        // titleTemplate omitted
      },
      contractorName: "Bob",
      contractName: "Contract X",
      taskName: "Task Y",
    });

    const args = mockCreateCalendarEvent.mock.calls[0]?.[1] as any;
    // Default template: "{task} - {contractor} ({contract})"
    expect(args.summary).toBe("[Contractor Ops] Task Y - Bob (Contract X)");
  });

  it("handles multiple occurrences of same placeholder in template", async () => {
    await createTaskCalendarEvent(mockPrisma, {
      organizationId: ORG_ID,
      workflowTaskRunId: "wtr-1",
      config: {
        calendarEnabled: true,
        duration: "1h",
        titleTemplate: "{contractor}: {task} ({contractor})",
        attendees: [],
      },
      contractorName: "Jane",
      contractName: "C",
      taskName: "T",
    });

    const args = mockCreateCalendarEvent.mock.calls[0]?.[1] as any;
    expect(args.summary).toBe("[Contractor Ops] Jane: T (Jane)");
  });

  it("duration '1h' results in endDateTime exactly 60 minutes after startDateTime", async () => {
    await createTaskCalendarEvent(mockPrisma, {
      organizationId: ORG_ID,
      workflowTaskRunId: "wtr-1",
      config: {
        calendarEnabled: true,
        duration: "1h",
        attendees: [],
      },
      contractorName: "Jane",
      contractName: "C",
      taskName: "T",
    });

    const args = mockCreateCalendarEvent.mock.calls[0]?.[1] as any;
    const start = new Date(args.startDateTime).getTime();
    const end = new Date(args.endDateTime).getTime();
    expect(end - start).toBe(60 * 60 * 1000);
  });

  it("duration '30m' results in endDateTime exactly 30 minutes after startDateTime", async () => {
    await createTaskCalendarEvent(mockPrisma, {
      organizationId: ORG_ID,
      workflowTaskRunId: "wtr-1",
      config: {
        calendarEnabled: true,
        duration: "30m",
        attendees: [],
      },
      contractorName: "Jane",
      contractName: "C",
      taskName: "T",
    });

    const args = mockCreateCalendarEvent.mock.calls[0]?.[1] as any;
    const start = new Date(args.startDateTime).getTime();
    const end = new Date(args.endDateTime).getTime();
    expect(end - start).toBe(30 * 60 * 1000);
  });

  it("duration '2h' results in endDateTime exactly 120 minutes after startDateTime", async () => {
    await createTaskCalendarEvent(mockPrisma, {
      organizationId: ORG_ID,
      workflowTaskRunId: "wtr-1",
      config: {
        calendarEnabled: true,
        duration: "2h",
        attendees: [],
      },
      contractorName: "Jane",
      contractName: "C",
      taskName: "T",
    });

    const args = mockCreateCalendarEvent.mock.calls[0]?.[1] as any;
    const start = new Date(args.startDateTime).getTime();
    const end = new Date(args.endDateTime).getTime();
    expect(end - start).toBe(2 * 60 * 60 * 1000);
  });

  it("duration 'full_day' results in endDateTime at 23:59:00 UTC on the same day", async () => {
    await createTaskCalendarEvent(mockPrisma, {
      organizationId: ORG_ID,
      workflowTaskRunId: "wtr-1",
      config: {
        calendarEnabled: true,
        duration: "full_day",
        attendees: [],
      },
      contractorName: "Jane",
      contractName: "C",
      taskName: "T",
    });

    const args = mockCreateCalendarEvent.mock.calls[0]?.[1] as any;
    const end = new Date(args.endDateTime);
    expect(end.getUTCHours()).toBe(23);
    expect(end.getUTCMinutes()).toBe(59);
    expect(end.getUTCSeconds()).toBe(0);
  });

  it("unknown duration falls back to 1h default", async () => {
    await createTaskCalendarEvent(mockPrisma, {
      organizationId: ORG_ID,
      workflowTaskRunId: "wtr-1",
      config: {
        calendarEnabled: true,
        duration: "unknown_value" as any,
        attendees: [],
      },
      contractorName: "Jane",
      contractName: "C",
      taskName: "T",
    });

    const args = mockCreateCalendarEvent.mock.calls[0]?.[1] as any;
    const start = new Date(args.startDateTime).getTime();
    const end = new Date(args.endDateTime).getTime();
    expect(end - start).toBe(60 * 60 * 1000); // 1h fallback
  });

  it("passes attendees from config to createCalendarEvent", async () => {
    const attendees = ["alice@example.com", "bob@example.com"];

    await createTaskCalendarEvent(mockPrisma, {
      organizationId: ORG_ID,
      workflowTaskRunId: "wtr-1",
      config: {
        calendarEnabled: true,
        duration: "1h",
        attendees,
      },
      contractorName: "Jane",
      contractName: "C",
      taskName: "T",
      userId: "user-1",
    });

    const args = mockCreateCalendarEvent.mock.calls[0]?.[1] as any;
    expect(args.attendees).toEqual(attendees);
  });

  it("description contains deep link to /workflows", async () => {
    await createTaskCalendarEvent(mockPrisma, {
      organizationId: ORG_ID,
      workflowTaskRunId: "wtr-1",
      config: {
        calendarEnabled: true,
        duration: "1h",
        attendees: [],
      },
      contractorName: "Jane Doe",
      contractName: "Dev Services",
      taskName: "Onboarding",
    });

    const args = mockCreateCalendarEvent.mock.calls[0]?.[1] as any;
    expect(args.description).toContain("/workflows");
    expect(args.description).toContain("Onboarding");
    expect(args.description).toContain("Jane Doe");
    expect(args.description).toContain("Dev Services");
  });

  it("uses entityType WORKFLOW_TASK_RUN and workflowTaskRunId as entityId", async () => {
    await createTaskCalendarEvent(mockPrisma, {
      organizationId: ORG_ID,
      workflowTaskRunId: "wtr-xyz",
      config: {
        calendarEnabled: true,
        duration: "1h",
        attendees: [],
      },
      contractorName: "Jane",
      contractName: "C",
      taskName: "T",
    });

    const args = mockCreateCalendarEvent.mock.calls[0]?.[1] as any;
    expect(args.entityType).toBe("WORKFLOW_TASK_RUN");
    expect(args.entityId).toBe("wtr-xyz");
  });
});
