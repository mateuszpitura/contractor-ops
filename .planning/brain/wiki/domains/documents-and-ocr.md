---
title: Documents and OCR
type: domain
tags: [documents, ocr, storage]
source_commit: e0d533fa
verify_with:
  - packages/api/src/routers/core/document.ts
  - packages/api/src/routers/core/ocr.ts
  - packages/api/src/services/ocr-extraction.ts
  - packages/api/src/services/document-virus-scan.ts
  - apps/cron-worker/src/jobs/handlers/document-virus-scan-reconcile.ts
updated: 2026-07-10
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
- **Callback idempotency (compare-and-swap claim):** `processOcrExtraction` claims work with `ocrExtraction.updateMany({ where: { id, status: 'PENDING' }, data: { status: 'PROCESSING' } })` and aborts (early return, no extraction) when `count === 0`. A QStash redelivery of an already-processed job (`EXTRACTED`/`FAILED`/`SKIPPED`/in-flight `PROCESSING`) therefore claims nothing — no second Claude Vision spend, and a completed `resultJson` is never clobbered back to `PROCESSING`. `triggerOcrExtraction` also sets a stable QStash `deduplicationId` (`ocr-extraction:<extractionId>`) as a first-line dedup. Credits are deducted once at trigger (`checkAndDeductCredit`), never in the callback. Retriggers create a fresh `PENDING` row, so genuine re-runs are unaffected by the CAS gate.
- **Regional download in callback:** PDF fetch uses `createRegionalPresignedDownloadUrl(storageKey, 900, region)` where `region` comes from `resolveOrgRegion(organizationId)` — never the default EU bucket when the org is ME-hosted.
- **Virus-scan reconcile cron:** `document-virus-scan-reconcile` (`*/5`) re-schedules `Document` rows stuck in `virusScanStatus` `PENDING`/`FAILED` longer than 10 min — backstop for the fire-and-forget `scheduleDocumentVirusScan` in `confirmUpload` when a pod dies mid-scan.
- **Virus scan streams the FULL object:** `packages/api/src/services/document-virus-scan.ts` fetches the whole object from R2 (un-ranged GetObject) and streams it to ClamAV. The 4KB ranged read exists only for MIME sniffing — scanning must never reuse the sniff buffer, because a ranged read scans only the first bytes and passes malware appended later in the file.
- **Upload-review errors are coded + translated:** the web-vite upload-review hook (`apps/web-vite/src/components/contractors/compliance/hooks/use-upload-review.ts`) toasts `translateError(err)` in both mutation handlers, so coded errors like `documentScanPending` / `documentInfected` render translated instead of a generic toast.
- **OCR credit ordering:** `triggerOcrExtraction` validates org-scoped `Document` + `storageKey` before `checkAndDeductCredit` — foreign/missing docs do not burn credits.

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
- Scanning the 4KB MIME-sniff buffer instead of streaming the full object to ClamAV — appended malware passes
- Toasting a generic message on upload-review mutation errors — route through `translateError` so coded errors stay translated
- Reusing `FAILED` for a kill-switch-disabled upload — it's `SKIPPED` (manual entry), not a failure; downstream FAILED-handling (retry/alerts/red badge) misreads it otherwise
- Excluding `SKIPPED` rows from reprocessing — retrigger creates a fresh `PENDING` row, so SKIPPED rows must stay re-runnable once the flag is back on
