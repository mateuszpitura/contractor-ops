import { describe, it, expect, beforeEach } from "vitest";
import { PeppolAEProfile } from "../profiles/peppol-ae/index.js";
import { generatePintAeXml } from "../profiles/peppol-ae/generator.js";
import { parsePintAeXml } from "../profiles/peppol-ae/parser.js";
import { validatePintAeXml } from "../profiles/peppol-ae/validator.js";
import { PeppolAEQRCode } from "../profiles/peppol-ae/qr-code.js";
import { PINT_AE_CUSTOMIZATION_ID, PINT_AE_PROFILE_ID, UAE_SCHEME_ID } from "../profiles/peppol-ae/constants.js";
import { peppolParticipantIdSchema } from "../profiles/peppol-ae/schemas.js";
import { registerProfile, getProfile, clearProfiles } from "../registry.js";
import type { EInvoice } from "../types/invoice.js";

/** Test fixture: UAE AED invoice with 5% VAT */
function createTestInvoice(): EInvoice {
  return {
    id: "INV-2026-001",
    issueDate: "2026-04-11",
    dueDate: "2026-05-11",
    invoiceTypeCode: "380",
    currencyCode: "AED",
    supplier: {
      id: "123456789012345",
      name: "Acme UAE LLC",
      address: "Dubai Internet City",
      country: "AE",
      additionalIds: { tradeLicense: "TL-12345" },
    },
    customer: {
      id: "987654321098765",
      name: "Client Corp FZE",
      address: "Abu Dhabi Business Hub",
      country: "AE",
    },
    lines: [
      {
        lineNumber: 1,
        description: "Software Development Services",
        quantity: 160,
        unit: "HUR",
        unitPriceMinor: 15000,
        netAmountMinor: 2400000,
        vatRate: "S",
        vatAmountMinor: 120000,
        grossAmountMinor: 2520000,
      },
    ],
    taxExclusiveAmount: 2400000,
    taxInclusiveAmount: 2520000,
    payableAmount: 2520000,
    taxBreakdown: [
      {
        taxableAmountMinor: 2400000,
        taxAmountMinor: 120000,
        taxCategory: "S",
        percent: 5,
      },
    ],
    profileId: "peppol-ae",
    extensions: {
      buyerReference: "PO-2026-042",
    },
  };
}

describe("PeppolAEProfile", () => {
  beforeEach(() => {
    clearProfiles();
  });

  it("registers with profileId 'peppol-ae'", () => {
    const profile = new PeppolAEProfile();
    registerProfile(profile);
    const retrieved = getProfile("peppol-ae");
    expect(retrieved.profileId).toBe("peppol-ae");
    expect(retrieved.country).toBe("AE");
    expect(retrieved.displayName).toBe("Peppol PINT-AE (UAE)");
  });

  it("has qrCode capability and no sign capability", () => {
    const profile = new PeppolAEProfile();
    expect(profile.qrCode).toBeDefined();
    expect(profile.sign).toBeUndefined();
  });

  it("returns not_connected compliance status without fetcher", async () => {
    const profile = new PeppolAEProfile();
    const status = await profile.getComplianceStatus("org-1");
    expect(status.state).toBe("not_connected");
    expect(status.profileId).toBe("peppol-ae");
    expect(status.country).toBe("AE");
  });
});

describe("PINT-AE Generator", () => {
  it("produces XML with correct CustomizationID", () => {
    const invoice = createTestInvoice();
    const xml = generatePintAeXml(invoice);
    expect(xml).toContain(PINT_AE_CUSTOMIZATION_ID);
  });

  it("produces XML with correct ProfileID", () => {
    const invoice = createTestInvoice();
    const xml = generatePintAeXml(invoice);
    expect(xml).toContain(PINT_AE_PROFILE_ID);
  });

  it("includes supplier TRN with schemeID 0192", () => {
    const invoice = createTestInvoice();
    const xml = generatePintAeXml(invoice);
    expect(xml).toContain(UAE_SCHEME_ID);
    expect(xml).toContain("123456789012345");
  });

  it("includes BuyerReference from extensions", () => {
    const invoice = createTestInvoice();
    const xml = generatePintAeXml(invoice);
    expect(xml).toContain("PO-2026-042");
  });

  it("includes tax breakdown with VAT scheme", () => {
    const invoice = createTestInvoice();
    const xml = generatePintAeXml(invoice);
    expect(xml).toContain("VAT");
    expect(xml).toContain("24000.00");
    expect(xml).toContain("1200.00");
  });
});

