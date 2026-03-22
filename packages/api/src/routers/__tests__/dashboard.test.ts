import { describe, it } from "vitest";

describe("dashboard router", () => {
  describe("kpis", () => {
    it.todo("returns 5 KPI values with current counts");
    it.todo("returns prevValue for trend comparison on activeContractors");
    it.todo("returns prevValue for trend comparison on pendingApprovals");
    it.todo("returns prevValue for trend comparison on readyToPayTotal");
    it.todo("returns neutral (no trend) for expiringContracts and openTasks");
    it.todo("scopes all queries to organizationId");
    it.todo("requires report.read permission");
  });

  describe("spendTrend", () => {
    it.todo("returns monthly aggregations grouped by currency for 6 months");
    it.todo("returns monthly aggregations for 12 months");
    it.todo("returns monthly aggregations for YTD (from Jan 1)");
    it.todo("casts BigInt SUM to number to avoid serialization issues");
    it.todo("filters only PAID invoices with deletedAt IS NULL");
  });

  describe("deadlines", () => {
    it.todo("returns contracts expiring within 90 days");
    it.todo("returns overdue workflow tasks");
    it.todo("returns invoices due within 30 days");
    it.todo("sorts overdue items first, then soonest upcoming");
    it.todo("limits to 20 items");
  });

  describe("activity", () => {
    it.todo("returns last 20 audit log entries ordered by createdAt DESC");
    it.todo("scopes to organizationId");
  });
});
