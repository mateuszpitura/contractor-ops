import { describe, it } from "vitest";

describe("time-entry", () => {
  describe("saveDraftEntries", () => {
    it.todo(
      "creates new manual time entries for a draft timesheet",
    );

    it.todo(
      "updates existing manual entries by id",
    );

    it.todo(
      "rejects edits when timesheet is SUBMITTED",
    );

    it.todo(
      "rejects edits when timesheet is APPROVED",
    );

    it.todo(
      "allows edits when timesheet is REJECTED",
    );

    it.todo(
      "prevents editing imported entries (source !== MANUAL)",
    );

    it.todo(
      "recalculates timesheet totalMinutes after save",
    );

    it.todo(
      "stores minutes as integers, not floats",
    );

    it.todo(
      "validates minutes range 0-1440",
    );
  });

  describe("createSingleEntry", () => {
    it.todo(
      "creates a single ad-hoc entry with minimum 15 minutes",
    );

    it.todo(
      "assigns entry to correct weekly timesheet based on entryDate",
    );

    it.todo(
      "creates timesheet if none exists for the entry's week",
    );
  });
});
