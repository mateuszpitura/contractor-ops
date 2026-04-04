import { describe, it, expect, vi, beforeEach } from "vitest";
import { getOrCreateTimesheet, submitTimesheet } from "../time-entry.js";

const mockPrisma = {
  timesheet: {
    upsert: vi.fn(),
    updateMany: vi.fn(),
    findUniqueOrThrow: vi.fn(),
  },
} as any;

const ORG_ID = "org-1";
const CONTRACTOR_ID = "contractor-1";
const TIMESHEET_ID = "ts-1";

beforeEach(() => {
  vi.resetAllMocks();
});

// ---------------------------------------------------------------------------
// getOrCreateTimesheet
// ---------------------------------------------------------------------------

describe("getOrCreateTimesheet", () => {
  it("upsert where uses composite key organizationId_contractorId_weekStartDate", async () => {
    const monday = new Date("2025-01-06T00:00:00.000Z");
    mockPrisma.timesheet.upsert.mockResolvedValue({ id: TIMESHEET_ID });

    await getOrCreateTimesheet(mockPrisma, ORG_ID, CONTRACTOR_ID, monday);

    const args = mockPrisma.timesheet.upsert.mock.calls[0][0];
    expect(args.where).toEqual({
      organizationId_contractorId_weekStartDate: {
        organizationId: ORG_ID,
        contractorId: CONTRACTOR_ID,
        weekStartDate: monday,
      },
    });
  });

  it("create payload has status DRAFT, totalMinutes 0, and all identity fields", async () => {
    const monday = new Date("2025-01-06T00:00:00.000Z");
    mockPrisma.timesheet.upsert.mockResolvedValue({ id: TIMESHEET_ID });

    await getOrCreateTimesheet(mockPrisma, ORG_ID, CONTRACTOR_ID, monday);

    const args = mockPrisma.timesheet.upsert.mock.calls[0][0];
    expect(args.create).toEqual({
      organizationId: ORG_ID,
      contractorId: CONTRACTOR_ID,
      weekStartDate: monday,
      status: "DRAFT",
      totalMinutes: 0,
    });
  });

  it("update is empty object (no-op on existing record)", async () => {
    const monday = new Date("2025-01-06T00:00:00.000Z");
    mockPrisma.timesheet.upsert.mockResolvedValue({ id: TIMESHEET_ID });

    await getOrCreateTimesheet(mockPrisma, ORG_ID, CONTRACTOR_ID, monday);

    const args = mockPrisma.timesheet.upsert.mock.calls[0][0];
    expect(args.update).toEqual({});
  });

  it("includes entries relation in result", async () => {
    const monday = new Date("2025-01-06T00:00:00.000Z");
    mockPrisma.timesheet.upsert.mockResolvedValue({ id: TIMESHEET_ID });

    await getOrCreateTimesheet(mockPrisma, ORG_ID, CONTRACTOR_ID, monday);

    const args = mockPrisma.timesheet.upsert.mock.calls[0][0];
    expect(args.include).toEqual({ entries: true });
  });

  it("throws BAD_REQUEST when weekStartDate is a Tuesday", async () => {
    const tuesday = new Date("2025-01-07T00:00:00.000Z");

    await expect(
      getOrCreateTimesheet(mockPrisma, ORG_ID, CONTRACTOR_ID, tuesday),
    ).rejects.toThrow("weekStartDate must be a Monday");

    expect(mockPrisma.timesheet.upsert).not.toHaveBeenCalled();
  });

  it("throws BAD_REQUEST when weekStartDate is a Sunday", async () => {
    const sunday = new Date("2025-01-05T00:00:00.000Z");

    await expect(
      getOrCreateTimesheet(mockPrisma, ORG_ID, CONTRACTOR_ID, sunday),
    ).rejects.toThrow("weekStartDate must be a Monday");

    expect(mockPrisma.timesheet.upsert).not.toHaveBeenCalled();
  });

  it("throws BAD_REQUEST when weekStartDate is a Saturday", async () => {
    const saturday = new Date("2025-01-04T00:00:00.000Z");

    await expect(
      getOrCreateTimesheet(mockPrisma, ORG_ID, CONTRACTOR_ID, saturday),
    ).rejects.toThrow("weekStartDate must be a Monday");
  });

  it("accepts a valid Monday date and does NOT throw", async () => {
    const monday = new Date("2025-01-13T00:00:00.000Z"); // Monday
    mockPrisma.timesheet.upsert.mockResolvedValue({ id: TIMESHEET_ID });

    await expect(
      getOrCreateTimesheet(mockPrisma, ORG_ID, CONTRACTOR_ID, monday),
    ).resolves.toBeDefined();
  });

  it("getISOMonday validation: Wednesday maps to Monday internally but rejects because input !== Monday", async () => {
    // Wednesday 2025-01-08 -> internal getISOMonday returns 2025-01-06 (Monday)
    // Since input time !== monday time, it throws
    const wednesday = new Date("2025-01-08T00:00:00.000Z");

    await expect(
      getOrCreateTimesheet(mockPrisma, ORG_ID, CONTRACTOR_ID, wednesday),
    ).rejects.toThrow("weekStartDate must be a Monday");
  });
});

