---
phase: 16-ocr-invoice-parsing
verified: 2026-03-27T00:00:00Z
status: human_needed
score: 12/12 must-haves verified
human_verification:
  - test: "Admin invoice upload OCR flow"
    expected: "Upload a PDF invoice in the admin invoice creation form, see OcrProcessingOverlay appear, then see form fields pre-fill with extracted data and confidence badges; toggle View PDF to see split panel with PDF on left"
    why_human: "Visual rendering, PDF viewer, overlay animation, and cascade pre-fill stagger require browser execution"
  - test: "Portal invoice submit OCR flow"
    expected: "Log in as contractor, go to submit invoice, upload a PDF invoice, see extraction status bar appear, form fields pre-fill with confidence badges inline, and the 'We've pre-filled some fields' banner display"
    why_human: "Portal-specific OAuth session context, form pre-fill behavior, and confidence badge rendering require browser execution"
  - test: "Error / PARTIAL extraction handling"
    expected: "Upload a non-invoice PDF (blank page or unrelated document), see ExtractionStatusBar show PARTIAL or FAILED, error message is helpful, and form remains editable for manual entry"
    why_human: "Requires live Anthropic API call and real OCR response to test partial/failure paths"
  - test: "Re-run OCR and discard extraction actions"
    expected: "In admin review panel, click 'Re-run OCR' and confirm dialog — extraction restarts. Click 'Discard Extraction' and confirm — panel closes and form resets to empty"
    why_human: "Requires interactive dialog flows and state transitions across full UI"
  - test: "NIP confidence adjustment visible in UI"
    expected: "An invoice with an invalid NIP should show the NipValidationBadge as destructive and the field confidence badge as red (low), reflecting the confidence cap of 40"
    why_human: "Requires a real extracted result with an invalid NIP to flow through the confidence adjustment pipeline to UI"
---

# Phase 16: OCR Invoice Parsing — Verification Report

**Phase Goal:** Uploaded invoice PDFs are automatically parsed so users spend less time on manual data entry
**Verified:** 2026-03-27
**Status:** human_needed — all automated checks passed; 5 items require browser/live-API verification
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Uploaded PDF can be sent to Claude Vision and structured invoice data is returned | VERIFIED | `ClaudeOcrAdapter.extractInvoice` uses `type: "document"`, `media_type: "application/pdf"` with `tool_use`; `extract_invoice_data` tool returns structured fields |
| 2 | Extraction results are persisted in the database with status tracking | VERIFIED | `processOcrExtraction` updates `OcrExtraction` record from PENDING → PROCESSING → EXTRACTED/PARTIAL/FAILED with `resultJson`, `overallConfidence`, `pageCount`, `processingTimeMs`, `completedAt` |
| 3 | OCR runs asynchronously via QStash without blocking the upload | VERIFIED | `triggerOcrExtraction` creates PENDING record then calls `qstash.publishJSON` to `/api/ocr/_process`; `verifySignatureAppRouter` wraps the callback handler |
| 4 | Each extracted field has a confidence score | VERIFIED | `OcrExtractionField.confidence: number` (0-100); all scalar and amount fields carry confidence; line items carry per-row confidence |
| 5 | NIP values are checksum-validated and confidence is adjusted accordingly | VERIFIED | `validateNip` uses weights `[6,5,7,2,3,4,5,6,7]` mod-11; `adjustConfidences` caps NIP field confidence to 40 on invalid checksum |
| 6 | PDF viewer renders uploaded invoice pages with navigation and zoom controls | VERIFIED | `PdfViewer` uses `react-pdf` (^10.4.1), `pdfjs.GlobalWorkerOptions.workerSrc` configured, prev/next page buttons with bounds check, zoom +/- 0.25 (min 0.5 / max 2.0), "Fit width" reset |
| 7 | Confidence badges show color-coded indicators (green >90%, amber 70-90%, red <70%) | VERIFIED | `getConfidenceConfig` maps >90 → success+CheckCircle2, 70-89 → warning+AlertTriangle, <70 → destructive+AlertCircle with tooltip copy |
| 8 | Form fields display colored borders based on confidence level | VERIFIED | `ConfidenceFieldWrapper` applies `border-l-2` with `border-l-green-600`, `border-l-amber-500`, or `border-l-destructive`; 150ms transition |
| 9 | NIP fields show valid/invalid format badge | VERIFIED | `NipValidationBadge` inlines same modulo-11 algorithm; renders success badge "Valid NIP format" or destructive badge "Invalid NIP format" with tooltip |
| 10 | Extraction status bar reflects processing/complete/partial/failed states | VERIFIED | `ExtractionStatusBar` handles PENDING (null), PROCESSING (spinner + copy), EXTRACTED, PARTIAL, FAILED (with re-run button) |
| 11 | Uploading a PDF in admin invoice creation triggers OCR automatically | VERIFIED | `invoice-upload-area.tsx` calls `trpc.ocr.trigger.mutationOptions({})` after upload; stores `extractionId` in state; renders `OcrReviewPanel` when extractionId + pdfUrl set |
| 12 | Uploading a PDF in portal invoice submission triggers OCR and pre-fills form | VERIFIED | `invoice-submit-form.tsx` calls `trpc.ocr.portalTrigger.mutationOptions({})`; polls via `portalGetResult` with `refetchInterval`; uses `form.setValue()` to pre-fill 7 fields; shows `ExtractionStatusBar` and `ConfidenceBadge` inline |

