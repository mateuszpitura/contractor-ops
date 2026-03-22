import { describe, it } from "vitest";

describe("audit router", () => {
  describe("list", () => {
    it.todo("returns paginated audit log entries scoped to organizationId");
    it.todo("supports full-text search across actorName, resourceName, action");
    it.todo("filters by actorId when provided");
    it.todo("filters by action when provided");
    it.todo("filters by resourceType when provided");
    it.todo("filters by date range when dateFrom/dateTo provided");
    it.todo("supports asc/desc sort order on createdAt");
    it.todo("requires settings.read permission (admin-only per D-13)");
  });

  describe("actors", () => {
    it.todo("returns distinct actors for filter dropdown");
  });

  describe("export", () => {
    it.todo("returns base64 CSV with all matching rows (up to 10000 limit)");
    it.todo("applies same filters as list query");
    it.todo("filename includes current date: audit-log-YYYY-MM-DD.csv");
  });
});
