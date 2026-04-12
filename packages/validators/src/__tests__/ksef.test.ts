import { describe, expect, it } from "vitest";
import {
  ksefConnectionConfigSchema,
  ksefParsedInvoiceSchema,
  ksefSyncParamsSchema,
} from "@contractor-ops/einvoice";

describe("ksefConnectionConfigSchema", () => {
  it("requires token when authMethod is token", () => {
    const bad = ksefConnectionConfigSchema.safeParse({
      authMethod: "token",
      environment: "test",
    });
    expect(bad.success).toBe(false);

    const good = ksefConnectionConfigSchema.safeParse({
      authMethod: "token",
      token: "tok",
      environment: "test",
    });
    expect(good.success).toBe(true);
  });

  it("requires certificateBase64 when authMethod is certificate", () => {
    const bad = ksefConnectionConfigSchema.safeParse({
      authMethod: "certificate",
    });
    expect(bad.success).toBe(false);

    const good = ksefConnectionConfigSchema.safeParse({
      authMethod: "certificate",
      certificateBase64: "YmFzZTY0",
    });
    expect(good.success).toBe(true);
  });

  it("defaults environment to prod", () => {
    const r = ksefConnectionConfigSchema.safeParse({
      authMethod: "token",
      token: "x",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.environment).toBe("prod");
  });
});

describe("ksefParsedInvoiceSchema", () => {
  it("parses minimal FA-like structure", () => {
    const r = ksefParsedInvoiceSchema.safeParse({
      invoiceNumber: "FV/1/2026",
      issueDate: "2026-04-01",
      invoiceType: "VAT",
      currency: "PLN",
      seller: { nip: "5261040828", name: "Seller" },
      buyer: { nip: "1234563218", name: "Buyer" },
      lines: [{ lineNumber: 1, description: "Svc" }],
      totals: { netMinor: 10000, vatMinor: 2300, grossMinor: 12300 },
      ksefReferenceNumber: "ref-1",
    });
    expect(r.success).toBe(true);
  });

  it("rejects short or non-numeric NIP", () => {
    const shortNip = ksefParsedInvoiceSchema.safeParse({
      invoiceNumber: "FV/1/2026",
      issueDate: "2026-04-01",
      invoiceType: "VAT",
      currency: "PLN",
      seller: { nip: "123", name: "Seller" },
      buyer: { nip: "1234563218", name: "Buyer" },
      lines: [{ lineNumber: 1, description: "Svc" }],
      totals: { netMinor: 10000, vatMinor: 2300, grossMinor: 12300 },
      ksefReferenceNumber: "ref-1",
    });
    expect(shortNip.success).toBe(false);

    const nonNumeric = ksefParsedInvoiceSchema.safeParse({
      invoiceNumber: "FV/1/2026",
      issueDate: "2026-04-01",
      invoiceType: "VAT",
      currency: "PLN",
      seller: { nip: "5261040828", name: "Seller" },
      buyer: { nip: "12345abcde", name: "Buyer" },
      lines: [{ lineNumber: 1, description: "Svc" }],
      totals: { netMinor: 10000, vatMinor: 2300, grossMinor: 12300 },
      ksefReferenceNumber: "ref-1",
    });
    expect(nonNumeric.success).toBe(false);
  });

  it("rejects empty lines array", () => {
    const r = ksefParsedInvoiceSchema.safeParse({
      invoiceNumber: "FV/1/2026",
      issueDate: "2026-04-01",
      invoiceType: "VAT",
      currency: "PLN",
      seller: { nip: "5261040828", name: "Seller" },
      buyer: { nip: "1234563218", name: "Buyer" },
      lines: [],
      totals: { netMinor: 0, vatMinor: 0, grossMinor: 0 },
      ksefReferenceNumber: "ref-1",
    });
    expect(r.success).toBe(false);
  });

  it("rejects wrong currency length", () => {
    const r = ksefParsedInvoiceSchema.safeParse({
      invoiceNumber: "1",
      issueDate: "2026-04-01",
      invoiceType: "VAT",
      currency: "PL",
      seller: { nip: "5261040828", name: "S" },
      buyer: { nip: "1234563218", name: "B" },
      lines: [],
      totals: { netMinor: 0, vatMinor: 0, grossMinor: 0 },
      ksefReferenceNumber: "r",
    });
    expect(r.success).toBe(false);
  });
});

describe("ksefSyncParamsSchema", () => {
  it("requires org and connection ids", () => {
    const r = ksefSyncParamsSchema.safeParse({
      organizationId: "o1",
      connectionId: "k1",
    });
    expect(r.success).toBe(true);
  });
});
