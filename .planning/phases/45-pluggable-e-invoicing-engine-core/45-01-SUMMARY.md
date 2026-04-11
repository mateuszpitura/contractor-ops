---
phase: 45-pluggable-e-invoicing-engine-core
plan: 01
subsystem: einvoice
tags: [typescript, zod, vitest, monorepo]

requires: []
provides:
  - packages/einvoice package shell with tsconfig, vitest
  - EInvoice, EInvoiceProfile, Signable, QRCodeable core types
  - Profile registry (register/get/list/clear)
  - EInvoiceEngine orchestrator class
  - Zod schemas for runtime validation
  - dig() and toMinorUnits() XML utilities
affects: [phase-46-multi-currency, phase-48-zatca, phase-49-peppol]

tech-stack:
  added: ["@contractor-ops/einvoice"]
  patterns: [profile-registry-pattern, capability-hook-pattern]

key-files:
  created:
    - packages/einvoice/package.json
    - packages/einvoice/src/types/invoice.ts
    - packages/einvoice/src/types/profile.ts
    - packages/einvoice/src/types/compliance.ts
    - packages/einvoice/src/types/validation.ts
    - packages/einvoice/src/registry.ts
    - packages/einvoice/src/engine/engine.ts
    - packages/einvoice/src/engine/xml-utils.ts
    - packages/einvoice/src/schemas/invoice.ts
  modified: []

key-decisions:
  - "Separate package (packages/einvoice) per D-01"
  - "Static Map-based registry per D-02"
  - "Core invoice model ~15-20 fields per D-06"
  - "Capability hooks (Signable, QRCodeable) as optional interface fields per D-07"

patterns-established:
  - "Profile registry: registerProfile/getProfile/listProfiles for country profiles"
  - "EInvoice canonical type: country-agnostic invoice model all profiles map to/from"
  - "Capability detection: profile.sign/profile.qrCode undefined = not supported"
---

# Plan 45-01 Summary: E-Invoicing Package Shell, Core Types & Registry

## What was built
Created the `packages/einvoice` package with all core infrastructure for the pluggable e-invoicing engine. Defines the EInvoiceProfile interface that country profiles implement, the profile registry for runtime registration, and the EInvoiceEngine class that delegates operations to profiles.

## Tests
- 5 registry tests (register, get, list, clear, duplicate detection)
- 6 engine tests (generate, parse, validate, compliance, multi-profile, error handling)
- 7 xml-utils tests (dig navigation, toMinorUnits conversion edge cases)

## Self-Check: PASSED
- [x] EInvoiceProfile interface defined with generate/parse/validate/getComplianceStatus
- [x] Registry supports register/get/list operations
- [x] Engine delegates to correct profiles
- [x] Package compiles without errors
