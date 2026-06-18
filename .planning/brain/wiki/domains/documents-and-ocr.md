---
title: Documents and OCR
type: domain
tags: [documents, ocr, storage]
source_commit: db71d4e71ed9623787762fc87c2f22a77fb5325c
verify_with:
  - packages/api/src/routers/core/document.ts
  - packages/api/src/routers/core/ocr.ts
  - packages/api/src/services/ocr-extraction.ts
updated: 2026-06-18
---

# Documents and OCR

## Purpose

File upload/download via presigned R2 URLs, versioning, entity linking, virus scanning, and Claude OCR for invoice line items.

## Entry points

| Piece | Path |
|-------|------|
| Document router | `packages/api/src/routers/core/document.ts` |
| OCR router | `packages/api/src/routers/core/ocr.ts` |
| OCR service | `packages/api/src/services/ocr-extraction.ts` |
| Regional storage | `packages/api/src/services/regional-storage.ts` |
| UI | `apps/web-vite/src/components/documents/`, `ocr/` |

## Invariants

- Presigned URL pattern — no direct bucket exposure
- Tenant-scoped entity links
- **AI parser kill-switch → SKIPPED:** `processOcrExtraction` evaluates `killswitch.ai-invoice-parser` (org-context: `organizationId` + region resolved from `Organization.dataRegion` via `resolveOrgRegion`, default EU). When disabled — or Unleash is unreachable (`killWhenUnknown`) — it skips the Claude Vision call, leaves the upload persisted, and marks the `OcrExtraction` row `SKIPPED` (dedicated `OcrExtractionStatus` value, **not** `FAILED`) with a manual-entry `errorMessage`, no `resultJson`, and an `ocr.skipped` metric. SKIPPED is a non-error "manual entry required" state: it must not trip FAILED-handling (retry/alerts/red badge). It stays eligible for reprocessing — `ocr.retrigger` always creates a fresh `PENDING` row regardless of the prior status, so once the flag is re-enabled the next run produces a real extraction. See [[patterns/feature-flags]]
- **OcrExtractionStatus values:** `PENDING` · `PROCESSING` · `EXTRACTED` · `PARTIAL` · `FAILED` · `SKIPPED`. UI: `apps/web-vite/.../ocr/extraction-status-bar.tsx` styles SKIPPED as `info` (manual-entry), distinct from FAILED's `destructive`; the review form treats SKIPPED like no-`resultJson` (manual entry, no prefill) because `use-ocr-review.ts` classes it as neither `isProcessing` nor `isComplete`.

## Related

- [[invoice-to-payment]]
- [[integrations/neon-r2]]
- [[integrations/framework-core]]

## Verify live

```bash
semble search "presigned"
semble search "ocrRouter"
```

## Agent mistakes

- Storing files without virus scan path
- Skipping regional bucket selection
- Reusing `FAILED` for a kill-switch-disabled upload — it's `SKIPPED` (manual entry), not a failure; downstream FAILED-handling (retry/alerts/red badge) misreads it otherwise
- Excluding `SKIPPED` rows from reprocessing — retrigger creates a fresh `PENDING` row, so SKIPPED rows must stay re-runnable once the flag is back on
