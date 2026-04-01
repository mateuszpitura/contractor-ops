# Phase 16: OCR Invoice Parsing - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-27
**Phase:** 16-ocr-invoice-parsing
**Areas discussed:** OCR provider strategy, Parsing trigger & flow, Review & correction UX, Field extraction scope

---

## OCR Provider Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Claude Vision API | Send PDF pages as images to Claude vision model. No new vendor. | |
| Google Document AI | Pre-trained invoice parser, GCP account required. | |
| Azure Form Recognizer | Microsoft's pre-built invoice model. Azure required. | |
| Provider-agnostic with Claude default | Abstraction layer, default to Claude, swap later. | ✓ |

**User's choice:** Provider-agnostic with Claude default
**Notes:** None

---

## Parsing Trigger & Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Auto on upload | Parsing starts immediately on PDF upload. | |
| Background queue | Upload completes instantly, parsing runs async. | ✓ |
| On-demand button | User explicitly clicks to trigger parsing. | |

**User's choice:** Background queue
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Pre-fill form | Extracted fields auto-populate the invoice form. | ✓ |
| Separate review step | Dedicated review page before form population. | |
| Review then create | Draft invoice with extracted data, review IS creation. | |

**User's choice:** Pre-fill form
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Both portal + admin | Contractors and admins both get OCR. | ✓ |
| Admin-side only | OCR only for admin uploads. | |
| Portal with admin review | Portal gets OCR but admin reviews before finalizing. | |

**User's choice:** Both portal + admin
**Notes:** None

---

## Review & Correction UX

| Option | Description | Selected |
|--------|-------------|----------|
| Split panel in invoice form | PDF left, pre-filled form right. Confidence badges on fields. | ✓ |
| Dedicated review page | Full-page side-by-side separate from form. | |
| Overlay/modal review | Full-screen modal with PDF + fields. | |

**User's choice:** Split panel in invoice form
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Color-coded field borders | Green >90%, amber 70-90%, red <70%. Tooltip shows %. | ✓ |
| Inline badges per field | Small badge showing "95%" next to each field. | |
| Summary bar + highlights | Top bar with overall quality, only low fields highlighted. | |

**User's choice:** Color-coded field borders
**Notes:** None

---

## Field Extraction Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Full extraction | All fields + line items + bank account. | ✓ |
| Core fields only | Number, dates, amounts, NIP, currency. No line items. | |
| Core + line items | Core fields plus line items. No bank account. | |

**User's choice:** Full extraction
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Validate format only | 10-digit checksum check for NIP. | ✓ |
| Validate against GUS/VIES | External registry lookup. | |
| No validation | Extract NIP as-is. | |

**User's choice:** Validate format only
**Notes:** None

---

## Claude's Discretion

- OCR adapter interface shape
- Claude Vision prompt engineering
- Background queue implementation
- PDF-to-image conversion
- Multi-page handling
- Confidence score methodology
- PDF viewer component choice
- Error/retry handling

## Deferred Ideas

- NIP validation against GUS/VIES — future enhancement
- Duplicate invoice detection from OCR fields — separate phase
- Fine-tuning OCR on org-specific formats — future optimization
