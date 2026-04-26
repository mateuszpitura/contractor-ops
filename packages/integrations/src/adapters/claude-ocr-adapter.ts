import Anthropic from '@anthropic-ai/sdk';
import type {
  OcrAdapter,
  OcrExtractionField,
  OcrExtractionRequest,
  OcrExtractionResult,
  OcrLineItem,
} from '../types/ocr.js';
import { adjustConfidences } from '../types/ocr.js';

// ---------------------------------------------------------------------------
// Prompt & Tool Schema
// ---------------------------------------------------------------------------

const POLISH_INVOICE_EXTRACTION_PROMPT = `You are an invoice data extraction system specializing in Polish invoices (faktura VAT).

Extract all fields from this invoice PDF. For each field, provide a confidence score from 0 to 100 indicating how certain you are about the extracted value.

Key Polish invoice conventions:
- NIP (Numer Identyfikacji Podatkowej): 10-digit tax identification number, may include dashes (e.g., 123-456-78-90)
- Amounts use comma as decimal separator (e.g., "1 234,56 zl")
- Currency is typically PLN (zloty) unless stated otherwise
- VAT rates: 23%, 8%, 5%, 0%, "zw." (exempt), "np." (not applicable)
- "Faktura VAT" = VAT invoice, "Faktura proforma" = proforma
- "Netto" = net amount, "Brutto" = gross amount, "VAT" = tax amount
- "Data wystawienia" = issue date, "Termin platnosci" = due date
- "Nr faktury" = invoice number
- "Sprzedawca" = seller, "Nabywca" = buyer

Return all monetary amounts in their original currency as decimal numbers (e.g., 1234.56, not "1 234,56 zl").
Return dates in ISO 8601 format (YYYY-MM-DD).
Strip dashes and spaces from NIP numbers (return 10 consecutive digits).

Use the extract_invoice_data tool to return your results.`;

const INVOICE_EXTRACTION_TOOL: Anthropic.Tool = {
  name: 'extract_invoice_data',
  description: 'Extract structured invoice data from a Polish invoice PDF',
  input_schema: {
    type: 'object' as const,
    properties: {
      invoiceNumber: {
        type: 'object',
        properties: {
          value: { type: 'string' },
          confidence: { type: 'number' },
        },
        required: ['value', 'confidence'],
      },
      issueDate: {
        type: 'object',
        properties: {
          value: { type: 'string', description: 'ISO 8601 date' },
          confidence: { type: 'number' },
        },
        required: ['value', 'confidence'],
      },
      dueDate: {
        type: 'object',
        properties: {
          value: { type: 'string', description: 'ISO 8601 date or null' },
          confidence: { type: 'number' },
        },
        required: ['value', 'confidence'],
      },
      sellerNip: {
        type: 'object',
        properties: {
          value: {
            type: 'string',
            description: '10 digits, no dashes',
          },
          confidence: { type: 'number' },
        },
        required: ['value', 'confidence'],
      },
      buyerNip: {
        type: 'object',
        properties: {
          value: {
            type: 'string',
            description: '10 digits, no dashes',
          },
          confidence: { type: 'number' },
        },
        required: ['value', 'confidence'],
      },
      sellerName: {
        type: 'object',
        properties: {
          value: { type: 'string' },
          confidence: { type: 'number' },
        },
        required: ['value', 'confidence'],
      },
      buyerName: {
        type: 'object',
        properties: {
          value: { type: 'string' },
          confidence: { type: 'number' },
        },
        required: ['value', 'confidence'],
      },
      currency: {
        type: 'object',
        properties: {
          value: {
            type: 'string',
            description: '3-letter ISO currency code',
          },
          confidence: { type: 'number' },
        },
        required: ['value', 'confidence'],
      },
      totalNet: {
        type: 'object',
        properties: {
          value: { type: 'number', description: 'Net total as decimal' },
          confidence: { type: 'number' },
        },
        required: ['value', 'confidence'],
      },
      totalTax: {
        type: 'object',
        properties: {
          value: { type: 'number', description: 'Tax total as decimal' },
          confidence: { type: 'number' },
        },
        required: ['value', 'confidence'],
      },
      totalGross: {
        type: 'object',
        properties: {
          value: {
            type: 'number',
            description: 'Gross total as decimal',
          },
          confidence: { type: 'number' },
        },
        required: ['value', 'confidence'],
      },
      bankAccount: {
        type: 'object',
        properties: {
          value: { type: 'string', description: 'Bank account number' },
          confidence: { type: 'number' },
        },
        required: ['value', 'confidence'],
      },
      lineItems: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            description: { type: 'string' },
            quantity: { type: 'number' },
            unit: { type: 'string' },
            unitPrice: {
              type: 'number',
              description: 'Decimal amount',
            },
            netAmount: {
              type: 'number',
              description: 'Decimal amount',
            },
            vatRate: { type: 'string' },
            vatAmount: {
              type: 'number',
              description: 'Decimal amount',
            },
            grossAmount: {
              type: 'number',
              description: 'Decimal amount',
            },
            confidence: { type: 'number' },
          },
          required: ['description', 'confidence'],
        },
      },
    },
    required: ['invoiceNumber', 'issueDate', 'totalNet', 'totalGross', 'currency', 'lineItems'],
  },
};

