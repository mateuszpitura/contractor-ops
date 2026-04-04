import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  approveTimesheet,
  rejectTimesheet,
  bulkApproveTimesheets,
  bulkRejectTimesheets,
} from "../time-entry.js";

const mockPrisma = {
  timesheet: {
    updateMany: vi.fn(),
    findUniqueOrThrow: vi.fn(),
  },
} as any;

const ORG_ID = "org-1";
const TIMESHEET_ID = "ts-1";
const REVIEWER_ID = "user-reviewer";

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ now: new Date("2026-03-15T10:00:00Z") });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("time-approval", () => {
  describe("approveTimesheet", () => {
    it("transitions SUBMITTED timesheet to APPROVED", async () => {
      mockPrisma.timesheet.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.timesheet.findUniqueOrThrow.mockResolvedValue({
        id: TIMESHEET_ID,
        status: "APPROVED",
        entries: [],
        contractor: {},
      });

      const result = await approveTimesheet(
        mockPrisma,
        ORG_ID,
        TIMESHEET_ID,
        REVIEWER_ID,
      );

      expect(mockPrisma.timesheet.updateMany).toHaveBeenCalledWith({
        where: {
          id: TIMESHEET_ID,
          organizationId: ORG_ID,
          status: "SUBMITTED",
        },
        data: expect.objectContaining({
          status: "APPROVED",
        }),
      });
      expect(result.status).toBe("APPROVED");
    });

    it("records reviewedByUserId and reviewedAt", async () => {
      mockPrisma.timesheet.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.timesheet.findUniqueOrThrow.mockResolvedValue({
        id: TIMESHEET_ID,
        status: "APPROVED",
      });

      await approveTimesheet(mockPrisma, ORG_ID, TIMESHEET_ID, REVIEWER_ID);

      expect(mockPrisma.timesheet.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            reviewedByUserId: REVIEWER_ID,
            reviewedAt: expect.any(Date),
          }),
        }),
      );
    });

    it("rejects approval of DRAFT timesheet", async () => {
      mockPrisma.timesheet.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        approveTimesheet(mockPrisma, ORG_ID, TIMESHEET_ID, REVIEWER_ID),
      ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    });

    it("rejects approval of already APPROVED timesheet", async () => {
      mockPrisma.timesheet.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        approveTimesheet(mockPrisma, ORG_ID, TIMESHEET_ID, REVIEWER_ID),
      ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    });

    it("rejects approval of REJECTED timesheet", async () => {
      mockPrisma.timesheet.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        approveTimesheet(mockPrisma, ORG_ID, TIMESHEET_ID, REVIEWER_ID),
      ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    });
  });

  describe("rejectTimesheet", () => {
    it("transitions SUBMITTED timesheet to REJECTED", async () => {
      mockPrisma.timesheet.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.timesheet.findUniqueOrThrow.mockResolvedValue({
        id: TIMESHEET_ID,
        status: "REJECTED",
        entries: [],
        contractor: {},
      });

      const result = await rejectTimesheet(
        mockPrisma,
        ORG_ID,
        TIMESHEET_ID,
        REVIEWER_ID,
        "Work quality issues need addressing",
      );

      expect(mockPrisma.timesheet.updateMany).toHaveBeenCalledWith({
        where: {
          id: TIMESHEET_ID,
          organizationId: ORG_ID,
          status: "SUBMITTED",
        },
        data: expect.objectContaining({
          status: "REJECTED",
        }),
      });
      expect(result.status).toBe("REJECTED");
    });

    it("stores rejection reason", async () => {
      mockPrisma.timesheet.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.timesheet.findUniqueOrThrow.mockResolvedValue({
        id: TIMESHEET_ID,
        status: "REJECTED",
      });

      const reason = "Hours do not match the agreed contract scope";
      await rejectTimesheet(
        mockPrisma,
        ORG_ID,
        TIMESHEET_ID,
        REVIEWER_ID,
        reason,
      );

      expect(mockPrisma.timesheet.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            rejectionReason: reason,
          }),
        }),
      );
    });

    it("records reviewedByUserId and reviewedAt", async () => {
      mockPrisma.timesheet.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.timesheet.findUniqueOrThrow.mockResolvedValue({
        id: TIMESHEET_ID,
        status: "REJECTED",
      });

      await rejectTimesheet(
        mockPrisma,
        ORG_ID,
        TIMESHEET_ID,
        REVIEWER_ID,
        "Insufficient detail in time entries",
      );

      expect(mockPrisma.timesheet.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            reviewedByUserId: REVIEWER_ID,
            reviewedAt: expect.any(Date),
          }),
        }),
      );
    });

    it("rejects rejection of DRAFT timesheet", async () => {
      mockPrisma.timesheet.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        rejectTimesheet(
          mockPrisma,
          ORG_ID,
          TIMESHEET_ID,
          REVIEWER_ID,
          "Some reason for the rejection",
        ),
      ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    });
  });

  describe("bulkApproveTimesheets", () => {
    it("approves multiple SUBMITTED timesheets in one call", async () => {
      const ids = ["ts-1", "ts-2", "ts-3"];
      mockPrisma.timesheet.updateMany.mockResolvedValue({ count: 3 });

      const result = await bulkApproveTimesheets(
        mockPrisma,
        ORG_ID,
        ids,
        REVIEWER_ID,
      );

      expect(mockPrisma.timesheet.updateMany).toHaveBeenCalledWith({
        where: {
          id: { in: ids },
          organizationId: ORG_ID,
          status: "SUBMITTED",
        },
        data: expect.objectContaining({
          status: "APPROVED",
          reviewedByUserId: REVIEWER_ID,
          reviewedAt: expect.any(Date),
        }),
      });
      expect(result.count).toBe(3);
    });

    it("skips timesheets not in SUBMITTED status", async () => {
      const ids = ["ts-submitted", "ts-draft", "ts-approved"];
      mockPrisma.timesheet.updateMany.mockResolvedValue({ count: 1 });

      const result = await bulkApproveTimesheets(
        mockPrisma,
        ORG_ID,
        ids,
        REVIEWER_ID,
      );

      expect(result.count).toBe(1);
    });

    it("returns count of actually approved timesheets", async () => {
      mockPrisma.timesheet.updateMany.mockResolvedValue({ count: 2 });

      const result = await bulkApproveTimesheets(
        mockPrisma,
        ORG_ID,
        ["ts-1", "ts-2", "ts-3"],
        REVIEWER_ID,
      );

      expect(result).toEqual({ count: 2 });
    });
  });

  describe("bulkRejectTimesheets", () => {
    it("rejects multiple SUBMITTED timesheets with same reason", async () => {
      const ids = ["ts-1", "ts-2"];
      const reason = "Bulk rejection due to policy change";
      mockPrisma.timesheet.updateMany.mockResolvedValue({ count: 2 });

      const result = await bulkRejectTimesheets(
        mockPrisma,
        ORG_ID,
        ids,
        REVIEWER_ID,
        reason,
      );

      expect(mockPrisma.timesheet.updateMany).toHaveBeenCalledWith({
        where: {
          id: { in: ids },
          organizationId: ORG_ID,
          status: "SUBMITTED",
        },
        data: expect.objectContaining({
          status: "REJECTED",
          rejectionReason: reason,
          reviewedByUserId: REVIEWER_ID,
          reviewedAt: expect.any(Date),
        }),
      });
      expect(result.count).toBe(2);
    });

    it("skips timesheets not in SUBMITTED status", async () => {
      mockPrisma.timesheet.updateMany.mockResolvedValue({ count: 0 });

      const result = await bulkRejectTimesheets(
        mockPrisma,
        ORG_ID,
        ["ts-draft-1", "ts-approved-1"],
        REVIEWER_ID,
        "Reason for bulk rejection test",
      );

      expect(result.count).toBe(0);
    });
  });
});
