---
phase: 48-zatca-fatoorah-integration
plan: 01
subsystem: einvoice
tags: [zatca, ubl-2.1, xml, prisma, zod, saudi-arabia, e-invoicing]

# Dependency graph
requires:
  - phase: 45-pluggable-e-invoicing-engine-core
    provides: EInvoiceProfile interface, Signable/QRCodeable hooks, engine registry
provides:
  - ZatcaProfile class implementing EInvoiceProfile
  - UBL 2.1 XML generator with ZATCA extensions (ICV, PIH, UUID, ProfileID)
  - UBL 2.1 XML parser extracting ZATCA-specific fields
  - ZatcaInvoiceChain Prisma model with sequential chain tracking
  - ZatcaSubmissionStatus enum
  - Zod schemas for ZATCA tax details, CSR attributes, invoice fields, environment
  - ZATCA TypeScript types (ZatcaTlvTag, ZatcaInvoiceType, ZatcaInvoiceSubtype)
affects: [48-02-xades-signing, 48-03-tlv-qr-code, 48-04-device-onboarding, 48-05-submission-pipeline]

# Tech tracking
tech-stack:
  added: []
  patterns: [ZATCA UBL 2.1 XML generation with AdditionalDocumentReference for ICV/PIH, profileId-based clearance/reporting ProfileID selection]

key-files:
  created:
    - packages/einvoice/src/profiles/zatca/index.ts
    - packages/einvoice/src/profiles/zatca/generator.ts
    - packages/einvoice/src/profiles/zatca/parser.ts
    - packages/einvoice/src/profiles/zatca/compliance.ts
    - packages/einvoice/src/profiles/zatca/schemas.ts
    - packages/einvoice/src/profiles/zatca/types.ts
    - packages/db/prisma/schema/zatca.prisma
    - packages/validators/src/zatca.ts
    - packages/einvoice/src/__tests__/zatca.test.ts
    - packages/db/src/__tests__/zatca-schema.test.ts
  modified:
    - packages/db/prisma/schema/integration.prisma
    - packages/db/prisma/schema/invoice.prisma
    - packages/db/prisma/schema/organization.prisma
    - packages/einvoice/src/index.ts
    - packages/validators/src/index.ts

key-decisions:
  - "ZATCA simplified invoices use ProfileID reporting:1.0, standard use clearance:1.0"
  - "PIH stored as hex SHA-256, Base64-encoded when embedded in XML AdditionalDocumentReference"
  - "ZatcaProfile.sign and qrCode left as undefined -- wired by Plan 02 and Plan 03 respectively"

patterns-established:
  - "ZATCA UBL 2.1 generation via fast-xml-parser XMLBuilder with namespace prefixes (cbc, cac, ext, sig, sac, ds, xades)"
  - "ZATCA invoice extensions pattern: invoiceType/invoiceSubtype/icv/pih/uuid in EInvoice.extensions"

requirements-completed: [ZATCA-01, ZATCA-04]

# Metrics
duration: 10min
completed: 2026-04-11
---

# Phase 48 Plan 01: ZATCA Foundation Summary

**ZATCA country profile with UBL 2.1 XML generator, Prisma chain model, and Zod validation schemas for Saudi e-invoicing**

## Performance

- **Duration:** 10 min
- **Started:** 2026-04-11T12:35:56Z
- **Completed:** 2026-04-11T12:45:47Z
- **Tasks:** 2
- **Files modified:** 15

## Accomplishments
- ZatcaProfile class implementing EInvoiceProfile, plugged into engine registry without modifying core
- UBL 2.1 XML generator producing ZATCA-compliant invoices with ICV, PIH, UUID, ProfileID, InvoiceTypeCode with subtype @name attribute
- ZatcaInvoiceChain Prisma model with @@unique([organizationId, icv]) for sequential chain integrity
- Comprehensive Zod schemas validating Saudi VAT numbers, CSR attributes, and invoice fields

## Task Commits

Each task was committed atomically:

1. **Task 1: Prisma schema** - `3b088e3` (test) + `128fc1c` (feat)
2. **Task 2: ZATCA profile, generator, parser, schemas** - `fdad9bd` (test) + `ea0e067` (feat)

_TDD tasks have RED (test) + GREEN (feat) commits._

## Files Created/Modified
- `packages/db/prisma/schema/zatca.prisma` - ZatcaInvoiceChain model and ZatcaSubmissionStatus enum
- `packages/einvoice/src/profiles/zatca/index.ts` - ZatcaProfile class implementing EInvoiceProfile
- `packages/einvoice/src/profiles/zatca/generator.ts` - UBL 2.1 XML generator with ZATCA extensions
- `packages/einvoice/src/profiles/zatca/parser.ts` - XML parser extracting ICV, PIH, UUID from AdditionalDocumentReference
- `packages/einvoice/src/profiles/zatca/compliance.ts` - Compliance status computation with certificate expiry
- `packages/einvoice/src/profiles/zatca/schemas.ts` - Zod schemas for tax details, CSR, invoice fields, environment
- `packages/einvoice/src/profiles/zatca/types.ts` - TypeScript types including ZatcaTlvTag enum
- `packages/validators/src/zatca.ts` - Re-exports ZATCA schemas from einvoice
- `packages/db/prisma/schema/integration.prisma` - ZATCA added to IntegrationProvider enum
- `packages/db/prisma/schema/invoice.prisma` - zatcaChainEntry relation added
- `packages/db/prisma/schema/organization.prisma` - zatcaChainEntries relation added
- `packages/einvoice/src/index.ts` - ZATCA exports and registerZatcaProfile function
- `packages/validators/src/index.ts` - ZATCA schema exports

## Decisions Made
- ZATCA simplified invoices use ProfileID "reporting:1.0", standard invoices use "clearance:1.0" -- following ZATCA spec
- PIH (Previous Invoice Hash) stored as 64-char hex string internally, Base64-encoded when embedded in XML
- ZatcaProfile.sign and qrCode capabilities left as undefined -- Plan 02 wires XAdES signer, Plan 03 wires TLV QR code generator
- Used fast-xml-parser XMLBuilder (already in einvoice dependencies) rather than xmlbuilder2 -- consistent with existing KSeF and Peppol-AE generators

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Worktree node_modules resolution required symlink setup for einvoice and validators packages -- standard worktree environment issue, resolved with proper symlinks.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all generated XML contains real data from EInvoice model. Signature placeholder in UBLExtensions is intentional (Plan 02 fills it).

## Next Phase Readiness
- ZatcaProfile is ready for Plan 02 (XAdES signing) to wire the Signable capability
- ZatcaProfile is ready for Plan 03 (TLV QR code) to wire the QRCodeable capability
- ZatcaInvoiceChain model is ready for Plan 05 (submission pipeline) to track invoice chain state
- Generator output is ready for Plan 02 to sign via enveloped XAdES in UBLExtensions

---
*Phase: 48-zatca-fatoorah-integration*
*Completed: 2026-04-11*
