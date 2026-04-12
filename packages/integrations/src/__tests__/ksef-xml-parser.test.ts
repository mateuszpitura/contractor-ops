import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { mapKsefToInvoiceFields, parseFa3Xml } from "../services/ksef-xml-parser.js";

const FIXTURE_PATH = resolve(__dirname, "fixtures/sample-fa3.xml");
const sampleXml = readFileSync(FIXTURE_PATH, "utf-8");

describe("parseFa3Xml", () => {
  it("parses sample FA(3) XML into validated invoice structure", () => {
    const result = parseFa3Xml(sampleXml, "KSEF-REF-001", "UPO-001");

    expect(result.invoiceNumber).toBe("FV/2026/03/001");
    expect(result.issueDate).toBe("2026-03-15");
    expect(result.invoiceType).toBe("VAT");
    expect(result.currency).toBe("PLN");
    expect(result.seller.nip).toBe("5261040828");
    expect(result.seller.name).toBe("Test Seller Sp. z o.o.");
    expect(result.buyer.nip).toBe("9876543210");
    expect(result.buyer.name).toBe("Test Buyer S.A.");
    expect(result.totals.grossMinor).toBe(3567000);
    expect(result.lines).toHaveLength(2);
    expect(result.lines[0]?.description).toBe("Uslugi programistyczne");
    expect(result.lines[0]?.netAmountMinor).toBe(2400000);
    expect(result.ksefReferenceNumber).toBe("KSEF-REF-001");
    expect(result.upoNumber).toBe("UPO-001");
  });

  it("converts PLN amounts to minor units correctly", () => {
    const result = parseFa3Xml(sampleXml, "KSEF-REF-001");

    expect(result.totals.netMinor).toBe(2900000);
    expect(result.totals.vatMinor).toBe(667000);
    expect(result.lines[1]?.unitPriceMinor).toBe(500000);
  });

  it("handles missing optional payment fields", () => {
    const xmlWithoutPayment = sampleXml.replace(/<Platnosc>[\s\S]*?<\/Platnosc>/, "");

    const result = parseFa3Xml(xmlWithoutPayment, "KSEF-REF-002");

    expect(result.payment).toBeUndefined();
    expect(result.invoiceNumber).toBe("FV/2026/03/001");
  });

  it("throws on malformed XML (not valid XML at all)", () => {
    expect(() => parseFa3Xml("this is not xml at all {{{", "KSEF-REF-BAD")).toThrow();
  });

  it("throws on XML missing required seller NIP", () => {
    // Remove the seller NIP element to trigger Zod validation failure
    const xmlWithoutSellerNip = sampleXml.replace(/<NIP>5261040828<\/NIP>/, "");

    expect(() => parseFa3Xml(xmlWithoutSellerNip, "KSEF-REF-NO-NIP")).toThrow();
  });
});

describe("mapKsefToInvoiceFields", () => {
  it("maps parsed invoice to Invoice model fields", () => {
    const parsed = parseFa3Xml(sampleXml, "KSEF-REF-001", "UPO-001");
    const { invoice, lines } = mapKsefToInvoiceFields(parsed);

    expect(invoice.source).toBe("KSEF");
    expect(invoice.externalInvoiceId).toBe("KSEF-REF-001");
    expect(invoice.sourceReference).toBe("UPO-001");
    expect(invoice.sellerTaxId).toBe("5261040828");
    expect(invoice.buyerTaxId).toBe("9876543210");
    expect(invoice.totalMinor).toBe(3567000);
    expect(invoice.subtotalMinor).toBe(2900000);
    expect(invoice.vatAmountMinor).toBe(667000);
    expect(invoice.amountToPayMinor).toBe(3567000);
    expect(invoice.currency).toBe("PLN");
    expect(invoice.sellerBankAccount).toBe("PL61109010140000071219812874");
    expect(invoice.issueDate).toBeInstanceOf(Date);
    expect(invoice.dueDate).toBeInstanceOf(Date);
    expect(lines).toHaveLength(2);
    expect(lines[0]?.lineNumber).toBe(1);
    expect(lines[0]?.description).toBe("Uslugi programistyczne");
  });
});
