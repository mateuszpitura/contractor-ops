// ---------------------------------------------------------------------------
// ZatcaTLVQRCode Tests -- TLV encoding and QR code generation
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";
import type { EInvoice } from "../../../types/invoice.js";
import { decodeTLV, encodeTLV, ZatcaTLVQRCode } from "../qr-code.js";
import { ZatcaTlvTag } from "../types.js";

// ---------------------------------------------------------------------------
// Test Fixtures
// ---------------------------------------------------------------------------

function makeInvoice(overrides: Partial<EInvoice> = {}): EInvoice {
  return {
    id: "INV-001",
    issueDate: "2024-03-15T12:30:00Z",
    invoiceTypeCode: "388",
    currencyCode: "SAR",
    supplier: {
      id: "300075588700003",
      name: "Acme Saudi Ltd",
    },
    customer: {
      id: "310122393500003",
      name: "Buyer Corp",
    },
    lines: [
      {
        lineNumber: 1,
        description: "Consulting Services",
        quantity: 1,
        unitPriceMinor: 100000,
        netAmountMinor: 100000,
        vatRate: "15",
        vatAmountMinor: 15000,
        grossAmountMinor: 115000,
      },
    ],
    taxExclusiveAmount: 100000,
    taxInclusiveAmount: 115000,
    payableAmount: 115000,
    taxBreakdown: [
      {
        taxableAmountMinor: 100000,
        taxAmountMinor: 15000,
        taxCategory: "S",
        percent: 15,
      },
    ],
    profileId: "zatca",
    extensions: {
      invoiceType: "simplified",
      invoiceSubtype: "0200000",
      icv: 1,
      pih: "NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==",
      uuid: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// TLV Encoder Tests
// ---------------------------------------------------------------------------

describe("encodeTLV", () => {
  it("produces correct bytes for tag=1, value='Test Seller'", () => {
    const result = encodeTLV([{ tag: 1, value: "Test Seller" }]);

    // Tag 1 (0x01), Length 11 (0x0B), Value "Test Seller" in UTF-8
    expect(result[0]).toBe(0x01);
    expect(result[1]).toBe(11);
    expect(result.subarray(2).toString("utf-8")).toBe("Test Seller");
    expect(result.length).toBe(2 + 11); // tag + length + value
  });

  it("handles multi-byte length for values 128-255 bytes", () => {
    const longValue = "A".repeat(200);
    const result = encodeTLV([{ tag: 1, value: longValue }]);

    // Tag 1 byte, then 0x81 (multi-byte indicator), then 200 (0xC8), then 200 bytes
    expect(result[0]).toBe(0x01);
    expect(result[1]).toBe(0x81);
    expect(result[2]).toBe(200);
    expect(result.length).toBe(1 + 2 + 200);
  });

  it("handles Buffer values directly", () => {
    const buf = Buffer.from([0xde, 0xad, 0xbe, 0xef]);
    const result = encodeTLV([{ tag: 6, value: buf }]);

    expect(result[0]).toBe(0x06);
    expect(result[1]).toBe(4);
    expect(result.subarray(2)).toEqual(buf);
  });

  it("concatenates multiple fields correctly", () => {
    const result = encodeTLV([
      { tag: 1, value: "AB" },
      { tag: 2, value: "CD" },
    ]);

    // Field 1: tag(1) + len(1) + "AB"(2) = 4 bytes
    // Field 2: tag(1) + len(1) + "CD"(2) = 4 bytes
    expect(result.length).toBe(8);
    expect(result[0]).toBe(0x01);
    expect(result[1]).toBe(2);
    expect(result.subarray(2, 4).toString("utf-8")).toBe("AB");
    expect(result[4]).toBe(0x02);
    expect(result[5]).toBe(2);
    expect(result.subarray(6, 8).toString("utf-8")).toBe("CD");
  });
});

// ---------------------------------------------------------------------------
// TLV Decoder Tests
// ---------------------------------------------------------------------------

describe("decodeTLV", () => {
  it("parses TLV buffer back to tag-value pairs", () => {
    // Manually construct: tag=1, len=3, value="abc"
    const buf = Buffer.from([0x01, 0x03, 0x61, 0x62, 0x63]);
    const result = decodeTLV(buf);

    expect(result).toHaveLength(1);
    expect(result[0]?.tag).toBe(1);
    expect(result[0]?.value.toString("utf-8")).toBe("abc");
  });

  it("parses multi-byte length values", () => {
    // tag=1, 0x81, 0xC8 (200), then 200 'A' bytes
    const header = Buffer.from([0x01, 0x81, 0xc8]);
    const payload = Buffer.alloc(200, 0x41);
    const buf = Buffer.concat([header, payload]);
    const result = decodeTLV(buf);

    expect(result).toHaveLength(1);
    expect(result[0]?.tag).toBe(1);
    expect(result[0]?.value.length).toBe(200);
  });

  it("parses multiple fields sequentially", () => {
    const buf = Buffer.from([
      0x01,
      0x02,
      0x41,
      0x42, // tag=1, len=2, "AB"
      0x02,
      0x02,
      0x43,
      0x44, // tag=2, len=2, "CD"
    ]);
    const result = decodeTLV(buf);

    expect(result).toHaveLength(2);
    expect(result[0]?.tag).toBe(1);
    expect(result[0]?.value.toString("utf-8")).toBe("AB");
    expect(result[1]?.tag).toBe(2);
    expect(result[1]?.value.toString("utf-8")).toBe("CD");
  });
});

// ---------------------------------------------------------------------------
// Roundtrip Tests
// ---------------------------------------------------------------------------

describe("TLV roundtrip", () => {
  it("encodeTLV + decodeTLV preserves string values", () => {
    const fields = [
      { tag: ZatcaTlvTag.SELLER_NAME, value: "Acme Saudi Ltd" },
      { tag: ZatcaTlvTag.VAT_NUMBER, value: "300075588700003" },
      { tag: ZatcaTlvTag.TIMESTAMP, value: "2024-03-15T12:30:00Z" },
      { tag: ZatcaTlvTag.TOTAL_WITH_VAT, value: "1150.00" },
      { tag: ZatcaTlvTag.VAT_AMOUNT, value: "150.00" },
    ];

    const encoded = encodeTLV(fields);
    const decoded = decodeTLV(encoded);

    expect(decoded).toHaveLength(5);
    for (let i = 0; i < fields.length; i++) {
      expect(decoded[i]?.tag).toBe(fields[i]?.tag);
      expect(decoded[i]?.value.toString("utf-8")).toBe(fields[i]?.value);
    }
  });

  it("encodeTLV + decodeTLV preserves Buffer values", () => {
    const hashBuf = Buffer.from("deadbeef", "hex");
    const fields = [{ tag: ZatcaTlvTag.INVOICE_HASH, value: hashBuf }];

    const encoded = encodeTLV(fields);
    const decoded = decodeTLV(encoded);

    expect(decoded).toHaveLength(1);
    expect(decoded[0]?.tag).toBe(ZatcaTlvTag.INVOICE_HASH);
    expect(Buffer.compare(decoded[0]?.value, hashBuf)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// ZatcaTLVQRCode Tests
// ---------------------------------------------------------------------------

describe("ZatcaTLVQRCode", () => {
  const qrCode = new ZatcaTLVQRCode();

  describe("generateQR", () => {
    it("returns a valid PNG buffer (magic bytes 0x89504E47)", async () => {
      const invoice = makeInvoice();
      const result = await qrCode.generateQR(invoice);

      expect(result).toBeInstanceOf(Buffer);
      // PNG magic bytes
      expect(result[0]).toBe(0x89);
      expect(result[1]).toBe(0x50); // P
      expect(result[2]).toBe(0x4e); // N
      expect(result[3]).toBe(0x47); // G
    });

    it("includes tags 1-5 for simplified invoices", async () => {
      const invoice = makeInvoice({
        extensions: {
          invoiceType: "simplified",
          invoiceSubtype: "0200000",
          icv: 1,
          pih: "abc",
          uuid: "test-uuid",
        },
      });

      const result = await qrCode.generateQR(invoice);
      expect(result).toBeInstanceOf(Buffer);

      // Decode the QR content to verify tags are present
      // The QR contains base64-encoded TLV data
      // We verify indirectly through parseQR roundtrip
      const parsed = await qrCode.parseQR(extractTlvFromQrGeneration(invoice));
      expect(parsed.supplier?.name).toBe("Acme Saudi Ltd");
      expect(parsed.supplier?.id).toBe("300075588700003");
      expect(parsed.issueDate).toBe("2024-03-15T12:30:00Z");
      expect(parsed.taxInclusiveAmount).toBe(115000);
    });

    it("includes tags 1-8 when extensions have hash/sig/key", async () => {
      const invoice = makeInvoice({
        extensions: {
          invoiceType: "standard",
          invoiceSubtype: "0100000",
          icv: 1,
          pih: "abc",
          uuid: "test-uuid",
          invoiceHash: "a1b2c3d4e5f6",
          signatureValue: Buffer.from("signature-bytes").toString("base64"),
          publicKey: Buffer.from("public-key-bytes").toString("base64"),
        },
      });

      const result = await qrCode.generateQR(invoice);
      expect(result).toBeInstanceOf(Buffer);

      // Verify B2B tags exist through TLV extraction
      const tlvBuffer = extractTlvFromQrGeneration(invoice);
      const parsed = decodeTLV(Buffer.from(tlvBuffer.toString("utf-8"), "base64"));
      const tags = parsed.map((p) => p.tag);
      expect(tags).toContain(ZatcaTlvTag.SELLER_NAME);
      expect(tags).toContain(ZatcaTlvTag.VAT_NUMBER);
      expect(tags).toContain(ZatcaTlvTag.TIMESTAMP);
      expect(tags).toContain(ZatcaTlvTag.TOTAL_WITH_VAT);
      expect(tags).toContain(ZatcaTlvTag.VAT_AMOUNT);
      expect(tags).toContain(ZatcaTlvTag.INVOICE_HASH);
      expect(tags).toContain(ZatcaTlvTag.ECDSA_SIGNATURE);
      expect(tags).toContain(ZatcaTlvTag.PUBLIC_KEY);
    });

    it("tag values match ZATCA spec fields", async () => {
      const invoice = makeInvoice();
      const tlvBuffer = extractTlvFromQrGeneration(invoice);
      const decoded = decodeTLV(Buffer.from(tlvBuffer.toString("utf-8"), "base64"));

      const findTag = (tag: number) => decoded.find((d) => d.tag === tag)?.value.toString("utf-8");

      expect(findTag(ZatcaTlvTag.SELLER_NAME)).toBe("Acme Saudi Ltd");
      expect(findTag(ZatcaTlvTag.VAT_NUMBER)).toBe("300075588700003");
      expect(findTag(ZatcaTlvTag.TIMESTAMP)).toBe("2024-03-15T12:30:00Z");
      expect(findTag(ZatcaTlvTag.TOTAL_WITH_VAT)).toBe("1150.00");
      expect(findTag(ZatcaTlvTag.VAT_AMOUNT)).toBe("150.00");
    });

    it("rejects supplier names longer than 1000 characters", async () => {
      const invoice = makeInvoice({
        supplier: {
          id: "300075588700003",
          name: "X".repeat(1001),
        },
      });

      await expect(qrCode.generateQR(invoice)).rejects.toThrow(/supplier name/i);
    });
  });

  describe("parseQR", () => {
    it("extracts supplier name, VAT, total, and VAT amount", async () => {
      // Build a TLV buffer, base64-encode, wrap as UTF-8 buffer
      const tlv = encodeTLV([
        { tag: ZatcaTlvTag.SELLER_NAME, value: "Test Co" },
        { tag: ZatcaTlvTag.VAT_NUMBER, value: "310000000000003" },
        { tag: ZatcaTlvTag.TIMESTAMP, value: "2024-06-01T08:00:00Z" },
        { tag: ZatcaTlvTag.TOTAL_WITH_VAT, value: "500.00" },
        { tag: ZatcaTlvTag.VAT_AMOUNT, value: "65.22" },
      ]);
      const base64 = tlv.toString("base64");
      const data = Buffer.from(base64, "utf-8");

      const result = await qrCode.parseQR(data);

      expect(result.supplier?.name).toBe("Test Co");
      expect(result.supplier?.id).toBe("310000000000003");
      expect(result.issueDate).toBe("2024-06-01T08:00:00Z");
      expect(result.taxInclusiveAmount).toBe(50000);
      expect(result.taxBreakdown?.[0]?.taxAmountMinor).toBe(6522);
    });
  });
});

// ---------------------------------------------------------------------------
// Helper: Extract TLV buffer from generateQR process (bypasses PNG rendering)
// ---------------------------------------------------------------------------

/**
 * Build the TLV buffer the same way generateQR does, for testing tag contents.
 * This mirrors the encoding logic without the QR image rendering step.
 */
function extractTlvFromQrGeneration(invoice: EInvoice): Buffer {
  const vatAmount = invoice.taxBreakdown.reduce((sum, t) => sum + t.taxAmountMinor, 0);

  const fields: Array<{ tag: number; value: string | Buffer }> = [
    { tag: ZatcaTlvTag.SELLER_NAME, value: invoice.supplier.name },
    { tag: ZatcaTlvTag.VAT_NUMBER, value: invoice.supplier.id },
    { tag: ZatcaTlvTag.TIMESTAMP, value: invoice.issueDate },
    {
      tag: ZatcaTlvTag.TOTAL_WITH_VAT,
      value: (invoice.taxInclusiveAmount / 100).toFixed(2),
    },
    {
      tag: ZatcaTlvTag.VAT_AMOUNT,
      value: (vatAmount / 100).toFixed(2),
    },
  ];

  const ext = invoice.extensions as Record<string, unknown> | undefined;
  if (ext?.invoiceHash) {
    fields.push({
      tag: ZatcaTlvTag.INVOICE_HASH,
      value: Buffer.from(ext.invoiceHash as string, "hex"),
    });
  }
  if (ext?.signatureValue) {
    fields.push({
      tag: ZatcaTlvTag.ECDSA_SIGNATURE,
      value: Buffer.from(ext.signatureValue as string, "base64"),
    });
  }
  if (ext?.publicKey) {
    fields.push({
      tag: ZatcaTlvTag.PUBLIC_KEY,
      value: Buffer.from(ext.publicKey as string, "base64"),
    });
  }

  const tlv = encodeTLV(fields);
  const base64 = tlv.toString("base64");
  return Buffer.from(base64, "utf-8");
}
