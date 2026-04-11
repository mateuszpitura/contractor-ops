import { describe, it, expect } from "vitest";
import type { EInvoice } from "../types/invoice.js";

/** Test fixture: Saudi SAR invoice with 15% VAT */
function createTestInvoice(
  overrides?: Partial<EInvoice> & { extensions?: Record<string, unknown> },
): EInvoice {
  return {
    id: "INV-2026-001",
    issueDate: "2026-04-11",
    dueDate: "2026-05-11",
    invoiceTypeCode: "388",
    currencyCode: "SAR",
    supplier: {
      id: "300075588700003",
      name: "Acme Saudi LLC",
      address: "123 King Fahd Rd, Riyadh",
      country: "SA",
    },
    customer: {
      id: "310122393500003",
      name: "Client Corp KSA",
      address: "456 Olaya St, Jeddah",
      country: "SA",
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
        vatAmountMinor: 360000,
        grossAmountMinor: 2760000,
      },
    ],
    taxExclusiveAmount: 2400000,
    taxInclusiveAmount: 2760000,
    payableAmount: 2760000,
    taxBreakdown: [
      {
        taxableAmountMinor: 2400000,
        taxAmountMinor: 360000,
        taxCategory: "S",
        percent: 15,
      },
    ],
    profileId: "zatca",
    extensions: {
      invoiceType: "standard" as const,
      invoiceSubtype: "0100000",
      icv: 1,
      pih: "a]b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1".replace(
        /[^a-f0-9]/g,
        "0",
      ),
      uuid: "550e8400-e29b-41d4-a716-446655440000",
      ...(overrides?.extensions ?? {}),
    },
    ...overrides,
  };
}

describe("ZATCA Profile", () => {
  it("has profileId=zatca and country=SA", async () => {
    const { ZatcaProfile } = await import(
      "../profiles/zatca/index.js"
    );
    const profile = new ZatcaProfile();
    expect(profile.profileId).toBe("zatca");
    expect(profile.country).toBe("SA");
  });
});

describe("ZATCA UBL 2.1 Generator", () => {
  it("produces XML with ProfileID containing reporting:1.0 for simplified", async () => {
    const { generateZatcaXml } = await import(
      "../profiles/zatca/generator.js"
    );
    const invoice = createTestInvoice({
      extensions: {
        invoiceType: "simplified",
        invoiceSubtype: "0200000",
        icv: 1,
        pih: "a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1",
        uuid: "550e8400-e29b-41d4-a716-446655440000",
      },
    });
    const xml = generateZatcaXml(invoice);
    expect(xml).toContain("reporting:1.0");
  });

  it("produces XML with ProfileID containing clearance:1.0 for standard", async () => {
    const { generateZatcaXml } = await import(
      "../profiles/zatca/generator.js"
    );
    const invoice = createTestInvoice();
    const xml = generateZatcaXml(invoice);
    expect(xml).toContain("clearance:1.0");
  });

  it("contains UUID element", async () => {
    const { generateZatcaXml } = await import(
      "../profiles/zatca/generator.js"
    );
    const invoice = createTestInvoice();
    const xml = generateZatcaXml(invoice);
    expect(xml).toContain("<cbc:UUID>");
    expect(xml).toContain("550e8400-e29b-41d4-a716-446655440000");
  });

  it("contains AdditionalDocumentReference for ICV and PIH", async () => {
    const { generateZatcaXml } = await import(
      "../profiles/zatca/generator.js"
    );
    const invoice = createTestInvoice();
    const xml = generateZatcaXml(invoice);
    expect(xml).toContain("ICV");
    expect(xml).toContain("PIH");
  });

  it("uses InvoiceTypeCode 388 with subtype @name attribute", async () => {
    const { generateZatcaXml } = await import(
      "../profiles/zatca/generator.js"
    );
    const invoice = createTestInvoice();
    const xml = generateZatcaXml(invoice);
    expect(xml).toContain("388");
    expect(xml).toContain("0100000");
  });
});

describe("ZATCA Zod Schemas", () => {
  it("zatcaTaxDetailsSchema rejects invalid VAT number", async () => {
    const { zatcaTaxDetailsSchema } = await import(
      "../profiles/zatca/schemas.js"
    );
    const result = zatcaTaxDetailsSchema.safeParse({
      vatNumber: "123",
      orgNameArabic: "شركة",
      street: "King Fahd Rd",
      city: "Riyadh",
      district: "Al Olaya",
      postalCode: "12345",
      invoiceTypes: ["standard"],
    });
    expect(result.success).toBe(false);
  });

  it("zatcaTaxDetailsSchema accepts valid 15-digit VAT number", async () => {
    const { zatcaTaxDetailsSchema } = await import(
      "../profiles/zatca/schemas.js"
    );
    const result = zatcaTaxDetailsSchema.safeParse({
      vatNumber: "300075588700003",
      orgNameArabic: "شركة",
      street: "King Fahd Rd",
      city: "Riyadh",
      district: "Al Olaya",
      postalCode: "12345",
      invoiceTypes: ["standard"],
    });
    expect(result.success).toBe(true);
  });
});