describe("PINT-AE Parser", () => {
  it("roundtrip: generate -> parse preserves key fields", () => {
    const original = createTestInvoice();
    const xml = generatePintAeXml(original);
    const parsed = parsePintAeXml(xml);

    expect(parsed.id).toBe(original.id);
    expect(parsed.issueDate).toBe(original.issueDate);
    expect(parsed.invoiceTypeCode).toBe(original.invoiceTypeCode);
    expect(parsed.currencyCode).toBe(original.currencyCode);
    expect(parsed.supplier.id).toBe(original.supplier.id);
    expect(parsed.supplier.name).toBe(original.supplier.name);
    expect(parsed.customer.id).toBe(original.customer.id);
    expect(parsed.taxExclusiveAmount).toBe(original.taxExclusiveAmount);
    expect(parsed.taxInclusiveAmount).toBe(original.taxInclusiveAmount);
    expect(parsed.payableAmount).toBe(original.payableAmount);
    expect(parsed.profileId).toBe("peppol-ae");
  });

  it("preserves invoice lines through roundtrip", () => {
    const original = createTestInvoice();
    const xml = generatePintAeXml(original);
    const parsed = parsePintAeXml(xml);

    expect(parsed.lines).toHaveLength(1);
    expect(parsed.lines[0]!.description).toBe("Software Development Services");
    expect(parsed.lines[0]!.netAmountMinor).toBe(2400000);
  });

  it("preserves tax breakdown through roundtrip", () => {
    const original = createTestInvoice();
    const xml = generatePintAeXml(original);
    const parsed = parsePintAeXml(xml);

    expect(parsed.taxBreakdown).toHaveLength(1);
    expect(parsed.taxBreakdown[0]!.taxCategory).toBe("S");
    expect(parsed.taxBreakdown[0]!.taxAmountMinor).toBe(120000);
    expect(parsed.taxBreakdown[0]!.percent).toBe(5);
  });

  it("extracts buyerReference into extensions", () => {
    const original = createTestInvoice();
    const xml = generatePintAeXml(original);
    const parsed = parsePintAeXml(xml);

    expect((parsed.extensions as Record<string, unknown>)?.buyerReference).toBe(
      "PO-2026-042",
    );
  });

  it("sets transmissionId from metadata", () => {
    const original = createTestInvoice();
    const xml = generatePintAeXml(original);
    const parsed = parsePintAeXml(xml, {
      transmissionId: "tx-abc-123",
    });

    expect(parsed.externalReference).toBe("tx-abc-123");
  });
});

describe("PINT-AE Validator", () => {
  it("passes valid PINT-AE XML", () => {
    const invoice = createTestInvoice();
    const xml = generatePintAeXml(invoice);
    const result = validatePintAeXml(xml);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects XML missing BuyerReference", () => {
    const invoice = createTestInvoice();
    invoice.extensions = {};
    invoice.customer.id = "";
    const xml = generatePintAeXml(invoice);
    // Remove BuyerReference from XML
    const xmlNoBuyerRef = xml.replace(
      /<cbc:BuyerReference>[^<]*<\/cbc:BuyerReference>/,
      "",
    );
    const result = validatePintAeXml(xmlNoBuyerRef);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "MISSING_BUYER_REFERENCE")).toBe(
      true,
    );
  });

  it("rejects XML missing supplier TRN", () => {
    const invoice = createTestInvoice();
    const xml = generatePintAeXml(invoice);
    // Remove schemeID attribute from supplier
    const xmlNoScheme = xml.replace(
      /schemeID="0192"/,
      'schemeID="NONE"',
    );
    const result = validatePintAeXml(xmlNoScheme);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => e.code === "MISSING_SUPPLIER_TRN"),
    ).toBe(true);
  });

  it("returns error for malformed XML", () => {
    const result = validatePintAeXml("<not-valid>>>");
    expect(result.valid).toBe(false);
  });

  it("warns when customer TRN is missing", () => {
    const invoice = createTestInvoice();
    // Remove customer schemeID
    const xml = generatePintAeXml(invoice);
    // Replace customer schemeID with a different one
    const parts = xml.split(UAE_SCHEME_ID);
    // First occurrence is supplier, second is customer
    if (parts.length >= 3) {
      const xmlNoCustomerScheme =
        parts[0] + UAE_SCHEME_ID + parts[1] + "0000" + parts.slice(2).join(UAE_SCHEME_ID);
      const result = validatePintAeXml(xmlNoCustomerScheme);
      expect(
        result.warnings.some((w) => w.code === "MISSING_CUSTOMER_TRN"),
      ).toBe(true);
    }
  });
});

describe("PeppolAEQRCode", () => {
  it("generates a non-empty PNG buffer", async () => {
    const qr = new PeppolAEQRCode();
    const invoice = createTestInvoice();
    const buffer = await qr.generateQR(invoice);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
    // PNG magic bytes
    expect(buffer[0]).toBe(0x89);
    expect(buffer[1]).toBe(0x50); // P
    expect(buffer[2]).toBe(0x4e); // N
    expect(buffer[3]).toBe(0x47); // G
  });

  it("parseQR extracts data from pipe-delimited string", async () => {
    const qr = new PeppolAEQRCode();
    const data = Buffer.from(
      "Acme UAE LLC|123456789012345|2026-04-11|25200.00|1200.00",
    );
    const partial = await qr.parseQR(data);
    expect(partial.supplier?.name).toBe("Acme UAE LLC");
    expect(partial.supplier?.id).toBe("123456789012345");
    expect(partial.issueDate).toBe("2026-04-11");
    expect(partial.taxInclusiveAmount).toBe(2520000);
  });
});

describe("Peppol Schemas", () => {
  it("validates correct participant ID format", () => {
    const result = peppolParticipantIdSchema.safeParse(
      "0192:123456789012345",
    );
    expect(result.success).toBe(true);
  });

  it("rejects invalid participant ID format", () => {
    expect(
      peppolParticipantIdSchema.safeParse("0192:12345").success,
    ).toBe(false);
    expect(
      peppolParticipantIdSchema.safeParse("0088:123456789012345").success,
    ).toBe(false);
    expect(peppolParticipantIdSchema.safeParse("invalid").success).toBe(
      false,
    );
  });
});