// ---------------------------------------------------------------------------
// Required fields for PARTIAL vs EXTRACTED determination
// ---------------------------------------------------------------------------

const REQUIRED_FIELDS = [
  'invoiceNumber',
  'issueDate',
  'totalNet',
  'totalGross',
  'currency',
  'sellerNip',
] as const;

// Max PDF size: 30MB
const MAX_PDF_SIZE_BYTES = 30 * 1024 * 1024;

function deriveExtractionStatus(
  fields: Record<string, OcrExtractionField>,
): 'EXTRACTED' | 'PARTIAL' | 'FAILED' {
  const extractedRequiredCount = REQUIRED_FIELDS.filter(key => fields[key]?.value != null).length;
  const requiredRatio = extractedRequiredCount / REQUIRED_FIELDS.length;
  return requiredRatio < 0.5 ? 'PARTIAL' : 'EXTRACTED';
}

function computeOverallConfidence(
  fields: Record<string, OcrExtractionField>,
  lineItems: OcrLineItem[],
): number {
  const allConfidences: number[] = [];
  for (const field of Object.values(fields)) {
    if (field.value != null) {
      allConfidences.push(field.confidence);
    }
  }
  for (const item of lineItems) {
    allConfidences.push(item.confidence);
  }

  return allConfidences.length > 0
    ? Math.round(allConfidences.reduce((sum, c) => sum + c, 0) / allConfidences.length)
    : 0;
}

// ---------------------------------------------------------------------------
// Claude OCR Adapter
// ---------------------------------------------------------------------------

/**
 * OCR adapter using Claude Vision API with native PDF document support.
 *
 * Sends the raw PDF base64 to Claude (no PDF-to-image conversion) and uses
 * tool_use for guaranteed structured JSON output.
 */
export class ClaudeOcrAdapter implements OcrAdapter {
  readonly providerName = 'claude';
  readonly slug = 'claude';
  readonly supportedDocumentTypes = ['application/pdf'];

  private readonly client: Anthropic;
  private readonly modelId: string;

  constructor(params?: { apiKey?: string; modelId?: string }) {
    this.client = new Anthropic({
      apiKey: params?.apiKey ?? process.env.ANTHROPIC_API_KEY,
    });
    this.modelId = params?.modelId ?? 'claude-sonnet-4-5-20250514';
  }