// ---------------------------------------------------------------------------
// submitTimesheet
// ---------------------------------------------------------------------------

describe("submitTimesheet", () => {
  it("updateMany where clause includes status { in: ['DRAFT', 'REJECTED'] } - both statuses", async () => {
    mockPrisma.timesheet.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.timesheet.findUniqueOrThrow.mockResolvedValue({
      id: TIMESHEET_ID,
      status: "SUBMITTED",
      entries: [],
    });

    await submitTimesheet(mockPrisma, ORG_ID, CONTRACTOR_ID, TIMESHEET_ID);

    const where = mockPrisma.timesheet.updateMany.mock.calls[0][0].where;
    expect(where.status).toEqual({ in: ["DRAFT", "REJECTED"] });
    // Verify it's not just one status
    expect(where.status.in).toHaveLength(2);
    expect(where.status.in).toContain("DRAFT");
    expect(where.status.in).toContain("REJECTED");
  });

  it("updateMany where includes id, organizationId, and contractorId for scoping", async () => {
    mockPrisma.timesheet.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.timesheet.findUniqueOrThrow.mockResolvedValue({
      id: TIMESHEET_ID,
      status: "SUBMITTED",
    });

    await submitTimesheet(mockPrisma, ORG_ID, CONTRACTOR_ID, TIMESHEET_ID);

    const where = mockPrisma.timesheet.updateMany.mock.calls[0][0].where;
    expect(where).toEqual({
      id: TIMESHEET_ID,
      organizationId: ORG_ID,
      contractorId: CONTRACTOR_ID,
      status: { in: ["DRAFT", "REJECTED"] },
    });
  });

  it("data includes submittedAt as a Date instance", async () => {
    mockPrisma.timesheet.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.timesheet.findUniqueOrThrow.mockResolvedValue({
      id: TIMESHEET_ID,
      status: "SUBMITTED",
    });

    const before = new Date();
    await submitTimesheet(mockPrisma, ORG_ID, CONTRACTOR_ID, TIMESHEET_ID);
    const after = new Date();

    const data = mockPrisma.timesheet.updateMany.mock.calls[0][0].data;
    expect(data.submittedAt).toBeInstanceOf(Date);
    // Verify the timestamp is reasonable (between before and after call)
    expect(data.submittedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(data.submittedAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it("data includes rejectionReason: null to clear previous rejection", async () => {
    mockPrisma.timesheet.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.timesheet.findUniqueOrThrow.mockResolvedValue({
      id: TIMESHEET_ID,
      status: "SUBMITTED",
    });

    await submitTimesheet(mockPrisma, ORG_ID, CONTRACTOR_ID, TIMESHEET_ID);

    const data = mockPrisma.timesheet.updateMany.mock.calls[0][0].data;
    expect(data.rejectionReason).toBeNull();
    // Ensure it's explicitly null, not undefined or missing
    expect(Object.keys(data)).toContain("rejectionReason");
  });

  it("data sets status to 'SUBMITTED'", async () => {
    mockPrisma.timesheet.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.timesheet.findUniqueOrThrow.mockResolvedValue({
      id: TIMESHEET_ID,
      status: "SUBMITTED",
    });

    await submitTimesheet(mockPrisma, ORG_ID, CONTRACTOR_ID, TIMESHEET_ID);

    const data = mockPrisma.timesheet.updateMany.mock.calls[0][0].data;
    expect(data.status).toBe("SUBMITTED");
  });

  it("returns result of findUniqueOrThrow with include { entries: true }", async () => {
    mockPrisma.timesheet.updateMany.mockResolvedValue({ count: 1 });
    const returnedTimesheet = {
      id: TIMESHEET_ID,
      status: "SUBMITTED",
      entries: [{ id: "e-1", minutes: 60 }],
    };
    mockPrisma.timesheet.findUniqueOrThrow.mockResolvedValue(returnedTimesheet);

    const result = await submitTimesheet(
      mockPrisma,
      ORG_ID,
      CONTRACTOR_ID,
      TIMESHEET_ID,
    );

    expect(result).toBe(returnedTimesheet);
    expect(mockPrisma.timesheet.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: TIMESHEET_ID },
      include: { entries: true },
    });
  });

  it("throws PRECONDITION_FAILED when updateMany returns count: 0 (wrong status)", async () => {
    mockPrisma.timesheet.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      submitTimesheet(mockPrisma, ORG_ID, CONTRACTOR_ID, TIMESHEET_ID),
    ).rejects.toThrow("Timesheet cannot be submitted");

    // findUniqueOrThrow should NOT be called when update fails
    expect(mockPrisma.timesheet.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it("uses updateMany (not update) for optimistic locking pattern", async () => {
    mockPrisma.timesheet.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.timesheet.findUniqueOrThrow.mockResolvedValue({
      id: TIMESHEET_ID,
      status: "SUBMITTED",
    });

    await submitTimesheet(mockPrisma, ORG_ID, CONTRACTOR_ID, TIMESHEET_ID);

    // updateMany allows status in where clause without throwing on 0 results
    expect(mockPrisma.timesheet.updateMany).toHaveBeenCalledTimes(1);
    // Verify the prisma mock does NOT have a plain .update method being used
    expect(mockPrisma.timesheet.update).toBeUndefined();
  });
});
