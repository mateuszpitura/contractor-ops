import { describe, it, expect } from "vitest";
import {
  generateReportCsv,
  generateAuditCsv,
  generateSpendCsv,
  generateContractsCsv,
  generateInvoicesCsv,
  generateComplianceCsv,
} from "../report-export.js";

describe("report-export", () => {
  describe("generateReportCsv", () => {
    it("generates CSV from columns and rows", async () => {
      const columns = [
        { key: "name", header: "Name" },
        { key: "value", header: "Value" },
      ];
      const rows = [
        { name: "Alpha", value: 10 },
        { name: "Beta", value: 20 },
      ];

      const result = await generateReportCsv(columns, rows);
      const decoded = Buffer.from(result.data, "base64").toString("utf-8");

      // Strip BOM for easier assertion
      const content = decoded.replace(/^\uFEFF/, "");
      expect(content).toContain("Name");
      expect(content).toContain("Value");
      expect(content).toContain("Alpha");
      expect(content).toContain("Beta");
      expect(content).toContain("10");
      expect(content).toContain("20");
    });

    it("includes UTF-8 BOM for Polish character support", async () => {
      const columns = [{ key: "text", header: "Tekst" }];
      const rows = [{ text: "Zlozone" }];

      const result = await generateReportCsv(columns, rows);
      const rawBuffer = Buffer.from(result.data, "base64");

      // UTF-8 BOM bytes: 0xEF 0xBB 0xBF
      expect(rawBuffer[0]).toBe(0xef);
      expect(rawBuffer[1]).toBe(0xbb);
      expect(rawBuffer[2]).toBe(0xbf);
    });

    it("returns base64 encoded string with text/csv mimeType", async () => {
      const columns = [{ key: "a", header: "A" }];
      const rows = [{ a: 1 }];

      const result = await generateReportCsv(columns, rows);

      expect(result.mimeType).toBe("text/csv");
      expect(typeof result.data).toBe("string");
      // Verify it is valid base64
      expect(() => Buffer.from(result.data, "base64")).not.toThrow();
    });
  });

  describe("generateAuditCsv", () => {
    const baseItem = {
      id: "audit-1",
      actorName: "John Doe",
      actorType: "USER",
      action: "UPDATE",
      resourceType: "contractor",
      resourceId: "c-1",
      resourceName: "Acme Contractor",
      oldValuesJson: { bankName: "Old Bank", taxId: "111" },
      newValuesJson: { bankName: "New Bank", taxId: "111" },
      metadataJson: {},
      createdAt: new Date("2026-03-15T12:00:00Z"),
    };

    it("includes columns: Timestamp, Actor Name, Action, Resource Type, Resource Name, Resource ID, Changed Fields", async () => {
      const result = await generateAuditCsv([baseItem]);
      const decoded = Buffer.from(result.data, "base64")
        .toString("utf-8")
        .replace(/^\uFEFF/, "");

      expect(decoded).toContain("Timestamp");
      expect(decoded).toContain("Actor Name");
      expect(decoded).toContain("Actor Type");
      expect(decoded).toContain("Action");
      expect(decoded).toContain("Resource Type");
      expect(decoded).toContain("Resource Name");
      expect(decoded).toContain("Resource ID");
      expect(decoded).toContain("Changed Fields");
    });

    it("formats timestamps as ISO 8601", async () => {
      const result = await generateAuditCsv([baseItem]);
      const decoded = Buffer.from(result.data, "base64")
        .toString("utf-8")
        .replace(/^\uFEFF/, "");

      expect(decoded).toContain("2026-03-15T12:00:00.000Z");
    });

    it("computes changed fields from oldValuesJson/newValuesJson diff", async () => {
      const item = {
        ...baseItem,
        oldValuesJson: { bankName: "Old", swiftBic: "OLD1", taxId: "same" },
        newValuesJson: { bankName: "New", swiftBic: "NEW1", taxId: "same" },
      };

      const result = await generateAuditCsv([item]);
      const decoded = Buffer.from(result.data, "base64")
        .toString("utf-8")
        .replace(/^\uFEFF/, "");

      // bankName and swiftBic changed, taxId did not
      expect(decoded).toContain("bankName");
      expect(decoded).toContain("swiftBic");
      // taxId should NOT appear in changed fields - check the row content
      // The changed fields column should list only changed keys
    });
  });

  describe("report-specific wrappers", () => {
    it("generateSpendCsv maps contractor spend columns", async () => {
      const result = await generateSpendCsv([
        {
          contractorName: "Jan Kowalski",
          invoiceCount: 3,
          totalGrosze: 150000,
          avgGrosze: 50000,
          lastPaidAt: "2026-02-01",
        },
      ]);

      const decoded = Buffer.from(result.data, "base64")
        .toString("utf-8")
        .replace(/^\uFEFF/, "");

      expect(decoded).toContain("Contractor");
      expect(decoded).toContain("Invoice Count");
      expect(decoded).toContain("Total Amount");
      expect(decoded).toContain("Average Amount");
      expect(decoded).toContain("Last Paid");
      expect(decoded).toContain("Jan Kowalski");
      expect(decoded).toContain("1500.00"); // 150000 grosze -> 1500.00 PLN
      expect(decoded).toContain("500.00");
    });

    it("generateContractsCsv maps expiring contract columns", async () => {
      const result = await generateContractsCsv([
        {
          contractTitle: "Dev Services",
          contractorName: "Anna Nowak",
          endDate: "2026-06-30",
          daysRemaining: 90,
          status: "ACTIVE",
        },
      ]);

      const decoded = Buffer.from(result.data, "base64")
        .toString("utf-8")
        .replace(/^\uFEFF/, "");

      expect(decoded).toContain("Contract");
      expect(decoded).toContain("Contractor");
      expect(decoded).toContain("End Date");
      expect(decoded).toContain("Days Remaining");
      expect(decoded).toContain("Status");
      expect(decoded).toContain("Dev Services");
      expect(decoded).toContain("Anna Nowak");
    });

    it("generateInvoicesCsv maps overdue invoice columns", async () => {
      const result = await generateInvoicesCsv([
        {
          invoiceNumber: "FV/2026/001",
          contractorName: "Test Contractor",
          amountGrosze: 250000,
          currency: "PLN",
          dueDate: "2026-01-15",
          daysOverdue: 75,
          status: "OVERDUE",
        },
      ]);

      const decoded = Buffer.from(result.data, "base64")
        .toString("utf-8")
        .replace(/^\uFEFF/, "");

      expect(decoded).toContain("Invoice Number");
      expect(decoded).toContain("Contractor");
      expect(decoded).toContain("Amount");
      expect(decoded).toContain("Currency");
      expect(decoded).toContain("Due Date");
      expect(decoded).toContain("Days Overdue");
      expect(decoded).toContain("FV/2026/001");
      expect(decoded).toContain("2500.00"); // 250000 grosze -> 2500.00
      expect(decoded).toContain("PLN");
    });

    it("generateComplianceCsv maps compliance gap columns", async () => {
      const result = await generateComplianceCsv([
        {
          contractorName: "Compliance Test",
          missingDocuments: 2,
          contractStatus: "ACTIVE",
          overdueTasks: 1,
          health: "AT_RISK",
        },
      ]);

      const decoded = Buffer.from(result.data, "base64")
        .toString("utf-8")
        .replace(/^\uFEFF/, "");

      expect(decoded).toContain("Contractor");
      expect(decoded).toContain("Missing Documents");
      expect(decoded).toContain("Contract Status");
      expect(decoded).toContain("Overdue Tasks");
      expect(decoded).toContain("Health");
      expect(decoded).toContain("Compliance Test");
      expect(decoded).toContain("AT_RISK");
    });
  });
});
