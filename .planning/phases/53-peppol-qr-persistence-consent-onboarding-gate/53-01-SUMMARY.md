---
phase: 53-peppol-qr-persistence-consent-onboarding-gate
plan: 01
subsystem: api, database
tags: [prisma, peppol, qr-code, einvoice, uae]

requires:
  - phase: 49-peppol-pint-ae-integration
    provides: PeppolAEQRCode class, PeppolOrchestrator, PeppolQRDisplay component
provides:
  - Invoice.qrCodeBase64 Prisma field for QR code persistence
  - QR generation wired into Peppol outbound submission pipeline
affects: [peppol, invoice-detail, e-invoicing]

tech-stack:
  added: []
  patterns: [QR code generation and persistence in e-invoicing submission pipeline]

key-files:
  created: []
  modified:
    - packages/db/prisma/schema/invoice.prisma
    - packages/api/src/services/peppol-orchestrator.ts

key-decisions:
  - "QR code stored as data URI (data:image/png;base64,...) for direct img src rendering"
  - "QR generated after XML but before transmission record creation — ensures QR is persisted even if ASP transmission fails"

patterns-established:
  - "QR persistence pattern: generate QR buffer, encode as data URI, persist on invoice record"

requirements-completed: [PEPPOL-04]

duration: 3min
completed: 2026-04-12
---

# Plan 53-01: Peppol QR Persistence Summary

**Added qrCodeBase64 Text field to Invoice model and wired PeppolAEQRCode.generateQR() into outbound submission pipeline**

## Performance

- **Duration:** 3 min
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added nullable `qrCodeBase64` Text field to Invoice Prisma model
- Wired PeppolAEQRCode into PeppolOrchestrator.submitOutboundInvoice() to generate and persist QR codes
- PeppolQRDisplay on invoice detail page now has data to render (was already wired, just needed data)

## Task Commits

1. **Task 1: Add qrCodeBase64 field to Invoice model** - `cf7f881` (feat)
2. **Task 2: Wire QR generation into PeppolOrchestrator** - `65ec064` (feat)

## Files Created/Modified
- `packages/db/prisma/schema/invoice.prisma` - Added qrCodeBase64 String? @db.Text field
- `packages/api/src/services/peppol-orchestrator.ts` - Added PeppolAEQRCode import, qrCode field, generateQR() call with invoice.update persistence

## Decisions Made
- None - followed plan as specified

## Deviations from Plan
None - plan executed exactly as written

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- PEPPOL-04 requirement satisfied
- QR codes will be generated for all future Peppol outbound invoices

---
*Phase: 53-peppol-qr-persistence-consent-onboarding-gate*
*Completed: 2026-04-12*
