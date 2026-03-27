# Phase 16: OCR Invoice Parsing - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Uploaded invoice PDFs are automatically parsed to extract structured data (fields + line items), reducing manual data entry. Users review OCR results with confidence scores before accepting. Applies to both admin and portal invoice uploads.

</domain>

<decisions>
## Implementation Decisions

### OCR Provider Strategy
- **D-01:** Provider-agnostic abstraction layer (same adapter pattern as e-sign) with Claude Vision API as the default provider. Interface supports swapping to Google Document AI or Azure Form Recognizer later without UI changes.
- **D-02:** Claude Vision sends PDF pages as images, receives structured JSON extraction response. Prompt engineering for Polish invoice format understanding.

### Parsing Trigger & Flow
- **D-03:** Background queue processing — upload completes instantly, OCR runs asynchronously. User gets notified when extraction is ready. Better for large volumes and doesn't block the upload UX.
- **D-04:** Pre-fill form — extracted fields auto-populate the invoice creation/edit form. User reviews and edits before saving. No separate review step; the form IS the review.
- **D-05:** Both portal + admin — contractors uploading invoices via portal get auto-extraction too. Pre-fills their submit form. Reduces contractor errors and admin corrections.

### Review & Correction UX
- **D-06:** Split panel in invoice form — PDF preview on the left, pre-filled form fields on the right. Confidence badges on each field. Low-confidence fields highlighted. User edits inline and saves normally.
- **D-07:** Color-coded field borders for confidence — green border = high confidence (>90%), amber = medium (70-90%), red = low (<70%). Tooltip shows exact percentage. Low-confidence fields get a warning icon.

### Field Extraction Scope
- **D-08:** Full extraction — invoice number, issue date, due date, NIP (seller + buyer), total net, total gross, tax amount, currency, bank account, line items (description, quantity, unit price, net, tax rate, gross). Covers everything in the Invoice model.
- **D-09:** NIP format validation only — check 10 digits + checksum algorithm. Flag invalid NIPs in the review. No external registry lookup (GUS/VIES deferred).

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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Invoice Model & Intake
- `packages/db/prisma/schema/invoice.prisma` — Invoice model with all target fields (invoiceNumber, issueDate, dueDate, totalGross, totalNet, taxAmount, currency, etc.) and InvoiceLineItem model
- `packages/api/src/routers/invoice.ts` — Invoice CRUD router, existing create/update patterns
- `apps/web/src/components/portal/invoice-submit-form.tsx` — Portal invoice upload form with react-dropzone + R2 presigned URLs

### Integration Infrastructure (Phase 12)
- `packages/integrations/src/types/esign.ts` — ESignAdapter interface pattern (reference for OCR adapter design)
- `packages/integrations/src/services/esign-service.ts` — Provider-agnostic service pattern (reference for OCR service)
- `packages/api/src/services/r2.ts` — R2 presigned URL pattern for file access

### Admin Invoice Page
- `apps/web/src/app/[locale]/(dashboard)/invoices/page.tsx` — Admin invoice list page
- `apps/web/src/components/invoices/` — Existing invoice UI components

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `InvoiceSource` enum — add OCR/AUTO source for tracking extraction origin
- R2 presigned URLs — already handle PDF upload/download, reuse for OCR input
- react-dropzone in portal form — upload flow already established
- Phase 12 adapter pattern — proven abstraction for external service integrations
- Notification system (Phase 7) — can notify user when OCR completes

### Established Patterns
- Provider adapter registration via `registerAllAdapters()` pattern
- tRPC routers with tenant-scoped procedures
- Zod schema validation on all inputs
- Toast notifications via sonner for success/error feedback
- Form components use react-hook-form + zodResolver

### Integration Points
- Invoice create/update endpoints — OCR results pre-fill form data sent to these
- Portal invoice submit form — add PDF preview + OCR pre-fill
- Admin invoice creation page — add split panel with PDF viewer
- R2 storage — read uploaded PDFs for OCR processing
- Background processing — trigger after R2 upload completes

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches for the OCR adapter and PDF viewer.

</specifics>

<deferred>
## Deferred Ideas

- NIP validation against GUS/VIES registry — future enhancement, format-only validation for now
- Duplicate invoice detection based on OCR fields — could be a separate phase or backlog item
- Training/fine-tuning OCR model on org-specific invoice formats — future optimization

</deferred>

---

*Phase: 16-ocr-invoice-parsing*
*Context gathered: 2026-03-27*
