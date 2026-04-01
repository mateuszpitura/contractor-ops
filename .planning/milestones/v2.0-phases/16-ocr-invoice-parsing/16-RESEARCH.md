# Phase 16: OCR Invoice Parsing - Research

**Researched:** 2026-03-27
**Domain:** PDF document processing, Claude Vision API, background job processing, PDF viewer UI
**Confidence:** HIGH

## Summary

Phase 16 adds automated invoice field extraction from uploaded PDFs using Claude Vision API as the default OCR provider, behind a provider-agnostic adapter interface that mirrors the Phase 12 e-sign pattern. The system sends the raw PDF to Claude (which natively supports PDF as a document content type -- no PDF-to-image conversion needed), receives structured JSON with field-level confidence scores, and pre-fills existing invoice forms. Background processing via the already-established QStash queue ensures uploads remain fast.

The frontend adds a split-panel review experience (PDF viewer left, pre-filled form right) for admin users, and inline OCR pre-fill for the portal submit form. The `react-pdf` library (v10.4.1) provides client-side PDF rendering. Confidence scores drive color-coded field borders per the UI-SPEC. A new `OcrExtraction` Prisma model tracks extraction state, results, and provider metadata.

**Primary recommendation:** Use Claude's native PDF support (`type: "document"`, `media_type: "application/pdf"`) with base64 encoding, structured output via tool_use for guaranteed JSON schema compliance, and QStash for async processing. Mirror the ESignAdapter pattern for the OCR adapter interface.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Provider-agnostic abstraction layer (same adapter pattern as e-sign) with Claude Vision API as the default provider. Interface supports swapping to Google Document AI or Azure Form Recognizer later without UI changes.
- **D-02:** Claude Vision sends PDF pages as images, receives structured JSON extraction response. Prompt engineering for Polish invoice format understanding.
- **D-03:** Background queue processing -- upload completes instantly, OCR runs asynchronously. User gets notified when extraction is ready. Better for large volumes and doesn't block the upload UX.
- **D-04:** Pre-fill form -- extracted fields auto-populate the invoice creation/edit form. User reviews and edits before saving. No separate review step; the form IS the review.
- **D-05:** Both portal + admin -- contractors uploading invoices via portal get auto-extraction too. Pre-fills their submit form. Reduces contractor errors and admin corrections.
- **D-06:** Split panel in invoice form -- PDF preview on the left, pre-filled form fields on the right. Confidence badges on each field. Low-confidence fields highlighted. User edits inline and saves normally.
- **D-07:** Color-coded field borders for confidence -- green border = high confidence (>90%), amber = medium (70-90%), red = low (<70%). Tooltip shows exact percentage. Low-confidence fields get a warning icon.
- **D-08:** Full extraction -- invoice number, issue date, due date, NIP (seller + buyer), total net, total gross, tax amount, currency, bank account, line items (description, quantity, unit price, net, tax rate, gross). Covers everything in the Invoice model.
- **D-09:** NIP format validation only -- check 10 digits + checksum algorithm. Flag invalid NIPs in the review. No external registry lookup (GUS/VIES deferred).

### Claude's Discretion
- OCR adapter interface shape and method signatures
- Claude Vision prompt engineering for Polish invoice extraction
- Background queue implementation (in-process vs external job queue)
- PDF-to-image conversion approach (page splitting, resolution)
- Multi-page invoice handling strategy
- Confidence score calculation methodology
- PDF viewer component choice for split panel
- Error handling for failed/partial extractions
- Retry strategy for transient OCR failures

