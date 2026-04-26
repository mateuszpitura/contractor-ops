---
phase: 48-zatca-fatoorah-integration
plan: 03
subsystem: einvoice
tags: [zatca, qr-code, tlv, binary-encoding, qrcode-npm]

# Dependency graph
requires:
  - phase: 45-pluggable-e-invoicing-engine-core
    provides: QRCodeable interface, EInvoice model
provides:
  - ZatcaTLVQRCode class implementing QRCodeable for ZATCA invoices
  - encodeTLV/decodeTLV binary encoding utilities
  - TLV tags 1-8 support (B2C and B2B)
affects: [48-zatca-fatoorah-integration]

# Tech tracking
tech-stack:
  added: []
  patterns: [TLV binary encoding with BER-style multi-byte lengths]

key-files:
  created:
    - packages/einvoice/src/profiles/zatca/qr-code.ts
    - packages/einvoice/src/profiles/zatca/__tests__/qr-code.test.ts
  modified: []

key-decisions:
  - "Used BER-style length encoding (0x81/0x82 prefixes) for TLV values > 127 bytes"
  - "qrcode dependency already present — no package.json changes needed"

patterns-established:
  - "TLV encoder/decoder pattern: encodeTLV/decodeTLV as standalone exported utilities"
  - "B2B crypto tags (6-8) conditionally included based on extensions presence"

requirements-completed: [ZATCA-03]

# Metrics
duration: 3min
completed: 2026-04-11
---

# Phase 48 Plan 03: ZATCA TLV QR Code Summary

**TLV-encoded QR code generation for ZATCA invoices with binary Tag-Length-Value encoding, B2C/B2B tag support, and PNG output via qrcode**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-11T23:22:59Z
- **Completed:** 2026-04-11T23:26:05Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- ZatcaTLVQRCode class implementing QRCodeable with full TLV binary encoding
- encodeTLV/decodeTLV utilities supporting multi-byte lengths (BER-style 0x81/0x82)
- Tags 1-5 for B2C simplified invoices, tags 6-8 conditionally for B2B standard invoices
- DoS protection rejecting supplier names > 1000 characters
- 16 tests passing covering encoding, decoding, roundtrip, PNG output, and parseQR

## Task Commits

Each task was committed atomically:

1. **Task 1: Install qrcode dependency** - skipped (already installed)
2. **Task 2 RED: TLV encoder/decoder tests** - `5205918` (test)
3. **Task 2 GREEN: ZatcaTLVQRCode implementation** - `b8b5a8f` (feat)

## Files Created/Modified
- `packages/einvoice/src/profiles/zatca/qr-code.ts` - ZatcaTLVQRCode class, encodeTLV, decodeTLV utilities
- `packages/einvoice/src/profiles/zatca/__tests__/qr-code.test.ts` - 16 unit tests for TLV encoding and QR generation

## Decisions Made
- Used BER-style length encoding (0x81 for 128-255 bytes, 0x82 for 256+ bytes) matching ASN.1 conventions for multi-byte TLV values
- qrcode and @types/qrcode already in package.json from prior work, no installation needed

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all functionality is fully wired.

## Issues Encountered
- Pre-existing TypeScript errors in signer.ts (missing DOM `Element` type) - out of scope, not related to QR code changes

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- QRCodeable implementation ready to be wired into ZATCA profile's `qrCode` capability
- encodeTLV/decodeTLV available for any other TLV needs in the ZATCA pipeline

## Self-Check: PASSED

- All created files exist on disk
- All commit hashes found in git log

---
*Phase: 48-zatca-fatoorah-integration*
*Completed: 2026-04-11*
