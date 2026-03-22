import { describe, it } from "vitest";

describe("report-export", () => {
  describe("generateReportCsv", () => {
    it.todo("generates CSV from columns and rows");
    it.todo("includes UTF-8 BOM for Polish character support");
    it.todo("returns base64 encoded string with text/csv mimeType");
  });

  describe("generateAuditCsv", () => {
    it.todo("includes columns: Timestamp, Actor name, Action, Resource type, Resource name, Resource ID, Changed fields");
    it.todo("formats timestamps as ISO 8601");
    it.todo("computes changed fields from oldValuesJson/newValuesJson diff");
  });

  describe("report-specific wrappers", () => {
    it.todo("generateSpendCsv maps contractor spend columns");
    it.todo("generateContractsCsv maps expiring contract columns");
    it.todo("generateInvoicesCsv maps overdue invoice columns");
    it.todo("generateComplianceCsv maps compliance gap columns");
  });
});
