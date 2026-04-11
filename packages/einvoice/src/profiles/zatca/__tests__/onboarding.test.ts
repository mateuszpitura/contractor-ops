// ---------------------------------------------------------------------------
// Tests: ZATCA CSR Generation & Compliance Test Invoice Builder
// ---------------------------------------------------------------------------

import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import type { EInvoice } from "../../../types/invoice.js";
import type { ZatcaCsrAttributes, ZatcaTaxDetails } from "../schemas.js";
import { buildComplianceTestInvoices, generateZatcaCsr } from "../onboarding.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const testCsrAttributes: ZatcaCsrAttributes = {
  commonName: "contractor-ops",
  orgName: "Test Organization LLC",
  vatNumber: "300000000000003",
  country: "SA",
  serialNumber: "1-contractor-ops|2-ContractorOps|3-00000000-0000-0000-0000-000000000001",
  title: "1100",
  registeredAddress: "123 Test Street, Riyadh",
  businessCategory: "Technology",
};

const testTaxDetails: ZatcaTaxDetails = {
  vatNumber: "300000000000003",
  orgNameArabic: "\u0634\u0631\u0643\u0629 \u0627\u062E\u062A\u0628\u0627\u0631",
  street: "123 Test Street",
  city: "Riyadh",
  district: "Al Olaya",
  postalCode: "12345",
  invoiceTypes: ["standard", "simplified"],
};

// ---------------------------------------------------------------------------
// CSR Generation Tests
// ---------------------------------------------------------------------------

describe("onboarding", () => {
  describe("generateZatcaCsr", () => {
    it("returns csr and privateKey as PEM strings", () => {
      const result = generateZatcaCsr(testCsrAttributes);

      expect(result).toHaveProperty("csr");
      expect(result).toHaveProperty("privateKey");
      expect(typeof result.csr).toBe("string");
      expect(typeof result.privateKey).toBe("string");
      expect(result.csr).toContain("-----BEGIN CERTIFICATE REQUEST-----");
      expect(result.csr).toContain("-----END CERTIFICATE REQUEST-----");
      expect(result.privateKey).toContain("-----BEGIN");
    });

    it("generates an ECDSA P-256 key pair", () => {
      const result = generateZatcaCsr(testCsrAttributes);

      // Parse the private key and check it is EC P-256
      const keyObject = crypto.createPrivateKey(result.privateKey);
      expect(keyObject.type).toBe("private");
      expect(keyObject.asymmetricKeyType).toBe("ec");
      const details = keyObject.asymmetricKeyDetails;
      expect(details?.namedCurve).toBe("prime256v1");
    });

    it("CSR contains ZATCA-required subject attributes", () => {
      const result = generateZatcaCsr(testCsrAttributes);

      // Decode CSR PEM to inspect subject
      // We use a basic check: parse the CSR PEM and verify DER structure contains our values
      const csrPem = result.csr;
      const csrDer = Buffer.from(
        csrPem
          .replace(/-----BEGIN CERTIFICATE REQUEST-----/, "")
          .replace(/-----END CERTIFICATE REQUEST-----/, "")
          .replace(/\s/g, ""),
        "base64",
      );

      // Subject attributes should be embedded in the DER-encoded CSR
      const csrString = csrDer.toString("utf-8");
      // CN, O, OU, C are standard subject fields embedded as UTF8/PrintableString
      expect(csrString).toContain(testCsrAttributes.commonName);
      expect(csrString).toContain(testCsrAttributes.orgName);
      // Country code "SA" and VAT number should be present
      expect(csrString).toContain("SA");
      expect(csrString).toContain(testCsrAttributes.vatNumber);
    });
  });

  // ---------------------------------------------------------------------------
  // Compliance Test Invoices
  // ---------------------------------------------------------------------------

  describe("buildComplianceTestInvoices", () => {
    it("returns exactly 6 EInvoice objects", () => {
      const invoices = buildComplianceTestInvoices(testTaxDetails);

      expect(invoices).toHaveLength(6);
      for (const inv of invoices) {
        expect(inv).toHaveProperty("id");
        expect(inv).toHaveProperty("supplier");
        expect(inv).toHaveProperty("customer");
        expect(inv).toHaveProperty("lines");
      }
    });

    it("covers all 6 required type/subtype combinations", () => {
      const invoices = buildComplianceTestInvoices(testTaxDetails);

      const typeSubtypePairs = invoices.map((inv) => ({
        typeCode: inv.invoiceTypeCode,
        subtype: (inv.extensions as Record<string, unknown>)?.invoiceSubtype,
      }));

      // Standard (0100000): invoice 388, credit 381, debit 383
      expect(typeSubtypePairs).toContainEqual({ typeCode: "388", subtype: "0100000" });
      expect(typeSubtypePairs).toContainEqual({ typeCode: "381", subtype: "0100000" });
      expect(typeSubtypePairs).toContainEqual({ typeCode: "383", subtype: "0100000" });

      // Simplified (0200000): invoice 388, credit 381, debit 383
      expect(typeSubtypePairs).toContainEqual({ typeCode: "388", subtype: "0200000" });
      expect(typeSubtypePairs).toContainEqual({ typeCode: "381", subtype: "0200000" });
      expect(typeSubtypePairs).toContainEqual({ typeCode: "383", subtype: "0200000" });
    });

    it("each test invoice has valid ZATCA extensions (icv, uuid, invoiceType/subtype)", () => {
      const invoices = buildComplianceTestInvoices(testTaxDetails);

      for (let i = 0; i < invoices.length; i++) {
        const inv = invoices[i]!;
        const ext = inv.extensions as Record<string, unknown>;

        expect(ext).toBeDefined();
        expect(ext.icv).toBe(i + 1);
        expect(typeof ext.uuid).toBe("string");
        expect((ext.uuid as string).length).toBeGreaterThan(0);
        expect(ext.invoiceType).toMatch(/^(standard|simplified)$/);
        expect(ext.invoiceSubtype).toMatch(/^[01]{7}$/);
        // Previous hash: first invoice uses SHA-256 of "0"
        expect(typeof ext.pih).toBe("string");
      }
    });

    it("invoices have correct supplier from tax details", () => {
      const invoices = buildComplianceTestInvoices(testTaxDetails);

      for (const inv of invoices) {
        expect(inv.supplier.id).toBe(testTaxDetails.vatNumber);
        expect(inv.supplier.name).toBe(testTaxDetails.orgNameArabic);
        expect(inv.supplier.country).toBe("SA");
      }
    });

    it("invoices have test customer and SAR currency", () => {
      const invoices = buildComplianceTestInvoices(testTaxDetails);

      for (const inv of invoices) {
        expect(inv.customer.id).toBe("300000000000003");
        expect(inv.customer.name).toBe("Test Buyer");
        expect(inv.currencyCode).toBe("SAR");
      }
    });

    it("invoices have correct monetary amounts", () => {
      const invoices = buildComplianceTestInvoices(testTaxDetails);

      for (const inv of invoices) {
        expect(inv.taxExclusiveAmount).toBe(10000);
        expect(inv.taxInclusiveAmount).toBe(11500);
        expect(inv.payableAmount).toBe(11500);
        expect(inv.lines).toHaveLength(1);
        expect(inv.lines[0]!.netAmountMinor).toBe(10000);
        expect(inv.taxBreakdown).toHaveLength(1);
        expect(inv.taxBreakdown[0]!.taxAmountMinor).toBe(1500);
      }
    });
  });
});
