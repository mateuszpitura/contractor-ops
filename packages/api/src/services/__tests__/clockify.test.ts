import { describe, it } from "vitest";

describe("clockify", () => {
  describe("syncClockifyEntries", () => {
    it.todo(
      "fetches entries from correct regional base URL",
    );

    it.todo(
      "paginates with page-size=100 until last page",
    );

    it.todo(
      "parses PT duration format to integer minutes",
    );

    it.todo(
      "deduplicates entries by externalId using unique constraint",
    );

    it.todo(
      "sets source=CLOCKIFY on all imported entries",
    );

    it.todo(
      "stores clockify metadata in metadataJson",
    );

    it.todo(
      "recalculates timesheet totalMinutes after import",
    );

    it.todo(
      "returns count of imported and skipped entries",
    );

    it.todo(
      "uses contractId parameter for contract assignment",
    );

    it.todo(
      "handles 401 with reconnect error message",
    );
  });

  describe("parseDurationToMinutes", () => {
    it.todo(
      "parses PT1H30M to 90",
    );

    it.todo(
      "parses PT2H to 120",
    );

    it.todo(
      "parses PT45M to 45",
    );

    it.todo(
      "parses PT0S to 0",
    );

    it.todo(
      "rounds seconds >= 30 up to next minute",
    );
  });
});
