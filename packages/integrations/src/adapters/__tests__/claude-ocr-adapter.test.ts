import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OcrExtractionRequest, OcrExtractionResult } from "../../types/ocr.js";
import { adjustConfidences, validateNip } from "../../types/ocr.js";
import { ClaudeOcrAdapter } from "../claude-ocr-adapter.js";

// ---------------------------------------------------------------------------
// Mock the Anthropic SDK
// ---------------------------------------------------------------------------

const mockCreate = vi.fn();

vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = { create: mockCreate };
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockToolResponse(input: Record<string, unknown>) {
  return {
    content: [
      {
        type: "tool_use" as const,
        id: "tool_1",
        name: "extract_invoice_data",
        input,
      },
    ],
  };
}

const BASE_REQUEST: OcrExtractionRequest = {
  pdfBase64: "AAAA", // small valid base64
  fileName: "faktura.pdf",
  locale: "pl",
};

const FULL_EXTRACTION_RESPONSE = {
  invoiceNumber: { value: "FV/2026/001", confidence: 95 },
  issueDate: { value: "2026-03-15", confidence: 92 },
  dueDate: { value: "2026-04-15", confidence: 88 },
  sellerNip: { value: "5261040828", confidence: 90 }, // valid NIP
  buyerNip: { value: "7681230519", confidence: 85 },
  sellerName: { value: "Acme Sp. z o.o.", confidence: 93 },
  buyerName: { value: "Client SA", confidence: 91 },
  currency: { value: "PLN", confidence: 99 },
  totalNet: { value: 1000.0, confidence: 94 },
  totalTax: { value: 230.0, confidence: 93 },
  totalGross: { value: 1230.0, confidence: 95 },
  bankAccount: { value: "PL12345678901234567890123456", confidence: 80 },
  lineItems: [
    {
      description: "Uslugi programistyczne",
      quantity: 160,
      unit: "h",
      unitPrice: 6.25,
      netAmount: 1000.0,
      vatRate: "23%",
      vatAmount: 230.0,
      grossAmount: 1230.0,
      confidence: 90,
    },
  ],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ClaudeOcrAdapter", () => {
  let adapter: ClaudeOcrAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new ClaudeOcrAdapter({ apiKey: "test-key" });
  });

  it("extracts fields from mock PDF response", async () => {
    mockCreate.mockResolvedValueOnce(makeMockToolResponse(FULL_EXTRACTION_RESPONSE));

    const result = await adapter.extractInvoice(BASE_REQUEST);

    expect(result.status).toBe("EXTRACTED");
    expect(result.fields.invoiceNumber?.value).toBe("FV/2026/001");
    expect(result.fields.issueDate?.value).toBe("2026-03-15");
    expect(result.fields.currency?.value).toBe("PLN");
    expect(result.fields.sellerName?.value).toBe("Acme Sp. z o.o.");
    expect(result.lineItems).toHaveLength(1);
    expect(result.lineItems[0]!.description).toBe("Uslugi programistyczne");
    expect(result.overallConfidence).toBeGreaterThan(0);
  });

  it("normalizes amounts to grosze correctly", async () => {
    mockCreate.mockResolvedValueOnce(makeMockToolResponse(FULL_EXTRACTION_RESPONSE));

    const result = await adapter.extractInvoice(BASE_REQUEST);

    // 1000.00 PLN = 100000 grosze
    expect(result.fields.totalNet?.value).toBe(100000);
    // 230.00 PLN = 23000 grosze
    expect(result.fields.totalTax?.value).toBe(23000);
    // 1230.00 PLN = 123000 grosze
    expect(result.fields.totalGross?.value).toBe(123000);

    // Line item amounts in grosze
    expect(result.lineItems[0]!.unitPriceGrosze).toBe(625);
    expect(result.lineItems[0]!.netAmountGrosze).toBe(100000);
    expect(result.lineItems[0]!.vatAmountGrosze).toBe(23000);
    expect(result.lineItems[0]!.grossAmountGrosze).toBe(123000);
  });

  it("adjusts confidence when NIP is invalid", async () => {
    const responseWithInvalidNip = {
      ...FULL_EXTRACTION_RESPONSE,
      sellerNip: { value: "1234567890", confidence: 90 }, // invalid: remainder 10
    };

    mockCreate.mockResolvedValueOnce(makeMockToolResponse(responseWithInvalidNip));

    const result = await adapter.extractInvoice(BASE_REQUEST);

    // NIP confidence should be capped at 40
    expect(result.fields.sellerNip?.confidence).toBeLessThanOrEqual(40);
  });

  it("returns FAILED status on empty tool_use response", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "I cannot extract data" }],
    });

    const result = await adapter.extractInvoice(BASE_REQUEST);

    expect(result.status).toBe("FAILED");
    expect(result.errorMessage).toContain("no tool_use block");
  });

  it("returns PARTIAL when less than 50% of required fields are extracted", async () => {
    const sparseResponse = {
      invoiceNumber: { value: "FV/001", confidence: 80 },
      issueDate: { value: null, confidence: 0 },
      totalNet: { value: null, confidence: 0 },
      totalGross: { value: null, confidence: 0 },
      currency: { value: null, confidence: 0 },
      lineItems: [],
    };

    mockCreate.mockResolvedValueOnce(makeMockToolResponse(sparseResponse));

    const result = await adapter.extractInvoice(BASE_REQUEST);

    expect(result.status).toBe("PARTIAL");
  });

  it("returns FAILED when PDF exceeds 30MB size limit", async () => {
    const largePdf = "A".repeat(41 * 1024 * 1024); // > 30MB after base64 decode
    const result = await adapter.extractInvoice({
      ...BASE_REQUEST,
      pdfBase64: largePdf,
    });

    expect(result.status).toBe("FAILED");
    expect(result.errorMessage).toContain("30MB limit");
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("has slug property matching providerName for registry compatibility", () => {
    expect(adapter.slug).toBe("claude");
    expect(adapter.slug).toBe(adapter.providerName);
  });
});

