import { describe, it, expect, beforeEach } from "vitest";
import { EInvoiceEngine } from "../engine/engine.js";
import { registerProfile, clearProfiles } from "../registry.js";
import type { EInvoiceProfile } from "../types/profile.js";
import type { EInvoice } from "../types/invoice.js";
import type { ValidationResult } from "../types/validation.js";
import type { ComplianceStatus } from "../types/compliance.js";

// ---------------------------------------------------------------------------
// Mock Profile
// ---------------------------------------------------------------------------

const mockInvoice: EInvoice = {
  id: "INV-001",
  issueDate: "2026-04-11",
  invoiceTypeCode: "380",
  currencyCode: "PLN",
  supplier: { id: "1234567890", name: "Seller" },
  customer: { id: "0987654321", name: "Buyer" },
  lines: [
    {
      lineNumber: 1,
      description: "Service",
      netAmountMinor: 10000,
      vatRate: "23",
      vatAmountMinor: 2300,
      grossAmountMinor: 12300,
    },
  ],
  taxExclusiveAmount: 10000,
  taxInclusiveAmount: 12300,
  payableAmount: 12300,
  taxBreakdown: [
    { taxableAmountMinor: 10000, taxAmountMinor: 2300, taxCategory: "S", percent: 23 },
  ],
  profileId: "mock",
};

function createMockProfile(): EInvoiceProfile {
  return {
    profileId: "mock",
    country: "XX",
    displayName: "Mock Profile",
    sign: undefined,
    qrCode: undefined,
    async generate(_invoice: EInvoice) {
      return "<mock-xml/>";
    },
    async parse(_xml: string) {
      return { ...mockInvoice };
    },
    async validate(_xml: string): Promise<ValidationResult> {
      return { valid: true, errors: [], warnings: [], profileId: "mock" };
    },
    async getComplianceStatus(orgId: string): Promise<ComplianceStatus> {
      return {
        profileId: "mock",
        state: "active",
        country: "XX",
        displayName: "Mock Profile",
        healthScore: 100,
        capabilities: {
          canGenerate: true,
          canParse: true,
          canSign: false,
          canQRCode: false,
        },
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("EInvoiceEngine", () => {
  let engine: EInvoiceEngine;

  beforeEach(() => {
    clearProfiles();
    registerProfile(createMockProfile());
    engine = new EInvoiceEngine();
  });

  it("delegates generate to correct profile", async () => {
    const xml = await engine.generate("mock", mockInvoice);
    expect(xml).toBe("<mock-xml/>");
  });

  it("delegates parse to correct profile", async () => {
    const result = await engine.parse("mock", "<mock-xml/>");
    expect(result.id).toBe("INV-001");
    expect(result.profileId).toBe("mock");
  });

  it("delegates validate to correct profile", async () => {
    const result = await engine.validate("mock", "<mock-xml/>");
    expect(result.valid).toBe(true);
    expect(result.profileId).toBe("mock");
  });

  it("returns compliance status for a single profile", async () => {
    const status = await engine.getComplianceStatus("mock", "org-123");
    expect(status.profileId).toBe("mock");
    expect(status.state).toBe("active");
  });

  it("returns compliance statuses for all registered profiles", async () => {
    const statuses = await engine.getComplianceStatuses("org-123");
    expect(statuses).toHaveLength(1);
    expect(statuses[0]!.profileId).toBe("mock");
  });

  it("throws for unknown profile", async () => {
    await expect(engine.generate("unknown", mockInvoice)).rejects.toThrow(
      "Unknown e-invoicing profile: unknown",
    );
  });
});
