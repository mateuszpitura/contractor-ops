import { describe, it } from "vitest";

describe("report router", () => {
  describe("spendByContractor", () => {
    it.todo("aggregates paid invoices grouped by contractor with date range filter");
    it.todo("supports pagination with page and pageSize");
    it.todo("supports sorting by totalSpend, invoiceCount, contractorName");
    it.todo("returns totalCount for pagination");
    it.todo("filters by optional contractorId for drill-down");
  });

  describe("spendByTeam", () => {
    it.todo("joins Invoice -> Contractor -> Team via primaryTeamId");
    it.todo("groups by team with contractor count");
    it.todo("supports pagination and sorting");
  });

  describe("expiringContracts", () => {
    it.todo("filters contracts expiring within 30/60/90 days");
    it.todo("includes contractor relation for name");
    it.todo("calculates daysRemaining correctly");
  });

  describe("overdueInvoices", () => {
    it.todo("filters invoices where dueDate < now and not PAID/CANCELLED");
    it.todo("calculates daysOverdue correctly");
    it.todo("supports pagination and sorting");
  });

  describe("complianceGaps", () => {
    it.todo("returns contractors with YELLOW or RED compliance health");
    it.todo("includes missing document count and overdue task count");
  });

  describe("chart variants", () => {
    it.todo("spendByContractorChart returns top 10 by spend");
    it.todo("spendByTeamChart returns all teams with spend");
    it.todo("expiringContractsChart returns counts by 30-day buckets");
    it.todo("complianceGapsChart returns critical/warning/ok counts");
  });

  describe("export mutations", () => {
    it.todo("exportSpendByContractor returns base64 CSV with correct columns");
    it.todo("exportSpendByTeam returns base64 CSV");
    it.todo("exportExpiringContracts returns base64 CSV");
    it.todo("exportOverdueInvoices returns base64 CSV");
    it.todo("exportComplianceGaps returns base64 CSV");
  });
});