**Score:** 12/12 truths verified

---

## Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `packages/db/prisma/schema/ocr.prisma` | VERIFIED | `OcrExtraction` model with all 14 fields; `OcrProvider` enum (CLAUDE, GOOGLE_DOCUMENT_AI, AZURE_FORM_RECOGNIZER); `OcrExtractionStatus` enum (PENDING, PROCESSING, EXTRACTED, PARTIAL, FAILED); 3 indexes; Organization relation |
| `packages/integrations/src/types/ocr.ts` | VERIFIED | Exports `OcrAdapter`, `OcrExtractionRequest`, `OcrExtractionResult`, `OcrExtractionField`, `OcrLineItem`, `validateNip`, `adjustConfidences` |
| `packages/integrations/src/adapters/claude-ocr-adapter.ts` | VERIFIED | `ClaudeOcrAdapter` implements `OcrAdapter`; native PDF `type: "document"`; `tool_use` with `extract_invoice_data`; grosze normalization; 30MB size guard |
| `packages/integrations/src/services/ocr-service.ts` | VERIFIED | Exports `getOcrAdapter`, `extractInvoice`; resolves adapter from registry; delegates to `adapter.extractInvoice` |
| `packages/api/src/services/ocr-extraction.ts` | VERIFIED | Exports `triggerOcrExtraction` (QStash dispatch), `processOcrExtraction` (R2 fetch → adapter → DB persist), `getExtractionResult`, `getExtractionByDocument` |
| `packages/api/src/routers/ocr.ts` | VERIFIED | `ocrRouter` exports admin endpoints: `trigger`, `getResult`, `getByDocument`, `retrigger`; portal endpoints: `portalTrigger`, `portalGetResult`, `portalGetByDocument` |
| `apps/web/src/app/api/ocr/_process/route.ts` | VERIFIED | `verifySignatureAppRouter` wrapper; calls `processOcrExtraction`; returns 500 on error for QStash retry |
| `apps/web/src/components/ocr/pdf-viewer.tsx` | VERIFIED | `PdfViewer` with `react-pdf`, worker config, page nav, zoom |
| `apps/web/src/components/ocr/confidence-badge.tsx` | VERIFIED | `ConfidenceBadge` with 3-tier color logic and tooltip |
| `apps/web/src/components/ocr/confidence-field-wrapper.tsx` | VERIFIED | `ConfidenceFieldWrapper` imports `ConfidenceBadge`; applies colored left border |
| `apps/web/src/components/ocr/nip-validation-badge.tsx` | VERIFIED | `NipValidationBadge` with inline modulo-11; valid/invalid badge states |
| `apps/web/src/components/ocr/extraction-status-bar.tsx` | VERIFIED | `ExtractionStatusBar` handles all 5 states with correct copy |
| `apps/web/src/components/ocr/ocr-processing-overlay.tsx` | VERIFIED | `OcrProcessingOverlay` with spinner, optional `Progress`, 8 skeleton rows |
| `apps/web/src/components/ocr/line-items-table.tsx` | VERIFIED | `LineItemsTable` imports `ConfidenceBadge`; grosze formatting; inline editing; add/remove rows |
| `apps/web/src/components/ocr/ocr-review-panel.tsx` | VERIFIED | `OcrReviewPanel` polls `ocr.getResult` / `ocr.portalGetResult` with `refetchInterval`; renders `PdfViewer` + `ConfidenceFieldWrapper` + `LineItemsTable`; accept/discard/retrigger actions |
| `apps/web/src/components/invoices/invoice-upload-area.tsx` | VERIFIED | Calls `trpc.ocr.trigger`; stores `extractionId`; renders `OcrReviewPanel` with toggle |
| `apps/web/src/components/portal/invoice-submit-form.tsx` | VERIFIED | Calls `trpc.ocr.portalTrigger`; polls `portalGetResult`; uses `form.setValue`; renders `ExtractionStatusBar` and `ConfidenceBadge` inline |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `apps/web/src/app/api/ocr/_process/route.ts` | `packages/api/src/services/ocr-extraction.ts` | `processOcrExtraction` call | WIRED | Direct import and call at line 45 |
| `packages/api/src/services/ocr-extraction.ts` | `packages/integrations/src/services/ocr-service.ts` | `extractInvoice` call | WIRED | Imported from `@contractor-ops/integrations/services/ocr-service`; called at line 84 |
| `packages/integrations/src/services/ocr-service.ts` | `packages/integrations/src/adapters/claude-ocr-adapter.ts` | `adapter.extractInvoice` | WIRED | `getOcrAdapter` resolves from registry; registry has `ClaudeOcrAdapter` registered in `register-all.ts` |
| `apps/web/src/components/ocr/ocr-review-panel.tsx` | `packages/api/src/routers/ocr.ts` | `trpc.ocr.getResult` / `trpc.ocr.portalGetResult` with `refetchInterval` polling | WIRED | Both query options with `refetchInterval` returning 2000ms while PENDING/PROCESSING |
| `apps/web/src/components/invoices/invoice-upload-area.tsx` | `packages/api/src/routers/ocr.ts` | `trpc.ocr.trigger` useMutation | WIRED | `trpc.ocr.trigger.mutationOptions({})` + `trpc.ocr.retrigger.mutationOptions({})` both present |
| `apps/web/src/components/portal/invoice-submit-form.tsx` | `packages/api/src/routers/ocr.ts` | `trpc.ocr.portalTrigger` useMutation | WIRED | `trpc.ocr.portalTrigger.mutationOptions({})` + `trpc.ocr.portalGetResult.queryOptions` both present |
| `apps/web/src/components/ocr/confidence-field-wrapper.tsx` | `apps/web/src/components/ocr/confidence-badge.tsx` | import `ConfidenceBadge` | WIRED | Direct import at line 5; rendered in label row |
| `apps/web/src/components/ocr/line-items-table.tsx` | `apps/web/src/components/ocr/confidence-badge.tsx` | import `ConfidenceBadge` for per-row confidence | WIRED | Direct import at line 18; rendered per row |

