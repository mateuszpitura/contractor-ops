import { describe, expect, it } from "vitest";
import type { ExportItem, OrgBankInfo } from "../payment-export.js";
import { generateSwiftXml } from "../payment-export.js";
import { getAllPurposeCodes, getPurposeCode, isValidPurposeCode } from "../purpose-codes.js";

// ---------------------------------------------------------------------------
// Purpose Code Tests
// ---------------------------------------------------------------------------

describe("getPurposeCode", () => {
  it('returns "SCVE" for SOFTWARE_DEVELOPMENT', () => {
    expect(getPurposeCode("SOFTWARE_DEVELOPMENT")).toBe("SCVE");
  });

  it('returns "COMC" for CONSULTING', () => {
    expect(getPurposeCode("CONSULTING")).toBe("COMC");
  });

  it('returns "LGAS" for LEGAL', () => {
    expect(getPurposeCode("LEGAL")).toBe("LGAS");
  });

  it('returns "ACCT" for ACCOUNTING', () => {
    expect(getPurposeCode("ACCOUNTING")).toBe("ACCT");
  });

  it('returns "ADVE" for MARKETING', () => {
    expect(getPurposeCode("MARKETING")).toBe("ADVE");
  });

  it('returns "EDUC" for EDUCATION', () => {
    expect(getPurposeCode("EDUCATION")).toBe("EDUC");
  });

  it('returns "BLDG" for CONSTRUCTION', () => {
    expect(getPurposeCode("CONSTRUCTION")).toBe("BLDG");
  });

  it('returns "SUPP" for unknown category', () => {
    expect(getPurposeCode("UNKNOWN_CATEGORY")).toBe("SUPP");
  });

  it("returns override when valid", () => {
    expect(getPurposeCode("SOFTWARE_DEVELOPMENT", "COMC")).toBe("COMC");
  });

  it("ignores invalid override and uses category", () => {
    expect(getPurposeCode("SOFTWARE_DEVELOPMENT", "INVALID")).toBe("SCVE");
  });
});

describe("isValidPurposeCode", () => {
  it("returns true for SCVE", () => {
    expect(isValidPurposeCode("SCVE")).toBe(true);
  });

  it("returns false for INVALID", () => {
    expect(isValidPurposeCode("INVALID")).toBe(false);
  });
});

describe("getAllPurposeCodes", () => {
  it("returns array with code and description", () => {
    const codes = getAllPurposeCodes();
    expect(codes.length).toBeGreaterThan(0);
    expect(codes[0]).toHaveProperty("code");
    expect(codes[0]).toHaveProperty("description");
  });
});

// ---------------------------------------------------------------------------
// SWIFT XML Generator Tests
// ---------------------------------------------------------------------------

const sampleOrg: OrgBankInfo = {
  name: "Acme Corp",
  iban: "PL61109010140000071219812874",
  bic: "WBKPPLPP",
};

const sampleItems: ExportItem[] = [
  {
    contractorName: "Gulf Contractor LLC",
    iban: "AE070331234567890123456",
    amountMinor: 50000,
    currency: "AED",
    invoiceNumber: "INV-2026-001",
    taxId: "1234567890",
    bankName: "Emirates NBD",
    swiftBic: "EABORUDU",
    dueDate: new Date("2026-04-15"),
    transferTitle: "Payment for INV-2026-001",
    serviceCategory: "SOFTWARE_DEVELOPMENT",
    creditorCountry: "AE",
  },
  {
    contractorName: "Saudi Dev Co",
    iban: "SA0380000000608010167519",
    amountMinor: 37500,
    currency: "AED",
    invoiceNumber: "INV-2026-002",
    taxId: "9876543210",
    bankName: "Al Rajhi Bank",
    swiftBic: "RJHISARI",
    dueDate: new Date("2026-04-15"),
    transferTitle: "Payment for INV-2026-002",
    serviceCategory: "CONSULTING",
    purposeCodeOverride: "COMC",
    creditorCountry: "SA",
  },
];

describe("generateSwiftXml", () => {
  const xml = generateSwiftXml(sampleItems, sampleOrg, "PR-2026-042").toString("utf-8");

  it("produces XML with pain.001.001.09 namespace", () => {
    expect(xml).toContain("urn:iso:std:iso:20022:tech:xsd:pain.001.001.09");
  });

  it("includes MsgId in GrpHdr", () => {
    expect(xml).toContain("<MsgId>PR-2026-042</MsgId>");
  });

  it("includes NbOfTxs matching item count", () => {
    expect(xml).toContain("<NbOfTxs>2</NbOfTxs>");
  });

  it("includes CtrlSum with correct total", () => {
    // 50000 + 37500 = 87500 AED minor = 875.00
    expect(xml).toContain("<CtrlSum>875.00</CtrlSum>");
  });

  it("does NOT include SEPA service level", () => {
    expect(xml).not.toContain("<SvcLvl>");
    expect(xml).not.toContain("SEPA");
  });

  it("uses SHAR charge bearer (not SLEV)", () => {
    expect(xml).toContain("<ChrgBr>SHAR</ChrgBr>");
    expect(xml).not.toContain("<ChrgBr>SLEV</ChrgBr>");
  });

  it("uses BICFI tag (not BIC) per v09 spec", () => {
    expect(xml).toContain("<BICFI>");
    // Should not have bare <BIC> tags (only BICFI)
    expect(xml).not.toMatch(/<BIC>[^F]/);
  });

  it("includes purpose codes", () => {
    expect(xml).toContain("<Purp><Cd>SCVE</Cd></Purp>");
    expect(xml).toContain("<Purp><Cd>COMC</Cd></Purp>");
  });

  it("includes creditor postal address with country", () => {
    expect(xml).toContain("<PstlAdr><Ctry>AE</Ctry></PstlAdr>");
    expect(xml).toContain("<PstlAdr><Ctry>SA</Ctry></PstlAdr>");
  });

  it("wraps ReqdExctnDt in Dt element (v09 format)", () => {
    expect(xml).toContain("<ReqdExctnDt><Dt>");
  });

  it("escapes XML special characters in contractor names", () => {
    const itemWithSpecial: ExportItem[] = [
      {
        ...sampleItems[0],
        contractorName: 'M&M <Corp> "Partners"',
      },
    ];
    const specialXml = generateSwiftXml(itemWithSpecial, sampleOrg, "PR-TEST").toString("utf-8");
    expect(specialXml).toContain("M&amp;M &lt;Corp&gt; &quot;Partners&quot;");
  });

  it("formats AED amounts with correct decimal", () => {
    // 50000 minor AED = 500.00
    expect(xml).toContain('Ccy="AED">500.00</InstdAmt>');
  });
});
