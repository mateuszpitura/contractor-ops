---
phase: 49
plan: 1
status: complete
started: 2026-04-11T12:50:00Z
completed: 2026-04-11T12:53:00Z
---

# Plan 49-01 Summary: Peppol-AE Profile & ASP Adapter Interface

## What Was Built

Implemented the Peppol PINT-AE country profile as the third profile in the `packages/einvoice` engine, alongside KSeF (Poland) and the planned ZATCA (Saudi Arabia) profile.

### Key Artifacts

1. **ASP Adapter Interface** (`packages/einvoice/src/asp/types.ts`) — Vendor-agnostic interface for Peppol Accredited Service Providers. Defines contracts for: participant registration, invoice transmission, webhook handling, polling, and health checks. Per D-01 from CONTEXT.md.

2. **PINT-AE Constants** (`packages/einvoice/src/profiles/peppol-ae/constants.ts`) — All UAE-specific Peppol identifiers: CustomizationID, ProfileID, UAE scheme ID (0192), document type ID, tax categories, UBL 2.1 namespace URIs.

3. **PINT-AE Schemas** (`packages/einvoice/src/profiles/peppol-ae/schemas.ts`) — Zod validation schemas for participant IDs (0192:NNNNNNNNNNNNNNN format), connection config, and transmission status.

4. **PINT-AE Generator** (`packages/einvoice/src/profiles/peppol-ae/generator.ts`) — Converts canonical EInvoice to PINT-AE compliant UBL 2.1 XML using fast-xml-parser XMLBuilder. Includes proper namespace declarations, schemeID attributes, tax breakdown, and payment means.

5. **PINT-AE Parser** (`packages/einvoice/src/profiles/peppol-ae/parser.ts`) — Parses PINT-AE UBL 2.1 XML back to canonical EInvoice. Handles TRN extraction from schemeID, minor unit conversion, and metadata mapping.

6. **PINT-AE Validator** (`packages/einvoice/src/profiles/peppol-ae/validator.ts`) — Validates PINT-AE business rules: CustomizationID match, mandatory BuyerReference, supplier TRN, tax subtotals, line amounts. Returns structured errors/warnings.

7. **QR Code Generator** (`packages/einvoice/src/profiles/peppol-ae/qr-code.ts`) — Implements QRCodeable interface. Generates 200x200 PNG containing seller name, TRN, date, total, VAT amount in pipe-delimited format. Per PEPPOL-04 and D-05.

8. **PeppolAEProfile** (`packages/einvoice/src/profiles/peppol-ae/index.ts`) — Main profile class implementing EInvoiceProfile. profileId="peppol-ae", country="AE", sign=undefined (ASP handles), qrCode=PeppolAEQRCode.

### Test Results

22 new tests, all passing. 62 total tests (including 40 existing), zero regressions.

## Decisions Made

- Used `fast-xml-parser` (already in project) for both XML generation and parsing, consistent with KSeF profile pattern
- QR code uses pipe-delimited format (simpler than ZATCA's TLV encoding) per UAE FTA requirements
- Parser extracts buyerReference and customizationId into extensions for downstream use
- Added `qrcode` npm dependency for PNG generation

## Self-Check: PASSED

- [x] PeppolAEProfile registered in engine registry
- [x] Generator produces valid PINT-AE UBL 2.1 XML
- [x] Parser roundtrip preserves all key fields
- [x] Validator catches missing mandatory fields
- [x] QR code generates valid PNG buffer
- [x] ASP adapter interface defined
- [x] All 22 tests pass
- [x] Zero regressions on existing tests

## Key Files

### Created
- `packages/einvoice/src/asp/types.ts`
- `packages/einvoice/src/profiles/peppol-ae/index.ts`
- `packages/einvoice/src/profiles/peppol-ae/generator.ts`
- `packages/einvoice/src/profiles/peppol-ae/parser.ts`
- `packages/einvoice/src/profiles/peppol-ae/validator.ts`
- `packages/einvoice/src/profiles/peppol-ae/qr-code.ts`
- `packages/einvoice/src/profiles/peppol-ae/constants.ts`
- `packages/einvoice/src/profiles/peppol-ae/schemas.ts`
- `packages/einvoice/src/__tests__/peppol-ae.test.ts`

### Modified
- `packages/einvoice/src/index.ts` — Added all Peppol-AE exports
- `packages/einvoice/package.json` — Added qrcode dependency