// ---------------------------------------------------------------------------
// NIP Validation Tests
// ---------------------------------------------------------------------------

describe("validateNip", () => {
  it("validates a correct NIP", () => {
    // 5261040828 is a valid Polish NIP (GUS)
    const result = validateNip("5261040828");
    expect(result.valid).toBe(true);
    expect(result.formatted).toBe("5261040828");
  });

  it("strips dashes and spaces", () => {
    const result = validateNip("526-104-08-28");
    expect(result.valid).toBe(true);
    expect(result.formatted).toBe("5261040828");
  });

  it("rejects NIP with wrong length", () => {
    const result = validateNip("12345");
    expect(result.valid).toBe(false);
  });

  it("rejects NIP with invalid checksum (remainder 10)", () => {
    const result = validateNip("1234567890");
    expect(result.valid).toBe(false);
  });

  it("rejects non-numeric NIP", () => {
    const result = validateNip("ABCDEFGHIJ");
    expect(result.valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Confidence Adjustment Tests
// ---------------------------------------------------------------------------

describe("adjustConfidences", () => {
  it("caps amount confidence when net + tax != gross", () => {
    const result: OcrExtractionResult = {
      status: "EXTRACTED",
      fields: {
        totalNet: { key: "totalNet", value: 100000, confidence: 95 },
        totalTax: { key: "totalTax", value: 23000, confidence: 90 },
        totalGross: { key: "totalGross", value: 150000, confidence: 92 }, // wrong: should be 123000
      },
      lineItems: [],
      processingTimeMs: 100,
      pageCount: 1,
      overallConfidence: 92,
    };

    const adjusted = adjustConfidences(result);

    expect(adjusted.fields.totalNet?.confidence).toBeLessThanOrEqual(60);
    expect(adjusted.fields.totalTax?.confidence).toBeLessThanOrEqual(60);
    expect(adjusted.fields.totalGross?.confidence).toBeLessThanOrEqual(60);
  });

  it("does not cap amount confidence when net + tax == gross", () => {
    const result: OcrExtractionResult = {
      status: "EXTRACTED",
      fields: {
        totalNet: { key: "totalNet", value: 100000, confidence: 95 },
        totalTax: { key: "totalTax", value: 23000, confidence: 90 },
        totalGross: { key: "totalGross", value: 123000, confidence: 92 },
      },
      lineItems: [],
      processingTimeMs: 100,
      pageCount: 1,
      overallConfidence: 92,
    };

    const adjusted = adjustConfidences(result);

    expect(adjusted.fields.totalNet?.confidence).toBe(95);
    expect(adjusted.fields.totalTax?.confidence).toBe(90);
    expect(adjusted.fields.totalGross?.confidence).toBe(92);
  });

  it("caps NIP confidence when checksum is invalid", () => {
    const result: OcrExtractionResult = {
      status: "EXTRACTED",
      fields: {
        sellerNip: {
          key: "sellerNip",
          value: "1234567890",
          confidence: 85,
        },
      },
      lineItems: [],
      processingTimeMs: 100,
      pageCount: 1,
      overallConfidence: 85,
    };

    const adjusted = adjustConfidences(result);

    expect(adjusted.fields.sellerNip?.confidence).toBeLessThanOrEqual(40);
  });
});
