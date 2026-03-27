import { describe, it } from "vitest";

describe("jira-worklog", () => {
  describe("syncJiraWorklogs", () => {
    it.todo(
      "performs JQL search for issues with user worklogs in date range",
    );

    it.todo(
      "fetches worklogs per issue and filters by accountId",
    );

    it.todo(
      "converts timeSpentSeconds to integer minutes",
    );

    it.todo(
      "deduplicates worklogs by externalId using unique constraint",
    );

    it.todo(
      "sets source=JIRA on all imported entries",
    );

    it.todo(
      "stores issueKey and issueSummary in metadataJson",
    );

    it.todo(
      "paginates JQL search with startAt parameter",
    );

    it.todo(
      "recalculates timesheet totalMinutes after import",
    );

    it.todo(
      "returns count of imported and skipped worklogs",
    );

    it.todo(
      "handles 401 with reconnect error message",
    );
  });
});