### Deferred Ideas (OUT OF SCOPE)
- NIP validation against GUS/VIES registry -- future enhancement, format-only validation for now
- Duplicate invoice detection based on OCR fields -- could be a separate phase or backlog item
- Training/fine-tuning OCR model on org-specific invoice formats -- future optimization
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| OCR-01 | System auto-extracts fields (NIP, invoice number, date, amount, line items) from uploaded PDF | Claude API native PDF support with document content block, structured JSON extraction via tool_use, OCR adapter interface, QStash background processing |
| OCR-02 | Extracted fields display confidence scores per field | Claude response includes field-level confidence in structured output; ConfidenceBadge + ConfidenceFieldWrapper components per UI-SPEC |
| OCR-03 | User can review OCR results in side-by-side view (PDF + extracted fields with edit-in-place) | react-pdf for PDF rendering in split panel, pre-filled react-hook-form fields with inline editing, ExtractionStatusBar for state feedback |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @anthropic-ai/sdk | 0.80.0 | Claude API client for PDF extraction | Official TypeScript SDK; supports native PDF document type with base64 encoding |
| react-pdf | 10.4.1 | Client-side PDF rendering in split panel viewer | Most actively maintained React PDF viewer; 1000+ dependents; supports page navigation, zoom |
| @upstash/qstash | ^2.10.1 | Background job queue for async OCR processing | Already in use (Phase 12 webhook processing); QStash signature verification included |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | ^3.23.0 | Schema validation for OCR extraction results | Already in stack; validate structured extraction response before form pre-fill |
| pdfjs-dist | (peer dep of react-pdf) | PDF.js engine for rendering | Automatic peer dependency; needed for react-pdf worker setup |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @anthropic-ai/sdk | Google Document AI | Higher accuracy on structured forms but vendor lock-in; adapter pattern allows swap later |
| react-pdf | iframe with presigned URL | Simpler but no page navigation, zoom controls, or programmatic control |
| react-pdf | @react-pdf-viewer/core | Last published 3 years ago; abandoned |
| QStash | inngest, trigger.dev | More features but new dependency; QStash already proven in codebase |

**Installation:**
```bash
pnpm add @anthropic-ai/sdk --filter @contractor-ops/integrations
pnpm add react-pdf --filter contractor-ops-web
```

**Version verification:** Versions confirmed via npm registry on 2026-03-27. @anthropic-ai/sdk@0.80.0, react-pdf@10.4.1, @upstash/qstash already installed.

## Architecture Patterns

### Recommended Project Structure
```
packages/integrations/src/
├── types/
│   └── ocr.ts                    # OcrAdapter interface, extraction types
├── adapters/
│   └── claude-ocr-adapter.ts     # Claude Vision OCR implementation
├── services/
│   └── ocr-service.ts            # Provider-agnostic OCR orchestration

packages/api/src/
├── services/
│   └── ocr-extraction.ts         # Extraction orchestrator (R2 fetch, adapter call, DB persist)
├── routers/
│   └── ocr.ts                    # tRPC endpoints for triggering/querying extraction

apps/web/src/
├── app/api/ocr/
│   └── _process/route.ts         # QStash callback for async OCR processing
├── components/
│   ├── ocr/
│   │   ├── ocr-review-panel.tsx       # Split panel container
│   │   ├── pdf-viewer.tsx             # react-pdf based viewer
│   │   ├── confidence-badge.tsx       # Per-field confidence indicator
│   │   ├── confidence-field-wrapper.tsx # Colored-border field wrapper
│   │   ├── line-items-table.tsx       # Editable line items
│   │   ├── extraction-status-bar.tsx  # Processing/complete/failed status
│   │   ├── ocr-processing-overlay.tsx # Loading overlay during extraction
│   │   └── nip-validation-badge.tsx   # NIP format validation indicator
│   └── invoices/
│       └── (extend existing invoice form with OCR integration)
```

### Pattern 1: OCR Adapter Interface (mirroring ESignAdapter)
**What:** Provider-agnostic interface for document extraction
**When to use:** All OCR operations go through this interface
**Example:**
```typescript
// Source: Modeled after packages/integrations/src/types/esign.ts
export interface OcrExtractionRequest {
  pdfBase64: string;
  fileName: string;
  pageCount?: number;
  locale?: string; // "pl" for Polish invoice format hints
}

export interface OcrExtractionField {
  key: string;
  value: string | number | null;
  confidence: number; // 0-100
  boundingBox?: { page: number; x: number; y: number; w: number; h: number };
}

export interface OcrLineItem {
  description: string;
  quantity: number | null;
  unit: string | null;
  unitPriceGrosze: number | null;
  netAmountGrosze: number | null;
  vatRate: string | null;
  vatAmountGrosze: number | null;
  grossAmountGrosze: number | null;
  confidence: number; // average confidence across line item fields
}

export interface OcrExtractionResult {
  status: "EXTRACTED" | "PARTIAL" | "FAILED";
  fields: Record<string, OcrExtractionField>;
  lineItems: OcrLineItem[];
  rawResponse?: unknown;
  processingTimeMs: number;
  pageCount: number;
  overallConfidence: number; // weighted average
}

export interface OcrAdapter {
  extractInvoice(request: OcrExtractionRequest): Promise<OcrExtractionResult>;
  readonly providerName: string;
  readonly supportedDocumentTypes: string[];
}
```