---

## Requirements Coverage

| Requirement | Plans | Description | Status | Evidence |
|-------------|-------|-------------|--------|----------|
| OCR-01 | 16-01, 16-03 | System auto-extracts fields (NIP, invoice number, date, amount, line items) from uploaded PDF | SATISFIED | `ClaudeOcrAdapter` extracts all named fields via tool_use; admin upload area and portal form trigger extraction automatically after PDF upload |
| OCR-02 | 16-01, 16-02 | Extracted fields display confidence scores per field | SATISFIED | `OcrExtractionField.confidence` on every field; `ConfidenceBadge` and `ConfidenceFieldWrapper` render per-field confidence in UI with color coding |
| OCR-03 | 16-02, 16-03 | User can review OCR results in side-by-side view (PDF + extracted fields with edit-in-place) | SATISFIED | `OcrReviewPanel` renders CSS grid `grid-cols-1 md:grid-cols-2` with sticky `PdfViewer` left and editable form right; `LineItemsTable` supports inline editing |

All 3 requirement IDs declared in plan frontmatter are accounted for. No orphaned requirements found in REQUIREMENTS.md for Phase 16.

---

## Anti-Patterns Found

| File | Pattern | Severity | Assessment |
|------|---------|----------|------------|
| `claude-ocr-adapter.ts` line 407-411 | `status` type annotation includes `"FAILED"` but `parseExtractionResponse` branch only produces `EXTRACTED` or `PARTIAL` | Info | Not a bug — FAILED is correctly returned only on early-exit paths (size check, no tool_use block, thrown exception); the `PARTIAL` < 0.5 threshold matches spec |
| `nip-validation-badge.tsx` | Inlines NIP validation rather than importing from `@contractor-ops/integrations/types/ocr` | Info | Deliberate decision documented in 16-02-SUMMARY.md; identical algorithm; acceptable duplication until a future consolidation refactor |