  async extractInvoice(request: OcrExtractionRequest): Promise<OcrExtractionResult> {
    const startTime = Date.now();

    // Check PDF size before sending
    const pdfSizeBytes = Math.ceil((request.pdfBase64.length * 3) / 4);
    if (pdfSizeBytes > MAX_PDF_SIZE_BYTES) {
      return {
        status: 'FAILED',
        fields: {},
        lineItems: [],
        processingTimeMs: Date.now() - startTime,
        pageCount: 0,
        overallConfidence: 0,
        errorMessage: `PDF size (${Math.round(pdfSizeBytes / 1024 / 1024)}MB) exceeds the 30MB limit`,
      };
    }

    try {
      const response = await this.client.messages.create({
        model: this.modelId,
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: 'application/pdf',
                  data: request.pdfBase64,
                },
              },
              {
                type: 'text',
                text: POLISH_INVOICE_EXTRACTION_PROMPT,
              },
            ],
          },
        ],
        tools: [INVOICE_EXTRACTION_TOOL],
        tool_choice: { type: 'tool', name: 'extract_invoice_data' },
      });

      // Find the tool_use block in the response
      const toolUseBlock = response.content.find(
        (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
      );

      if (!toolUseBlock) {
        return {
          status: 'FAILED',
          fields: {},
          lineItems: [],
          processingTimeMs: Date.now() - startTime,
          pageCount: 0,
          overallConfidence: 0,
          errorMessage: 'Claude returned no tool_use block in response',
        };
      }

      const rawData = toolUseBlock.input as Record<string, unknown>;
      const processingTimeMs = Date.now() - startTime;

      return this.parseExtractionResponse(rawData, processingTimeMs, request.pageCount, response);
    } catch (error) {
      return {
        status: 'FAILED',
        fields: {},
        lineItems: [],
        processingTimeMs: Date.now() - startTime,
        pageCount: 0,
        overallConfidence: 0,
        errorMessage: error instanceof Error ? error.message : 'Unknown extraction error',
      };
    }
  }

  /**
   * Parses the raw tool_use response into OcrExtractionResult.
   * Normalizes amounts from decimal to minor units (integer cents).
   */
  private parseExtractionResponse(
    rawData: Record<string, unknown>,
    processingTimeMs: number,
    requestPageCount: number | undefined,
    rawResponse: unknown,
  ): OcrExtractionResult {
    const fields: Record<string, OcrExtractionField> = {};

    // Parse scalar fields
    const scalarFieldKeys = [
      'invoiceNumber',
      'issueDate',
      'dueDate',
      'sellerNip',
      'buyerNip',
      'sellerName',
      'buyerName',
      'currency',
      'bankAccount',
    ] as const;

    for (const key of scalarFieldKeys) {
      const raw = rawData[key] as { value: string | null; confidence: number } | undefined;
      if (raw) {
        fields[key] = {
          key,
          value: raw.value ?? null,
          confidence: raw.confidence ?? 0,
        };
      }
    }

    // Parse amount fields -- convert from decimal to minor units
    const amountFieldKeys = ['totalNet', 'totalTax', 'totalGross'] as const;

    for (const key of amountFieldKeys) {
      const raw = rawData[key] as { value: number | null; confidence: number } | undefined;
      if (raw) {
        fields[key] = {
          key,
          value: raw.value == null ? null : Math.round(raw.value * 100),
          confidence: raw.confidence ?? 0,
        };
      }
    }

    // Parse line items -- convert amounts to minor units
    const rawLineItems = (rawData.lineItems ?? []) as Array<{
      description: string;
      quantity?: number | null;
      unit?: string | null;
      unitPrice?: number | null;
      netAmount?: number | null;
      vatRate?: string | null;
      vatAmount?: number | null;
      grossAmount?: number | null;
      confidence: number;
    }>;

    const lineItems: OcrLineItem[] = rawLineItems.map(item => ({
      description: item.description,
      quantity: item.quantity ?? null,
      unit: item.unit ?? null,
      unitPriceMinor: item.unitPrice == null ? null : Math.round(item.unitPrice * 100),
      netAmountMinor: item.netAmount == null ? null : Math.round(item.netAmount * 100),
      vatRate: item.vatRate ?? null,
      vatAmountMinor: item.vatAmount == null ? null : Math.round(item.vatAmount * 100),
      grossAmountMinor: item.grossAmount == null ? null : Math.round(item.grossAmount * 100),
      confidence: item.confidence ?? 0,
    }));

    const status = deriveExtractionStatus(fields);
    const overallConfidence = computeOverallConfidence(fields, lineItems);

    const result: OcrExtractionResult = {
      status,
      fields,
      lineItems,
      rawResponse,
      processingTimeMs,
      pageCount: requestPageCount ?? 1,
      overallConfidence,
    };

    // Apply confidence adjustments (NIP validation, cross-validation)
    return adjustConfidences(result);
  }
}