### Pattern 2: Claude PDF Document API (no image conversion needed)
**What:** Send PDF directly to Claude as a document content block
**When to use:** Default OCR extraction path
**Example:**
```typescript
// Source: https://platform.claude.com/docs/en/build-with-claude/pdf-support
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

const response = await anthropic.messages.create({
  model: "claude-sonnet-4-5-20250514",
  max_tokens: 4096,
  messages: [
    {
      role: "user",
      content: [
        {
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: pdfBase64,
          },
        },
        {
          type: "text",
          text: POLISH_INVOICE_EXTRACTION_PROMPT,
        },
      ],
    },
  ],
  tools: [
    {
      name: "extract_invoice_data",
      description: "Extract structured invoice data from the PDF",
      input_schema: invoiceExtractionSchema, // JSON Schema
    },
  ],
  tool_choice: { type: "tool", name: "extract_invoice_data" },
});
```

### Pattern 3: QStash Background Processing
**What:** Async OCR triggered after upload, callback to process endpoint
**When to use:** Every PDF upload that triggers OCR
**Example:**
```typescript
// Source: Existing QStash pattern from packages/integrations/src/services/qstash-client.ts
import { getQStashClient } from "@contractor-ops/integrations/services/qstash-client";

const qstash = getQStashClient();
await qstash.publishJSON({
  url: `${process.env.APP_URL}/api/ocr/_process`,
  body: {
    extractionId: extraction.id,
    organizationId,
    storageKey,
  },
  retries: 2,
  timeout: "60s", // Invoice extraction typically takes 5-15s
});
```

### Pattern 4: NIP Checksum Validation
**What:** Polish tax ID (NIP) format validation using modulo-11 checksum
**When to use:** After OCR extracts sellerTaxId/buyerTaxId fields
**Example:**
```typescript
// Source: Polish NIP standard (weights: 6,5,7,2,3,4,5,6,7 mod 11)
export function validateNip(nip: string): { valid: boolean; formatted: string } {
  const digits = nip.replace(/[\s-]/g, "");
  if (!/^\d{10}$/.test(digits)) {
    return { valid: false, formatted: digits };
  }

  const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7];
  const sum = weights.reduce(
    (acc, w, i) => acc + w * parseInt(digits[i]!, 10),
    0,
  );
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
```

### Pattern 5: Prisma Model for Extraction State
**What:** Track OCR extraction status, results, and provider metadata
**When to use:** Every extraction job needs state persistence
**Example:**
```prisma
model OcrExtraction {
  id               String            @id @default(cuid())
  organizationId   String
  invoiceId        String?
  documentId       String
  provider         OcrProvider       @default(CLAUDE)
  status           OcrExtractionStatus @default(PENDING)
  resultJson       Json?             // Full OcrExtractionResult
  overallConfidence Decimal?         @db.Decimal(5,2)
  pageCount        Int?
  processingTimeMs Int?
  errorMessage     String?
  retryCount       Int               @default(0)
  createdAt        DateTime          @default(now())
  completedAt      DateTime?

  organization     Organization      @relation(fields: [organizationId], references: [id])

  @@index([organizationId])
  @@index([organizationId, documentId])
  @@index([organizationId, status])
}

enum OcrProvider {
  CLAUDE
  GOOGLE_DOCUMENT_AI
  AZURE_FORM_RECOGNIZER
}

enum OcrExtractionStatus {
  PENDING
  PROCESSING
  EXTRACTED
  PARTIAL
  FAILED
}
```

