import { describe, it } from "vitest";

describe("time-approval", () => {
  describe("approveTimesheet", () => {
    it.todo(
      "transitions SUBMITTED timesheet to APPROVED",
    );

    it.todo(
      "records reviewedByUserId and reviewedAt",
    );

    it.todo(
      "rejects approval of DRAFT timesheet",
    );

    it.todo(
      "rejects approval of already APPROVED timesheet",
    );

    it.todo(
      "rejects approval of REJECTED timesheet",
    );
  });

  describe("rejectTimesheet", () => {
    it.todo(
      "transitions SUBMITTED timesheet to REJECTED",
    );

    it.todo(
      "stores rejection reason (min 10 chars)",
    );

    it.todo(
      "records reviewedByUserId and reviewedAt",
    );

    it.todo(
      "rejects rejection of DRAFT timesheet",
    );
  });

  describe("bulkApproveTimesheets", () => {
    it.todo(
      "approves multiple SUBMITTED timesheets in one call",
    );

    it.todo(
      "skips timesheets not in SUBMITTED status",
    );

    it.todo(
      "returns count of actually approved timesheets",
    );
  });

  describe("bulkRejectTimesheets", () => {
    it.todo(
      "rejects multiple SUBMITTED timesheets with same reason",
    );

    it.todo(
      "skips timesheets not in SUBMITTED status",
    );
  });
});
