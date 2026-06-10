---
title: Documents and OCR
type: domain
tags: [documents, ocr, storage]
source_commit: 70f5782d78e33ba98c82e4ccda2cd4b0b4aff216
verify_with:
  - packages/api/src/routers/core/document.ts
  - packages/api/src/routers/core/ocr.ts
updated: 2026-06-09
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