### Anti-Patterns to Avoid
- **Converting PDF to images before sending to Claude:** Claude API natively accepts PDFs as document content blocks. Converting to images loses text layer information and increases token cost.
- **Synchronous OCR in the upload request:** Extraction can take 5-15s. Always use background queue (QStash) and notify when complete.
- **Storing extraction results only in memory:** Persist OcrExtraction model in DB so results survive across requests and can be retried.
- **Hardcoding Claude-specific logic in the router:** All provider-specific logic must be in the adapter; the service layer only knows OcrAdapter interface.
- **Parsing amounts as floating point:** The invoice model uses grosze (integer cents). Parse OCR amounts to grosze immediately to avoid floating-point precision issues.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF rendering in browser | Custom canvas renderer | react-pdf (pdfjs-dist) | Cross-browser PDF rendering with text layer, annotations, zoom; hundreds of edge cases |
| PDF text extraction | Custom PDF parser | Claude native PDF support | Claude extracts text + images internally; no need for pdfjs text extraction on server |
| Background job queue | setTimeout/in-process queue | QStash | Already in stack; handles retries, signature verification, timeouts; survives process restarts |
| NIP checksum | Regex-only validation | Modulo-11 checksum function | Regex validates format but not checksum; invalid NIPs pass format check |
| Structured JSON from LLM | Parse free-text response | tool_use with JSON schema | tool_use forces structured output matching schema; eliminates JSON parse errors |

**Key insight:** Claude's native PDF document support eliminates the entire PDF-to-image conversion pipeline. D-02 mentions "sends PDF pages as images" but the API handles this internally -- the adapter sends the raw PDF and Claude processes it with both text extraction and vision.

## Common Pitfalls

### Pitfall 1: PDF Size Exceeds Claude API Limits
**What goes wrong:** Large invoices (many pages, embedded images) exceed the 32MB request limit or 600-page limit.
**Why it happens:** Polish invoices with extensive line items or attached specifications can be large.
**How to avoid:** Check file size before sending to Claude. For oversized PDFs, extract only the first few pages (invoices typically have header data on page 1). Set a reasonable page limit (e.g., 10 pages) in the adapter.
**Warning signs:** 413 or 400 errors from Claude API.

### Pitfall 2: Grosze/Currency Conversion Errors
**What goes wrong:** OCR extracts "1,234.56 PLN" but the form expects grosze (integer 123456).
**Why it happens:** Polish invoices use comma as decimal separator. Claude may return amounts in various formats.
**How to avoid:** Normalize amounts in the adapter response -- parse locale-aware decimal strings, multiply by 100, round to integer. Include explicit currency detection in the prompt.
**Warning signs:** Amounts off by factor of 100, or NaN values in pre-filled fields.

### Pitfall 3: react-pdf Worker Configuration in Next.js
**What goes wrong:** PDF rendering fails with "Cannot find module pdfjs-dist/build/pdf.worker" errors.
**Why it happens:** react-pdf requires a Web Worker for PDF.js; Next.js bundler needs explicit worker configuration.
**How to avoid:** Configure the worker source explicitly. react-pdf v10+ requires setting `pdfjs.GlobalWorkerOptions.workerSrc` to a CDN URL or local copy of the worker file.
**Warning signs:** Blank PDF viewer, console errors about workers.

### Pitfall 4: Race Condition Between Upload and OCR Trigger
**What goes wrong:** OCR job starts before the PDF upload to R2 is confirmed/complete.
**Why it happens:** QStash job dispatched too early in the upload flow.
**How to avoid:** Only dispatch OCR job AFTER the document record is created and upload is confirmed (R2 HEAD check or upload callback). The portal form already has `status: "uploaded"` state -- trigger OCR from this state transition.
**Warning signs:** OCR fails with "object not found" or empty PDF.

### Pitfall 5: Confidence Score Inconsistency
**What goes wrong:** Confidence scores from Claude are unreliable or inconsistent across extractions.
**Why it happens:** LLMs don't have true calibrated confidence; self-reported confidence can be overconfident.
**How to avoid:** Use heuristic post-processing: cross-validate extracted fields (e.g., net + tax = gross), validate NIP checksums, check date formats. Adjust confidence down for fields that fail validation. Don't rely solely on Claude's self-reported confidence.
**Warning signs:** All fields showing 95%+ confidence even when values are clearly wrong.

