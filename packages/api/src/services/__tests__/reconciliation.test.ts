import { describe, it } from "vitest";

describe("reconciliation", () => {
  describe("computeTimeReconciliation", () => {
    it.todo(
      "computes expected amount for PER_HOUR contract: minutes * rate / 60",
    );

    it.todo(
      "computes expected amount for PER_DAY contract: minutes / (hoursPerDay * 60) * rate",
    );

    it.todo(
      "returns null for MONTHLY_FIXED contracts",
    );

    it.todo(
      "returns null for PER_MILESTONE contracts",
    );

    it.todo(
      "returns null when no approved time entries exist",
    );

    it.todo(
      "only counts entries from APPROVED timesheets",
    );

    it.todo(
      "calculates deviation percentage to 2 decimal places",
    );

    it.todo(
      "marks withinThreshold=true when deviation <= org threshold",
    );

    it.todo(
      "marks withinThreshold=false when deviation > org threshold",
    );

    it.todo(
      "uses org settingsJson.timeDeviationThresholdPercent (default 10%)",
    );

    it.todo(
      "uses org settingsJson.timeHoursPerDay for PER_DAY (default 8)",
    );
  });

  describe("invoice-matching TIME_DEVIATION flag", () => {
    it.todo(
      "adds TIME_DEVIATION to flags when deviation exceeds threshold",
    );

    it.todo(
      "does not add TIME_DEVIATION when within threshold",
    );

    it.todo(
      "does not block invoice approval (warning only)",
    );
  });
});
