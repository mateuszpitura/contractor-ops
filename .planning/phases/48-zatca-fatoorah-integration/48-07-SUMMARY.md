---
phase: 48-zatca-fatoorah-integration
plan: 07
subsystem: api
tags: [zatca, xades, qr-code, ubl, xml-signing, einvoice, trpc]

requires:
  - phase: 48-zatca-fatoorah-integration (plans 01-06)
    provides: ZatcaProfile, ZatcaXAdESSigner, ZatcaTLVQRCode, submission service skeleton, hash chain, tRPC router
provides:
  - Fully wired ZATCA submission pipeline with real XML generation, XAdES signing, and QR code
  - getStatus tRPC query returning invoiceHash and previousHash for UI display
affects: [zatca-submission, zatca-ui, zatca-compliance]

tech-stack:
  added: []
  patterns: [buildEInvoiceFromPrisma helper for Prisma-to-EInvoice mapping]

key-files:
  created: []
  modified:
    - packages/api/src/services/zatca-submission.ts
    - packages/api/src/routers/zatca.ts

key-decisions:
  - "Invoice type code 388 (tax invoice) used for all ZATCA submissions"
  - "QR EInvoice enriched with invoiceHash, signatureValue, publicKey for TLV encoding"

patterns-established:
  - "buildEInvoiceFromPrisma: converts Prisma invoice with relations to canonical EInvoice type"

requirements-completed: [ZATCA-05, ZATCA-07]

duration: 3min
completed: 2026-04-12
---

# Phase 48 Plan 07: Wire ZATCA Submission Pipeline Summary

**Real ZATCA UBL 2.1 XML generation, XAdES-BES signing, TLV QR code generation, and SHA-256 hash computation replacing placeholder XML in submitToZatca()**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-12T09:42:27Z
- **Completed:** 2026-04-12T09:45:33Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Replaced placeholder `<Invoice>${invoiceId}</Invoice>` with full ZATCA pipeline: ZatcaProfile.generate() for UBL 2.1, profile.sign.sign() for XAdES-BES, profile.qrCode.generateQR() for TLV QR
- Added buildEInvoiceFromPrisma helper that maps Prisma invoice records (with lines, contractor) to canonical EInvoice type
- Added invoiceHash and previousHash fields to getStatus tRPC query for UI hash chain display
- Retrieved ZATCA private key from Infisical secret store for XAdES signing

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace placeholder XML with real ZATCA pipeline in submitToZatca()** - `a95a71d` (feat)
2. **Task 2: Add invoiceHash and previousHash to getStatus tRPC query select** - `49c9c2d` (feat)

## Files Created/Modified
- `packages/api/src/services/zatca-submission.ts` - Full ZATCA pipeline: EInvoice building, XML generation, XAdES signing, QR code, SHA-256 hash
- `packages/api/src/routers/zatca.ts` - Added invoiceHash and previousHash to getStatus select

## Decisions Made
- Used invoice type code "388" (tax invoice) as default for all ZATCA submissions
- Enriched QR EInvoice with invoiceHash, signatureValue (full signed XML), and publicKey for TLV field encoding
- Default zatcaSubtype "0100000" (standard B2B) when metadata doesn't specify

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all pipeline steps produce real data from actual invoice records.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- ZATCA-05 (clearance) and ZATCA-07 (reporting) are now unblocked
- Submission pipeline generates valid UBL 2.1 XML ready for ZATCA API
- Hash chain integrity maintained with real SHA-256 hashes

---
*Phase: 48-zatca-fatoorah-integration*
*Completed: 2026-04-12*