### Pitfall 6: QStash Callback URL in Development
**What goes wrong:** QStash cannot reach localhost for the callback URL.
**Why it happens:** QStash is a cloud service that needs a public URL.
**How to avoid:** Use QStash's built-in development mode or a tunneling solution (ngrok/cloudflared) during development. For testing, provide a mock/bypass mode that processes OCR synchronously.
**Warning signs:** OCR jobs stuck in PENDING state; QStash delivery failures.

## Code Examples

### Claude Invoice Extraction Prompt (Polish)
```typescript
// Source: Domain knowledge for Polish invoice (faktura VAT) extraction
export const POLISH_INVOICE_EXTRACTION_PROMPT = `You are an invoice data extraction system specializing in Polish invoices (faktura VAT).

Extract all fields from this invoice PDF. For each field, provide a confidence score from 0 to 100 indicating how certain you are about the extracted value.

Key Polish invoice conventions:
- NIP (Numer Identyfikacji Podatkowej): 10-digit tax identification number, may include dashes (e.g., 123-456-78-90)
- Amounts use comma as decimal separator (e.g., "1 234,56 zł")
- Currency is typically PLN (złoty) unless stated otherwise
- VAT rates: 23%, 8%, 5%, 0%, "zw." (exempt), "np." (not applicable)
- "Faktura VAT" = VAT invoice, "Faktura proforma" = proforma
- "Netto" = net amount, "Brutto" = gross amount, "VAT" = tax amount
- "Data wystawienia" = issue date, "Termin płatności" = due date
- "Nr faktury" = invoice number
- "Sprzedawca" = seller, "Nabywca" = buyer

Return all monetary amounts in their original currency as decimal numbers (e.g., 1234.56, not "1 234,56 zł").
Return dates in ISO 8601 format (YYYY-MM-DD).
Strip dashes and spaces from NIP numbers (return 10 consecutive digits).

Use the extract_invoice_data tool to return your results.`;
```

### Tool Schema for Structured Extraction
```typescript
// Source: Anthropic tool_use pattern for guaranteed JSON structure
export const INVOICE_EXTRACTION_TOOL_SCHEMA = {
  name: "extract_invoice_data",
  description: "Extract structured invoice data from a Polish invoice PDF",
  input_schema: {
    type: "object" as const,
    properties: {
      invoiceNumber: {
        type: "object",
        properties: {
          value: { type: "string" },
          confidence: { type: "number", minimum: 0, maximum: 100 },
        },
        required: ["value", "confidence"],
      },
      issueDate: {
        type: "object",
        properties: {
          value: { type: "string", description: "ISO 8601 date" },
          confidence: { type: "number", minimum: 0, maximum: 100 },
        },
        required: ["value", "confidence"],
      },
      dueDate: {
        type: "object",
        properties: {
          value: { type: ["string", "null"], description: "ISO 8601 date" },
          confidence: { type: "number", minimum: 0, maximum: 100 },
        },
        required: ["value", "confidence"],
      },
      sellerNip: {
        type: "object",
        properties: {
          value: { type: ["string", "null"], description: "10 digits, no dashes" },
          confidence: { type: "number", minimum: 0, maximum: 100 },
        },
        required: ["value", "confidence"],
      },
      buyerNip: {
        type: "object",
        properties: {
          value: { type: ["string", "null"], description: "10 digits, no dashes" },
          confidence: { type: "number", minimum: 0, maximum: 100 },
        },
        required: ["value", "confidence"],
      },
      sellerName: {
        type: "object",
        properties: {
          value: { type: ["string", "null"] },
          confidence: { type: "number", minimum: 0, maximum: 100 },
        },
        required: ["value", "confidence"],
      },
      buyerName: {
        type: "object",
        properties: {
          value: { type: ["string", "null"] },
          confidence: { type: "number", minimum: 0, maximum: 100 },
        },
        required: ["value", "confidence"],
      },
      currency: {
        type: "object",
        properties: {
          value: { type: "string", description: "3-letter ISO currency code" },
          confidence: { type: "number", minimum: 0, maximum: 100 },
        },
        required: ["value", "confidence"],
      },
      totalNet: {
        type: "object",
        properties: {
          value: { type: "number", description: "Net total as decimal" },
          confidence: { type: "number", minimum: 0, maximum: 100 },
        },
        required: ["value", "confidence"],
      },
      totalTax: {
        type: "object",
        properties: {
          value: { type: "number", description: "Tax total as decimal" },
          confidence: { type: "number", minimum: 0, maximum: 100 },
        },
        required: ["value", "confidence"],
      },
      totalGross: {
        type: "object",
        properties: {
          value: { type: "number", description: "Gross total as decimal" },
          confidence: { type: "number", minimum: 0, maximum: 100 },
        },
        required: ["value", "confidence"],
      },
      bankAccount: {
        type: "object",
        properties: {
          value: { type: ["string", "null"], description: "Bank account number" },
          confidence: { type: "number", minimum: 0, maximum: 100 },
        },
        required: ["value", "confidence"],
      },
      lineItems: {
        type: "array",
        items: {
          type: "object",
          properties: {
            description: { type: "string" },
            quantity: { type: ["number", "null"] },
            unit: { type: ["string", "null"] },
            unitPrice: { type: ["number", "null"], description: "Decimal amount" },
            netAmount: { type: ["number", "null"], description: "Decimal amount" },
            vatRate: { type: ["string", "null"] },
            vatAmount: { type: ["number", "null"], description: "Decimal amount" },
            grossAmount: { type: ["number", "null"], description: "Decimal amount" },
            confidence: { type: "number", minimum: 0, maximum: 100 },
          },
          required: ["description", "confidence"],
        },
      },
    },
    required: [
      "invoiceNumber", "issueDate", "totalNet", "totalGross",
      "currency", "lineItems",
    ],
  },
};
```

