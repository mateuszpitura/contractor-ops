---
phase: 49-peppol-pint-ae-integration
plan: 05
subsystem: ui
tags: [peppol, tRPC, react, pint-ae, compliance, invoice-detail]

# Dependency graph
requires:
  - phase: 49-04
    provides: "4 orphaned Peppol UI components (PeppolTransmissionStatus, PeppolInboundBanner, PeppolQRDisplay, PeppolComplianceWidget)"
provides:
  - "All 4 Peppol UI components wired into target pages"
  - "getTransmissionByInvoiceId tRPC endpoint for invoice-level Peppol data"
  - "Peppol compliance row in dashboard compliance widget"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Conditional Peppol component rendering based on invoice source and transmission direction"
    - "Sender data derived from invoice model (sellerName/sellerTaxId) not transmission participant"

key-files:
  created: []
  modified:
    - packages/validators/src/peppol.ts
    - packages/validators/src/index.ts
    - packages/api/src/routers/peppol.ts
    - apps/web/src/app/[locale]/(dashboard)/invoices/[id]/page.tsx
    - apps/web/src/components/einvoice/compliance-widget.tsx

key-decisions:
  - "Sender info for PeppolInboundBanner comes from invoice.sellerTaxId/sellerName, not transmission participant (which is our org's receiver)"
  - "PeppolQRDisplay wired but will not render until qrCodeBase64 field is added to Invoice model"
  - "Peppol compliance state derived from participant status enum mapping"

patterns-established:
  - "Invoice source=PEPPOL indicates inbound Peppol invoice"
  - "Transmission direction=OUTBOUND indicates locally-created invoice sent via Peppol"

requirements-completed: [PEPPOL-01, PEPPOL-02, PEPPOL-03, PEPPOL-04]

# Metrics
duration: 3min
completed: 2026-04-12
---

# Phase 49 Plan 05: Wire Orphaned Peppol UI Components Summary

**4 Peppol UI components wired into invoice detail page and dashboard compliance widget via new getTransmissionByInvoiceId endpoint**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-12T00:01:31Z
- **Completed:** 2026-04-12T00:04:31Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Wired PeppolTransmissionStatus, PeppolInboundBanner, and PeppolQRDisplay into the invoice detail page with correct conditional rendering
- Added getTransmissionByInvoiceId tRPC endpoint with Prisma participant include for invoice-level Peppol data
- Wired PeppolComplianceWidget into EInvoiceComplianceWidget dashboard card with state derived from participant status

## Task Commits

Each task was committed atomically:

1. **Task 1: Add getTransmissionByInvoiceId endpoint and wire 3 Peppol components into invoice detail page** - `cbde2c5` (feat)
2. **Task 2: Wire PeppolComplianceWidget into dashboard compliance widget** - `7d07459` (feat)

## Files Created/Modified
- `packages/validators/src/peppol.ts` - Added getTransmissionByInvoiceIdSchema with cuid invoiceId input
- `packages/validators/src/index.ts` - Exported new schema and type
- `packages/api/src/routers/peppol.ts` - Added getTransmissionByInvoiceId query with participant include
- `apps/web/src/app/[locale]/(dashboard)/invoices/[id]/page.tsx` - Imported and conditionally rendered 3 Peppol components
- `apps/web/src/components/einvoice/compliance-widget.tsx` - Added Peppol compliance row with status query

## Decisions Made
- Sender info for PeppolInboundBanner uses invoice.sellerTaxId as senderParticipantId and invoice.sellerName as senderName. The transmission's participant relation points to our org's receiver, not the external sender.
- PeppolQRDisplay is wired but will not render until a qrCodeBase64 field is added to the Invoice model. The component itself returns null for falsy qrCodeBase64.
- Peppol compliance state is derived from PeppolParticipant.status: ACTIVE -> "active", PENDING/REGISTERED -> "onboarding", SUSPENDED -> "suspended", others -> "error".

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

- `invoice.qrCodeBase64` - Field does not exist on the Invoice Prisma model. PeppolQRDisplay is wired but the condition `invoice.qrCodeBase64` will always be falsy until the field is added. This is intentional - the component is ready for when QR code generation is implemented in a future plan.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 4 previously-orphaned Peppol UI components are now wired into their target pages
- Phase 49 verification gaps (4/16 failing truths) should now be resolved
- QR code display ready for future Invoice model extension

## Self-Check: PASSED

All files exist. All commits verified (cbde2c5, 7d07459).

---
*Phase: 49-peppol-pint-ae-integration*
*Completed: 2026-04-12*
