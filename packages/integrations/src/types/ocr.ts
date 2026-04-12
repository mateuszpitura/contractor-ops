// ---------------------------------------------------------------------------
// OCR Adapter Interface & Extraction Types
// ---------------------------------------------------------------------------

/**
 * Request payload for invoice extraction.
 */
export interface OcrExtractionRequest {
  pdfBase64: string;
  fileName: string;
  pageCount?: number;
  locale?: string; // "pl" for Polish invoice format hints
}

/**
 * A single extracted field with confidence score.
 */
export interface OcrExtractionField {
  key: string;
  value: string | number | null;
  confidence: number; // 0-100
  boundingBox?: { page: number; x: number; y: number; w: number; h: number };
}

/**
 * An extracted line item from the invoice.
 */
export interface OcrLineItem {
  description: string;
  quantity: number | null;
  unit: string | null;
  unitPriceMinor: number | null;
  netAmountMinor: number | null;
  vatRate: string | null;
  vatAmountMinor: number | null;
  grossAmountMinor: number | null;
  confidence: number; // average confidence across line item fields
}

/**
 * Complete extraction result from an OCR adapter.
 */
export interface OcrExtractionResult {
  status: "EXTRACTED" | "PARTIAL" | "FAILED";
  fields: Record<string, OcrExtractionField>;
  lineItems: OcrLineItem[];
  rawResponse?: unknown;
  processingTimeMs: number;
  pageCount: number;
  overallConfidence: number; // weighted average
  errorMessage?: string;
}

/**
 * Provider-agnostic interface for document extraction.
 * Implemented by ClaudeOcrAdapter (and future providers).
 */
export interface OcrAdapter {
  extractInvoice(request: OcrExtractionRequest): Promise<OcrExtractionResult>;
  readonly providerName: string;
  readonly supportedDocumentTypes: string[];
}

// ---------------------------------------------------------------------------
// NIP Validation (Polish Tax ID)
// ---------------------------------------------------------------------------

/**
 * Validates a Polish NIP (tax identification number) using the modulo-11
 * checksum algorithm with weights 6,5,7,2,3,4,5,6,7.
 *
 * Strips dashes and spaces before validation.
 * A remainder of 10 means the NIP is invalid.
 */
export function validateNip(nip: string): { valid: boolean; formatted: string } {
  const digits = nip.replace(/[\s-]/g, "");

  if (!/^\d{10}$/.test(digits)) {
    return { valid: false, formatted: digits };
  }

  const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7];
  const sum = weights.reduce((acc, w, i) => acc + w * parseInt(digits[i]!, 10), 0);
  const checkDigit = sum % 11;

  // Remainder of 10 means invalid NIP
  if (checkDigit === 10) {
    return { valid: false, formatted: digits };
  }

  return {
    valid: checkDigit === parseInt(digits[9]!, 10),
    formatted: digits,
  };
}

// ---------------------------------------------------------------------------
// Confidence Post-Processing
// ---------------------------------------------------------------------------

/**
 * Adjusts extraction confidence scores based on cross-validation:
 * - net + tax should equal gross (cap amount confidences to 60 if mismatch > 0.01)
 * - NIP checksums must be valid (cap NIP confidence to 40 if invalid)
 */
export function adjustConfidences(result: OcrExtractionResult): OcrExtractionResult {
  const fields = { ...result.fields };

  // Cross-validate: net + tax should equal gross
  const net = fields.totalNet?.value as number | null;
  const tax = fields.totalTax?.value as number | null;
  const gross = fields.totalGross?.value as number | null;

  if (net != null && tax != null && gross != null) {
    const expectedGross = Math.round((net + tax) * 100) / 100;
    if (Math.abs(expectedGross - gross) > 0.01) {
      // Amounts don't add up -- lower confidence on all amount fields
      for (const key of ["totalNet", "totalTax", "totalGross"]) {
        const field = fields[key];
        if (field) {
          fields[key] = {
            ...field,
            confidence: Math.min(field.confidence, 60),
          };
        }
      }
    }
  }

  // Validate NIP checksums
  for (const key of ["sellerNip", "buyerNip"]) {
    const nipField = fields[key];
    if (nipField?.value && typeof nipField.value === "string") {
      const { valid } = validateNip(nipField.value);
      if (!valid) {
        fields[key] = {
          ...nipField,
          confidence: Math.min(nipField.confidence, 40),
        };
      }
    }
  }

  return { ...result, fields };
}