### react-pdf Setup in Next.js
```typescript
// Source: react-pdf v10 documentation + Next.js integration
"use client";

import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";

// Configure worker (must be set before any Document renders)
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

interface PdfViewerProps {
  url: string; // R2 presigned download URL
}

export function PdfViewer({ url }: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState(1);

  return (
    <Document
      file={url}
      onLoadSuccess={({ numPages }) => setNumPages(numPages)}
    >
      <Page pageNumber={pageNumber} width={500} />
    </Document>
  );
}
```

### Confidence Post-Processing
```typescript
// Source: Domain logic for confidence adjustment
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
        if (fields[key]) {
          fields[key] = { ...fields[key]!, confidence: Math.min(fields[key]!.confidence, 60) };
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
        fields[key] = { ...nipField, confidence: Math.min(nipField.confidence, 40) };
      }
    }
  }

  return { ...result, fields };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| PDF-to-image conversion for LLM OCR | Native PDF document type in Claude API | 2024 | Eliminates pdf-to-img dependency; preserves text layer; lower token cost |
| Free-text JSON response parsing | tool_use with JSON schema constraint | 2024 | Guaranteed valid JSON structure; no parse errors |
| Structured Outputs beta header | tool_use (GA) | Already GA | tool_use is production-ready; structured outputs beta is optional enhancement |
| Tesseract/traditional OCR | LLM-based vision extraction | 2024 | Better accuracy on varied layouts; understands context; extracts semantics not just text |
| pdfjs-dist direct usage | react-pdf v10 wrapper | 2025 | Cleaner React integration; handles worker setup; annotation/text layers |

**Deprecated/outdated:**
- `react-pdf` v7 and below: Use v10+ which supports React 19 and modern pdfjs-dist
- `@react-pdf-viewer/core`: Last published 3 years ago; effectively abandoned
- Traditional OCR engines (Tesseract) for structured extraction: LLM-based approach is superior for varied invoice layouts

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^4.1.0 |
| Config file | `packages/integrations/vitest.config.ts`, `packages/api/vitest.config.ts` |
| Quick run command | `pnpm --filter @contractor-ops/integrations test` |
| Full suite command | `pnpm --filter @contractor-ops/integrations test && pnpm --filter @contractor-ops/api test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| OCR-01 | Claude adapter extracts fields from PDF base64 | unit (mocked SDK) | `pnpm --filter @contractor-ops/integrations vitest run src/adapters/__tests__/claude-ocr-adapter.test.ts -x` | Wave 0 |
| OCR-01 | OCR service orchestrates extraction flow | unit | `pnpm --filter @contractor-ops/api vitest run src/services/__tests__/ocr-extraction.test.ts -x` | Wave 0 |
| OCR-01 | NIP validation checksum logic | unit | `pnpm --filter @contractor-ops/validators vitest run src/__tests__/nip.test.ts -x` | Wave 0 |
| OCR-02 | Confidence adjustment post-processing | unit | `pnpm --filter @contractor-ops/integrations vitest run src/adapters/__tests__/claude-ocr-adapter.test.ts -x` | Wave 0 |
| OCR-03 | OCR tRPC endpoints return extraction data | unit | `pnpm --filter @contractor-ops/api vitest run src/routers/__tests__/ocr.test.ts -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm --filter @contractor-ops/integrations test && pnpm --filter @contractor-ops/api test`
- **Per wave merge:** Full suite (integrations + api packages)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/integrations/src/adapters/__tests__/claude-ocr-adapter.test.ts` -- covers OCR-01, OCR-02
- [ ] `packages/api/src/services/__tests__/ocr-extraction.test.ts` -- covers OCR-01
- [ ] `packages/api/src/routers/__tests__/ocr.test.ts` -- covers OCR-03
- [ ] NIP validation utility test (location TBD -- validators package or inline)

## Open Questions

1. **Claude Model Selection for OCR**
   - What we know: Claude Sonnet 4.5 offers best cost/performance ratio. Opus 4.1 has higher accuracy but 5x cost.
   - What's unclear: Whether Sonnet is sufficient accuracy for Polish invoice extraction or if Opus is needed.
   - Recommendation: Default to `claude-sonnet-4-5-20250514` with configurable model in adapter. Test with real Polish invoices during development.

2. **QStash Timeout for Large PDFs**
   - What we know: QStash default timeout is 30s. Claude PDF processing typically takes 5-15s.
   - What's unclear: Whether multi-page invoices with complex tables could exceed 30s.
   - Recommendation: Set QStash timeout to 60s. If extraction frequently times out, add retry with longer timeout.

3. **react-pdf Worker in Next.js App Router**
   - What we know: react-pdf v10 requires pdfjs-dist worker. Next.js App Router has specific bundling behavior.
   - What's unclear: Whether `import.meta.url` worker resolution works correctly in Next.js production builds.
   - Recommendation: Test worker setup in production build early. Fallback option: load worker from CDN (`unpkg.com/pdfjs-dist@{version}/build/pdf.worker.min.mjs`).

## Sources

### Primary (HIGH confidence)
- [Anthropic PDF Support Docs](https://platform.claude.com/docs/en/build-with-claude/pdf-support) -- Native PDF document type, base64 encoding, limits (32MB, 600 pages), TypeScript SDK examples
- [Anthropic Structured Outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) -- tool_use for JSON schema compliance
- Existing codebase: `packages/integrations/src/types/esign.ts` -- Adapter pattern reference
- Existing codebase: `packages/integrations/src/services/qstash-client.ts` -- QStash singleton pattern
- Existing codebase: `apps/web/src/app/api/webhooks/_process/route.ts` -- QStash callback with signature verification

### Secondary (MEDIUM confidence)
- [react-pdf npm](https://www.npmjs.com/package/react-pdf) -- v10.4.1 confirmed, React 19 support
- [react-pdf GitHub](https://github.com/wojtekmaj/react-pdf) -- Worker configuration documentation
- [NIP Validation Algorithm](https://poland.gg/tools/nip-checker) -- Weights 6,5,7,2,3,4,5,6,7 mod 11

### Tertiary (LOW confidence)
- Claude model pricing/performance comparison for OCR specifically -- needs real-world testing with Polish invoices

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- Claude native PDF support verified via official docs; react-pdf actively maintained; QStash already in codebase
- Architecture: HIGH -- Adapter pattern proven in Phase 12/15; QStash background processing established; Prisma patterns well-understood
- Pitfalls: MEDIUM -- Worker configuration in Next.js and confidence calibration need validation during implementation

**Research date:** 2026-03-27
**Valid until:** 2026-04-27 (stable domain, all libraries actively maintained)