No blockers. No stubs.

---

## Commit Verification

All 7 feature commits verified in git history:

| Commit | Description |
|--------|-------------|
| `2ebd852` | feat(16-01): OCR types, Prisma schema, Claude adapter, and OCR service |
| `3dff7a9` | feat(16-01): OCR extraction orchestrator, tRPC router, and QStash callback |
| `bf7904b` | feat(16-02): add PDF viewer and confidence UI components |
| `6d2c160` | feat(16-02): add extraction status bar, processing overlay, and line items table |
| `b75c817` | feat(16-03): OcrReviewPanel split view and admin upload OCR integration |
| `5710cb2` | feat(16-03): portal invoice form OCR integration with pre-fill |
| `1ab93c5` | refactor(16-03): replace mirrored OCR types with package imports |

---

## Human Verification Required

### 1. Admin Invoice Upload OCR Flow

**Test:** Navigate to admin invoice creation page. Upload a real PDF invoice.
**Expected:** OcrProcessingOverlay appears over the form while QStash processes; once extraction completes, form fields pre-fill top-to-bottom with 50ms stagger; confidence badges appear on each field (green/amber/red); toggle "View PDF" shows split panel with PdfViewer on left and annotated form on right; "Accept and Save" passes extracted data to parent form.
**Why human:** Visual rendering, PDF worker initialisation, overlay animation, cascade field stagger, and the QStash round-trip all require a live browser environment with ANTHROPIC_API_KEY and QSTASH_* env vars set.

### 2. Portal Invoice Submit OCR Flow

**Test:** Log in as a contractor via the portal. Navigate to submit invoice. Upload a PDF invoice.
**Expected:** ExtractionStatusBar appears above the form showing PROCESSING then EXTRACTED/PARTIAL; form fields pre-fill via `form.setValue`; inline ConfidenceBadge appears next to each pre-filled field; "We've pre-filled some fields from your invoice. Please review before submitting." banner is visible; form can still be submitted normally.
**Why human:** Portal OAuth session, form pre-fill triggering validation, and inline confidence indicator placement require browser execution.

### 3. Error / PARTIAL Extraction Handling

**Test:** Upload a non-invoice PDF (blank page, image-only scan with no text, or a contract document).
**Expected:** ExtractionStatusBar shows PARTIAL or FAILED state; error message is legible and actionable; form fields remain editable for manual entry; "Re-run OCR" button is present and functional.
**Why human:** Requires a live Anthropic API call returning a genuinely low-confidence or failed extraction to exercise these UI paths.

### 4. Re-run OCR and Discard Actions

**Test:** In the admin OcrReviewPanel after extraction, click "Re-run OCR". Confirm the dialog ("Re-running OCR will replace the current extracted data. Continue?"). Separately, click "Discard Extraction" and confirm.
**Expected:** Re-run calls `trpc.ocr.retrigger`, replaces extractionId, and shows overlay while re-processing. Discard calls `onDiscard`, closes the review panel, and clears form state.
**Why human:** Requires interactive AlertDialog confirmation flows and live state transitions.

### 5. NIP Confidence Adjustment in UI

**Test:** Use a PDF invoice containing an invalid NIP (e.g., NIP with wrong check digit). Observe both the NipValidationBadge and the ConfidenceFieldWrapper on the seller/buyer NIP fields.
**Expected:** NipValidationBadge shows "Invalid NIP format" (destructive badge). The ConfidenceFieldWrapper shows a red (low confidence) left border, reflecting the 40-cap applied by `adjustConfidences` in the backend.
**Why human:** Requires a specific test PDF with known-invalid NIPs flowing through the live Anthropic extraction pipeline.

---

## Overall Assessment

The phase goal is structurally achieved. Every backend artifact, UI component, and integration wire has been built and connected as specified. The complete extraction pipeline from QStash dispatch through R2 PDF fetch, Claude Vision extraction, DB persistence, tRPC polling, to UI pre-fill with confidence annotations is fully implemented. Requirements OCR-01, OCR-02, and OCR-03 are all satisfied.

The `human_needed` status reflects 5 items that require a running browser with live API keys — normal for a feature of this nature involving external AI calls, PDF rendering, and multi-step UI flows.

---

_Verified: 2026-03-27_
_Verifier: Claude (gsd-verifier)_
