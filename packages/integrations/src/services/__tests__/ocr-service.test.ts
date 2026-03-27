import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  clearAdapters,
  registerAdapter,
} from "../../registry.js";
import { getOcrAdapter, extractInvoice } from "../ocr-service.js";
import type { OcrAdapter, OcrExtractionResult } from "../../types/ocr.js";
import type { IntegrationProviderAdapter } from "../../types/provider.js";

// ---------------------------------------------------------------------------
// Mock adapter
// ---------------------------------------------------------------------------

const MOCK_RESULT: OcrExtractionResult = {
  status: "EXTRACTED",
  fields: {
    invoiceNumber: {
      key: "invoiceNumber",
      value: "FV/001",
      confidence: 95,
    },
  },
  lineItems: [],
  processingTimeMs: 500,
  pageCount: 1,
  overallConfidence: 95,
};

const mockExtractInvoice = vi.fn().mockResolvedValue(MOCK_RESULT);

const mockOcrAdapter: OcrAdapter & { slug: string } = {
  providerName: "claude",
  supportedDocumentTypes: ["application/pdf"],
  extractInvoice: mockExtractInvoice,
  slug: "claude",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ocr-service", () => {
  beforeEach(() => {
    clearAdapters();
    vi.clearAllMocks();
    // Register the mock adapter with the same slug pattern used by ClaudeOcrAdapter
    registerAdapter(
      mockOcrAdapter as unknown as IntegrationProviderAdapter,
    );
  });

  afterEach(() => {
    clearAdapters();
  });

  describe("getOcrAdapter", () => {
    it("resolves registered adapter by provider name", () => {
      const adapter = getOcrAdapter("CLAUDE");
      expect(adapter).toBeDefined();
      expect(adapter.providerName).toBe("claude");
    });

    it("throws if adapter is not registered", () => {
      clearAdapters();
      expect(() => getOcrAdapter("CLAUDE")).toThrow(
        "No adapter registered for OCR provider: CLAUDE",
      );
    });
  });

  describe("extractInvoice", () => {
    it("delegates to the resolved adapter", async () => {
      const result = await extractInvoice({
        provider: "CLAUDE",
        pdfBase64: "AAAA",
        fileName: "test.pdf",
        locale: "pl",
      });

      expect(mockExtractInvoice).toHaveBeenCalledWith({
        pdfBase64: "AAAA",
        fileName: "test.pdf",
        locale: "pl",
      });
      expect(result.status).toBe("EXTRACTED");
      expect(result.fields.invoiceNumber?.value).toBe("FV/001");
    });

    it("defaults locale to 'pl' when not specified", async () => {
      await extractInvoice({
        provider: "CLAUDE",
        pdfBase64: "AAAA",
        fileName: "test.pdf",
      });

      expect(mockExtractInvoice).toHaveBeenCalledWith(
        expect.objectContaining({ locale: "pl" }),
      );
    });
  });
});
