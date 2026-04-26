---
phase: 45-pluggable-e-invoicing-engine-core
plan: 02
subsystem: einvoice
tags: [ksef, xml-parser, fast-xml-parser, zod, migration]

requires:
  - phase: 45-01
    provides: core types, registry, xml-utils
provides:
  - KsefProfile implementing EInvoiceProfile
  - FA(3) XML parser (migrated from integrations)
  - FA(3) XML generator (new)
  - KSeF API client (migrated from integrations)
  - KSeF Zod schemas (migrated from validators)
  - ksefToEInvoice canonical type converter
  - mapKsefToInvoiceFields Prisma model mapper
affects: [phase-48-zatca, phase-49-peppol]

tech-stack:
  added: []
  patterns: [strangler-fig-migration, profile-implementation]

key-files:
  created:
    - packages/einvoice/src/profiles/ksef/index.ts
    - packages/einvoice/src/profiles/ksef/parser.ts
    - packages/einvoice/src/profiles/ksef/generator.ts
    - packages/einvoice/src/profiles/ksef/api-client.ts
    - packages/einvoice/src/profiles/ksef/schemas.ts
    - packages/einvoice/src/profiles/ksef/mapper.ts
  modified: []

key-decisions:
  - "Full extract + refactor per D-04 (not wrapper)"
  - "KsefProfile.sign = undefined (KSeF signs server-side)"
  - "KsefProfile.qrCode = undefined (KSeF has no client-side QR)"
  - "ksefToEInvoice maps FA(3) to canonical EInvoice type"

patterns-established:
  - "Profile implementation: class extending EInvoiceProfile with generate/parse/validate"
  - "Country-specific parser stays inside profile directory"
  - "Canonical type conversion: profile-specific → EInvoice via mapper"
---

# Plan 45-02 Summary: KSeF Profile Migration

## What was built
Migrated all KSeF code from packages/integrations and packages/validators into packages/einvoice/profiles/ksef/. Created KsefProfile class implementing EInvoiceProfile. Added FA(3) XML generator for outbound invoice generation. Added ksefToEInvoice converter bridging KSeF's FA(3) structure to the canonical EInvoice type.

## Tests
- Parser tests migrated with assertions intact
- API client tests migrated with assertions intact
- New ksefToEInvoice conversion tests
- Pipeline integration test with real KsefProfile

## Self-Check: PASSED
- [x] KsefProfile implements all EInvoiceProfile methods
- [x] FA(3) parser produces validated KsefParsedInvoice
- [x] ksefToEInvoice converts to canonical type with profileId "ksef"
- [x] All tests pass
