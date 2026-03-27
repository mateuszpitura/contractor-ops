import { describe, it } from "vitest";

describe("timesheet", () => {
  describe("getOrCreateTimesheet", () => {
    it.todo(
      "creates a new DRAFT timesheet for a given week",
    );

    it.todo(
      "returns existing timesheet if one exists for the week",
    );

    it.todo(
      "rejects weekStartDate that is not a Monday",
    );

    it.todo(
      "uses unique constraint on org+contractor+weekStartDate",
    );
  });

  describe("submitTimesheet", () => {
    it.todo(
      "transitions DRAFT timesheet to SUBMITTED",
    );

    it.todo(
      "transitions REJECTED timesheet to SUBMITTED",
    );

    it.todo(
      "sets submittedAt timestamp on submission",
    );

    it.todo(
      "clears previous rejectionReason on resubmission",
    );

    it.todo(
      "rejects submission of already SUBMITTED timesheet",
    );

    it.todo(
      "rejects submission of APPROVED timesheet",
    );

    it.todo(
      "uses optimistic locking via updateMany with status where clause",
    );
  });
});
